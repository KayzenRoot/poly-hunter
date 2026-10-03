# ADR-0006 — Application-level encrypted secret envelope

Status: CANDIDATE in PH-M01-PLAN-001; APPROVED upon merge.

## Decision
Sensitive tenant credentials are encrypted server-side with Node.js built-in AES-256-GCM before persistence. The master/wrapping key is never stored in Postgres or Git. Records carry tenant, purpose, key version, nonce/IV, authentication tag and ciphertext.

## Consequences
Secret values are write-only/masked in normal UI/API flows. Logging/telemetry must redact values. Key rotation and re-encryption metadata are required before live trading credentials can exist.
