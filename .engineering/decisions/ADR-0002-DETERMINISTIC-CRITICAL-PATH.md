# ADR-0002 — Deterministic trading critical path

Status: APPROVED.

## Decision
Trading authority is Market Data -> Strategy Proposal -> Risk -> Execution -> Reconciliation. LLM/AI output is advisory data only and cannot bypass or replace deterministic Risk/Execution.

## Consequences
AI outage does not weaken safety. AI outputs are validated, bounded, cached/expired and treated as untrusted input. No prompt or model response is an executable trading instruction by itself.
