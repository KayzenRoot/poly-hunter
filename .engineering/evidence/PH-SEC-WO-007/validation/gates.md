# PH-SEC-WO-007 / validation gate state

Work Order: PH-SEC-WO-007 (evidence-only)
Branch: security/ph-m01-dev-nongo-vex
Parent head: 7d5be250255bd20cb0b20d6713f6f41c52c73b47
Parent PR: #15 (OPEN, unmerged)
Target image: polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3

**Corrected by the independent audit finding CR-01.** The previous revision of
this file reported `lint`, `format:check` and `typecheck` as `FAIL (pre-existing)`
and stated that the parent head and PR #15 cannot pass `npm run validate`. That
was wrong. Those failures were produced by executing the repository validation
**inside the compose `web` container**, whose `/workspace` is not a faithful view
of the checked-out repository. The parent exact head does pass
`npm run validate`.

## Authoritative verdict: clean checkout

GitHub Actions **`Validate` run #46 / `37243275834`**, `headSha`
`7d5be250255bd20cb0b20d6713f6f41c52c73b47`, event `pull_request`:

| Field | Value |
|---|---|
| Workflow | `Validate` → job `Node 24 validation` |
| Head SHA | `7d5be250255bd20cb0b20d6713f6f41c52c73b47` (**the exact parent head**) |
| Status / conclusion | `completed` / **`success`** |
| Jobs | 1/1 `success` |
| Steps | 16/16 `success`, incl. **`Run required validation gates` → `npm run validate`** |
| URL | https://github.com/KayzenRoot/poly-hunter/actions/runs/37243275834 |

This is the authoritative gate verdict for the parent exact head, because the CI
job reproduces the gate in the conditions the gate is defined for:

1. `actions/checkout` materialises the **complete** repository tree, so every
   tracked file — including `biome.json`, `.gitignore` and
   `apps/worker/tsconfig.json` — is present;
2. `npm ci` installs `@biomejs/biome` **2.5.15** from the lockfile, matching
   `biome.json`'s `$schema` pin;
3. `npm run validate` then runs `lint && format:check && typecheck && test &&
   build && audit --audit-level=high` and exited 0.

Receipts: [`validate-ci-run-46.json`](validate-ci-run-46.json),
[`validate-ci-parent.yml`](validate-ci-parent.yml) (byte-identical to the parent
blob `1efb621ebc4937cfe5a7f4a983a88335f56993e5`).

## Why the in-container run disagreed

The compose `web` service exposes only part of the tree. `/workspace` inside that
container is assembled from the image plus six bind mounts, and the pieces that
govern lint and format behaviour are **not among them**:

| Needed by the gates | Present in the `web` container? | Why |
|---|---|---|
| `biome.json` | **No** | not `COPY`ed by `Dockerfile.dev`, not bind-mounted by `compose.yaml` |
| `.gitignore` | **No** | not `COPY`ed, not bind-mounted, and no `.git` either |
| `apps/worker/**` | **only `package.json`** | `Dockerfile.dev` `COPY`s just the manifests; the `web` service does not bind-mount `apps/worker` (the `worker` service does) |
| `apps/web/.next/**` | **Yes — generated** | named volume `web_next` populated by the running Next dev server |
| `tsconfig.base.json` | Yes, baked at image build | `COPY`ed after `npm ci` |

Each recorded failure follows mechanically:

- **`typecheck` → `TS5058` on `@polyhunter/worker`.** `apps/worker/tsconfig.json`
  **is tracked at the parent exact head** (assertion `G1`) but is absent from the
  container, so `tsc --noEmit -p tsconfig.json` had no project file to read. Not a
  repository defect.
- **`format:check` → 68 errors on tracked files.** With no `biome.json`, Biome
  falls back to its **defaults**, which use tab indentation, while the repository
  config mandates `indentStyle: "space"`. Every space-indented file is therefore
  reported as differing from formatting output. Verified directly: the *same*
  `tsconfig.base.json` bytes **pass** `biome ci` on the host and **fail** inside
  the container, with Biome **2.5.15 in both places** — so this is configuration
  absence, not version drift.
- **`lint` → 990 errors.** With no `biome.json`, the
  `files.includes: ["!.engineering"]` exclusion is gone; and with no `.gitignore`
  and no `.git`, the `.next/` ignore rule cannot apply, so Biome traverses the
  generated `apps/web/.next/dev/**` dev-server output in the `web_next` volume.
  Generated build output, not source.

Mechanism confirmed by 18 deterministic assertions in
[`../analysis/09-container-context.py`](../analysis/09-container-context.py),
13 of them mandatory git/CI assertions that need no container and make the script
exit non-zero on drift. Receipt:
[`container-context-diagnosis.json`](container-context-diagnosis.json) — **18/18
PASS** (13/13 mandatory, 5/5 container probes).

| Check | Assertion | Result |
|---|---|---|
| `G1` | `apps/worker/tsconfig.json` tracked at parent exact head | PASS |
| `G2` | `biome.json` tracked at parent exact head | PASS |
| `G3` | `.gitignore` ignores `.next/` | PASS |
| `C1` | `web` does **not** bind-mount `apps/worker` | PASS |
| `C2` | `web` does **not** bind-mount `biome.json` | PASS |
| `C3` | `apps/web/.next` is a generated volume target | PASS |
| `D1` | `Dockerfile.dev` does not `COPY` `biome.json` | PASS |
| `D2` | `Dockerfile.dev` does not `COPY` `apps/worker/tsconfig.json` | PASS |
| `D3` | `Dockerfile.dev` bakes `node_modules` via `npm ci` | PASS |
| `D4` | lockfile pins `@biomejs/biome` 2.5.15 | PASS |
| `V1` | CI executes `npm run validate` | PASS |
| `V2` | CI does full checkout + `npm ci` (no bind-mount gap) | PASS |
| `V3` | CI run #46 SUCCESS on the exact parent head | PASS |
| `X1` | `biome.json` absent inside the `web` container | PASS |
| `X2` | `.gitignore` absent inside the `web` container | PASS |
| `X3` | `/workspace/apps/worker` holds only `package.json` | PASS |
| `X4` | `apps/web/.next/dev` present inside the container | PASS |
| `X5` | container Biome is 2.5.15, same as the lockfile | PASS |

## Corrected gate state for the parent exact head

| Gate | Verdict | Authority |
|---|---|---|
| `npm run validate` (lint + format:check + typecheck + test + build + audit) | **PASS** | CI run #46 on the exact parent head — authoritative |
| `npm test` | PASS (1 file, 4 tests) | CI run #46 step `Run PostgreSQL tenancy integration tests`; in-container receipt agrees |
| `npm audit --audit-level=high` | PASS (`found 0 vulnerabilities`) | CI run #46 step 6; in-container receipt agrees |
| `npm run lint` | **PASS** | CI run #46. The recorded failure is a container-context artifact. |
| `npm run format:check` | **PASS** | CI run #46. The recorded failure is a container-context artifact. |
| `npm run typecheck` | **PASS** | CI run #46. The recorded failure is a container-context artifact. |
| `git diff --check HEAD` | PASS (no whitespace errors) | in-container receipt; unchanged by this Work Order |
| Product mutation guard | PASS (`git diff HEAD --stat` empty) | in-container receipt; independently re-verified by the preflight |
| CI for **this** evidence-only branch | **NOT EXECUTED — no run exists** | see below |

### This branch has no CI execution

`.github/workflows/validate.yml` triggers only on
`pull_request: branches: [main]` and `push: branches: [main]`. PR #33 targets
`feat/ph-m01-tenancy-persistence`, not `main`, so **no Validate run is ever
created for `security/ph-m01-dev-nongo-vex`** (`gh run list --branch
security/ph-m01-dev-nongo-vex` returns `[]`).

This is recorded rather than glossed over. Consequences:

- The authoritative clean-checkout verdict in this document is CI run #46 **on
  the parent exact head**, which is the correct authority for the question CR-01
  asked ("can the parent head pass `npm run validate`?").
- This branch's own gate state is **not** CI-attested. It is instead covered by
  (a) the empty product diff, (b) the deterministic preflight, and (c) the fact
  that every added file lives under `.engineering/`, which `biome.json` excludes
  via `files.includes: ["!.engineering"]`.
- A branch-level CI attestation would require either retargeting PR #33 to
  `main`, or adding a `pull_request` trigger for the feature branch. Both are
  workflow/branch-policy changes and are **outside this Work Order's authority**;
  they are reported to the owner, not made.

No product, Dockerfile, Compose, dependency, schema, migration, TenantContext or
trading change is implicated, and none was made. **No product change was made to
"fix" these artifacts**, because there is nothing in the product to fix.

## Retained in-container receipts — status reclassified

The files below are preserved verbatim as an observation of how the repository
behaves **when validated inside the compose `web` container**. They are no longer
evidence about the parent head, and they are no longer described as pre-existing
defects. Their diagnostic value is that they are the fingerprint of a container
whose `/workspace` lacks `biome.json`, `.gitignore` and `apps/worker/**`.

| File | Content | Reclassified as |
|---|---|---|
| `check-test.txt` | `npm test` output | agrees with CI |
| `check-audit.txt` | `npm audit --audit-level=high` output | agrees with CI |
| `check-lint.txt` | `npm run lint` (`biome lint .`) output | container-context artifact |
| `check-lint-source-only.txt` | `npm run lint` output — despite the filename this is the **full `biome lint .` run**, not a source-restricted run; the in-container source-only probe was not isolated | container-context artifact; filename retained for index stability |
| `check-format.txt` | `npm run format:check` output | container-context artifact |
| `check-typecheck.txt` | `npm run typecheck` output | container-context artifact |

## Reproduction

```sh
# authoritative, from the exact parent head
git checkout 7d5be250255bd20cb0b20d6713f6f41c52c73b47
npm ci && npm run validate          # exits 0

# the CR-01 mechanism, re-runnable and drift-detecting
python .engineering/evidence/PH-SEC-WO-007/analysis/09-container-context.py
```
