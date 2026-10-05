# PH-SEC-WO-008 — Final two libstdc++ blocker resolution

Issue: #34
Parent implementation: PH-M01-WO-001 / PR #15
Parent head: 5cf4c2ffe7b5365ca4941253f92b612f0322a83d
Branch: security/ph-m01-libstdcpp-final-two
Risk: HIGH_ASSURANCE / SECURITY_BLOCKER_RESOLUTION

## OBJECTIVE
Resolve the final two HIGH findings that still block PH-M01-WO-001 under ADR-0007 by performing exact upstream-source and exact-consumer reachability analysis against the locked PolyHunter development artifact:

- CVE-2026-102010 — libstdc++ / header-only `std::erase_if` binary-heap priority_queue path.
- CVE-2026-95619 — libstdc++ aligned `operator new(size_t, align_val_t)` integer-overflow path.

For each finding, determine one of: FIXED, evidence-complete proposed NOT_AFFECTED, AFFECTED, or UNDER_INVESTIGATION. Fail closed on ambiguity.

## LOCKED CONTEXT
- Exact artifact: `polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`
- Parent PR #15 remains OPEN, DRAFT, unmerged.
- PH-SEC-WO-007 is preserved in the parent.
- Exactly 20 PH-SEC-WO-007 NOT_AFFECTED dispositions are independently audited + explicitly owner-approved for this exact artifact.
- Those 20 rows are out of scope except for drift checks.
- The only unresolved rows are CVE-2026-102010 and CVE-2026-95619.
- PH-M01-WO-002 remains prohibited.

## AUTHORITATIVE UPSTREAM TARGETS
CVE-2026-102010:
- GCC fix commit: `aaa8351f4d2e636f9680a1f0a8ebc2f0a60611e6`
- GCC bug: 127656

CVE-2026-95619:
- GCC fix commit: `59d235ffa5a69231eb42e5290d52dc8c90d28b7a`
- GCC/Red Hat bug reference recorded by locked scanner evidence: 2537811

The executor must retrieve/read the authoritative upstream changes and preserve exact source receipts/commit identities. Scanner prose alone is not sufficient.

## SCOPE
Evidence-only:
1. Revalidate exact image identity, installed `libstdc++6`, Node binary and linked libraries.
2. Capture exact Node/V8 version/build identity in the artifact.
3. Read and diff both upstream GCC fix commits to identify the exact vulnerable operation, arithmetic, types, API/template specialization, trigger constraints and corrected behavior.
4. For CVE-2026-102010:
   - identify the exact binary-heap priority_queue implementation/API affected;
   - determine whether relevant Node/V8 or other shipped C++ consumers can instantiate/call that vulnerable `erase_if` path;
   - because templates may be inlined, do not use dynamic-symbol absence as proof;
   - inspect exact source corresponding to the shipped Node/V8 version and, where needed, binary/disassembly/static evidence;
   - prove attacker-controlled input prerequisites or prove their absence.
5. For CVE-2026-95619:
   - establish the exact overflow formula/threshold from upstream fix;
   - identify every relevant aligned-allocation path in shipped Node/V8/libstdc++ consumers;
   - determine whether JavaScript/web/worker-controlled values can reach an over-aligned allocation size;
   - compare the vulnerable threshold with hard runtime limits (V8 heap/object/string/ArrayBuffer/Buffer/etc.) only when those limits are proven from exact source/runtime evidence;
   - do not infer safety merely from TypeScript surface code.
6. Safe binary/source inspection may use disposable local analysis containers and host tooling.
7. If either row cannot be policy-completely cleared, produce the exact minimal remediation delta and remain blocked.

## OUT OF SCOPE
- Product/domain behavior changes.
- Dockerfile or Compose mutation.
- Package/dependency/base-image mutation.
- Schema, migrations, TenantContext, Supabase Auth, secret vault.
- Polymarket integration or trading logic.
- Scanner suppression, ignore, waiver, severity downgrade or accepted-risk shortcut.
- Malicious/external exploit execution.
- PH-M01-WO-002.

## REQUIRED PREFLIGHT
Before analysis:
1. Verify current branch and merge-base exactly equal parent head `5cf4c2ffe7b5365ca4941253f92b612f0322a83d`.
2. Verify PR #15 is OPEN, DRAFT and unmerged at that head.
3. Verify every Context Lock fingerprint.
4. Verify exact target image digest `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`.
5. Reconcile the locked SARIF to the same 22 HIGH/CRITICAL findings and confirm:
   - 20 owner-approved NOT_AFFECTED rows remain artifact-bound and unexpired at execution time, or explicitly report expiry/revalidation;
   - exactly CVE-2026-102010 and CVE-2026-95619 are unresolved.
6. Verify the original 35 Go HIGH/CRITICAL remain zero.
7. Capture current CISA KEV + FIRST EPSS snapshots for the two target CVEs as prioritisation only.
8. Capture exact Node/V8/libstdc++ identities before source analysis.

Any parent/source/artifact/package drift => STOP `BLOCKED_STALE_CONTEXT`.

## REQUIRED EVIDENCE PER TARGET CVE
- exact scanner tuple and component/version;
- exact upstream advisory + fix commit identity;
- source diff excerpts summarized without overclaim;
- vulnerable code/function/template presence analysis;
- exact shipped consumer set;
- source-version mapping for shipped Node/V8;
- binary/static corroboration where applicable;
- attacker-controlled input path;
- numerical bounds/overflow threshold where relevant;
- privileges/network/filesystem prerequisites;
- runtime phase and exposure;
- CISA KEV/EPSS;
- VEX status + allowed justification when NOT_AFFECTED;
- confidence and residual risk;
- revalidation/expiry trigger;
- immutable receipts.

## SAFETY / QUALITY RULES
- Default is UNDER_INVESTIGATION.
- No claim based solely on symbol absence for header-only/inlined code.
- No claim based solely on "application is TypeScript/JavaScript".
- No claim based solely on low EPSS or absent KEV.
- Numeric infeasibility claims must show exact types, formula and proven runtime bounds.
- Reachability claims must cover Node/V8 and any other relevant compiled consumer in the exact artifact.
- If exhaustive proof is impossible, fail closed.
- No owner approval is implied by executor output.
- Do not mutate the target artifact or dependencies in this Work Order.

## DELIVERABLES
- `.engineering/evidence/PH-SEC-WO-008-EVIDENCE.md`
- `.engineering/evidence/PH-SEC-WO-008-VEX.json`
- `.engineering/evidence/PH-SEC-WO-008-VEX.md`
- `.engineering/evidence/PH-SEC-WO-008/` source/binary/analysis receipts + SHA256SUMS
- updated PR body with exact-head result

## ACCEPTANCE CRITERIA
1. Both target CVEs have complete individual records.
2. Upstream fix commits are read and preserved as evidence.
3. Exact shipped Node/V8 version is mapped to corresponding source evidence.
4. CVE-2026-102010 does not rely on `.dynsym` absence.
5. CVE-2026-95619 includes exact overflow arithmetic/threshold analysis.
6. Consumer/call-path evidence is sufficient for HIGH_ASSURANCE, or row stays UNDER_INVESTIGATION.
7. No product/runtime/dependency mutation.
8. No suppression/waiver.
9. Parent/image/SARIF fingerprints remain locked.
10. Evidence is reproducible and sufficient for independent audit.

## STOP CONDITION
- `READY_FOR_INDEPENDENT_AUDIT`: both CVEs are FIXED or policy-complete proposed NOT_AFFECTED, with no AFFECTED/UNDER_INVESTIGATION.
- `BLOCKED_UNRESOLVED`: either CVE remains AFFECTED/UNDER_INVESTIGATION; provide exact next remediation delta.
- `BLOCKED_STALE_CONTEXT`: any locked source/artifact drift.

Regardless of result, do not start PH-M01-WO-002 and do not merge PR #15.

## COMPLETION / APPROVAL

Independent audit completed at:
`1deee1e5d4e6984ae61a0883d2fc2fca46d912df`

Independent review:
`5418683462`

Owner approval completed on 2026-10-05 for the exact artifact:
`polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`

Receipt:
`.engineering/evidence/PH-SEC-WO-008-OWNER-APPROVAL.md`

Final dispositions:
- CVE-2026-102010 — NOT_AFFECTED / vulnerable_code_not_present
- CVE-2026-95619 — NOT_AFFECTED / vulnerable_code_cannot_be_controlled_by_adversary

PH-SEC-WO-008 is complete as evidence. Its results may be preserved into parent PR #15. PH-M01-WO-002 remains prohibited until PR #15 receives its own final review/promotion decision.
