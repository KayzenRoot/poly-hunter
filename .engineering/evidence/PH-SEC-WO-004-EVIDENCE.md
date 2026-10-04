# PH-SEC-WO-004 — Evidence Bundle

**Resultado:** `BLOCKED_UNRESOLVED`
**Branch:** `security/ph-m01-dev-go-vex`
**PR:** [#25](https://github.com/KayzenRoot/poly-hunter/pull/25)
**Head de entrada:** `1023a02a201d9e1dc347645c83c686e59d783eac`
**Parent/base:** `339ef9ae3100b022623dfd0cfaa49b66a56cb7f0`

## Preflight

- Releitura: `AGENTS.md`, Work Order, Context Lock e Execution Brief.
- Branch, ancestry, PR/base ao vivo e fingerprints travados conferidos antes de análise; Context Lock PASS (33/33 verificações).
- Reparse do SARIF: 56 CVEs únicos HIGH/CRITICAL (50 HIGH, 6 CRITICAL); 35 Go stdlib únicos; 64 ocorrências; versões 1.20.7, 1.23.12 e 1.26.4; os três caminhos do Context Lock.

## Identidade e ferramentas

- Imagem `polyhunter-dev:local`; Docker daemon image ID `sha256:6c8701d8141745e1625c392da42ff643389ed1dab1fcddd13d8dcff704180caa`. Repo digest local reportado `polyhunter-dev@sha256:6c8701d8141745e1625c392da42ff643389ed1dab1fcddd13d8dcff704180caa` não foi verificado em registry; as hashes dos executáveis foram reproduzidas pelo artefato npm travado.
- SHA-256 por binário e Go build metadata estão na matriz VEX JSON.
- package-lock da imagem bate byte a byte com o lockfile do parent. Os tarballs oficiais npm foram obtidos pelos `resolved` travados; os SRI SHA-512 bateram e cada executável interno teve o mesmo SHA-256 da imagem. Ver `npm-package-lineage-verification.json`.
- govulncheck `v1.8.0` binary/symbol, instalado de `golang.org/x/vuln` dentro de imagem oficial Go pinada `golang@sha256:a688600ca24f8a4d3ca77f95b0dd40704a9fc787c826660eb7ba0b641b8b175d`; SHA-256 do binário `0f5cad04c333d9e2b563dfb9d45b66700fc67ab70ee0adcf28b9622d938bae75`, module sum `h1:clG4qBU6zH5VKjti8n5j8BBuYzoSha392xXMkXS351U=`. Runner exit 0; rootfs read-only, cap-drop ALL, no-new-privileges. Raw outputs e identidade do executável em `govulncheck/` e `govulncheck-tool-identity.json`.
- Go DB `vuln.go.dev`; index e advisories OSV preservados. FIRST EPSS contém 35 IDs na data 2026-10-03. CISA KEV lista: CVE-2023-44487.

## Execução e segurança

- Probes benignos no container web iniciaram ambos esbuild por API em memória e o wrapper npm do tsc executou o binário nativo exato. Processos uid 1000/CapEff 0; probe sem TCP/TCP6 FD, usando AF_UNIX/stdio.
- Fluxos Compose anotados por pacote/scripts; migration e integração não foram executadas por poderem alterar PostgreSQL. App-source search não encontrou spawn/execFile/esbuild/typescript nos arquivos `.ts/.tsx/.js/.mjs` sob `apps/` e `packages/` (exit 1, sem matches).
- Compose atual: web healthy, host `127.0.0.1:3000`; worker sem porta publicada. Worker nodemon relança script que clean-exit. Recibos de processo/config/log preservados.

## Disposições

- JSON VEX traz 64 registros por ocorrência com pacote/símbolos, scanner e versão, hash exato, linha npm, ferramenta, caminho real, candidato a input controlado, pré-condições do advisory, network/privilege, KEV, EPSS, referências, expiração e missing proof.
- Símbolos foram confirmados em 61 ocorrências; 3 seguem sem match e sem prova de ausência. Mesmo nas demais, binary scan e probes não provaram reachability do símbolo vulnerável nem attacker control.
- 64/64 `UNDER_INVESTIGATION`; 35/35 agregados bloqueadores. Resultado `BLOCKED_UNRESOLVED`. Nenhuma dispensa ou autoaprovação.

## Escopo e recibos

- Sem alterações de Dockerfile, Compose, dependências, package-lock, aplicação, schema ou migrations.
- Nenhum finding não-Go analisado; 21 CVEs não-Go foram contados apenas para reconciliação. PR #15 não mergeada.
- Integridade cruzada dos outputs: `evidence-validation.json` PASS (766/766 checks), incluindo hashes de binários, saídas brutas e refs de evidência.
- `receipt-sha256.txt` indexa os entregáveis e todos os recibos, exceto ele próprio para evitar autorreferência.
