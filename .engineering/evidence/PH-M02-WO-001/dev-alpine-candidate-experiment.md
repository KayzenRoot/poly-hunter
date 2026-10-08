# PH-M02-WO-001 — isolated Node 24 Alpine 3.24 canary

Review: 5461309598. This is one candidate only; no alternative OS/image experiment was run.

## Artifact

- Official base: `node:24.21.0-alpine3.24@sha256:83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a`, linux/amd64, Alpine 3.24.
- Candidate build: `polyhunter-dev:ph-m02-alpine-candidate`, manifest sha256:c693fd1a325107969daf9dc4d2cfb06b10842fddbfe4f0304b06fd24bf149c32, config sha256:5957b287053d30a5c647ff8979891703e52e3b16059e4bd0f3e28ab484a9b7cf.
- Candidate Dockerfile SHA-256: 270f825b3fe778159fcecda5a3fe242c8f6089d3e58c295f630391cb8bcd51e6 (preserved as node24-alpine324-candidate.Dockerfile).
- Canonical final build: `polyhunter-dev:local@sha256:6a6c3d9dda7cd7c5d392d34cf28b00034909b4cae14af364a016aae46d7604e2`; its exact image metadata is dev-alpine-final-image-inspect.json.
- Only OS-package change: Alpine v3.24/main zlib 1.3.2-r0 → 1.3.2-r1. The Dockerfile compares installed package inventories and fails if any package other than zlib changes. No repository mixing or broad upgrade.

## Early canary gates

- Docker Scout exact candidate SARIF: dev-alpine-candidate.sarif.json; receipt dev-alpine-candidate-scan-receipt.json. Result: 6 unique findings, 6 MEDIUM, 0 HIGH, 0 CRITICAL; zero suppressions.
- Node v24.21.0 and npm 12.2.0; npm 12.2.0 engine range supports Node >=24.15.0. Candidate Docker build ran npm ci --ignore-scripts: 159 packages added, 167 audited, zero vulnerabilities.
- All seven npm workspaces linked; @next/swc-linux-x64-musl loaded and exposed transform plus 21 bindings; Rollup linux-x64-musl resolved; Biome CLI 2.5.15 executed.
- Targeted provider/package-boundary command: `npm test -- tests/polymarket-rest.test.ts tests/polymarket-stream.test.ts tests/polymarket-decimal.test.ts tests/polymarket-boundary.test.ts tests/workspace-boundaries.test.ts --testTimeout=30000`: 5 files / 43 tests PASS. The initial default 5-second boundary timeout on the Windows host bind mount was rerun at 30 seconds; the retry passed.
- Isolated Compose canary: web HTTP 200 at localhost:3100, worker running as node UID 1000, PostgreSQL healthy. The canary used a separate Compose project and named volumes; it was stopped after proof.

The canary passed the review's early gates. Promotion was based on deterministic build, tests and scan evidence; JEV returned a bounded advisory recommendation to promote and did not approve vulnerabilities.
