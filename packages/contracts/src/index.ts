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
