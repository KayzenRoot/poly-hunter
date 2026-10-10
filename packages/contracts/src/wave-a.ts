import type {
  AssetId,
  DecimalString,
  MarketId,
  MarketLifecycleStatus,
  MarketSummary,
  OrderBookSnapshot,
  ProviderOrderSide,
} from "./polymarket.ts";

/** Additive, provider-neutral shared contract set for the proposed Wave A. */
export const waveAContractVersion = 1 as const;
export type WaveAContractVersion = typeof waveAContractVersion;

/** Snapshot age is evaluated against an injected/local receive clock. */
type BookStalenessTiming = Readonly<{
  evaluatedAtUnixMs: number;
  maxAgeMs: number;
}>;

/** Missing observations are represented only as unknown, never fresh/stale. */
export type BookStaleness =
  | Readonly<
      BookStalenessTiming & {
        state: "fresh";
        observedAtUnixMs: number;
      }
    >
  | Readonly<
      BookStalenessTiming & {
        state: "stale";
        observedAtUnixMs: number;
      }
    >
  | Readonly<
      BookStalenessTiming & {
        state: "unknown";
        observedAtUnixMs: null;
      }
    >;

/** Coarse health only; provider wire errors and free-form messages stay private. */
export type ProviderHealth = Readonly<{
  state: "available" | "degraded" | "unavailable" | "unknown";
  checkedAtUnixMs: number | null;
}>;

/** Optional clauses are intersected; there is no ranking or fuzzy search rule. */
export type MarketFilter = Readonly<{
  marketIds?: readonly MarketId[];
  lifecycleStatuses?: readonly MarketLifecycleStatus[];
}>;

export type MarketSnapshot = Readonly<{
  contractVersion: WaveAContractVersion;
  capturedAtUnixMs: number;
  markets: readonly MarketSummary[];
  books: readonly Readonly<{
    snapshot: OrderBookSnapshot;
    staleness: BookStaleness;
  }>[];
  providerHealth: ProviderHealth;
}>;

/** A rate snapshot is input data; this contract does not define fee arithmetic. */
export type FeeModel =
  | Readonly<{
      state: "known";
      marketId: MarketId;
      makerRateBps: DecimalString | null;
      takerRateBps: DecimalString | null;
      source: "provider" | "configuration" | "fixture";
      observedAtUnixMs: number;
    }>
  | Readonly<{
      state: "unknown";
      marketId: MarketId;
      reason: "unavailable" | "stale" | "unsupported";
    }>;

export type StrategyId = "micro_maker_scalper" | "arbitrage_sentinel";

export type StrategyContext = Readonly<{
  snapshot: MarketSnapshot;
  feeModelsByMarket: Readonly<Record<string, FeeModel>>;
  evaluatedAtUnixMs: number;
}>;

/** Candidate only. It has no submission, signing, or order-mutation capability. */
export type StrategyProposal = Readonly<{
  contractVersion: WaveAContractVersion;
  proposalId: string;
  strategyId: StrategyId;
  marketId: MarketId;
  createdAtUnixMs: number;
  validUntilUnixMs: number | null;
  legs: readonly Readonly<{
    assetId: AssetId;
    side: ProviderOrderSide;
    price: DecimalString;
    size: DecimalString;
  }>[];
  reasonCodes: readonly string[];
}>;

export type RiskLimits = Readonly<{
  contractVersion: WaveAContractVersion;
  version: string;
  currencyCode: string;
  maxOrderSizeShares: DecimalString;
  maxOrderNotional: DecimalString;
  maxMarketExposure: DecimalString;
  maxTotalExposure: DecimalString;
  maxOpenPositions: number;
  maxOpenOrders: number;
  maxDailyLoss: DecimalString;
}>;

export type ExposureSnapshot = Readonly<{
  contractVersion: WaveAContractVersion;
  completeness: "complete" | "incomplete";
  asOfUnixMs: number;
  currencyCode: string;
  positionNotional: DecimalString | null;
  openOrderNotional: DecimalString | null;
  totalNotional: DecimalString | null;
  openPositions: number | null;
  openOrders: number | null;
  byMarket: readonly Readonly<{
    marketId: MarketId;
    positionNotional: DecimalString | null;
    openOrderNotional: DecimalString | null;
  }>[];
}>;

export const riskDecisionReasonCodes = [
  "within_limits",
  "order_size_limit",
  "order_notional_limit",
  "market_exposure_limit",
  "total_exposure_limit",
  "open_positions_limit",
  "open_orders_limit",
  "daily_loss_limit",
  "active_breaker",
  "unknown_breaker_state",
  "incomplete_exposure",
  "missing_limits",
  "currency_mismatch",
  "stale_input",
  "invalid_input",
] as const;

export type RiskDecisionReasonCode = (typeof riskDecisionReasonCodes)[number];

type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

/** `allow` is usable only for simulation in this contract version. */
export type RiskDecision = Readonly<{
  contractVersion: WaveAContractVersion;
  outcome: "allow" | "deny";
  scope: "simulation_only";
  proposalId: string;
  evaluatedAtUnixMs: number;
  reasonCodes: NonEmptyReadonlyArray<RiskDecisionReasonCode>;
}>;

export type ReplayTick = Readonly<{
  contractVersion: WaveAContractVersion;
  sequence: number;
  atUnixMs: number;
  snapshot: MarketSnapshot;
}>;

/** Compatible with the existing fixed-clock helper returned by createFixedClock. */
export type ReplayClock = () => Date;

export type PaperFillAssumptionCode =
  | "spread"
  | "tick_size"
  | "queue_uncertainty"
  | "fees"
  | "adverse_selection";

export type PaperFill = Readonly<{
  contractVersion: WaveAContractVersion;
  mode: "paper";
  marketId: MarketId;
  assetId: AssetId;
  side: ProviderOrderSide;
  price: DecimalString;
  size: DecimalString;
  feeAmount: DecimalString | null;
  currencyCode: string;
  filledAtUnixMs: number;
  modelVersion: string;
  assumptionCodes: readonly PaperFillAssumptionCode[];
}>;

export type UserDashboardSection =
  | "markets"
  | "orders"
  | "trades"
  | "pnl"
  | "risk"
  | "settings";

export type DashboardSectionState = Readonly<{
  section: UserDashboardSection;
  state: "available" | "mock" | "unavailable" | "disabled";
  itemCount: number | null;
}>;

/** Status DTO only; no tenant secrets or fabricated trading values are carried. */
export type UserDashboardDTO = Readonly<{
  contractVersion: WaveAContractVersion;
  availability: "available" | "unavailable" | "disabled";
  mode: "replay" | "paper" | "live_disabled";
  asOfUnixMs: number | null;
  sections: readonly DashboardSectionState[];
  liveTradingAuthorized: false;
}>;

export type AdminDashboardSection =
  | "tenants"
  | "health"
  | "exposure"
  | "audit"
  | "kill_switch";

export type KillSwitchCommand = Readonly<{
  contractVersion: WaveAContractVersion;
  availability: "disabled";
  operation: "NO_OP";
  canExecute: false;
}>;

/** Compile-time and display placeholder only; no executable kill action exists. */
export const disabledKillSwitchCommand = {
  contractVersion: waveAContractVersion,
  availability: "disabled",
  operation: "NO_OP",
  canExecute: false,
} as const satisfies KillSwitchCommand;

export type AdminHealthDTO = Readonly<{
  contractVersion: WaveAContractVersion;
  availability: "available" | "unavailable" | "disabled";
  checkedAtUnixMs: number | null;
  sections: readonly Readonly<{
    section: AdminDashboardSection;
    state: "available" | "mock" | "unavailable" | "disabled";
    itemCount: number | null;
  }>[];
  killSwitch: KillSwitchCommand;
}>;

/** Deliberately excludes arbitrary payloads, messages, identifiers, and secrets. */
export type ObservabilityEvent = Readonly<{
  contractVersion: WaveAContractVersion;
  code:
    | "provider_health_changed"
    | "market_snapshot_stale"
    | "strategy_proposal_created"
    | "risk_decision_denied"
    | "replay_completed"
    | "dashboard_section_unavailable"
    | "worker_health_changed";
  component: "market_data" | "strategy" | "risk" | "replay" | "web" | "worker";
  severity: "debug" | "info" | "warn" | "error";
  occurredAtUnixMs: number;
}>;
