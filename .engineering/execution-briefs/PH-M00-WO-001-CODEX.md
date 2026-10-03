# PH-M00-WO-001 — Codex Execution Brief

Execute PH-M00-WO-001 on branch feat/ph-m00-governance-harness.

1. Read AGENTS.md, the exact Work Order and .engineering/context-locks/PH-M00-WO-001.json first.
2. Verify HEAD lineage includes base b0d63d3b889f0a495313414c6e789ccade93251a and that every critical-source fingerprint still matches. If stale, STOP.
3. Implement only PH-M00-WO-001.
4. Run and fix all required checks from the Work Order.
5. Produce .engineering/evidence/PH-M00-WO-001-EVIDENCE.md with base/head SHA, versions, files, dependencies, command results/durations, CI state, risks and proposed checkpoint delta.
6. Commit and push to the same branch and update/open PR #7 if it exists; otherwise open a PR to main titled "feat(m00): governance and harness foundation".
7. Final report in Brazilian Portuguese.

STOP CONDITION: PH-M00 functional/tested/documented and PR-ready, or a real BLOCKED state. Do not begin PH-M01.
