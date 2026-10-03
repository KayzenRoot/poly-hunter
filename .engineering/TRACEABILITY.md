# MVP Traceability

Status: FROZEN upon merge of PH-PLAN-001.

| Requirements | Scope / module owner | Architecture / contract anchor | Validation / completion |
|---|---|---|---|
| REQ-001, REQ-002, REQ-011, REQ-020 | PH-M01 Identity, Tenancy & Secrets | tenant execution model, DATA-MODEL, API-CONTRACTS, SECURITY | tenant isolation, RBAC, secret-handling tests; DoD Security |
| REQ-003 | PH-M00 + PH-M07 + PH-M12 | mode control API, worker state, live gate | mode/state-machine tests; LIVE gate |
| REQ-004 | PH-M02 + PH-M03 | Polymarket adapter + market-data path | provider integration/reconnect/staleness tests |
| REQ-005 | PH-M04 | Strategy Proposal boundary | replay/paper strategy evidence |
| REQ-006, REQ-008 | PH-M05 | deterministic Strategy -> Risk -> Execution | risk/state-machine/property tests |
| REQ-007, REQ-019 | PH-M10 + PH-M05 | AIProviderPort outside critical path | AI-unavailable and AI-boundary tests |
| REQ-009 | PH-M09 + PH-M06 | admin API + kill/reconciliation path | kill-switch fault/reconciliation tests |
| REQ-010, REQ-015, REQ-018 | PH-M06 | order state, reconciliation, Event Journal, PnL entities | journal, state transition, reconciliation and PnL tests |
| REQ-012, REQ-013, REQ-014 | PH-M02 + PH-M12 | INTEGRATION-CONTRACTS + SECURITY eligibility boundary | auth capability + geoblock fail-closed evidence |
| REQ-016, REQ-017 | PH-M07 + PH-M12 | testkit/replay/paper architecture | conservative fill simulation and live-acceptance evidence |
| REQ-021, REQ-022 | PH-M00 + all Work Orders | AGENTS + Source Hierarchy + HIGH_ASSURANCE path | GEF flow, exact-head audit, CI/evidence |
| REQ-023 | PH-M11 | DEPLOYMENT portability contract | pilot deployment/runbook evidence |
| REQ-024 | PH-M01 + PH-M11 | SECURITY redaction + observability boundary | secret-redaction tests/telemetry review |
| REQ-025 | PH-M08 + docs | UI-UX safety/copy contract | UI/copy audit and DoD trading acceptance |
| REQ-026 | PH-M00 Governance & Harness | local-development Architecture + Deployment contract | docker compose config/build/up, localhost:3000 health, worker-running and shutdown evidence |

All NECESSARY scope items map to PH-M00..PH-M12 in BACKLOG.md. IMPORTANT/FUTURE items do not enter the MVP completion denominator unless explicitly promoted. No requirement is considered implemented by this planning document; this matrix assigns future proof ownership only.
