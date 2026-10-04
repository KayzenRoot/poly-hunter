# PH-SEC-WO-005 — Evidence Bundle

**Resultado após CR-01:** `READY_FOR_INDEPENDENT_AUDIT` — polling de webpack em desenvolvimento no modo Docker passou a atender o hot reload de edição do host Windows; todos os gates requeridos foram repetidos e passaram. Consulte o [Evidence Addendum CR-01](PH-SEC-WO-005/PH-SEC-WO-005-CR-01-EVIDENCE.md).

**Branch:** `security/ph-m01-dev-go-remediation`
**PR:** #29 (`OPEN`, draft; base `feat/ph-m01-tenancy-persistence`)
**Base travada:** `fa3e7c5272f4d04f31189867dc324a838279b8be`
**Head de entrada:** `fc1f9dcbfdb7437ec51c1e19df2dbb8b96300042`
**Commit de dependências:** `ec7db180218bbb03f633241e1b9a097820b14c1c`
O head final desta evidência é identificável pelo commit/PR que a contém; não é embutido neste arquivo para evitar autorreferência.

## Correção CR-01

O gate de hot reload que havia falhado foi corrigido em `apps/web/next.config.ts`, sem mudança em Compose, Dockerfile, dependências ou página de produto. O preflight atualizado no head de entrada `d2e02ce54e3145f68e34b97e908d5c973043cfc3` validou os 14 fingerprints do Context Lock, confirmou a PR #29 aberta na branch/head esperados, e confirmou a PR #15 `OPEN`/não mergeada. A evidência detalhada da sonda host→container→HTTP, checks finais, runtime e novo scan está em [PH-SEC-WO-005-CR-01-EVIDENCE.md](PH-SEC-WO-005/PH-SEC-WO-005-CR-01-EVIDENCE.md).

## Escopo e preflight

- Execução limitada a PH-SEC-WO-005 na branch e PR indicadas. PH-M01-WO-002, Supabase Auth, secret vault, Polymarket, trading e merge da PR #15 não foram iniciados.
- PR #15 foi confirmada `OPEN`, `mergedAt=null`, no head/base travado `fa3e7c5272f4d04f31189867dc324a838279b8be`.
- PR #29 foi confirmada aberta e draft, com base SHA exata `fa3e7c5272f4d04f31189867dc324a838279b8be`; o head local/remoto no preflight era `fc1f9dcbfdb7437ec51c1e19df2dbb8b96300042`, ancestral da base.
- Todos os 13 fingerprints críticos do Context Lock passaram. Fontes de `main` foram comparadas com `64ec83d02dbf9c85ca9718eb319efb44a1d62b76`; fontes do parent com `fa3e7c5272f4d04f31189867dc324a838279b8be`.
- Reconciliação do SARIF travado: 56 CVEs HIGH/CRITICAL únicos totais (50 HIGH, 6 CRITICAL); 35 CVEs Go stdlib únicos e 64 ocorrências Go (57 HIGH, 7 CRITICAL). Os três binários/versionamentos correspondem ao lock: esbuild nested `1.20.7`/34 ocorrências, esbuild Drizzle `1.23.12`/23 ocorrências e tsc nativo `1.26.4`/7 ocorrências.
- A divergência do SHA que o PH-SEC-WO-004 Evidence declara para o SARIF é registrada no arquivo de candidatos. O SARIF que efetivamente satisfaz o fingerprint do Context Lock foi usado e sua lista/contagem/path coincide com a reconciliação PH-SEC-WO-004.

## Decisão de dependências

O candidato C foi escolhido após testes isolados em worktree descartável. O candidato A (Vite `8.3.2`) manteve os 35 CVEs/64 ocorrências Go; no Windows também houve falha de binding Rolldown e `ETXTBSY` em instalação sobre volume. O candidato B removeu os esbuilds Go, mas manteve 7 ocorrências do TSC Go nativo. Seus resultados, imagem IDs, receipts e trees estão em [PH-SEC-WO-005-CANDIDATES.md](PH-SEC-WO-005-CANDIDATES.md).

O candidato C adotado contém:

- Vite `7.3.6`, stable e compatível com o peer range do Vitest `4.1.11` e com a linha de Node travada (`>=22 <27`; runtime Node 24).
- TypeScript `6.0.3`, stable sem o pacote compilado nativo `@typescript/typescript-linux-x64` que continha o TSC Go.
- Override restrito ao subtree do Drizzle Kit, substituindo `esbuild` por `0.28.2` em `drizzle-kit` e `@esbuild-kit/core-utils`. O override fica fora dos ranges declarados pelo Drizzle Kit (`^0.25.4`) e pelo core-utils (`~0.18.20`); risco de compatibilidade restante está abaixo.
- Vitest `4.1.11` e Drizzle Kit `0.31.11` foram mantidos. Nenhum override global foi aplicado.

O commit de dependências altera somente `package.json` e `package-lock.json`; não altera lógica de aplicação, domínio, schema, migrations, TenantContext, autenticação, Dockerfile ou Compose.

## Evidência de dependency lineage e executáveis

- `PH-SEC-WO-005/candidates/dependency-tree-before.json` registra a árvore da imagem original; SHA-256 `e8535b9df7834d7fc57e3b10a5d231d216f830a127e9987c70b5f36f2e47a4fa`.
- `PH-SEC-WO-005/validation/dependency-tree-final-runtime.json` registra `npm ls --all --json` no runtime do web construído do head corrigido; SHA-256 `e37f5332a1e1e11f1b5175f6799f692bfa507426bbcbd6f03ad46cec683b013f`.
- `PH-SEC-WO-005/validation/dependency-lineage-final.txt` confirma esbuild `0.28.2` em todos os edges Vite/tsx/Drizzle; Vite `7.3.6`; Vitest `4.1.11`; Drizzle Kit `0.31.11`; TypeScript `6.0.3`.
- `PH-SEC-WO-005/validation/tsc-final-version.txt`: `Version 6.0.3`; `native_tsc=ABSENT` no container.
- Candidate C: hash SHA-256 do binário Linux esbuild `e1698a3d5c6c0798fee4fd3b5cc816651f460c63d390a7a26ea4beb0b1884100` nos paths Linux registrados; `go version -m` não identifica esses executáveis como binários Go. O path nativo TSC está ausente.
- Candidate A raw `go version -m` completo em `PH-SEC-WO-005/candidates/candidate-a-go-version-m-complete.txt` documenta SHA e lineage Go dos bins antigos. Candidate B/C raw metadata estão nos respectivos arquivos `candidate-*-go-version-m.txt`.
- Árvore histórica da imagem inicial também está preservada em `PH-SEC-WO-004/npm-ls-tool-lineage.txt`; as árvores JSON before/candidate A/B/C/final são receipts complementares do mesmo lineage.

## Container scan final

- Ferramenta: Docker Scout CLI `v1.24.0`, commit `b1c9331b2166aef7ec690aa16fd655b8798ea4c6`, Go `1.26.3`; versão e output bruto em `PH-SEC-WO-005/validation/docker-scout-version.txt` e `PH-SEC-WO-005/validation/docker-scout-final.txt`.
- Comando: `docker scout cves polyhunter-dev:local --format sarif --output .engineering/evidence/PH-SEC-WO-005/validation/polyhunter-dev-final.sarif`.
- Imagem final local: `polyhunter-dev:local`, image ID/digest `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`. Base: `node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- SARIF SHA-256: `ae4819ad65096ee74634c7987540eda82837e3ca280ac7d692e5b6f2245d278d`.
- Final: 76 findings reportados pelo Scout; 22 CVEs HIGH/CRITICAL únicos — 20 HIGH, 2 CRITICAL — todos não-Go e fora do escopo PH-SEC-WO-005.
- Os 35 CVEs Go originais permanecem com **0** ocorrências HIGH/CRITICAL no scan final. A imagem original reescaneada tinha 57 CVEs HIGH/CRITICAL únicos (77 ocorrências HIGH, 9 CRITICAL); comparação determinística de tuples encontrou **0 novos** tuples HIGH/CRITICAL. Receipt em `PH-SEC-WO-005/validation/sarif-comparison.json`; script repetível em `PH-SEC-WO-005/validation/summarize-scout-sarif.mjs`.
- Todos os três scans candidatos e o rescan do baseline estão em `PH-SEC-WO-005/candidates/*-scan.sarif`. O Candidate C e o scan final produziram o mesmo SHA SARIF, embora seus image IDs locais sejam diferentes.
- Scout retornou sucesso e escreveu o SARIF. A limpeza do arquivo temporário em `%LOCALAPPDATA%\Temp\docker-scout` emitiu warning de arquivo ainda em uso após a indexação; não alterou código de saída ou artefato.

## Checks e runtime

| Check | Resultado | Receipt |
|---|---|---|
| `npm ci` | PASS; 121 packages adicionados, 128 auditados, 0 vulnerabilities; Node `26.4.0`, npm `11.17.0` | `PH-SEC-WO-005/validation/npm-ci.txt` |
| `npm run lint` | PASS, 36 arquivos, sem fixes | `PH-SEC-WO-005/validation/check-lint.txt` |
| `npm run format:check` | PASS após normalização local CRLF→LF somente para a checagem Biome de `vitest.integration.config.ts`; Git blob verificado idêntico ao HEAD, sem alteração staged/commit | `PH-SEC-WO-005/validation/check-format.txt` |
| `npm run typecheck` | PASS em todos os workspaces | `PH-SEC-WO-005/validation/check-typecheck.txt` |
| `npm test` | PASS, 3 arquivos / 7 testes | `PH-SEC-WO-005/validation/check-test.txt` |
| `npm run build` | PASS, incluindo Next.js production build | `PH-SEC-WO-005/validation/check-build.txt` |
| `npm audit --audit-level=high` | PASS, 0 vulnerabilities | `PH-SEC-WO-005/validation/check-audit.txt` |
| `npm run validate` | PASS integral, incluindo os checks acima e audit | `PH-SEC-WO-005/validation/check-validate.txt` |
| `db:generate` | PASS; 4 tabelas, sem schema change/drift | `PH-SEC-WO-005/validation/db-generate.txt` |
| `db:migrate` em banco descartável PostgreSQL | PASS | `PH-SEC-WO-005/validation/db-migrate.txt` |
| `npm run test:integration` em banco descartável | PASS, 1 arquivo / 4 testes | `PH-SEC-WO-005/validation/test-integration.txt` |
| Docker build `--pull --no-cache` | PASS; ID registrado acima | `PH-SEC-WO-005/validation/docker-build-final.txt`, `PH-SEC-WO-005/validation/docker-image-final.txt` |
| `docker compose config --quiet` | PASS | `PH-SEC-WO-005/validation/compose-config.txt` |
| Compose up / HTTP / Postgres / worker | PASS; `http://localhost:3000` HTTP 200, web healthy, Postgres healthy, processo worker Node rodando | `PH-SEC-WO-005/validation/compose-up.txt`, `PH-SEC-WO-005/validation/compose-final-ps.txt`, `PH-SEC-WO-005/validation/compose-http-final.txt`, `PH-SEC-WO-005/validation/worker-process-after.txt` |
| Worker restart | PASS; `StartedAt` mudou de `2026-10-04T16:30:27.114351835Z` para `2026-10-04T16:41:58.405623523Z`; processo Node ativo após restart | `PH-SEC-WO-005/validation/worker-restart-proof.txt`, `PH-SEC-WO-005/validation/worker-process-before.txt`, `PH-SEC-WO-005/validation/worker-process-after.txt` |

### Gate de hot reload do web — falha inicial, corrigida por CR-01

O Compose usa bind mount do worktree Windows para `/workspace/apps/web`. Uma edição temporária do título em `apps/web/app/page.tsx` apareceu no arquivo dentro do container, mas não foi servida e não disparou recompilação por conta própria. Um `touch` executado dentro do container disparou a recompilação e o servidor serviu o conteúdo atualizado; a página foi restaurada, a home original voltou a responder HTTP 200 e não há diff de aplicação no Git. Isso prova que o servidor compila, mas **não** prova hot reload automático a partir de edição no host Windows. A sonda temporária de rota e alteração de título foram removidas/revertidas.

O guia oficial atual do Next.js descreve que a camada de compartilhamento host→VM do Docker Desktop pode atrasar ou não propagar eventos de filesystem; cita como alternativas desenvolvimento sem Docker, arquivos dentro da VM/sistema Linux, ou synchronized file shares, e alerta que polling tem custo. Como PH-SEC-WO-005 proíbe alterar Compose, Dockerfile e configuração da aplicação, não foi aplicado workaround fora de escopo. Fonte primária: [Next.js — Development Environment, Docker pitfalls](https://nextjs.org/docs/app/guides/local-development#2-avoid-common-docker-pitfalls).

O Correction Delta CR-01 autorizou especificamente `apps/web/next.config.ts`. A sonda final descrita no addendum comprovou a resposta HTTP com marcador e a resposta restaurada após edições no host, sem restart/touch dentro do container; a página terminou com SHA idêntico ao original e diff vazio. O callback oficial de configuração webpack é documentado pelo [Next.js](https://nextjs.org/docs/pages/api-reference/config/next-config-js/webpack), e `watchOptions.poll` como intervalo em milissegundos pelo [webpack](https://webpack.js.org/configuration/watch/).

## Arquivos e integridade

- Alterações permanentes: `package.json`, `package-lock.json` (remediação de dependências) e `apps/web/next.config.ts` (somente webpack polling em dev quando `POLYHUNTER_DOCKER_DEV=1`, conforme CR-01).
- Bundle e receipts: este arquivo, `PH-SEC-WO-005-CANDIDATES.md`, `PH-SEC-WO-005/validation/` e `PH-SEC-WO-005/candidates/`.
- Páginas/componentes de aplicação, `Dockerfile.dev`, `compose.yaml`, manifests de workspace, schema e migrations não foram alterados.
- `vitest.integration.config.ts` foi normalizado localmente para executar Biome no Windows; o staged blob foi comparado com HEAD e não tem mudança Git.
- Next gerou referências a `.next/dev` em `apps/web/next-env.d.ts` durante a execução local; o arquivo foi restaurado. A sonda temporária foi removida; o SHA de `apps/web/app/page.tsx` permaneceu igual ao inicial e `git diff -- apps/web/app/page.tsx` ficou vazio. O único diff permitido sob `apps/web` é `next.config.ts`.
- Receipts textuais tiveram apenas padding de espaços/tabs finais removido para revisão do diff; os SARIF/JSON brutos dos scans e os dados relevantes dos comandos foram preservados. `receipt-sha256.txt` lista os hashes resultantes.
- `PH-SEC-WO-005/validation/receipt-sha256.txt` registra SHA-256 dos artefatos individuais e não inclui a si próprio nem este Evidence Bundle.

## Rollback e riscos restantes

- Rollback do código de dependências: `git revert ec7db180218bbb03f633241e1b9a097820b14c1c` e reconstruir a imagem dev com `docker build --pull --no-cache -f Dockerfile.dev -t polyhunter-dev:local .`; recriar web/worker pelo Compose.
- O override `esbuild@0.28.2` está fora do range upstream declarado pelo Drizzle Kit e core-utils; manter teste de migration/generate após atualizações e removê-lo quando upstream corrigir a cadeia deprecated.
- 22 CVEs HIGH/CRITICAL não-Go já presentes permanecem para Work Orders de findings não-Go; não são incluídos nem mascarados neste escopo.
- O polling verifica alterações do filesystem a cada 1000 ms no modo Docker dev e tem custo adicional de CPU proporcional ao volume observado; manteve-se restrito ao webpack dev. Os 22 findings HIGH/CRITICAL não-Go permanecem fora do escopo deste Work Order.
- npm 11 reportou avisos de allowScripts para os bins esbuild; a instalação, build Node 24, validação e execução do app passaram.
- A PR permanece draft e não foi mergeada. Nenhum release/promotion ocorreu.

## STOP CONDITION

Os 35 CVEs Go originais continuam com zero ocorrência HIGH/CRITICAL e o scan final encontrou zero novos tuples HIGH/CRITICAL. Typecheck, build, validate, Compose health, HTTP, worker restart e hot reload automático por polling passaram; `page.tsx` está restaurado e sem diff. **PH-SEC-WO-005/CR-01 termina `READY_FOR_INDEPENDENT_AUDIT`**. Docker Compose foi deixado rodando com web healthy, worker running e Postgres healthy. PR #29 continua aberta e draft; nenhuma PR foi mergeada.
