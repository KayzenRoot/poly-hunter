import type { Result, TenantRole } from "@polyhunter/contracts";

export * from "./secrets.js";

export type DomainResult<TValue, TError> = Result<TValue, TError>;

declare const tenantContextBrand: unique symbol;

/** Request-scoped tenant authority created by the server after membership lookup. */
export type TenantContext = Readonly<{
  userId: string;
  tenantId: string;
  role: TenantRole;
  readonly [tenantContextBrand]: "TenantContext";
}>;

import type {
  IdentityUnavailabilityReason,
  PlatformRole,
  VerifiedIdentity,
} from "@polyhunter/contracts";

export type {
  IdentityProvider,
  IdentityUnavailabilityReason,
  PlatformRole,
  VerifiedIdentity,
} from "@polyhunter/contracts";

export type IdentityUnverified = Readonly<{
  readonly kind: "unverified";
  readonly reason: IdentityUnavailabilityReason;
}>;

export type IdentityVerified = Readonly<{
  readonly kind: "verified";
  readonly identity: VerifiedIdentity;
}>;

/**
 * Provider-neutral identity boundary. Implementations live in an isolated
 * provider adapter (web identity boundary); application/domain code depends
 * only on this port. Verification must use signature-checked provider claims
 * (e.g. Supabase getClaims/getUser) — never a raw session cookie read.
 */
export type IdentityPort = Readonly<{
  /** Returns a verified provider identity or an explicit failure reason. Fails closed. */
  readonly verifyIdentity: () => Promise<IdentityVerified | IdentityUnverified>;
  /** Starts the provider login flow; returns a redirect target or an explicit unavailability. */
  readonly startLogin: (returnTo: string) => Promise<
    | { readonly kind: "redirect"; readonly location: string }
    | {
        readonly kind: "unavailable";
        readonly reason: IdentityUnavailabilityReason;
      }
  >;
  /** Clears the provider session path for the current browser session. */
  readonly signOut: () => Promise<void>;
}>;

declare const platformRoleBrand: unique symbol;

/** Server-derived platform authority; issued only from authoritative platform_roles rows. */
export type PlatformContext = Readonly<{
  userId: string;
  role: PlatformRole;
  readonly [platformRoleBrand]: "PlatformContext";
}>;

/**
 * Tenant capabilities by role. owner > admin > member.
 *
 * PH-M01-WO-003 adds the four `secret:*` capabilities to owner and admin.
 * `member` is intentionally left without any of them: tenant secret metadata,
 * write, delete and rotate are administrative operations, and the Work Order
 * requires `member` to be denied all four.
 */
export const tenantRoleCapabilities = {
  owner: new Set([
    "tenant:read",
    "tenant:rename",
    "member:read",
    "member:invite",
    "member:role",
    "member:remove",
    "secret:metadata",
    "secret:write",
    "secret:delete",
    "secret:rotate",
  ]),
  admin: new Set([
    "tenant:read",
    "tenant:rename",
    "member:read",
    "member:invite",
    "member:role",
    "member:remove",
    "secret:metadata",
    "secret:write",
    "secret:delete",
    "secret:rotate",
  ]),
  member: new Set(["tenant:read", "member:read"]),
} as const satisfies Record<TenantRole, ReadonlySet<string>>;

export function tenantRoleHasCapability(
  role: TenantRole,
  capability: string,
): boolean {
  return (tenantRoleCapabilities[role] as ReadonlySet<string>).has(capability);
}

/**
 * platform_admin is checked separately and never derived from tenant roles.
 * Passing any TenantRole here always denies: tenant authority cannot grant
 * platform authority (SEC-002/SEC-021).
 */
export function isPlatformAdmin(
  platformRole: PlatformRole | null,
): platformRole is "platform_admin" {
  return platformRole === "platform_admin";
}

/** Why an authoritative TenantContext resolution refused to issue a context. */
export const tenantResolutionFailureReasons = [
  "unauthenticated",
  "user_suspended",
  "invalid_selector",
  "no_active_membership",
  "tenant_not_active",
] as const;
export type TenantResolutionFailureReason =
  (typeof tenantResolutionFailureReasons)[number];

export type TenantResolutionOutcome =
  | { readonly kind: "resolved"; readonly context: TenantContext }
  | {
      readonly kind: "unresolved";
      readonly reason: TenantResolutionFailureReason;
    };

/**
 * Pure post-check policy applied to an authoritative membership row read.
 * The caller performs the DB read; this function decides issuance. A selector
 * is only a selector: membership + user + tenant must all be active in the
 * same authoritative read, or the resolution fails closed.
 */
export function evaluateTenantResolution(
  input: Readonly<{
    authenticated: boolean;
    userStatus: "active" | "suspended" | null;
    membership: {
      userId: string;
      tenantId: string;
      role: TenantRole;
      status: "invited" | "active" | "suspended";
    } | null;
    tenantStatus: "active" | "suspended" | null;
  }>,
): TenantResolutionOutcome {
  if (!input.authenticated) {
    return { kind: "unresolved", reason: "unauthenticated" };
  }
  if (!input.membership) {
    return { kind: "unresolved", reason: "no_active_membership" };
  }
  if (input.userStatus !== "active") {
    return { kind: "unresolved", reason: "user_suspended" };
  }
  // invited/suspended memberships never authorize (fail closed).
  if (input.membership.status !== "active") {
    return { kind: "unresolved", reason: "no_active_membership" };
  }
  if (input.tenantStatus !== "active") {
    return { kind: "unresolved", reason: "tenant_not_active" };
  }
  return {
    kind: "resolved",
    context: Object.freeze({
      userId: input.membership.userId,
      tenantId: input.membership.tenantId,
      role: input.membership.role,
    }) as TenantContext,
  };
}
