# PH-PLAN-001 — Materialize PolyHunter canonical Source Pack

Issue: #2
Base: main@3c942ff68a174ff0d71afcde21bacafe86f5fe89
Branch: planning/ph-plan-001-source-pack
Risk: STANDARD planning; product live-money boundary is HIGH_ASSURANCE.

## OBJECTIVE
Materialize the complete initial canonical Source Pack before product implementation.

## CONTEXT
PH-BS-001 merged GEF 1.1.2. Product intent is approved but no product runtime exists.

## SCOPE
README/AGENTS; Source Hierarchy; Overview; Requirements; Scope; Architecture; Security; Test Plan; Deployment; Backlog; DoD; Decisions; Data Model; API; Integration; UI/UX; Migration/Recovery; Checkpoint; ADRs; Context Lock; traceability/evidence.

## OUT OF SCOPE
Product code, dependencies, database migrations, CI implementation, deployment, credentials and trading.

## FILES / SOURCES TO READ
Exact base; .gef/init-state.json; GEF 1.1.2 operating model; current official Polymarket docs; owner-approved product intent.

## REQUIREMENTS
New-project Source Pack precedes code; deterministic critical path; multi-tenant isolation; HIGH_ASSURANCE for live money/signing/secrets/risk; replay/paper before live; no profit guarantee; no geoblock bypass.

## ARCHITECTURE RULES
Ports/adapters; Strategy -> Risk -> Execution; Postgres durability; event journal; provider reconciliation; AI advisory only; idempotency, leases and circuit breakers.

## CONSTRAINTS
Docs/planning only. No product runtime. No secret values. No unsupported provider assumptions promoted without capability checks.

## ACCEPTANCE CRITERIA
All Source Pack files present and internally consistent; Checkpoint JSON schema 2; exact-base Context Lock; backlog maps every NECESSARY MVP module; DoD blocks live before evidence; no product code.

## TESTS
JSON parse/schema sanity, source cross-reference review, exact diff/path audit, secret scan by inspection, no runtime file changes.

## DELIVERABLES
Source Pack, Context Lock, traceability matrix, PR, Evidence Bundle and proposed Checkpoint Delta.

## REVIEW FORMAT
APPROVED / CORRECTION REQUIRED / BLOCKED with exact-head diff, traceability, security, scope and checkpoint findings.

## STOP CONDITION
Stop when the Source Pack PR is audited and either corrected or promoted/merged. Do not begin PH-M00 implementation in this Work Order.
