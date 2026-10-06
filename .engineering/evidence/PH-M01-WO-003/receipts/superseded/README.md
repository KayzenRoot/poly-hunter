# Superseded receipts

These files are **history, not current claims**. Each was superseded by a later
correction round of PH-M01-WO-003. They are kept — not deleted — so an auditor can
see what was previously asserted and what replaced it. Nothing in this directory
should be read as describing the current artifact.

| File | Superseded because |
| --- | --- |
| `02-final-image-scan.sarif`, `02-final-image-scan.stderr.txt` | Scan of `sha256:f810df3a…`, which the CR-01 correction round replaced. |
| `04-vex-reconciliation.json`, `04-vex-reconciliation.md` | Registers `NOT_AFFECTED` as **current approved state**. That is exactly what audit CR-04 forbade: the executor proposes, it does not dispose. Replaced by the state machine. |
| `reconcile-vex.mjs` | The script that produced the above. Hard-codes the stale `f810df3a…` digest and applies generic justifications to rows whose prior proof was specific. Carries a guard that **throws** unless `POLYHUNTER_ALLOW_SUPERSEDED_VEX` is set, so it cannot be re-run by accident. |
| `05-secret-pattern-scan.txt` | Pre-dates the classified scan; its counts mix SHA-256 digests with key-shaped literals and are not comparable to the current receipt. |
| `11-new-image-scan.sarif`, `11-new-image-scan.stderr.txt` | Scan of `sha256:8bd3e85a…`, replaced by the CR-06 rebuild. |
| `12-objective-equivalence.txt` | Premise measurements taken on `sha256:8bd3e85a…`. |
| `13-final-validation.txt` | Final sweep taken on `sha256:8bd3e85a…`. |
| `13-cr04-vex-state-machine.json`, `13-cr04-vex-state-machine.md` | **Carry the CR-05 regression**: `CVE-2026-8376` restated as `vulnerable_code_not_in_execute_path` instead of the accepted `vulnerable_code_cannot_be_controlled_by_adversary`. Retained only so the audit's finding can be read against the artifact that contained the defect. The current state machine is `../vex-state-machine.mjs` → `../14-vex-state-machine.{json,md}`. |

## Why the CR-04 VEX outputs were moved rather than left in place

Leaving a file that asserts a wrong disposition next to the correct one invites a
reader — or a future executor — to pick up the wrong one. Moving them here keeps
them readable while making the current set unambiguous.

Two guards now prevent the failure from recurring:

1. `vex-state-machine.mjs` **throws** before writing any output if a proposed
   disposition diverges from the accepted WO-002 record. Both the historical
   regression mechanism and the CR-05 mutation were run against it as negative
   controls (see `../15-cr05-negative-controls.txt`).
2. `reconcile-vex.mjs` refuses to run without an explicit override environment
   variable.
