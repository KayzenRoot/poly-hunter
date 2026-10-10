# Decisions Ledger

Status: ACTIVE.

- D-0001 APPROVED — Product name is PolyHunter; repository is KayzenRoot/poly-hunter.
- D-0002 APPROVED — Build as multi-tenant micro-SaaS from the first product increment.
- D-0003 APPROVED — MVP targets frequent small opportunities, not a single long-held trade and not a guaranteed daily-income quota.
- D-0004 APPROVED — Primary MVP strategy is Micro Maker Scalper; Arbitrage Sentinel is the only secondary MVP strategy.
- D-0005 APPROVED — Maker-first execution is preferred when supported/economic, accounting for actual fees, fill probability and adverse selection.
- D-0006 APPROVED — REPLAY and PAPER precede LIVE.
- D-0007 APPROVED — Deterministic Strategy -> Risk -> Execution is the trading authority; AI is advisory only.
- D-0008 APPROVED — DeepSeek-compatible AI is preferred for low-cost context, behind a replaceable adapter.
- D-0009 APPROVED — Tenant dashboard and owner-only admin dashboard are required.
- D-0010 APPROVED — Tenant and global kill switches are required.
- D-0011 APPROVED — Prefer least-authority scoped/session trading authorization without withdrawal capability when officially supported.
- D-0012 APPROVED — Geographic eligibility is fail-closed and cannot be bypassed.
- D-0013 APPROVED — Pilot deployment should minimize cost and use free tiers where practical; portability/safety outrank zero-cost hosting.
- D-0014 APPROVED — HIGH_ASSURANCE applies to live money, signing, secrets, risk and irreversible trading actions.
- D-0015 APPROVED — Codex is sole product implementation/test/CI/migration executor; ChatGPT owns planning/GitHub coordination/audit.
- D-0016 APPROVED — Local Docker Compose is the standard runnable development environment before PH-M01. The web service must remain observable at http://localhost:3000 and the worker must run in the same local stack. This does not move production deployment/orchestration out of PH-M11.
- D-0017 APPROVED — PostgreSQL is the PH-M01 durable store, Drizzle owns application schema/migrations, local development adds PostgreSQL 17 to Docker, and pilot production targets a portable Supabase Postgres profile.
- D-0018 APPROVED — Supabase Auth is the pilot identity provider behind an IdentityPort/provider adapter; tenant authorization is not delegated to client-supplied metadata.
- D-0019 APPROVED — Tenant authorization derives server-side from authenticated identity plus active membership; owner/admin/member are tenant roles and platform_admin is separate.
- D-0020 APPROVED — Tenant secrets use a server-side AES-256-GCM envelope with key versioning/rotation metadata; plaintext is never persisted or returned in normal read flows.
- D-0021 APPROVED — PH-M01 is split into four HIGH_ASSURANCE increments: persistence/isolation, identity/RBAC, encrypted secret vault, and security acceptance.
- D-0022 APPROVED — HIGH/CRITICAL scanner findings default to UNDER_INVESTIGATION and block. Only FIXED or exact evidence-backed VEX NOT_AFFECTED findings may cease blocking; AFFECTED/UNDER_INVESTIGATION remain blockers. HIGH/CRITICAL NOT_AFFECTED requires independent audit, explicit owner approval, exact artifact binding and expiry/revalidation under ADR-0007.
- D-0023 APPROVED — Every review/audit response must include an evidence-based Project Progress Snapshot with estimated MVP completion/remaining percentages, done/remaining scope, time ranges and remaining executor-prompt estimates. Repository/Checkpoint state remains canonical; forecast values are explicitly estimates under .engineering/REVIEW-PROGRESS-REPORTING.md.
- D-0024 OWNER-APPROVED WITH CONDITIONS / NOT EFFECTIVE UNTIL INDEPENDENTLY AUDITED AND MERGED — Permit dependency-aware multiagent module Work Order waves with contract-first ownership and consolidated tests after wave code freeze, without weakening per-lane admission, HIGH_ASSURANCE, CI, checkpoint or LIVE gates. The Project Owner approved adoption in the current Codex task on 2026-10-10 UTC, conditional on preserving every security, independent-audit, test and dependency gate. Approval does not admit PH-M03+ work or change checkpoint/LIVE state. See ADR-0008 and PH-GOV-PARALLEL-001; this scheduling decision supersedes only the former sequential-admission preference after independent audit and merge.
