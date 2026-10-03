# Project Overview

Status: FROZEN upon merge of PH-PLAN-001.

## Product
PolyHunter is a multi-tenant micro-SaaS for governed low-notional Polymarket automation.

## User goal
For pilot users with limited capital, scan many markets and act only on bounded opportunities where expected value remains positive after fees, fill probability, slippage, adverse-selection assumptions and risk limits. The product does not promise daily profit.

## MVP behavior
- Primary strategy: Micro Maker Scalper, maker-first/post-only when supported and economic.
- Secondary strategy: Arbitrage Sentinel for simple deterministic inconsistencies.
- Modes: REPLAY, PAPER and LIVE.
- Tenant dashboard: account status, autopilot, exposure/PnL, trades, strategy/risk settings and connection health.
- Admin dashboard: tenants, engine health, exposure, errors, versions and tenant/global kill switches.
- Pilot scale: 1–2 tenants initially, multi-tenant architecture from day one.

## Important post-MVP capability
A DeepSeek-compatible intelligence adapter may add market classification/context behind a replaceable AIProviderPort. It remains advisory only and outside the order-critical path; the system must stay safe without it.

## Success definition
Safe, measurable, maintainable automation with statistically credible replay/paper evidence. A fixed US$5–10/day outcome is not an acceptance criterion.

## Constraints
- HIGH_ASSURANCE around money, signing, credentials and live execution.
- Free-tier-first pilot deployment where practical, without weakening reliability/security.
- No geoblock or eligibility circumvention.
