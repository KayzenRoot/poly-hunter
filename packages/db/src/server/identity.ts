import { Pool } from "pg";
import type { PlatformRole, VerifiedIdentity } from "@polyhunter/contracts";

if (typeof window !== "undefined") {
  throw new TypeError(
    "@polyhunter/db/server/identity cannot be imported by a browser bundle.",
  );
}

export class IdentityDataAccessOptionsError extends Error {
  constructor() {
    super("DATABASE_URL is required for server-side identity data access.");
    this.name = "IdentityDataAccessOptionsError";
  }
}

export interface IdentityDataAccessOptions {
  readonly connectionString?: string;
  readonly maxConnections?: number;
}

/** Authoritative internal user resolved server-side from a verified provider identity. */
export type InternalIdentity = Readonly<{
  userId: string;
  userStatus: "active" | "suspended";
}>;

export type IdentityDataAccess = Readonly<{
  /**
   * Resolves the verified provider subject to the authoritative internal user,
   * provisioning user + identity_link transactionally and idempotently. A
   * duplicate provider subject never creates a second internal user; a racing
   * insert loses and re-reads the winner inside the same transaction.
   */
  readonly resolveInternalIdentity: (
    identity: VerifiedIdentity,
  ) => Promise<InternalIdentity | null>;
  /**
   * Reads the authoritative platform role for an internal user. Platform
   * authority comes only from persisted platform_roles rows (user active) —
   * never from provider metadata or client input.
   */
  readonly resolvePlatformRole: (
    userId: string,
  ) => Promise<PlatformRole | null>;
  readonly close: () => Promise<void>;
}>;

const PROVIDER_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createIdentityDataAccess(
  options: IdentityDataAccessOptions = {},
): IdentityDataAccess {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new IdentityDataAccessOptionsError();
  }

  const pool = new Pool({
    connectionString,
    max: options.maxConnections ?? 10,
    application_name: "polyhunter-identity",
  });

  async function readInternalUser(
    userId: string,
  ): Promise<InternalIdentity | null> {
    const row = await pool.query<{ id: string; status: string }>(
      "SELECT id, status::text AS status FROM users WHERE id = $1",
      [userId],
    );
    if (row.rowCount === 0) {
      return null;
    }
    const found = row.rows[0];
    if (!found) {
      return null;
    }
    const status = found.status === "suspended" ? "suspended" : "active";
    return { userId: found.id, userStatus: status };
  }

  async function resolveInternalIdentity(
    identity: VerifiedIdentity,
  ): Promise<InternalIdentity | null> {
    if (
      !PROVIDER_PATTERN.test(identity.provider) ||
      identity.subject.length === 0 ||
      identity.subject.length > 255 ||
      identity.subject.trim() !== identity.subject ||
      /\s/.test(identity.subject)
    ) {
      return null;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize concurrent provisioning of the same provider subject: lock
      // the winning identity_link row (or insert it) before touching users.
      const existingLink = await client.query<{ user_id: string }>(
        "SELECT user_id FROM identity_links WHERE provider = $1 AND subject = $2 FOR UPDATE",
        [identity.provider, identity.subject],
      );

      if (existingLink.rowCount === 0) {
        const insertedUser = await client.query<{ id: string }>(
          "INSERT INTO users (id, status, created_at, updated_at) VALUES (gen_random_uuid(), 'active', now(), now()) RETURNING id",
        );
        const userId = insertedUser.rows[0]?.id ?? "";
        let lostRace = false;
        try {
          await client.query(
            "INSERT INTO identity_links (user_id, provider, subject) VALUES ($1, $2, $3)",
            [userId, identity.provider, identity.subject],
          );
        } catch (error) {
          // Unique (provider, subject) violation (SQLSTATE 23505): another
          // transaction won the race. The transaction is aborted now; roll
          // back and re-read the winner on a fresh transaction.
          if (
            error instanceof Error &&
            (error as { code?: string }).code === "23505"
          ) {
            lostRace = true;
            await client.query("ROLLBACK");
          } else {
            throw error;
          }
        }
        if (lostRace) {
          const winner = await pool.query<{ user_id: string }>(
            "SELECT user_id FROM identity_links WHERE provider = $1 AND subject = $2",
            [identity.provider, identity.subject],
          );
          const reusedId = winner.rows[0]?.user_id ?? "";
          return await readInternalUser(reusedId);
        }
        await client.query("COMMIT");
        return { userId, userStatus: "active" as const };
      }

      const userId = existingLink.rows[0]?.user_id ?? "";
      await client.query("COMMIT");
      return await readInternalUser(userId);
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // rollback after a server-side abort is a no-op
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function resolvePlatformRole(
    userId: string,
  ): Promise<PlatformRole | null> {
    if (!UUID_PATTERN.test(userId)) {
      return null;
    }
    const result = await pool.query<{ role: string }>(
      `SELECT pr.role::text AS role
       FROM platform_roles pr
       INNER JOIN users u ON u.id = pr.user_id
       WHERE pr.user_id = $1 AND u.status = 'active'
       ORDER BY pr.created_at ASC
       LIMIT 1`,
      [userId],
    );
    const role = result.rows[0]?.role;
    return role === "platform_admin" ? "platform_admin" : null;
  }

  return {
    resolveInternalIdentity,
    resolvePlatformRole,
    close: async () => {
      await pool.end();
    },
  };
}
