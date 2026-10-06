# JEV MCP Development Policy

Status: ACTIVE
Effective: 2026-10-06
Owner decision: JEV is installed locally and MUST be used through its real MCP server during PolyHunter development.
Scope: repository-wide engineering governance.
Applies to: Codex execution, coding/debugging, Work Orders, correction rounds, reviews, evidence triage, long-running development sessions and future agent prompts.

## Intent

JEV is not merely a prompting style.

PolyHunter development MUST use the actual locally installed **JEV MCP server** and the tools/capabilities that server advertises to the MCP client.

The executor must not simulate "JEV mode" with the primary LLM when the JEV MCP is expected to be available.

Primary goals:
- reduce expensive primary-model context and reasoning calls;
- make fast typed/bounded judgments through JEV;
- use JEV's full applicable MCP capability set;
- preserve all deterministic, security, audit and owner gates.

## Mandatory MCP discovery

At the beginning of every Codex/development execution:

1. Confirm the JEV MCP server is connected and healthy.
2. Enumerate/discover the tools currently advertised by the installed JEV MCP.
3. Record the discovered tool names/capabilities in the execution/evidence receipt when practical.
4. Use the actual advertised schema for each call.
5. Do not assume a fixed JEV version or hard-code an obsolete tool list.

If the installed JEV MCP exposes capabilities such as claim verification, screening, proposition scoring, semantic find, reranking, classification, bounded decision, comparison, extraction, source audit, diff review or additional future tools, use every capability that is relevant to the current task.

"Use all JEV functionality" means:
- discover the complete current tool surface;
- actively use all relevant capabilities;
- do not call irrelevant tools merely to satisfy a count;
- automatically benefit from newly exposed JEV capabilities in future versions.

## Failure behavior

If a prompt declares JEV MCP REQUIRED and the JEV MCP server is unavailable, unhealthy or exposes no usable tools:

- do not silently substitute the primary LLM for JEV;
- report `BLOCKED_JEV_MCP_UNAVAILABLE`;
- include the MCP discovery/health failure;
- deterministic safe checks may run, but context-expensive reasoning/coding that was expected to route through JEV must not silently continue.

Never request or print the user's JEV/TypeSafe provider key.

## Required development routing

Use this routing order whenever applicable:

### 1. Deterministic tools first

Prefer exact/non-probabilistic mechanisms for:
- Git status/diff/merge-base;
- hashes/fingerprints;
- exact file lookup;
- grep/search/AST/static analysis;
- schema/migration inspection;
- tests;
- lint/typecheck/build;
- CI/status;
- package/dependency inspection;
- scanners and machine-readable receipts.

Do not spend JEV or primary-model calls on questions deterministic tools answer exactly.

### 2. JEV MCP second

Before sending broad context to GPT-6 Luna/Codex reasoning, use the installed JEV MCP for bounded judgments that its advertised tools can answer.

Typical JEV MCP uses include:
- screen files/logs/evidence before they enter primary-model context;
- find the semantically best files/receipts/candidates;
- rerank candidate files/findings/evidence;
- classify changed files or findings;
- verify whether a claim is supported by supplied evidence;
- compare two passages/configurations/decisions;
- decide among a closed set of alternatives;
- score a proposition/confidence when the tool supports it;
- extract bounded fields and then audit those extracted values;
- review a proposed diff as a fast pre-review signal;
- batch many independent bounded judgments in one call where the MCP supports batching.

### 3. Primary engineering model third

Use GPT-6 Luna/Codex reasoning for:
- production code generation/modification;
- non-bounded debugging;
- architecture;
- cryptography/security design;
- concurrency reasoning;
- complex causal analysis;
- novel algorithms;
- synthesis across ambiguous evidence;
- tasks JEV cannot represent as a closed/typed judgment.

JEV reduces primary-model work. It does not replace engineering reasoning where the task is genuinely open-ended.

### 4. Independent audit and owner gates

JEV MCP NEVER replaces:
- deterministic test/CI evidence;
- HIGH_ASSURANCE independent review;
- vulnerability/VEX independent-auditor approval;
- Project Owner approval;
- checkpoint promotion;
- merge authorization;
- live-trading authorization.

## JEV MCP capability usage rules

### Screening before context

When a large set of files/logs/receipts exists:
1. deterministically produce the candidate set;
2. use JEV MCP screening/find/rerank/classify tools if available;
3. send only the selected minimum evidence to the primary model;
4. preserve exact ids/paths so selections are auditable.

### Claim verification

When prose/evidence asserts a bounded claim:
- use a JEV verification/audit capability if available;
- supply the claim plus the smallest supporting evidence;
- treat JEV confidence as advisory;
- security-sensitive conclusions still require primary-model/independent audit.

### Diff review

Before declaring a code delta complete:
- use a JEV review capability if exposed;
- feed only the bounded diff/requirements needed;
- treat it as a pre-review signal, not merge approval.

### Classification and routing

Use classify/decide/probability-style tools, if exposed, to route:
- relevant vs irrelevant files;
- in-scope vs out-of-scope changes;
- duplicate vs distinct findings;
- likely regression vs unrelated failure;
- deterministic-answer vs JEV-answer vs primary-model-escalation.

### Extraction

If JEV exposes extraction:
- use it only for bounded fields;
- audit/verify extracted values with an available JEV audit/verify tool or deterministic check before trusting them.

### Batch over microcalls

Prefer one structured JEV MCP call covering multiple related judgments over many tiny calls when supported.

## JEV data minimization

Never send to JEV MCP:
- plaintext tenant secrets;
- private keys;
- seed phrases;
- auth/session tokens;
- access/refresh tokens;
- JEV/TypeSafe API keys;
- production credentials;
- raw secret keyrings;
- sensitive user data unnecessary for the bounded judgment.

Redact/minimize inputs before JEV calls.

For HIGH_ASSURANCE secret/security work:
- JEV may inspect sanitized metadata/diffs/evidence;
- primary-model reasoning and normal gates remain mandatory.

## Repository-as-memory

Prompts must be delta-first.

Do not paste large project histories already stored in the repository.

Reference exact authoritative artifacts:
- Work Order;
- Context Lock;
- checkpoint;
- ADR/policy;
- prior review id;
- evidence receipt;
- exact HEAD/digest.

The executor reads repository truth directly.

## Prompt standard from now on

Every future PolyHunter Codex prompt must begin with a compact instruction equivalent to:

```
JEV MCP: REQUIRED
Read .engineering/policies/JEV-PROMPT-POLICY.md first.
Preflight: verify the locally installed JEV MCP is healthy and enumerate its currently advertised tools.
Use deterministic tools first.
Use every applicable JEV MCP capability to screen/find/rerank/classify/verify/compare/decide/extract/audit/review or otherwise reduce primary-model work, according to the actual advertised tool schemas.
Batch bounded JEV judgments when possible.
Do not send secrets or provider keys to JEV.
Use GPT-6 Luna/Codex reasoning for code, architecture, security, concurrency and other open-ended engineering.
Do not silently emulate JEV if the MCP is unavailable.
```

Then provide only the exact Work Order/correction delta.

## Work Order / evidence requirements

For substantial execution rounds, the evidence bundle should record when practical:
- JEV MCP health/discovery result;
- advertised JEV tools actually available;
- which JEV tools were used;
- compact purpose of each JEV call;
- which items escalated to the primary model;
- any JEV result rejected because deterministic evidence contradicted it.

Do NOT store API keys, secret values or sensitive JEV payloads in receipts.

## HIGH_ASSURANCE override

For secrets, auth, tenant isolation, crypto, money, trading, signing, HIGH/CRITICAL CVEs or irreversible operations:

- deterministic evidence remains authoritative;
- JEV MCP is an optimization/triage/verification layer;
- GPT-6 Luna/Codex performs the required deep engineering/security reasoning;
- independent audit remains required;
- explicit Project Owner approval remains required where governance says so;
- fail closed on uncertainty.

JEV cost savings must never weaken a security or governance gate.

## Conflict rule

If deterministic evidence conflicts with JEV:
- deterministic evidence wins;
- record the contradiction when material;
- escalate to the primary model if judgment is still required.

If two JEV tools/results conflict or JEV confidence is insufficient:
- do not force a verdict;
- escalate the item to the primary model.

## Compatibility rule

This policy intentionally does not freeze a particular JEV MCP package/version/tool inventory.

The installed local JEV MCP is the runtime authority for its available capabilities.

Future versions may add/remove/rename tools. The executor must discover the active surface and adapt to it rather than treating the examples in this policy as an exhaustive API contract.

## Supersession note

This revision supersedes the earlier 2026-10-06 wording that described JEV mainly as a conceptual bounded-decision layer.

The Project Owner clarified that the intended requirement is use of the **actual locally installed JEV MCP and all applicable functionality it exposes**.

Future PolyHunter prompts must follow this corrected interpretation unless a later explicit Project Owner decision supersedes it.
