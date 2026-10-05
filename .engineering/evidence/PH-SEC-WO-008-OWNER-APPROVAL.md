# PH-SEC-WO-008 — OWNER APPROVAL

Date: 2026-10-05
Project Owner: KayzenRoot
Work Order: PH-SEC-WO-008
PR: #35
Parent PR: #15

## Binding

Artifact:
`polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`

Independent audit head:
`1deee1e5d4e6984ae61a0883d2fc2fca46d912df`

Independent review:
`5418683462`

## Approved dispositions

1. `CVE-2026-102010`
   - Status: `NOT_AFFECTED`
   - Justification: `vulnerable_code_not_present`

2. `CVE-2026-95619`
   - Status: `NOT_AFFECTED`
   - Justification: `vulnerable_code_cannot_be_controlled_by_adversary`

## Exact owner approval

`APROVO AS 2 DISPOSIÇÕES NOT_AFFECTED DO PH-SEC-WO-008 (CVE-2026-102010 E CVE-2026-95619) PARA O ARTEFATO polyhunter-dev:local@sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3 NO HEAD DE AUDITORIA 1deee1e5d4e6984ae61a0883d2fc2fca46d912df`

## Scope

This approval applies only to the exact artifact digest and exact independent-audit head above.

It does not approve:
- any different image digest;
- any dependency/base-image change;
- any future advisory state;
- any expired/stale VEX evidence;
- any product, trading, signing, secret, auth or schema change.

Revalidation remains governed by ADR-0007 / PH-SEC-VEX-POLICY.

No HIGH/CRITICAL finding is waived, suppressed, severity-downgraded or accepted as risk.
