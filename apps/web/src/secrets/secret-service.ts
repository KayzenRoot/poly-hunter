import type {
  SecretHandle,
  SecretMetadata,
  TenantContext,
} from "@polyhunter/domain";
import type { RotateOutcome, SecretVault } from "@polyhunter/db/server/vault";
import {
  ACTIVE_KEY_VERSION_ENV,
  createSecretVault,
  KEYRING_JSON_ENV,
} from "@polyhunter/db/server/vault";
import { createWebIdentityService } from "@/identity/session-service";

/**
 * PH-M01-WO-003 — web-boundary secret vault application service.
 *
 * This is the only place where the authenticated session, the authoritative
 * TenantContext and the vault meet. Route Handlers depend on the narrow
 * structural contract declared here, never on the Supabase graph, the keyring
 * or the database, which is what keeps them unit-testable without a provider.
 *
 * Order of authority for every operation:
 *   1. a VERIFIED server-side identity (`resolveSession`);
 *   2. a FRESHLY resolved TenantContext from the authoritative membership row
 *      (`resolveTenantContext`) — the client tenant selector is a selector, not
 *      proof;
 *   3. the vault's own capability + membership check.
 *
 * Note the keyring is read from the environment INSIDE the vault, never here,
 * and neither variable is `NEXT_PUBLIC_*`: Next.js inlines `NEXT_PUBLIC_*`
 * into the browser bundle, so a key under that prefix would ship to clients no
 * matter how careful the import graph is.
 */

export type SecretSessionService = Readonly<{
  resolveSession: () => Promise<
    | {
        readonly kind: "authenticated";
        readonly userId: string;
        readonly platformAdmin: boolean;
      }
    | { readonly kind: "unauthenticated"; readonly reason: string }
  >;
  resolveTenantContext: (authenticatedUserId: string) => Promise<
    | {
        readonly kind: "resolved";
        readonly tenantId: string;
        readonly role: string;
      }
    | { readonly kind: "unresolved"; readonly reason: string }
  >;
}>;

export type WebSecretServiceOptions = Readonly<{
  connectionString?: string;
  environment?: Readonly<Record<string, string | undefined>>;
}>;

export type SecretAccess =
  | { readonly ok: true; readonly context: TenantContext }
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: string;
      readonly reason: string;
    };

/**
 * Resolve the authoritative tenant context for the current request, or an
 * explicit refusal. `platform_admin` is NOT consulted here and never mints a
 * TenantContext: platform authority is separate from tenant authority, and a
 * platform administrator with no active membership in the tenant is refused
 * exactly like any other unaffiliated user.
 */
export async function resolveSecretAccess(
  session: SecretSessionService,
): Promise<SecretAccess> {
  const resolvedSession = await session.resolveSession();
  if (resolvedSession.kind === "unauthenticated") {
    return {
      ok: false,
      status: 401,
      error: "unauthenticated",
      reason: resolvedSession.reason,
    };
  }

  const resolution = await session.resolveTenantContext(resolvedSession.userId);
  if (resolution.kind === "unresolved") {
    return {
      ok: false,
      status: 403,
      error: "tenant_context_unavailable",
      reason: resolution.reason,
    };
  }

  return {
    ok: true,
    context: Object.freeze({
      userId: resolvedSession.userId,
      tenantId: resolution.tenantId,
      role: resolution.role,
    }) as TenantContext,
  };
}

export type WebSecretService = Readonly<{
  /** Non-sensitive: true when a valid keyring is configured. Never exposes key material. */
  isConfigured: () => boolean;
  resolveAccess: () => Promise<SecretAccess>;
  listMetadata: (context: TenantContext) => Promise<SecretMetadata[]>;
  getMetadata: (
    context: TenantContext,
    secretId: string,
  ) => Promise<SecretMetadata | null>;
  create: (
    context: TenantContext,
    input: Readonly<{ purpose: string; secret: string }>,
  ) => Promise<SecretMetadata>;
  replace: (
    context: TenantContext,
    secretId: string,
    input: Readonly<{ secret: string }>,
  ) => Promise<SecretMetadata>;
  remove: (context: TenantContext, secretId: string) => Promise<void>;
  rotate: (context: TenantContext, secretId: string) => Promise<RotateOutcome>;
  withDecryptedSecret: <TValue>(
    context: TenantContext,
    handle: SecretHandle,
    callback: (plaintext: Buffer) => TValue | Promise<TValue>,
  ) => Promise<TValue>;
}>;

export function createWebSecretService(
  options: WebSecretServiceOptions = {},
): WebSecretService {
  // Lazy singletons scoped to this service instance, mirroring the identity
  // service. No module-level mutable state: two requests never share a handle
  // to a keyring or a pool through module scope.
  let vault: SecretVault | null = null;
  const identityService = createWebIdentityService(
    options.connectionString === undefined
      ? {}
      : { connectionString: options.connectionString },
  );
  const environment = options.environment ?? process.env;

  function getVault(): SecretVault {
    if (!vault) {
      vault = createSecretVault({
        ...(options.connectionString === undefined
          ? {}
          : { connectionString: options.connectionString }),
        keyring: {
          activeKeyVersion: environment[ACTIVE_KEY_VERSION_ENV],
          keyringJson: environment[KEYRING_JSON_ENV],
        },
      });
    }
    return vault;
  }

  return {
    isConfigured: () => getVault().isConfigured(),
    resolveAccess: () => resolveSecretAccess(identityService),
    listMetadata: (context) => getVault().listMetadata(context),
    getMetadata: (context, secretId) =>
      getVault().getMetadata(context, secretId),
    create: (context, input) => getVault().create(context, input),
    replace: (context, secretId, input) =>
      getVault().replace(context, secretId, input),
    remove: (context, secretId) => getVault().remove(context, secretId),
    rotate: (context, secretId) => getVault().rotate(context, secretId),
    withDecryptedSecret: (context, handle, callback) =>
      getVault().withDecryptedSecret(context, handle, callback),
  };
}
