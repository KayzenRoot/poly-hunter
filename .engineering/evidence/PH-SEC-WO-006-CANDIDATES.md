# PH-SEC-WO-006 — Candidate Matrix

**Test date:** 2026-10-04

**Branch / preflight head:** security/ph-m01-dev-nongo-remediation / 0240b17d794ee17cb348501061a21600245086e4

**Locked parent:** 6c6c05fc5d332a88b70cd5778ac9bba91df798df

**Scanner:** Docker Scout CLI v1.24.0, commit b1c9331b2166aef7ec690aa16fd655b8798ea4c6
**Policy:** candidate order A → B1 → B2 → C; D is evidence-only. Node major remains 24.

The initial baseline, candidate sequence, and pending comparison rows were recorded after preflight and before any product implementation-file edit. This matrix now contains the measured results from those isolated candidate runs.

## Preflight result

PASS. Branch, ancestry, PR #31 binding, PR #15 open/unmerged state, and all Context Lock critical-source fingerprints matched. The locked CR-01 SARIF has 76 results and exactly 22 unique HIGH/CRITICAL CVEs (20 HIGH, 2 CRITICAL). The 35 unique Go CVEs from PH-SEC-WO-004 are absent. Full command outputs and hashes are under .engineering/evidence/PH-SEC-WO-006/preflight/ and in the Evidence Bundle.

## Locked baseline

- Source: .engineering/evidence/PH-SEC-WO-005/validation/CR-01/polyhunter-dev-cr01.sarif; Context Lock Git blob SHA-1 d3999a5664ec91e2b555d468b6e85c8d04aaabe9.
- SHA-256: 1DE0C65CA652559CAB481DDB09FD95DED25D6691A828F46D402516FA0960451E.
- Baseline exact-set match: 22/22, 20 HIGH + 2 CRITICAL; original Go set: 35 unique, 0 HIGH/CRITICAL.
- Baseline package versions: Perl 5.36.0-7+deb12u3; util-linux 2.38.1-5+deb12u3; gcc-12 12.2.0-14+deb12u1; PCRE2 10.42-1+deb12u1; zlib 1.2.13.dfsg-1; npm brace-expansion 5.0.7, undici 6.27.0, tar 7.5.19, ip-address 10.2.0, and http-cache-semantics 4.2.0.

## Official metadata

Raw Docker Official Image manifests are preserved under preflight/:

- node:24-bookworm-slim: index sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6; linux/amd64 manifest sha256:5cbc7caba8c2c0f0bca675d1b61b9f2857e1cf1853c6164ee9dd409501a936e7.
- node:24-trixie-slim: index sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe; linux/amd64 manifest sha256:b64fccfbcd1ae10d11b969a868b50e1c2530a7054813d5cdea04ac3bce551697.
- node:24-alpine: index sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1; linux/amd64 manifest sha256:83f1c388c31fb2e51f7cbd4dea949b96260798c98f206e8e4696bc93bd964e3a (evidence-only).
- Registry metadata identified stable npm 12.2.0, tarball https://registry.npmjs.org/npm/-/npm-12.2.0.tgz.

## Candidate results

| Order | Candidate and exact base | Node / npm / OS | Vulnerable package versions in image | Docker Scout SARIF (SHA-256) | HIGH / CRITICAL | Decision |
|---|---|---|---|---|---|---|
| A | node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 (amd64 manifest above) | v24.21.0 / 11.19.0 / Debian 12 Bookworm | Perl 5.36.0-7+deb12u3; util-linux 2.38.1-5+deb12u3; gcc-12-base 12.2.0-14+deb12u1; PCRE2 10.42-1+deb12u1; zlib 1:1.2.13.dfsg-1; brace-expansion 5.0.7, undici 6.27.0, tar 7.5.19, ip-address 10.2.0, http-cache-semantics 4.2.0 | candidates/A-scan.sarif — AE4819AD65096EE74634C7987540EDA82837E3CA280AC7D692E5B6F2245D278D | 20 / 2; 76 SARIF results | Rejected: latest official Bookworm digest alone leaves all 22. No new HC; 0/35 prior Go. |
| B1 | Same Bookworm digest; supported security refresh of libpcre2-8-0 only | v24.21.0 / 11.19.0 / Debian 12 Bookworm | PCRE2 10.42-1+deb12u2; Perl 5.36.0-7+deb12u3, util-linux 2.38.1-5+deb12u3, gcc-12-base 12.2.0-14+deb12u1, zlib 1:1.2.13.dfsg-1; brace-expansion 5.0.7, undici 6.27.0, tar 7.5.19, ip-address 10.2.0, http-cache-semantics 4.2.0 | candidates/B1-scan.sarif — 45C281B24BEA0CBE975F6717FB211420932468ACA128DF430D5469237AE4E281 | 19 / 2; 75 SARIF results | Rejected: removes 1 baseline CVE; no new HC; 0/35 prior Go. Bookworm repositories have no newer candidates for the other affected OS packages. |
| B2 | B1 plus complete upstream stable npm 12.2.0 package; no manual private dependency edits | v24.21.0 / 12.2.0 / Debian 12 Bookworm | PCRE2 10.42-1+deb12u2; npm bundle includes brace-expansion 5.0.9, undici 6.28.0, http-cache-semantics 4.2.0; other OS versions unchanged | candidates/B2-scan.sarif — E62D351C4DA8B5EB479E50D8C65EB7A97B4DFF7CEDA7BA69AF95D5BB2281AB8A | 15 / 2; 66 SARIF results | Rejected: removes 5 baseline CVEs; no new HC; 0/35 prior Go. Upstream npm removes only part of its bundled findings; 17 remain. |
| C | Official node:24-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe (amd64 manifest above), no extra mutation | v24.21.0 / 11.19.0 / Debian 13.7 Trixie | gcc-14 14.2.0-19; PCRE2 10.46-1~deb13u2; zlib 1:1.3.dfsg+really1.3.1-1; OpenSSL 3.5.7-1~deb13u2; brace-expansion 5.0.7, undici 6.27.0, tar 7.5.19, ip-address 10.2.0, http-cache-semantics 4.2.0 | candidates/C-final-scan.sarif — D84384F67DBCE0224B668B1F14D7FB9FB7F8BC0145652AB961202BD75CBEDDB4 | 13 / 0; 64 SARIF results | Rejected: removes 10 baseline CVEs but leaves 12 and introduces new OpenSSL CVE-2026-84782. 0/35 prior Go. |
| D | Evidence-only official node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 (amd64 manifest above) | v24.21.0 / 11.19.0 / Alpine 3.24.2 | Remaining findings are npm bundle versions: brace-expansion 5.0.7, undici 6.27.0, ip-address 10.2.0, tar 7.5.19, http-cache-semantics 4.2.0 | candidates/D-scan.sarif — 5F0129F00C4D2BA0936B69CAFD25CAF902D2DDA6DC7541027D40E55A870D1BCB | 8 / 0; 20 SARIF results | Not adopted: 14 baseline CVEs removed, no new HC, 0/35 prior Go; eight npm HIGH remain and libc/distro family changes. |

## Candidate C full gates

Candidate C received the full requested matrix. Results are in PH-SEC-WO-006/validation/C/:

- PASS: npm ci, npm run lint, npm run format:check, npm run typecheck, npm test, npm run build, npm audit --audit-level=high, and npm run validate on Node v24.21.0.
- PASS: db:generate reported no schema changes; migration applied to disposable PostgreSQL 17.11; PostgreSQL integration suite passed 4/4 tests.
- PASS: clean docker build --pull --no-cache against C digest; docker compose config --quiet; candidate C Compose stack healthy; web HTTP 200; worker running; PostgreSQL healthy.
- PASS: Windows-host edit appeared inside the web container and HTTP 200 after automatic Next.js recompilation. Restoring the host file triggered a second automatic reload; original SHA was restored and git diff -- apps/web/app/page.tsx was empty. No touch ran inside a container.
- PASS: worker restart smoke; worker returned to running. Final Scout scan of the same C image digest reproduced 13 HIGH / 0 CRITICAL, including new OpenSSL CVE-2026-84782.
- The first format check found a pre-existing whitespace-only issue in vitest.integration.config.ts. Biome formatting fixed whitespace only; its committed blob hash is unchanged. The full suite was rerun and passed.

The candidate Dockerfile build inputs are retained verbatim as `.Dockerfile.txt` receipts to keep test-only recipes out of source-code analysis. Git blob comparisons confirm all five files are byte-for-byte unchanged; Candidate C's Compose override references `C.Dockerfile.txt`, and the post-rename Compose config check passed. Scan results and SARIF hashes are unchanged. Corrected-head SonarCloud and both Socket checks passed; receipts are in `PH-SEC-WO-006/ci/`.

## Selection / stop result

No tested candidate satisfies zero HIGH/CRITICAL. C is the smallest supported Debian-family transition tested, but has 13 HIGH including one new HIGH. D Alpine leaves eight npm HIGH and is not clean. Status: BLOCKED_UNRESOLVED. Dockerfile.dev, Compose topology, dependencies, application behavior, schema, migrations, and TenantContext were not changed. No candidate is promoted.
