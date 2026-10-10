# PH-M03-WO-001 Acceptance checklist

Status: CANDIDATE / NOT ADMITTED
Baseline: main@85489b2d5f7745e9e4dd81495cda41dcaba1090e
Work Order: .engineering/proposals/PH-GOV-WAVE-A-G1-G2/work-orders/PH-M03-WO-001.md

## Admission and integrity

- [ ] G1/G2 governance acceptance is recorded; a fresh Context Lock names the accepted main SHA.
- [ ] All source and contract fingerprints match; no checkpoint/ADR/module/scope drift exists.
- [ ] The issue remains the same existing NECESSARY module; no new module or reclassification was introduced.
- [ ] Upstream STOP/dependency and current VEX/security gates are resolved for this lane.
- [ ] Agent uses one isolated module worktree; changed paths stay inside the exclusive ownership set.
- [ ] liveTradingAuthorized remains false; no secrets, signing, authenticated mutation, VEX transfer or historical storage mutation.

## Implementation and deterministic acceptance

- [ ] AC-01: Identical fixtures and injected time yield deterministic snapshots and filter results.
- [ ] AC-02: Type and runtime validation prevent a missing/malformed timestamp from becoming fresh or stale; tests cover non-finite, negative, non-integer and future timestamps, provider-unavailable inputs, and the chosen threshold equality boundary.
- [ ] AC-03: Only public read-only M02 interfaces are used; no authenticated/user stream, credentials, provider mutation or signing import.
- [ ] AC-04: Focused tests cover filter intersection, stale transition, unknown state and malformed snapshots.

- [ ] Focused command passes and raw/sanitized receipt is retained.
- [ ] Affected lint, format, typecheck and build checks pass.
- [ ] Exact-head GitHub CI passes on the audited SHA.
- [ ] Required security/dependency scans are current for changed inputs; no unresolved applicable HIGH/CRITICAL finding.
- [ ] Independent reviewer records an exact-head verdict; HIGH_ASSURANCE requirements are satisfied.
- [ ] Evidence Bundle includes path manifest, evidence hashes, assumptions, limitations and rollback.
- [ ] Checkpoint delta remains proposal-only; canonical checkpoint is not modified.

## Lane gate

- [ ] BLOCKED until PH-M02-WO-005 is promoted and the active M02 stop is reconciled.
- [ ] No provider adapter or worker wiring; coordinator owns shared exports and worker entrypoint.
