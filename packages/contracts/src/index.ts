export type Result<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

export const tenantRoles = ["owner", "admin", "member"] as const;
export type TenantRole = (typeof tenantRoles)[number];

export const tenantStatuses = ["active", "suspended"] as const;
export type TenantStatus = (typeof tenantStatuses)[number];

export const userStatuses = ["active", "suspended"] as const;
export type UserStatus = (typeof userStatuses)[number];

export const membershipStatuses = ["invited", "active", "suspended"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const identityProviders = ["supabase"] as const;
export type IdentityProvider = (typeof identityProviders)[number];

export const platformRoles = ["platform_admin"] as const;
export type PlatformRole = (typeof platformRoles)[number];

/**
 * Verified provider identity produced only by a server-side authentication
 * boundary after signature verification (e.g. getClaims/getUser). The subject
 * is the provider's authoritative subject identifier; it is never taken from
 * client input, form fields or token metadata chosen by the client.
 */
export type VerifiedIdentity = Readonly<{
  provider: IdentityProvider;
  subject: string;
}>;

/** Reason an authentication boundary refused to produce a verified identity. */
export const identityUnavailabilityReasons = [
  "provider_not_configured",
  "unauthenticated",
  "invalid_session",
  "provider_unavailable",
] as const;
export type IdentityUnavailabilityReason =
  (typeof identityUnavailabilityReasons)[number];
