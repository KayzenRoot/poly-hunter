# PolyHunter Agent Operating Contract

Status: FROZEN upon merge of PH-PLAN-001.

## Roles
- Project Owner approves product intent and material direction changes.
- ChatGPT / Planning Agent owns architecture, canonical planning, Work Orders, GitHub coordination, objective audit and checkpoint promotion.
- Codex is the sole implementation/test/CI/migration executor for product code after an admitted Work Order.
- GitHub CI produces evidence but is not semantic authority.

## Required flow
ANALYZE -> SOURCE CHECK -> NEXT NECESSARY INCREMENT -> WORK ORDER -> CONTEXT LOCK -> PREFLIGHT -> CODEX EXECUTION -> TESTS/EVIDENCE -> PR -> AUDIT -> APPROVED / CORRECTION REQUIRED / BLOCKED -> CHECKPOINT DELTA -> MERGE -> NEXT.

## Authority
Resolve authority through .engineering/SOURCE-HIERARCHY.md. Exact repository evidence controls descriptive state. Frozen decisions, Scope, Requirements, Architecture, Security, Test Plan and DoD control normative state in their domains.

## Risk
Any live order placement, signing authority, credential handling, kill-switch behavior, exposure accounting or irreversible money-impacting action is HIGH_ASSURANCE.

## Hard rules
- Never bypass Polymarket geographic restrictions or eligibility controls.
- Never persist tenant trading secrets in plaintext or logs.
- Never let an LLM bypass deterministic Risk/Execution gates.
- Never claim profitability from a backtest alone.
- Never advance with a known HIGH/CRITICAL defect.
- Never force-push or rewrite history without separate explicit owner authorization.

## Mandatory post-review progress snapshot
After every review/audit verdict, append the Project Progress Snapshot defined in `.engineering/REVIEW-PROGRESS-REPORTING.md`.

At minimum report:
- estimated MVP % complete and % remaining;
- what is proven done and what remains;
- estimated time to next milestone and to MVP when responsibly estimable;
- estimated remaining Codex/executor prompts and review/correction cycles;
- confidence and assumptions.

Repository/Checkpoint evidence controls factual state. Percentages, time and prompt counts are estimates unless explicitly canonicalized. Never report an estimate as proof of completion.

## Agent skills

### Matt Pocock skill invocation

When the `mattpocock-skills` plugin is available, automatically use a model-invoked skill whose description matches the current task; these skills do not require the user to type a slash command. Use `/ask-matt` when skill routing is unclear. User-invoked workflows remain user-led. Do not force-fit a skill or let it override the user's request, this repository's governance/security rules, or deterministic evidence.

Prefer deterministic Git, text search, AST, hashes, tests, lint, typecheck, and build checks whenever they are sufficient. Use Jev only when available and useful for bounded context relevance, triage, classification, reranking, claim verification, comparison, or explicit-gate decisions. Jev output is advisory; never send it secrets or credentials.

### Issue tracker

Issues and specs for this repository live in GitHub Issues. Use the `gh` CLI and follow `docs/agents/issue-tracker.md`.

### Triage labels

Use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` for the five canonical triage roles. Follow `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain layout. Read relevant glossary and ADR material before domain changes; follow the actual paths recorded in `docs/agents/domain.md`.
