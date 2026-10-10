# PH-M02-WO-001 JEV MCP receipt

Actual local MCP calls used server/model `jev-1.13.0` / provider `typesafe`. The advertised live inventory included: `jev_screen`, `jev_audit`, `jev_classify`, `jev_compare`, `jev_decide`, `jev_extract`, `jev_find`, `jev_gate`, `jev_noul`, `jev_rerank`, `jev_review`, `jev_verify`. Calls completed without credentials, tokens, secrets, or private account data.

## Results

- `jev_screen` on an excerpt of official Polymarket documentation: action `pass`; injection 0.02, substance 0.97, relevance 0.95.
- `jev_verify` on five documentation/registry claims: 4 verified, 0 contradicted, 1 unsupported/review. The unsupported claim was the event-family summary because the supplied excerpt was abbreviated; the fetched official SDK page itself lists the event families at lines 393-413. No claim was accepted solely from Jev.
- Initial `jev_gate` request carrying all 16 code-file diffs returned `request failed (HTTP 400)`; no result was inferred from that call.
- `jev_review` of the exact staged `package-lock.json` diff (17,700 characters): action `escalate`, composite 0.5285, safe_to_apply 0.22, low confidence. No concrete defect was identified by the result; Node >=24 engine risk is documented in the Evidence Bundle.
- `jev_review` of exact staged core source diffs (`contracts.ts`, `decimal.ts`, `index.ts`, `rest.ts`, `stream.ts`, `wire.ts`; 62,509 characters): action `escalate`, composite 0.6704, safe_to_apply 0.29. Limiting rubrics were mostly low-confidence test-gap assessments; no concrete defect was identified in the result. The source was manually inspected and exercised by the 34 focused tests and the 223-test full suite.
- Bounded summary `jev_gate`: action `escalate`; review safe_to_apply 0.05 and composite 0.7485; verification 3 verified, 1 contradicted, 1 unsupported, 4 requiring review. The low-confidence contradiction concerned the PostgreSQL reconciliation claim. Deterministic SARIF/VEX data was independently parsed and directly confirms 25 H/C findings, 24 exact-digest approved dispositions (23 Go + one libxml2), and one unresolved zlib HIGH. No repeated JEV call was made to seek a preferred result.

JEV did not approve the patch, clear a CVE, authorize a checkpoint promotion, or replace exact Git/test/SARIF/VEX/ADR evidence. The Work Order remains `BLOCKED_UNRESOLVED` due the exact-image findings regardless of these advisory escalations.

## Final correction-delta gate

One final jev_gate call used provider typesafe, model jev-1.13.0, on the 31,347-character staged implementation diff plus bounded validation, runtime, and exact-image scan receipts. The patch input was not truncated.

- Gate action: escalate. Composite 0.72475; safe_to_apply 0.10. Correctness score 1.73 (confidence 0.59); spec-match 1.77 (0.64); test-gap 0.60 (0.11); blast-radius 1.89 (0.83).
- Claim verification: 2 verified, 0 contradicted, 6 unsupported/review. The supported claims were the validation result and the blocked exact-image gate. The CR-specific code claims were marked unsupported because the evidence field supplied concise summaries rather than source/test excerpts; this is a limitation of that claim-evidence input, not an approval. Those six points were checked directly against the staged code diff, targeted regression tests, and runtime receipts.
- JEV identified the test-gap rubric as the low-confidence limiter and did not identify a concrete code defect. Codex manually reviewed the exact staged implementation and the final 238-test/35-focused-test results. No repeated call was made to seek a different score.
- This advisory escalation does not override deterministic implementation/tests or clear image findings. Final Work Order state remains BLOCKED_UNRESOLVED due 23 dev-image and one PostgreSQL H/C finding.

No credentials, tokens, secrets or private account data were included in this request.
