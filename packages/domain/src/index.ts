import type { Result } from "@polyhunter/contracts";
import type { TenantRole } from "@polyhunter/contracts";

export type DomainResult<TValue, TError> = Result<TValue, TError>;

declare const tenantContextBrand: unique symbol;

/** Request-scoped tenant authority created by the server after membership lookup. */
export type TenantContext = Readonly<{
  userId: string;
  tenantId: string;
  role: TenantRole;
  readonly [tenantContextBrand]: "TenantContext";
}>;
