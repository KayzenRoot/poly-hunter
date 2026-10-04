# PH-SEC-WO-004 — VEX Go stdlib da imagem dev

## Resultado

**BLOCKED_UNRESOLVED / BLOCKED_STALE_CONTEXT.** O Context Lock passou nos fingerprints e a contagem de findings bate, mas o conjunto de versões Go travado não reconcilia com o SARIF igualmente travado. O execution brief determina parar diante de qualquer mismatch. Não foi iniciada análise de binários; por isso as 64 ocorrências e os 35 CVEs agregados permanecem **UNDER_INVESTIGATION** e bloqueiam a promoção. Nenhuma proposta `NOT_AFFECTED` foi feita ou aprovada.

## Reconciliação determinística

Fonte: `.engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif`, Docker Scout 1.24.0, SHA-256 registrado em `PH-SEC-WO-004/sarif-reconciliation.json`.

| Verificação | Esperado | Observado | Resultado |
|---|---:|---:|---|
| CVEs HIGH/CRITICAL únicos na imagem | 56 (50 HIGH, 6 CRITICAL) | 56 (50 HIGH, 6 CRITICAL) | PASS |
| CVEs únicos Go stdlib em escopo | 35 | 35 | PASS |
| Ocorrências Go stdlib em escopo | 64 | 64 | PASS |
| Caminhos de binário travados | 3 | 3 | PASS |
| Versões Go stdlib | 1.20.7 e 1.26.4 | 1.20.7, 1.23.12 e 1.26.4 | **MISMATCH — STOP** |

| Binário conforme Context Lock | Ocorrências | Versão indicada pelo SARIF |
|---|---:|---|
| `/workspace/node_modules/@esbuild-kit/core-utils/node_modules/@esbuild/linux-x64/bin/esbuild` | 34 | 1.20.7 |
| `/workspace/node_modules/@esbuild/linux-x64/bin/esbuild` | 23 | **1.23.12 (não consta no lock)** |
| `/workspace/node_modules/@typescript/typescript-linux-x64/lib/tsc` | 7 | 1.26.4 |

A divergência é específica e reproduzível: os 23 resultados do esbuild de nível superior carregam `pkg:golang/stdlib@1.23.12` no campo `Package` do resultado SARIF. A lista esperada no Context Lock e brief é somente `1.20.7`, `1.26.4`. Os totais reconciliados não anulam esse mismatch de versão.

## Matriz por ocorrência e agregação

A matriz integral `CVE × binário × versão SARIF`, com índices de resultado, severidade, faixa afetada, versão de correção declarada pelo scanner e referência/hash da fonte está em `PH-SEC-WO-004/sarif-reconciliation.json`. Cada uma das 64 ocorrências está como `UNDER_INVESTIGATION`, bloqueante, e indica explicitamente as provas técnicas não realizadas. A agregação determinística mantém os 35 CVEs únicos como `UNDER_INVESTIGATION`: qualquer ocorrência não resolvida mantém o CVE bloqueando.

## Gate de parada e trabalho não iniciado

Conforme `.engineering/execution-briefs/PH-SEC-WO-004-CODEX.md`, qualquer divergência na reconciliação exige **STOP STALE/BLOCKED**. Após detectar o mismatch, não foram extraídos, hasheados ou executados binários; `go version -m`, govulncheck, análise de packages/symbols, lineage npm, tracing de execução Docker, estudo de attacker-controlled inputs/prerequisites, nem consultas KEV/EPSS não foram iniciados. Isso evita apresentar uma análise de versões diferentes daquelas autorizadas pelo lock.

O Context Lock foi validado antes da análise: branch/head/PR/base/ancestry corretos, PR #15 ainda aberta e sem merge, canonical policy no SHA fixado e 11/11 fingerprints aprovados. Os receipts ficam em `.engineering/evidence/PH-SEC-WO-004/`.

## Próxima condição de retomada

A análise só pode começar de novo quando o Work Order/Context Lock/execution brief forem reconciliados com o SARIF e seus fingerprints forem revalidados, incluindo a ocorrência `1.23.12` no binário esbuild de nível superior. Até essa correção, nenhuma das ocorrências está liberada.

## Escopo

Somente evidência de preflight foi criada. Nenhum Dockerfile, Compose, dependência, package-lock, aplicação, schema, migration ou TenantContext foi alterado. Findings não-Go não foram analisados; PH-M01-WO-002 não foi iniciado; PR #15 não foi mergeada.
