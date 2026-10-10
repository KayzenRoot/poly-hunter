# JEV prompt-policy hotfix receipt

Work Order: PH-M02-WO-001
PR: #43
Base head: `84fd7b3f435853df591013abad7a2e685b7f5715`
Branch: `feat/ph-m02-public-provider-foundation`

## JEV MCP discovery and use

The connected TypeSafe JEV MCP returned a successful `jev_screen` response
from provider `typesafe`, model `jev-1.13.0`. The advertised tools were:
`jev_audit`, `jev_classify`, `jev_compare`, `jev_decide`, `jev_extract`,
`jev_find`, `jev_gate`, `jev_noul`, `jev_rerank`, `jev_review`,
`jev_screen`, and `jev_verify`.

Before this correction, screening returned `block` for an operator-designated
review (injection probability 0.80, substance 0.99, relevance 0.96) and an
operator attachment (0.92, 0.99, 0.85). No credentials, secrets, or raw
private material were sent. These were false positives for the operator-input
provenance described by the hotfix.

The policy now uses explicit MCP arguments from `JEV_SCREEN_OPTIONS`, including
`block_at: 0.99`, and deterministic outcomes in
`.engineering/policies/jev-prompt-policy.ts`. The reference evaluator
preserves independent security blockers and treats a high score from untrusted
external content as `SECURITY_EVALUATION`, not an automatic stop.

JEV pre-reviews of the staged deltas returned `escalate` (`safe_to_apply=0.58`
and `0.49`); both scored correctness and spec-match highly, with low confidence
for test-gap and blast-radius. The primary engineering review confirmed the
evaluator is isolated to policy interpretation and the tests cover each
requested threshold, provenance case and independent blocker. The JEV results
remain advisory and were not treated as approval.

## Repository search

The requested full-repository search found seven historical evidence files
containing one or more search terms. They are SARIF, CVE metadata, Alpine
security database, and prior execution receipts. No source, executable policy,
configuration, or test contained the old threshold or blocked-state names.
Historical evidence was left unchanged.

## Validation

- `npm test -- tests/jev-prompt-policy.test.ts`: PASS, 14 tests.
- `npm run format:check`: PASS.
- `npm run validate`: PASS; 237 tests, all workspace typechecks/builds, and
  `npm audit --audit-level=high` with zero vulnerabilities.
- Biome reported one pre-existing informational `noUselessContinue` finding in
  `packages/db/tests/m01-acceptance.integration.test.ts`; no unrelated file was
  changed.
