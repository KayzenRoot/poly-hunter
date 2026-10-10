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

export type {
  AssetId,
  BestPrices,
  BookLevel,
  ConditionId,
  ConnectionState,
  DecimalString,
  DiscoveryPage,
  MarketDetail,
  MarketFeeMetadata,
  MarketId,
  MarketLifecycleStatus,
  MarketStreamEvent,
  MarketStreamHandle,
  MarketStreamOptions,
  MarketSummary,
  OrderBookSnapshot,
  OutcomeAsset,
  PolymarketBook,
  PolymarketDiscovery,
  PriceChangeItem,
  ProviderErrorCategory,
  ProviderErrorCode,
  ProviderOrderSide,
  StreamScheduler,
  StreamSocket,
  StreamSocketFactory,
  StreamSocketHandler,
  StreamState,
} from "./polymarket.ts";
export { PolymarketProviderError } from "./polymarket.ts";
export type {
  AdminDashboardSection,
  AdminHealthDTO,
  BookStaleness,
  DashboardSectionState,
  ExposureSnapshot,
  FeeModel,
  KillSwitchCommand,
  MarketFilter,
  MarketSnapshot,
  ObservabilityEvent,
  PaperFill,
  PaperFillAssumptionCode,
  ProviderHealth,
  ReplayClock,
  ReplayTick,
  RiskDecision,
  RiskDecisionReasonCode,
  RiskLimits,
  StrategyContext,
  StrategyId,
  StrategyProposal,
  UserDashboardDTO,
  UserDashboardSection,
  WaveAContractVersion,
} from "./wave-a.ts";
export {
  disabledKillSwitchCommand,
  riskDecisionReasonCodes,
  waveAContractVersion,
} from "./wave-a.ts";

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
