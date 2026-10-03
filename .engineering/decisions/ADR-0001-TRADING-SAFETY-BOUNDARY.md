# ADR-0001 — Live trading is a HIGH_ASSURANCE boundary

Status: APPROVED.

## Decision
Any operation that can create/cancel a real order, exercise trading-signing authority, change live risk limits, affect tenant/global kill state or mutate material exposure is HIGH_ASSURANCE.

## Consequences
Replay/Paper must precede LIVE. Exact-state evidence, fault tests, reconciliation and recovery are mandatory. Any unresolved HIGH/CRITICAL blocker prevents progression.
