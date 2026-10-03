# Source Hierarchy

Status: FROZEN upon merge of PH-PLAN-001.

## Authority domains
1. REPOSITORY_STATE — exact Git/code/config/test/evidence facts.
2. PROJECT_STATE — CHECKPOINT.md + CHECKPOINT.json.
3. DECISION — DECISIONS-LEDGER.md and ADRs.
4. SCOPE — SCOPE.md.
5. REQUIREMENT — REQUIREMENTS.md.
6. ARCHITECTURE — ARCHITECTURE.md, DATA-MODEL.md, API-CONTRACTS.md and INTEGRATION-CONTRACTS.md.
7. SECURITY — SECURITY.md.
8. VALIDATION — TEST-BENCHMARK-PLAN.md and exact evidence.
9. COMPLETION — DEFINITION-OF-DONE.md.
10. EXECUTION — active Work Order + Context Lock.
11. FUTURE_WORK — BACKLOG.md.
12. CONVERSATION — contextual input only; never durable authority by itself.

## Rules
- Authority is domain-specific; newest text does not automatically win.
- Descriptive truth and normative truth stay separate. Mismatch is DRIFT.
- A Work Order cannot silently supersede frozen Scope, Architecture, Security or DoD.
- Checkpoint shared fields must agree between human and JSON views.
- Unknown or conflicting authority fails closed for the affected operation.
- Exact-state claims bind to a SHA, schema version or equivalent immutable fingerprint where practical.
