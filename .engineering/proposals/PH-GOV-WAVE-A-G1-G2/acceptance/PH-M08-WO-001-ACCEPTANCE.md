# PH-M08-WO-001 Acceptance checklist

Status: CANDIDATE / NOT ADMITTED
Baseline: main@85489b2d5f7745e9e4dd81495cda41dcaba1090e
Work Order: .engineering/proposals/PH-GOV-WAVE-A-G1-G2/work-orders/PH-M08-WO-001.md

## Admission and integrity

- [ ] G1/G2 governance acceptance is recorded; a fresh Context Lock names the accepted main SHA.
- [ ] All source and contract fingerprints match; no checkpoint/ADR/module/scope drift exists.
- [ ] The issue remains the same existing NECESSARY module; no new module or reclassification was introduced.
- [ ] Upstream STOP/dependency and current VEX/security gates are resolved for this lane.
- [ ] Agent uses one isolated module worktree; changed paths stay inside the exclusive ownership set.
- [ ] liveTradingAuthorized remains false; no secrets, signing, authenticated mutation, VEX transfer or historical storage mutation.

## Implementation and deterministic acceptance

- [ ] AC-01: Route builds and renders truthful typed disabled/mock/empty states.
- [ ] AC-02: No auth/session/proxy/root-layout/API/secret-route changes; no credential or tenant secret reaches client code.
- [ ] AC-03: Every action is disabled/non-operational and LIVE cannot be enabled from UI state.
- [ ] AC-04: Tests check section mapping, accessibility and that fixtures are visibly mock.
- [ ] AC-05: Copy does not claim guaranteed returns.

- [ ] Focused command passes and raw/sanitized receipt is retained.
- [ ] Affected lint, format, typecheck and build checks pass.
- [ ] Exact-head GitHub CI passes on the audited SHA.
- [ ] Required security/dependency scans are current for changed inputs; no unresolved applicable HIGH/CRITICAL finding.
- [ ] Independent reviewer records an exact-head verdict; HIGH_ASSURANCE requirements are satisfied.
- [ ] Evidence Bundle includes path manifest, evidence hashes, assumptions, limitations and rollback.
- [ ] Checkpoint delta remains proposal-only; canonical checkpoint is not modified.

## Lane gate

- [ ] Candidate only; no real tenant data or LIVE setting path.
- [ ] Coordinator owns root layout, proxy, identity/auth routes, shared shell and shared config.
