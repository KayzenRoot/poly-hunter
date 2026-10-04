# PH-SEC-WO-004 — Evidence Bundle

## Status

**BLOCKED_UNRESOLVED — BLOCKED_STALE_CONTEXT.** A análise técnica dos 35 CVEs Go não começou porque a reconciliação encontrou divergência entre a lista de versões do Context Lock e o SARIF travado. O execution brief exige parar diante de qualquer mismatch. Todas as ocorrências permanecem UNDER_INVESTIGATION; executor não aprovou NOT_AFFECTED.

## Context Lock

- Branch: `security/ph-m01-dev-go-vex`.
- Head antes dos receipts: `b6531aa015cba78313309d977e8c86b3ddd14acc`.
- Parent PR #15 head/base: `339ef9ae3100b022623dfd0cfaa49b66a56cb7f0`, ancestry confirmada, PR #15 aberta e sem merge.
- PR #25: aberta em draft, base `feat/ph-m01-tenancy-persistence` no SHA do parent.
- Canonical policy: `771f75bbd23fd458e67be1d34024e78e39f5b8af`.
- Fingerprints críticos: 11/11 aprovados. Receipt: `PH-SEC-WO-004/context-lock-validation.json`.

## Reconciliação SARIF

- SARIF locked: `.engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif`.
- Scanner Docker Scout 1.24.0; SHA-256 consta nos receipts.
- 56 CVEs HIGH/CRITICAL únicos: 50 HIGH + 6 CRITICAL — PASS.
- 35 CVEs Go stdlib únicos e 64 ocorrências, cobrindo os 3 caminhos travados — PASS.
- Versões observadas nas ocorrências em escopo: `1.20.7` em 34 ocorrências do esbuild nested; `1.23.12` em 23 ocorrências do esbuild de nível superior; `1.26.4` em 7 ocorrências do `tsc` nativo.
- O Context Lock e o brief listam apenas `1.20.7` e `1.26.4`. Omitiram `1.23.12`. Esse é o bloqueio stale e exige correção/recompilação do lock antes de qualquer inspeção técnica dos binários.

A matriz preservada contém uma linha por ocorrência com CVE, severidade, PURL/versão scanner, faixa e fixed version scanner, binário, índice SARIF e motivo de bloqueio. JSON detalhado: `PH-SEC-WO-004/sarif-reconciliation.json`.

## Análise e segurança

Após o mismatch, nenhum dos três executáveis foi copiado, hasheado ou executado. `go version -m`, lineage do npm lockfile, govulncheck, prova de símbolos/código, execução no fluxo Docker, attacker-controlled input, prerequisites, KEV e EPSS ficaram **NOT RUN**. Portanto não há base para classificar qualquer ocorrência como FIXED, NOT_AFFECTED ou AFFECTED; o status fail-closed de cada uma é UNDER_INVESTIGATION.

O receipt `local-image-metadata.json` preserva somente metadata do tag local obtida no preflight; nenhum conteúdo de binário foi acessado. A análise de findings não-Go não foi iniciada.

## Arquivos

- `.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.json`
- `.engineering/evidence/PH-SEC-WO-004-DEV-GO-VEX.md`
- `.engineering/evidence/PH-SEC-WO-004-EVIDENCE.md`
- `.engineering/evidence/PH-SEC-WO-004/` — validation, imagem metadata e reconciliação SARIF/matriz.

Somente esses arquivos de evidência foram criados/modificados. Nenhum arquivo de produto, Dockerfile, Compose, dependência, package-lock, schema, migration ou TenantContext mudou. O digest do índice de recibos exclui o próprio índice para evitar autorreferência.

## STOP CONDITION

Parado no bloqueio real `BLOCKED_STALE_CONTEXT`, conforme execução brief. Retomar somente após corrigir e revalidar Work Order/Context Lock/brief para incluir a versão scanner Go `1.23.12` observada. Não iniciar PH-M01-WO-002; não mergear PR #15.
