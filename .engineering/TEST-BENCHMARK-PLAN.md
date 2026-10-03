# Test & Benchmark Plan

Status: FROZEN upon merge of PH-PLAN-001.

## Assurance levels
- LOW planning/docs: consistency and schema checks.
- STANDARD product increments: targeted unit + lint + typecheck/build + relevant integration.
- ELEVATED persistence/recovery/security: STANDARD + migration/recovery/integration regression.
- HIGH_ASSURANCE live-money/signing/risk: ELEVATED + state-machine/property tests, replay regression, fault injection, exact-head security evidence and rollback/roll-forward proof.

## Required harnesses
1. Deterministic fake clock/randomness.
2. Recorded/synthetic order-book replay.
3. Polymarket adapter simulator for success, reject, timeout, duplicate, partial fill, cancel race and reconnect.
4. Multi-tenant isolation fixtures.
5. Paper fill simulator with conservative queue/fill assumptions.
6. Secret-redaction tests.
7. Kill-switch fault injection.
8. Reconciliation tests against conflicting local/remote order states.

## Strategy evidence
Report gross/net PnL, fees/rebates assumptions, fills, fill rate, trade count, expectancy, drawdown, inventory/exposure, latency and adverse-selection proxy. Separate in-sample from out-of-sample/replay windows.

## Live readiness gate
LIVE remains disabled until:
- required unit/integration/property/replay suites pass;
- paper mode covers representative market conditions;
- net expectancy is not negative under conservative assumptions;
- max drawdown/exposure remain inside frozen budgets;
- no HIGH/CRITICAL defects remain;
- recovery and kill-switch drills pass;
- geographic eligibility and credential model are verified at exact implementation state.

No single profit threshold is frozen at Source Pack time. PH-M12 must derive thresholds from measured evidence.
