# G1 — Wave A shared contract freeze proposal

Status: **PROPOSED / G1 REVIEW REQUIRED**
Source baseline: `main@85489b2d5f7745e9e4dd81495cda41dcaba1090e`
Additive API file: `packages/contracts/src/wave-a.ts`
Barrel export: `packages/contracts/src/index.ts`
Contract version: `waveAContractVersion = 1`

The definitions are provider-neutral, readonly TypeScript data contracts. Existing provider types (`MarketId`, `ConditionId`, `AssetId`, `DecimalString`, `BookLevel`, `MarketSummary`, `OrderBookSnapshot`, and `ProviderOrderSide`) are reused without changing their source or meaning. The `@polymarket/client` SDK remains confined to `packages/polymarket`.

## Version 1 inventory

| Contract | Version 1 meaning | Intended lanes |
|---|---|---|
| `MarketFilter` | Optional market-ID and lifecycle-status clauses; when both are supplied they are intersected. No ranking or fuzzy text matching is frozen. | M03 |
| `BookStaleness` | Discriminated `fresh` / `stale` / `unknown` result. Fresh/stale require an observation timestamp; unknown alone permits a missing timestamp. Producers validate finite, nonnegative integer UTC epoch milliseconds and nonnegative integer `maxAgeMs`; malformed values fail closed as unknown. Boundary equality remains a lane-level rule. | M03, M07 |
| `ProviderHealth` | Coarse available/degraded/unavailable/unknown state and check time; no raw provider error/message. | M03, M11 |
| `MarketSnapshot` | Captured time, normalized market summaries, order-book snapshots paired with staleness, and provider health. | M03, M04, M05, M07 |
| `FeeModel` | Known per-market maker/taker rates in basis points with source/time, or an explicit unknown reason. It is data only; no fee formula is implied. | M04, M05, M07 |
| `StrategyContext` | Immutable market snapshot, per-market fee models, and injected evaluation time. | M04 |
| `StrategyProposal` | Candidate-only strategy ID and market legs with exact decimal price/size, timestamps, and reason codes. It has no submit/sign/cancel capability. | M04, M05, M07 |
| `RiskLimits` | Per-tenant input limits: share size, notional/exposure, open positions/orders, daily loss, currency code, and version. No default numeric thresholds. | M05 |
| `ExposureSnapshot` | Complete/incomplete flag, as-of time, currency, totals/counts, and per-market exposure fields. Missing values stay nullable. | M05 |
| `RiskDecision` | Allow/deny result, a non-empty list from the closed, exported `RiskDecisionReasonCode` version 1 catalog, and evaluation time. The catalog names bounded outcomes/input failures without selecting numeric thresholds. `scope` is the literal `simulation_only`; it is not execution or LIVE authorization. | M05, M07 |
| `ReplayTick` / `ReplayClock` | Ordered snapshot tick and injected clock. `ReplayClock` is compatible with the existing `createFixedClock` return shape. | M07 |
| `PaperFill` | Explicit `paper` mode, exact decimal values, model version and assumptions; never a remote fill or order. | M07 |
| `UserDashboardDTO` | Section state/count shell for markets, orders, trades, PnL, risk, and settings; includes `liveTradingAuthorized: false`. No credentials or tenant secret fields. | M08 |
| `AdminHealthDTO` | State/count shell for tenant, health, exposure, audit, and kill-switch sections. It carries the inert kill-switch placeholder only. | M09 |
| `KillSwitchCommand` | Compile-time/display placeholder with `availability: "disabled"`, `operation: "NO_OP"`, and `canExecute: false`; contains no actor, target, execution function, or mutation request. | M09 |
| `ObservabilityEvent` | Bounded event code/component/severity/time only. No arbitrary message, payload, identifier, or credential field. | M11 |

## Explicitly deferred

`ExecutionIntent`, `OrderState`, `ReconciliationResult`, and `JournalEvent` are M06 execution/reconciliation contracts. No Wave A lane consumes them, M06 is not part of this batch, and no M06 Work Order is admitted. They are not frozen in this G1 proposal. The inert `KillSwitchCommand` placeholder does not define or enable the required future kill-switch mutation path.

## Semantic boundaries not frozen here

This contract freeze does not set strategy thresholds, risk-limit numbers/defaults, portfolio aggregation formulas, fee calculation, currency conversion, provider freshness thresholds or boundary equality behavior, paper-fill probabilities/queue assumptions, dashboard API authorization/data availability, audit-event retention, or any execution decision. Each lane's candidate Work Order requires only deterministic behavior within source-frozen requirements and explicit assumptions in evidence. Any material ambiguity affecting safety, money, tenancy, or authorization blocks that lane for owner/planning resolution before implementation.

## Compatibility and validation

- Additive export only; existing public contracts are unchanged.
- DTOs and arrays are readonly; numeric price/size/notional values use `DecimalString`.
- Epoch timestamps use UTC Unix milliseconds.
- Book freshness timestamps and configured age must be finite nonnegative integers at runtime; missing or malformed observations cannot be emitted as `fresh` or `stale`.
- Risk decision reason codes are non-empty members of the exported version 1 catalog; free-form strings are not accepted.
- The risk result is typed simulation-only. The UI's LIVE state is disabled. Kill-switch is structurally a no-op.
- CI/typecheck/build must prove the contracts compile at exact head. A contract change after G1 acceptance invalidates all seven candidate Context Locks and requires a new contract fingerprint plus focused recompilation.
