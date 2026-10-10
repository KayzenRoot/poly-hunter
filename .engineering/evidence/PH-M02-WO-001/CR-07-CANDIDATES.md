# PH-M02-WO-001 CR-07 — Candidate comparison

Recorded before changing `Dockerfile.dev`. Candidates were built or scanned in isolated local image tags; the repository product configuration remains unchanged at this point.

Scanner: Docker Scout CLI `1.24.0`; raw candidate SARIF and command logs are stored beside this file. Node remained major `24` in every candidate.

| Candidate | Official base / digest | Runtime | OS packages relevant to the 23 original findings | npm-bundled findings | Docker Scout HIGH / CRITICAL | Result |
|---|---|---|---|---|---:|---|
| A — current official Bookworm | `node:24-bookworm-slim`, `sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20`; this equals the currently pinned base | Node `v24.21.0`; npm `11.19.0`; Debian 12 | perl-base `5.36.0-7+deb12u3`; util-linux `2.38.1-5+deb12u3`; gcc-12-base `12.2.0-14+deb12u1`; zlib `1:1.2.13.dfsg-1` | brace-expansion `5.0.7`; undici `6.27.0`; tar `7.5.19`; ip-address `10.2.0`; http-cache-semantics `4.2.0` | 19 / 4 (the current image digest scan) | Re-pulling the official tag resolved to the same base digest; no remediation. |
| B — Bookworm security refresh + stable npm | Same Bookworm digest as A; isolated build installed only the Debian security upgrade for `perl-base` plus npm `12.2.0` | Node `v24.21.0`; npm `12.2.0`; Debian 12 | perl-base `5.36.0-7+deb12u4`; util-linux `2.38.1-5+deb12u3`; gcc-12-base `12.2.0-14+deb12u1`; zlib `1:1.2.13.dfsg-1` | brace-expansion `5.0.9`; undici `6.28.0`; tar `7.5.22`; ip-address `10.5.0`; http-cache-semantics `4.2.0` | 11 / 0 | Improvement, but stale Bookworm packages and npm's own remaining advisory ranges leave more findings than C/D. No internal npm dependency was edited. Image `polyhunter-dev:ph-m02-cr07-candidate-b`, image ID `sha256:c6b07e4f86365ca05b4de5707a55211bd5bcc75023cbdddc81a6c6f4c4dd984d`. |
| C — official Trixie base | `node:24-trixie-slim@sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66` | Node `v24.21.0`; npm `11.19.0`; Debian 13.7 | perl-base `5.40.1-6+deb13u1`; util-linux `2.41.5-0+deb13u1`; gcc-14-base `14.2.0-19`; zlib `1:1.3.dfsg+really1.3.1-1+b1` | brace-expansion `5.0.7`; undici `6.27.0`; tar `7.5.19`; ip-address `10.2.0`; http-cache-semantics `4.2.0` | 10 / 0 | Official same-major base removes the Perl and Bookworm package findings. Global npm is still older than the current stable. Image `polyhunter-dev:ph-m02-cr07-candidate-c`, image ID `sha256:99b7d52c6b6e607b4b3041051a664881775dd8d5816cef0acf99d9862d898cfb`. |
| D — official Trixie + stable npm | Same official Trixie digest as C; isolated clean build updated the global CLI to npm `12.2.0`, without changing npm's nested packages | Node `v24.21.0`; npm `12.2.0`; Debian 13.7 | Same versions as C | brace-expansion `5.0.9`; undici `6.28.0`; tar `7.5.22`; ip-address `10.5.0`; http-cache-semantics `4.2.0` | 6 / 0 | Improved over C, but three npm findings still have fixed compatible versions. Image `polyhunter-dev:ph-m02-cr07-trixie-npm12`, image ID `sha256:f0114a3358a5ee9e298388d8336c84c38df9f7c8f7278f3ac473afcc6cda6c0d`. |
| E — Trixie + npm `12.2.0` with supported in-range npm bundle fixes | Same official Trixie base and stable npm as D. Isolated candidate updated only npm's declared dependency instances to exact patch releases; dependency ranges remained satisfied and no project manifest/lockfile changed | Node `v24.21.0`; npm `12.2.0`; Debian 13.7 | Same versions as D | brace-expansion `5.0.11`; undici `6.28.1`; tar `7.5.22`; ip-address `10.5.0`; http-cache-semantics `4.3.0` | 2 / 0 | Selected for final clean Dockerfile validation: it removes four additional original H findings, retains no new H/C, and the npm workspace command still resolves. Remaining scanner rows are GCC/libstdc++ and zlib, carried to individual VEX review. Image `polyhunter-dev:ph-m02-cr07-candidate-e`, image ID `sha256:6256b167395d79bf5f0eca071d041f483d164fa10aa6f6018507315651df7aa2`. |

## Candidate raw evidence

- A: `.engineering/evidence/PH-M02-WO-001/polyhunter-dev-final.sarif.json` and `polyhunter-dev-scan.txt`.
- B: `dev-candidate-b.sarif.json` and `dev-candidate-b-scan.log`.
- C: `dev-candidate-c.sarif.json` and `dev-candidate-c-scan.log`.
- D: `dev-candidate-c-npm12.sarif.json` and `dev-candidate-c-npm12-scan.log`.
- E: `dev-candidate-e.sarif.json` and `dev-candidate-e-scan.log`; update command receipt `npm-supported-dependency-refresh-candidate.txt`.
- B and C/D clean-build logs: `dev-candidate-c-build.log` and `dev-candidate-c-npm12-build.log`; npm metadata and exact versions/integrities for D/E are recorded in the adjacent receipts.

## Reconciliation caveat

Docker Scout's C/D SARIF does not list the four original util-linux CVEs, although the exact Trixie package is `2.41.5-0+deb13u1`. The live Debian tracker still marks `CVE-2026-78408`, `CVE-2026-78409`, `CVE-2026-78410`, and `CVE-2026-76642` vulnerable for Trixie. For `CVE-2026-78409`, Red Hat states that v2.40/v2.41 are not affected and the affected detached-tree path begins in v2.42; final util-linux v2.41.5 is therefore excluded from the current finding set. The other three version-applicable rows remain in the VEX reconciliation; their absence from SARIF is not treated as remediation.

Candidate D's six Scout HIGHs are `CVE-2026-102276`, `CVE-2026-102278`, `CVE-2026-19534`, `CVE-2026-95619`, `CVE-2026-85091`, and `CVE-2026-93748`. Candidate E's fresh Scout SARIF contains only `CVE-2026-95619` and `CVE-2026-85091`, both HIGH, with zero CRITICAL. All six findings from D were in the original 23-finding set; no new HIGH/CRITICAL ID appeared in E. The four removed npm findings were retested against fixed upstream package releases and are recorded as candidates for FIXED status, subject to final clean-image validation.

## Post-selection security-repository check

After selecting and rebuilding Candidate E, `apt-get update` was run in an isolated copy of the Trixie image and current Debian Trixie plus Trixie-security package metadata was inspected. No newer candidate was available for any of the three residual base packages:

| Package | Installed | Repository candidate | Finding |
|---|---|---|---|
| util-linux | `2.41.5-0+deb13u1` | `2.41.5-0+deb13u1` | No package refresh available; upstream fixes for CVE-2026-76642 and CVE-2026-78408/78410 are newer. |
| zlib1g | `1:1.3.dfsg+really1.3.1-1+b1` | `1:1.3.dfsg+really1.3.1-1+b1` | No Trixie repository refresh available; the Debian 1.3.1 source does not contain `gz_vacate`, while Node embeds a separate zlib copy and its JS binding is evaluated in the VEX receipt. |
| libstdc++6 | `14.2.0-19` | `14.2.0-19` | No Trixie repository refresh available; the exact aligned `operator new` implementation is inspected in `gcc-aligned-new-runtime.txt`. |

Raw apt policy output: `trixie-security-candidate-apt-policy.txt`. Candidate E remains the smallest stable image candidate tested; this check found no supported repository update that improves its residual findings.

## SonarCloud follow-up on selected candidate

The first CR-07 push exposed SonarCloud rule `docker:S6505` on the global npm install because lifecycle scripts were not disabled. The selected Candidate E Dockerfile now passes `--ignore-scripts` to `npm install --global npm@12.2.0`; no dependency versions, project manifests, package-lock, architecture, or product files changed. The final no-cache rebuild produced dev image ID `sha256:1da515470671ec8175b1a1ff77dc408c333c0121f862f23f351288fb19d81fd1`. Fresh Docker Scout results remain 2 HIGH / 0 CRITICAL for dev and 23 HIGH / 2 CRITICAL for the unchanged pinned PostgreSQL image, with zero SARIF suppressions. Build, test and scan receipts are in the evidence directory. The SonarCloud result for the follow-up PR head remains pending until hosted checks finish.
