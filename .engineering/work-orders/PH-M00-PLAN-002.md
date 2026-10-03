# PH-M00-PLAN-002 — Plan Local Docker Development Runtime

Issue: #8
Base: main@0a464c460d8d198a4e08bf687ae61be77116621d
Branch: planning/ph-m00-local-docker
Risk: STANDARD planning.

## OBJECTIVE
Promote local Docker Compose to a canonical development requirement and prepare PH-M00-WO-002.

## CONTEXT
PH-M00-WO-001 completed the TypeScript/npm-workspaces foundation. The owner now requires all runnable development to stay locally observable through Docker.

## SCOPE
Update canonical Decisions, Requirements, Scope, Architecture, Deployment, Backlog, DoD, Test Plan and Traceability; define the Docker development module contract; prepare implementation Work Order and checkpoint delta.

## OUT OF SCOPE
Docker runtime files, dependency installation, production deployment, database, Polymarket, auth, strategies, secrets and live trading.

## FILES / SOURCES TO READ
Current main Checkpoint, Decisions, Requirements, Scope, Architecture, Deployment, Backlog, DoD, Test Plan, Traceability and PH-M00 foundation state.

## REQUIREMENTS
Local Docker is NECESSARY before PH-M01. It must not be confused with PH-M11 production deployment.

## ARCHITECTURE RULES
Two development services: web on localhost:3000 and continuously running worker; shared Node 24 dev image; non-root; no privileged/socket mount; source feedback through bind mounts; no host node_modules dependency.

## CONSTRAINTS
Planning/docs only. No Dockerfile/compose/runtime mutation in this Work Order.

## ACCEPTANCE CRITERIA
Canonical sources consistently encode REQ-026 and D-0016; module contract and PH-M00-WO-002 are complete; no runtime files are added; checkpoint delta admits implementation only after fresh Context Lock.

## TESTS
Exact diff/path review, source consistency, JSON Context Lock validation, no runtime files.

## DELIVERABLES
Canonical-source delta, module plan, implementation Work Order, Context Lock, Evidence Bundle and proposed checkpoint delta.

## REVIEW FORMAT
APPROVED / CORRECTION REQUIRED / BLOCKED with exact-head evidence.

## STOP CONDITION
Do not implement Docker runtime in PH-M00-PLAN-002.
