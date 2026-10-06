# JEV Prompt Policy

Status: ACTIVE
Effective: 2026-10-06
Scope: repository-wide prompt/execution policy for PolyHunter
Applies to: ChatGPT planning/audit prompts, Codex execution briefs, Work Order correction prompts, long-run runner prompts and future agent prompts.

## Objective

Use JEV as a low-cost bounded-decision layer to reduce unnecessary primary-model context and calls without weakening correctness, evidence quality or HIGH_ASSURANCE gates.

JEV is advisory. It is not a code generator, not a source of authority and not an approval mechanism.

## Required routing order

For every future prompt/workflow, prefer this order:

1. DETERMINISTIC FIRST
   - Git/diff/status/merge-base
   - exact file/path lookup
   - textual search
   - AST/static analysis
   - hashes/fingerprints
   - tests
   - lint/typecheck/build
   - CI/status receipts
   - schema/migration checks

2. JEV FOR BOUNDED JUDGMENTS
   Use JEV only when a small typed decision can avoid sending broad context to the primary model.

3. GPT-6 LUNA / CODEX FOR ENGINEERING
   Use the primary reasoning/coding model only for work that needs synthesis, implementation, debugging, security reasoning, architecture or non-bounded judgment.

4. INDEPENDENT AUDIT / OWNER GATES
   JEV never replaces independent audit, VEX auditor approval, Project Owner approval, checkpoint promotion or merge authorization.

## Good JEV tasks

Prefer JEV for bounded classification/ranking such as:
- select the minimum relevant files from a candidate set;
- rank evidence by relevance;
- classify a diff as in-scope / out-of-scope / suspicious;
- map findings to known Work Order requirements;
- choose which failed tests/log fragments need primary-model attention;
- deduplicate/re-rank receipts;
- classify evidence as sufficient / insufficient / contradictory;
- confidence routing: deterministic answer vs JEV vs primary model;
- pre-gate triage before an expensive audit.

## Tasks JEV MUST NOT perform

JEV must not:
- generate production code;
- design cryptographic/security primitives;
- make irreversible architecture decisions;
- approve HIGH/CRITICAL vulnerability dispositions;
- approve merge/checkpoint promotion;
- override CI/test failures;
- decide that a HIGH_ASSURANCE finding is safe without the normal audit chain;
- receive secrets, private keys, auth/session tokens, seed phrases, plaintext tenant credentials or other sensitive values.

## Prompt construction standard

All future prompts should be JEV-optimized:

### A. Delta-first
Do not restate the full project history when repository artifacts already contain it.
Reference exact authoritative files and exact HEADs instead.

### B. Repository-as-memory
Point the executor to:
- Work Order;
- Context Lock;
- checkpoint;
- relevant ADR/policy;
- prior review id;
- exact evidence receipts.

Avoid copying those documents into the prompt unless a tiny excerpt is needed to prevent ambiguity.

### C. Deterministic prefilter
Before asking the primary model to reason over many files, use deterministic search/diff/test output to reduce the candidate set.

### D. JEV batch
When multiple bounded judgments are needed, batch them in one JEV call with compact structured input instead of many microcalls.

### E. Structured output
Prefer small typed/structured JEV outputs:
- decision/classification;
- selected ids/paths;
- confidence;
- short reason/evidence ids.

Do not ask JEV for long prose.

### F. Confidence routing
If JEV confidence is low, evidence conflicts, or the issue is security/architecture-sensitive, escalate to the primary model.
Do not force a bounded verdict from uncertain evidence.

### G. Minimal correction prompts
Correction prompts must contain only:
- exact branch/PR/head;
- review id;
- unresolved finding ids;
- minimum required delta;
- exact validation/evidence obligations;
- STOP condition.

Do not repeat already-closed findings except by identifier/status.

### H. No duplicate context
Never resend large evidence bundles, source packs or long logs when hashes/paths/line ranges/receipt ids are sufficient.

## HIGH_ASSURANCE override

For secrets, money, trading, signing, tenant isolation, auth, security, HIGH/CRITICAL CVEs or irreversible operations:

- deterministic evidence first;
- JEV may triage only;
- primary-model engineering/security reasoning remains required;
- independent audit remains required;
- explicit Project Owner approval remains required where governance requires it;
- fail closed on uncertainty.

JEV savings never justify weakening a gate.

## Codex execution pattern

Future Codex prompts should begin with a compact block equivalent to:

JEV MODE: REQUIRED
Read: .engineering/policies/JEV-PROMPT-POLICY.md
Use deterministic tools first.
Use JEV only for bounded triage/reranking/classification.
Batch JEV decisions.
Do not send secrets.
Escalate uncertain/security-sensitive judgment to GPT-6 Luna/Codex reasoning.
Repository artifacts are source of truth; do not request duplicated context.

Then provide only the exact Work Order delta.

## Measurement

When practical, evidence may record:
- candidate files before/after deterministic/JEV filtering;
- number of JEV calls;
- number of primary-model escalations;
- context/tokens avoided if measurable;
- whether JEV changed the final engineering decision.

Do not optimize these metrics at the expense of correctness.

## Stop rule

If JEV and deterministic evidence disagree, or if JEV cannot reach a high-confidence bounded decision:
- stop JEV routing for that item;
- escalate to the primary model;
- preserve the normal Work Order/audit/checkpoint gate.

This policy is repository governance. Future prompts generated for PolyHunter must follow it unless a later explicit Project Owner decision supersedes it.
