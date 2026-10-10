# PH-M07-WO-001 Acceptance checklist

Status: CANDIDATE / NOT ADMITTED
Baseline: main@85489b2d5f7745e9e4dd81495cda41dcaba1090e
Work Order: .engineering/proposals/PH-GOV-WAVE-A-G1-G2/work-orders/PH-M07-WO-001.md

## Admission and integrity

- [ ] G1/G2 governance acceptance is recorded; a fresh Context Lock names the accepted main SHA.
- [ ] All source and contract fingerprints match; no checkpoint/ADR/module/scope drift exists.
- [ ] The issue remains the same existing NECESSARY module; no new module or reclassification was introduced.
- [ ] Upstream STOP/dependency and current VEX/security gates are resolved for this lane.
- [ ] Agent uses one isolated module worktree; changed paths stay inside the exclusive ownership set.
- [ ] liveTradingAuthorized remains false; no secrets, signing, authenticated mutation, VEX transfer or historical storage mutation.

## Implementation and deterministic acceptance

- [ ] AC-01: Same ordered ticks and injected clock yield identical results without wall-clock reads.
- [ ] AC-02: Fill/no-fill assumptions are versioned, documented, deterministic and conservative; unknown input never overstates fills.
- [ ] AC-03: Tests cover spread/tick, queue uncertainty, known/unknown fees, adverse selection, gaps, duplicate/out-of-order ticks.
- [ ] AC-04: No order mutation, signer, credentials, network mutation or profitability claim.
- [ ] AC-05: Evidence labels this a standalone foundation; end-to-end acceptance waits M03/M04/M05/M06.

- [ ] Focused command passes and raw/sanitized receipt is retained.
- [ ] Affected lint, format, typecheck and build checks pass.
- [ ] Exact-head GitHub CI passes on the audited SHA.
- [ ] Required security/dependency scans are current for changed inputs; no unresolved applicable HIGH/CRITICAL finding.
- [ ] Independent reviewer records an exact-head verdict; HIGH_ASSURANCE requirements are satisfied.
- [ ] Evidence Bundle includes path manifest, evidence hashes, assumptions, limitations and rollback.
- [ ] Checkpoint delta remains proposal-only; canonical checkpoint is not modified.

## Lane gate

- [ ] Candidate only; do not claim full end-to-end replay because M06 is absent.
- [ ] No strategy/risk/market-data paths, order path, runtime wiring or persistent state.
