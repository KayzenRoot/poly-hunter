import type { Pool } from "pg";

/**
 * Disposable-database lifecycle helpers for the PostgreSQL integration suites.
 *
 * PH-M01-WO-002 CR-05. The teardown must be deterministic: closing a `pg` pool
 * resolves once every client has been told to end, but the socket teardown is
 * asynchronous, so the server-side backend can still be present for a short
 * window afterwards. Dropping the database inside that window terminated a
 * backend that was already on its way out, and the dying client surfaced
 * `57P01 terminating connection due to administrator command` as an unhandled
 * error even though every assertion had passed.
 *
 * The rule this module enforces: wait until PostgreSQL reports zero backends on
 * the database, then drop it WITHOUT `WITH (FORCE)`. `FORCE` is only used by
 * `preflightDropStaleDatabase`, which exists to clear debris from a previously
 * interrupted run before the suite starts. If the wait times out, that is a real
 * resource leak and is reported as one, with the offending backends named.
 */

const DATABASE_NAME_PATTERN = /^phm01_[0-9a-f]{32}$/;

export function quoteGeneratedIdentifier(identifier: string): string {
  if (!DATABASE_NAME_PATTERN.test(identifier)) {
    throw new Error(
      "Refusing to use an unexpected integration database identifier.",
    );
  }
  return `"${identifier}"`;
}

export type BackendSnapshot = {
  pid: number;
  application_name: string | null;
  state: string | null;
  backend_type: string | null;
  query: string | null;
};

async function backendsOn(
  admin: Pool,
  databaseName: string,
): Promise<BackendSnapshot[]> {
  const result = await admin.query<{
    pid: number;
    application_name: string | null;
    state: string | null;
    backend_type: string | null;
    query: string | null;
  }>(
    "SELECT pid, application_name, state, backend_type, query FROM pg_stat_activity WHERE datname = $1 ORDER BY pid",
    [databaseName],
  );
  return result.rows;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Block until PostgreSQL reports no backend attached to `databaseName`.
 *
 * Throws a RESOURCE LEAK error — naming every backend that is still connected —
 * if the wait expires. It never falls back to terminating the connections.
 */
export async function waitForNoBackends(
  admin: Pool,
  databaseName: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: BackendSnapshot[] = [];
  for (;;) {
    last = await backendsOn(admin, databaseName);
    if (last.length === 0) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `RESOURCE LEAK: ${last.length} backend(s) still connected to ${databaseName} ` +
          `after every owned pool was closed; refusing to drop the database with FORCE. ` +
          `Backends: ${JSON.stringify(last)}`,
      );
    }
    await sleep(50);
  }
}

/**
 * Normal post-test teardown. Every pool this fixture owns must already be closed
 * and awaited by the caller; this then waits for the server to observe their
 * backends gone and drops the database with an ordinary statement.
 */
export async function dropDisposableDatabase(
  admin: Pool,
  databaseName: string,
): Promise<void> {
  await waitForNoBackends(admin, databaseName);
  await admin.query(
    `DROP DATABASE IF EXISTS ${quoteGeneratedIdentifier(databaseName)}`,
  );
}

/**
 * Setup-only cleanup of a database left behind by a previously interrupted run.
 *
 * `WITH (FORCE)` is confined to this preflight path on purpose: at preflight
 * there is no live owner to leak from, and a stale database may have been left
 * with backends attached by whatever process died. It is never used to tear down
 * a database this run created.
 */
export async function preflightDropStaleDatabase(
  admin: Pool,
  databaseName: string,
): Promise<void> {
  await admin.query(
    `DROP DATABASE IF EXISTS ${quoteGeneratedIdentifier(databaseName)} WITH (FORCE)`,
  );
}
