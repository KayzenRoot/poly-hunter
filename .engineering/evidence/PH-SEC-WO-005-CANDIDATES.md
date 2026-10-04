# PH-SEC-WO-005 — Matriz de candidatos

**Estado desta captura:** preflight e candidatos A/B/C concluídos; C selecionado por passar o scan e os gates funcionais, A/B rejeitados.
**Capturado em:** 2026-10-04 14:24:50 UTC
**Branch / head de entrada:** `security/ph-m01-dev-go-remediation` / `fc1f9dcbfdb7437ec51c1e19df2dbb8b96300042`
**Parent/base travado:** `fa3e7c5272f4d04f31189867dc324a838279b8be`
**PR de trabalho:** #29, `OPEN` / draft, base `feat/ph-m01-tenancy-persistence`, head igual ao branch.

## Preflight

- Branch local e `origin/security/ph-m01-dev-go-remediation` apontavam para o head `fc1f9dcb…`; checkout limpo antes da criação deste arquivo.
- O parent `fa3e7c5272f4d04f31189867dc324a838279b8be` é ancestral do head e corresponde ao `baseRefOid` da PR #29.
- PR #15 segue `OPEN`, `mergedAt=null`, branch `feat/ph-m01-tenancy-persistence`, head `fa3e7c5272f4d04f31189867dc324a838279b8be`.
- Context Lock validado: 13/13 fingerprints Git correspondem aos blobs dos SHAs travados. Fontes `main` foram conferidas em `64ec83d02dbf9c85ca9718eb319efb44a1d62b76`; fontes `parent` em `fa3e7c5272f4d04f31189867dc324a838279b8be`.
- SARIF travado em `.engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif`: SHA-256 recalculado `e703ff5206493044293ab3ee0a54502223dd0bffa5c8972bee0f8f131e96b86d`; fingerprint Git do Context Lock também confere.
- Reparse do SARIF: 56 CVEs HIGH/CRITICAL únicos totais (50 HIGH, 6 CRITICAL); em escopo, 35 CVEs Go únicos e 64 ocorrências (57 HIGH, 7 CRITICAL). A lista dos 35 CVEs e as 64 ocorrências coincidem com o PH-SEC-WO-004 VEX JSON.
- Ocorrências por binário: nested esbuild `34` (`Go 1.20.7`), top-level esbuild `23` (`Go 1.23.12`), native TypeScript tsc `7` (`Go 1.26.4`). Os três caminhos absolutos são exatamente os do Context Lock.
- Docker Engine acessível nesta máquina (`docker version`: cliente/servidor `29.7.2`). Nenhum build ou alteração de dependências foi feito no preflight.

### Divergência de integridade histórica registrada

O PH-SEC-WO-004 VEX JSON afirma que a fonte SARIF tinha SHA-256 `e811c090d0748d3ebac6ab550e186b6480252e7d63b1733265e25f1561e3c372`. O conteúdo do caminho travado, no parent `fa3e7c5…` e também no parent do PH-SEC-WO-004 `339ef9a…`, recalcula para `e703ff5206493044293ab3ee0a54502223dd0bffa5c8972bee0f8f131e96b86d`. Apesar da diferença documental, o arquivo atual passa o fingerprint do Context Lock e sua lista exata de CVEs, quantidade de ocorrências, versões, severidades e caminhos binários coincide com o VEX anterior. A discrepância fica explícita para auditoria; nenhuma evidência foi silenciosamente substituída.

## Metadata npm consultado antes de editar dependências

Consultas `npm view` ao registry npm, em 2026-10-04; dist-tag `latest` e metadata por versão estável:

| Pacote | Stable/latest observado | Metadata relevante para a decisão |
|---|---:|---|
| `esbuild` | `0.28.2` | Node `>=18`; estável e mais novo que as versões embutidas nos três bins originais. |
| `vite` | `8.3.2` | Node `^20.19.0 || >=22.12.0`; usa `rolldown`, não declara esbuild como dependência direta; peer opcional/compatível reportado para esbuild `^0.27.0 || ^0.28.0`. Último stable Vite 7 consultado: `7.3.6`, também com esbuild `^0.27.0 || ^0.28.0`. |
| `vitest` | `5.0.3` | Node `^22.12.0 || ^24.0.0 || >=26.0.0`; aceita Vite `^6.4.0 || ^7.0.0 || ^8.0.0`. A versão instalada `4.1.11` aceita Vite `^6.0.0 || ^7.0.0 || ^8.0.0`, portanto permanece candidata compatível com Vite 8 sem upgrade adicional. |
| `typescript` | `7.0.2` | Stable/latest; metadata lista dependências platform-specific `@typescript/typescript-*` `7.0.2`, incluindo Linux x64. O binário travado 7.0.2 está entre os três findings Go. Stable 6.x consultado: `6.0.3`, sem dependências/optionalDependencies reportadas; será avaliado como alternativa não nativa. |
| `drizzle-kit` | `0.31.11` | Stable/latest; continua dependendo de `esbuild ^0.25.4` e `@esbuild-kit/esm-loader ^2.5.5`, sem versão upstream estável mais nova que elimine a cadeia. |
| `@esbuild-kit/esm-loader` | `2.6.5` | Deprecated: merged into `tsx`; depende de `@esbuild-kit/core-utils ^3.3.2`. |
| `@esbuild-kit/core-utils` | `3.3.2` | Deprecated: merged into `tsx`; depende de `esbuild ~0.18.20`. |

Versões estáveis travadas no root antes de candidatos: Vite `6.4.3`, Vitest `4.1.11`, TypeScript `7.0.2`, Drizzle Kit `0.31.11`. O `package.json` mantém Node `>=22 <27`; imagem dev usa Node 24.

## Matriz inicial — ordem de teste

| Candidato | Mudança isolada a testar | Efeito esperado / gate para adoção |
|---|---|---|
| A — upgrades upstream estáveis | Vite `8.3.2`, mantendo Vitest `4.1.11` por compatibilidade de peer; Drizzle Kit `0.31.11` e TypeScript `7.0.2` continuam nos seus latest stable atuais. | Verificar se Rolldown elimina o binário top-level e se a cadeia Drizzle ainda instala o esbuild `0.25.x` e o nested `0.18.20`. Só adotar se Vite/Vitest, typecheck, build, testes e integração passarem. |
| B — Vite 7 e override estreito de esbuild | Como A deixou bins vulneráveis, testar Vite estável `7.3.6` (compatível com Vitest `4.1.11` e declarando suporte ao esbuild `^0.27 || ^0.28`) e `0.28.2` somente nos edges sob `drizzle-kit` (`drizzle-kit > esbuild` e `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild`). | A versão do Vite é suportada pelo peer range do Vitest; o override exclui os ranges declarados `^0.25.4` e `~0.18.20` de Drizzle e core-utils. Nenhum override global. Requer gates de generate/migrate, Vite/Vitest, typecheck, build, testes e integração. |
| C — TypeScript stable não nativo | Sobre B, testar TypeScript `6.0.3`, stable sem dependência de binário nativo, no lugar do `7.0.2` que inclui `@typescript/typescript-linux-x64` compilado em Go. | Só adotar após typechecks, builds, testes, Next build e integração passarem sem mudança de código de produto. Sem prerelease, beta, RC ou nightly. |

**Isolamento obrigatório:** os candidatos serão alterados e instalados apenas numa worktree descartável baseada no head de entrada `fc1f9dcb…`; os resultados não serão promovidos para a branch da PR até os gates definidos no Work Order passarem. Esta matriz é a captura anterior à primeira alteração de manifest/lockfile. O resultado de cada tentativa será anexado nesta mesma matriz e acompanhado por trees e receipts.

## Sem edição até esta captura

Até a gravação desta matriz não houve alteração de `package.json`, `package-lock.json`, manifests de workspace, Dockerfile, Compose ou código. O único arquivo criado no checkout foi este registro de candidatos, exigido pelo Work Order antes de qualquer edição.

## Resultados dos candidatos isolados

Capturados após testes na worktree descartável baseada em `fc1f9dcb…`; os manifests desta worktree ainda não foram promovidos ao branch da PR.

| Candidato | Imagem Docker (ID local) | Resultado funcional | Scan Docker Scout 1.24.0 | Decisão |
|---|---|---|---|---|
| A — Vite 8.3.2, Vitest 4.1.11, TS 7.0.2 | `ph-sec-wo005-candidate-a:local`, `sha256:51c2c0c950f3cd0c99bff6b151f4ef8f9b0a421b5c9a3e7508423cac967f1c05` | Docker `npm test` 7/7, typecheck e Next build passaram; instalação/teste host encontrou binding Rolldown ausente no Windows; `npm ci` sobre volume do bind mount também encontrou `ETXTBSY` no esbuild. | SARIF SHA-256 `78d29b61a4b7fc9390fcd8842d06743372d5296fc72d9c6c18779d5b4b8f3adb`; 57 findings HC únicos / 86 ocorrências; os 35 CVEs Go e 64 ocorrências originais permanecem. Nenhum novo tuple HC frente ao rescan da imagem base. | Rejeitado: não remedia os bins Go e teve falhas no fluxo host do ambiente Windows. |
| B — Vite 7.3.6 + override esbuild 0.28.2 sob Drizzle, TS 7.0.2 | `ph-sec-wo005-candidate-b:local`, `sha256:79fc64e7d771e4c454dc46e35cd75f629207b6ce04e422c7f87348d613ad2ae7` | `npm ci` e build Docker `--pull --no-cache` passaram; árvore confirma esbuild 0.28.2 em todos os edges. Override de Drizzle está fora dos ranges upstream documentados. | SARIF SHA-256 `7c93c001229ca8a0a6c0e7b41f23d68c04e73885d4472f84de41b410c6668c4a`; 29 findings HC únicos / 29 ocorrências, incluindo apenas 7 ocorrências Go do tsc nativo; sem novos tuples HC frente ao baseline reescaneado. | Parcial: removeu esbuild Go, mas mantém os 7 findings Go do TSC; não pode ser adotado sozinho. |
| C — B + TypeScript 6.0.3 | `ph-sec-wo005-candidate-c:local`, `sha256:95b48a30bf838fcb49e93e34676517275b5bcac9a675266b6913e5fedfa35d55` | `npm ci`, `npm run validate`, generate Drizzle sem drift, migrations em PostgreSQL descartável e 4 testes de integração passaram; build Docker Node 24 `--pull --no-cache` passou. `npm audit --audit-level=high`: 0 vulnerabilities. | SARIF SHA-256 `ae4819ad65096ee74634c7987540eda82837e3ca280ac7d692e5b6f2245d278d`; 22 findings HC únicos / 22 ocorrências, zero Go HC e zero novos tuples HC frente ao rescan do baseline. Os 22 são findings não-Go preexistentes fora do escopo do WO. | Selecionado: satisfaz o gate dos 35 CVEs Go, sem introduzir tuple HC, com validação funcional completa. |

### Referências de imagem e lineage

- Baseline local exato: `polyhunter-dev:local`, imagem `sha256:6c8701d8141745e1625c392da42ff643389ed1dab1fcddd13d8dcff704180caa`; rescan SARIF SHA-256 `0dd7542f4b06cce787b4fa9aacb6b81961cc7b039f8c098a9d6ff2035422fcf6`, 57 HC únicos / 86 ocorrências; Go 35/64.
- Todas as imagens candidatas usam `node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` e foram geradas em worktree isolada. Scout `v1.24.0`, commit `b1c9331b2166aef7ec690aa16fd655b8798ea4c6`, Go `1.26.3`; receipts SARIF ficam em `PH-SEC-WO-005/candidates/`.
- Binários no candidato A: esbuild `0.18.20` SHA-256 `82afa0d18098bef823ba5b5c89bb5cfbea1a25f0721416d29a9dd7ba73fd237d` / Go `1.20.7`; Drizzle esbuild `0.25.12` SHA-256 `bab29b2ca7a9e89b67cf720b77b2d743f9f31f5cf0d5bd74ee8c8de30ced7014` / Go `1.23.12`; TSC Go `1.26.4`, SHA-256 `4f2de678286401759b3fb4475bafe35b8f32b4b3a07d92642bbf37eadc9b34a4`.
- Candidato B mantém apenas TSC Go `1.26.4` com SHA `4f2de678286401759b3fb4475bafe35b8f32b4b3a07d92642bbf37eadc9b34a4`; esbuilds são `0.28.2`. Candidato C contém esbuild `0.28.2` (hash do binário Linux nos quatro paths: `e1698a3d5c6c0798fee4fd3b5cc816651f460c63d390a7a26ea4beb0b1884100`, `go version -m` informa não ser executável Go) e não contém o path do TSC Go. `tsc --version` reporta `6.0.3`.
- Candidate C testes de banco usaram PostgreSQL `17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` em container/rede descartáveis; migration PASS e integração 4/4 PASS. Containers descartáveis foram removidos.
- A reconstrução `--pull --no-cache` no worktree autorizado produziu a imagem final `polyhunter-dev:local` ID `sha256:ed140fd525aaacea4ddceb51e97c7215f6a6a9af1bfc0f62d7f8db5419297ba3`; o scan final foi repetido neste ID e gerou SARIF SHA-256 `ae4819ad65096ee74634c7987540eda82837e3ca280ac7d692e5b6f2245d278d`, idêntico ao scan isolado de C.

### Observações ambientais

- Docker Scout retornou resultados SARIF completos; a mensagem de cleanup do arquivo temporário após o scan foi apenas warning de limpeza e não alterou o status do scan.
- No Windows, o checkout de candidato precisou de normalização CRLF→LF local em `vitest.integration.config.ts` para a checagem Biome de formato. O blob Git permaneceu idêntico ao HEAD; nenhum arquivo de produto foi promovido por essa normalização.
- A comparação “sem novos tuples” usa o rescan atual da imagem base exata, não o SARIF histórico desatualizado; o CVE-2026-85091 já aparece no rescan da imagem base e não é introduzido pelo candidato.
