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
