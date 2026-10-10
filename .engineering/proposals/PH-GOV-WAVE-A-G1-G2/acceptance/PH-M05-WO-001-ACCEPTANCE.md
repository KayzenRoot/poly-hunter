# PH-M05-WO-001 Acceptance checklist

Status: CANDIDATE / NOT ADMITTED
Baseline: main@85489b2d5f7745e9e4dd81495cda41dcaba1090e
Work Order: .engineering/proposals/PH-GOV-WAVE-A-G1-G2/work-orders/PH-M05-WO-001.md

## Admission and integrity

- [ ] G1/G2 governance acceptance is recorded; a fresh Context Lock names the accepted main SHA.
- [ ] All source and contract fingerprints match; no checkpoint/ADR/module/scope drift exists.
- [ ] The issue remains the same existing NECESSARY module; no new module or reclassification was introduced.
- [ ] Upstream STOP/dependency and current VEX/security gates are resolved for this lane.
- [ ] Agent uses one isolated module worktree; changed paths stay inside the exclusive ownership set.
- [ ] liveTradingAuthorized remains false; no secrets, signing, authenticated mutation, VEX transfer or historical storage mutation.

## Implementation and deterministic acceptance

- [ ] AC-01: Unknown/incomplete exposure, missing limits, currency mismatch, stale input, invalid values or active/unknown breaker denies.
- [ ] AC-02: Boundary/adversarial/property tests use exact decimal arithmetic; binary floating point is not authoritative.
- [ ] AC-03: Every allow/denial has a non-empty list from the closed `RiskDecisionReasonCode` union; arbitrary strings fail typecheck/tests, and any allow remains simulation_only.
- [ ] AC-04: Tests cover caps, missing state, daily stop/breaker and fail-closed defaults.
- [ ] AC-05: Unfrozen safety semantics or numeric defaults are not invented; ambiguity blocks admission.

- [ ] Focused command passes and raw/sanitized receipt is retained.
- [ ] Affected lint, format, typecheck and build checks pass.
- [ ] Exact-head GitHub CI passes on the audited SHA.
- [ ] Required security/dependency scans are current for changed inputs; no unresolved applicable HIGH/CRITICAL finding.
- [ ] Independent reviewer records an exact-head verdict; HIGH_ASSURANCE requirements are satisfied.
- [ ] Evidence Bundle includes path manifest, evidence hashes, assumptions, limitations and rollback.
- [ ] Checkpoint delta remains proposal-only; canonical checkpoint is not modified.

## Lane gate

- [ ] Candidate only; HIGH_ASSURANCE; requires owner resolution of safety ambiguity and independent review.
- [ ] No DB/schema/migrations, auth, worker wiring or M06 output types.
