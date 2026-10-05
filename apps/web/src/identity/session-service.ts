import { cookies } from "next/headers";
import { createIdentityDataAccess } from "@polyhunter/db/server/identity";
import { createTenantDataAccess } from "@polyhunter/db/server";
import {
  evaluateTenantResolution,
  type VerifiedIdentity,
} from "@polyhunter/domain";
import { verifyServerIdentity } from "./supabase-adapter";

/**
 * Server-side session/identity application service for the web boundary.
 * Composes the verified provider identity (Supabase adapter) with the
 * authoritative internal identity and membership resolution (packages/db).
 *
 * Security invariants enforced here:
 * - identity comes only from signature-verified provider claims;
 * - internal user resolution is idempotent (no duplicate users per subject);
 * - TenantContext comes only from an authoritative membership row read;
 * - the client tenant selector is only a selector: it never authorizes;
 * - no session/token/user_metadata value is stored or returned;
 * - absent Supabase configuration fails closed (explicit unauthenticated).
 */

const ACTIVE_TENANT_COOKIE = "ph-active-tenant";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type UnauthenticatedReason =
  | "provider_not_configured"
  | "unauthenticated"
  | "invalid_session"
  | "provider_unavailable"
  | "user_suspended";

export type SessionResolution =
  | {
      readonly kind: "authenticated";
      readonly userId: string;
      readonly platformAdmin: boolean;
    }
  | {
      readonly kind: "unauthenticated";
      readonly reason: UnauthenticatedReason;
    };

export type TenantContextFailureReason =
  | UnauthenticatedReason
  | "invalid_selector"
  | "no_active_membership"
  | "tenant_not_active";

export type TenantContextResolution =
  | {
      readonly kind: "resolved";
      readonly tenantId: string;
      readonly role: string;
    }
  | {
      readonly kind: "unresolved";
      readonly reason: TenantContextFailureReason;
    };

export async function readActiveTenantSelection(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  if (raw === null || !UUID_PATTERN.test(raw)) {
    return null;
  }
  return raw;
}

export async function writeActiveTenantSelection(
  tenantId: string,
): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearActiveTenantSelection(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_TENANT_COOKIE);
}

export type WebIdentityServiceOptions = Readonly<{
  connectionString?: string;
}>;

export type WebIdentityService = Readonly<{
  resolveSession: () => Promise<SessionResolution>;
  resolveTenantContext: (
    authenticatedUserId: string,
  ) => Promise<TenantContextResolution>;
  selectTenant: (
    authenticatedUserId: string,
    requestedTenantId: string | null,
  ) => Promise<TenantContextResolution>;
  readonly activeTenantCookieName: string;
}>;

export function createWebIdentityService(
  options: WebIdentityServiceOptions = {},
): WebIdentityService {
  // Lazy singletons scoped to this service instance.
  let identityDataAccess: ReturnType<typeof createIdentityDataAccess> | null =
    null;
  let tenantDataAccess: ReturnType<typeof createTenantDataAccess> | null = null;

  function getIdentityDataAccess() {
    if (!identityDataAccess) {
      identityDataAccess = createIdentityDataAccess(
        options.connectionString === undefined
          ? {}
          : { connectionString: options.connectionString },
      );
    }
    return identityDataAccess;
  }

  function getTenantDataAccess() {
    if (!tenantDataAccess) {
      tenantDataAccess = createTenantDataAccess(
        options.connectionString === undefined
          ? {}
          : { connectionString: options.connectionString },
      );
    }
    return tenantDataAccess;
  }

  async function resolveSession(): Promise<SessionResolution> {
    const verification = await verifyServerIdentity();
    if (verification.kind === "unverified") {
      return { kind: "unauthenticated", reason: verification.reason };
    }

    const identity: VerifiedIdentity = verification.identity;
    const internal =
      await getIdentityDataAccess().resolveInternalIdentity(identity);
    if (!internal) {
      return { kind: "unauthenticated", reason: "invalid_session" };
    }
    if (internal.userStatus !== "active") {
      return { kind: "unauthenticated", reason: "user_suspended" };
    }

    const platformRole = await getIdentityDataAccess().resolvePlatformRole(
      internal.userId,
    );
    return {
      kind: "authenticated",
      userId: internal.userId,
      platformAdmin: platformRole === "platform_admin",
    };
  }

  async function resolveWithSelector(
    authenticatedUserId: string,
    selectedTenantId: string | null,
  ): Promise<TenantContextResolution> {
    if (
      selectedTenantId === null ||
      !UUID_PATTERN.test(selectedTenantId) ||
      !UUID_PATTERN.test(authenticatedUserId)
    ) {
      return { kind: "unresolved", reason: "invalid_selector" };
    }

    // Authoritative single read: membership + tenant + user statuses in one
    // joined row. The selector only chooses which membership row to read; the
    // statuses in that row decide issuance (fail closed on anything else).
    const row = await getTenantDataAccess().memberships.resolveMembershipRow(
      authenticatedUserId,
      selectedTenantId,
    );

    const outcome = evaluateTenantResolution({
      authenticated: true,
      userStatus: row?.userStatus ?? null,
      membership: row
        ? {
            userId: row.userId,
            tenantId: row.tenantId,
            role: row.role,
            status: row.status,
          }
        : null,
      tenantStatus: row?.tenantStatus ?? null,
    });

    if (outcome.kind === "unresolved") {
      return { kind: "unresolved", reason: outcome.reason };
    }
    return {
      kind: "resolved",
      tenantId: outcome.context.tenantId,
      role: outcome.context.role,
    };
  }

  return {
    resolveSession,
    resolveTenantContext: async (authenticatedUserId) =>
      resolveWithSelector(
        authenticatedUserId,
        await readActiveTenantSelection(),
      ),
    selectTenant: (authenticatedUserId, requestedTenantId) =>
      resolveWithSelector(authenticatedUserId, requestedTenantId),
    activeTenantCookieName: ACTIVE_TENANT_COOKIE,
  };
}
