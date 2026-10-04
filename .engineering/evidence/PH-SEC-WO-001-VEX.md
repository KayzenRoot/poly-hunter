# PH-SEC-WO-001 — VEX por imagem e CVE

**Resultado: BLOCKED_UNRESOLVED** — todos os 80 pares imagem/CVE seguem UNDER_INVESTIGATION.

Inventário: 57 CVE IDs, 80 pares imagem/CVE, 109 ocorrências; timestamp 2026-10-04T00:08:11Z UTC.

## Reconciliação

| Imagem | Digest | HIGH | CRITICAL | Linhas VEX | Ocorrências |
| --- | --- | ---: | ---: | ---: | ---: |
| polyhunter-dev:local | sha256:6c8701d8141745e1625c392da42ff643389ed1dab1fcddd13d8dcff704180caa | 50 | 6 | 56 | 85 |
| postgres:17.11-alpine3.24 | sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 | 22 | 2 | 24 | 24 |

Cada registro JSON é individual por imagem/CVE. Componentes/versões múltiplos, paths, scanner ranges, prerequisite description, controles, refs e índices SARIF estão preservados no registro correspondente.

## Contexto de runtime

- Dev: web/worker UID 1000, CapEff=0; web host binding 127.0.0.1:3000 e worker sem porta; bridge Compose project-scoped, Internal=false; peers comunicam; rootfs/mounts RW, NoNewPrivs=0.
- PostgreSQL: PID 1 UID 70, CapEff=0; porta 5432 sem publicação no host, listen_addresses=* na bridge project-scoped, Internal=false. Probe XML benigna autenticada comprova parser acessível mas não a função CVE específica nem input controlado pela aplicação.
- Os controles são contextuais, não mitigação inline. Nenhum exploit foi executado.

## Findings

| Imagem | CVE | Sev. | Componente(s) e versão(s) | Fix Scout | KEV | EPSS/percentil | Reachability | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| polyhunter-dev:local | CVE-2024-24790 | CRITICAL | stdlib@1.20.7 | 1.21.11 | não | 0.019520/0.795530 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2025-22871 | CRITICAL | stdlib@1.20.7 | 1.23.8 | não | 0.008110/0.554840 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2025-68121 | CRITICAL | stdlib@1.20.7; stdlib@1.23.12 | 1.24.13 | não | 0.009150/0.587800 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-12087 | CRITICAL | debian/perl@5.36.0-7+deb12u3 | não fixado pelo Scout | não | 0.003740/0.290620 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-13221 | CRITICAL | debian/perl@5.36.0-7+deb12u3 | não fixado pelo Scout | não | 0.004320/0.353230 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-39821 | CRITICAL | stdlib@1.20.7; stdlib@1.23.12; stdlib@1.26.4 | 1.25.13, 1.26.6 | não | 0.006920/0.511890 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2022-30635 | HIGH | stdlib@1.20.7 | 1.22.7 | não | 0.018100/0.778690 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2023-39325 | HIGH | stdlib@1.20.7 | 1.20.10 | não | 0.037960/0.896730 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2023-44487 | HIGH | stdlib@1.20.7 | 1.20.10 | SIM | 0.999990/0.999980 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2023-45283 | HIGH | stdlib@1.20.7 | 1.20.11 | não | 0.027580/0.857520 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2023-45288 | HIGH | stdlib@1.20.7 | 1.21.9 | não | 0.919690/0.998180 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2024-24784 | HIGH | stdlib@1.20.7 | 1.21.8 | não | 0.010500/0.630700 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2024-24791 | HIGH | stdlib@1.20.7 | 1.21.12 | não | 0.014140/0.718050 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2024-34156 | HIGH | stdlib@1.20.7 | 1.22.7 | não | 0.011270/0.651790 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2024-34158 | HIGH | stdlib@1.20.7 | 1.22.7 | não | 0.010460/0.629580 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2025-58187 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.24.9 | não | 0.004060/0.325550 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2025-58188 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.24.8 | não | 0.003810/0.298060 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2025-61723 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.24.8 | não | 0.006610/0.498920 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2025-61725 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.24.8 | não | 0.006470/0.492380 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2025-61726 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.24.12 | não | 0.023260/0.829110 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2025-61729 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.24.11 | não | 0.004570/0.374270 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-102010 | HIGH | debian/gcc-12@12.2.0-14+deb12u1 | não fixado pelo Scout | não | 0.002500/0.147990 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-102276 | HIGH | brace-expansion@5.0.7 | 5.0.10 | não | 0.003500/0.263900 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-102278 | HIGH | brace-expansion@5.0.7 | 5.0.11 | não | 0.003500/0.263890 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-103111 | HIGH | debian/pcre2@10.42-1+deb12u1 | não fixado pelo Scout | não | 0.002060/0.096370 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-14257 | HIGH | brace-expansion@5.0.7 | 5.0.8 | não | 0.006430/0.490050 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-19534 | HIGH | undici@6.27.0 | 6.28.1 | não | 0.003940/0.312500 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-25679 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.8 | não | 0.008340/0.562000 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-32280 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.9 | não | 0.006150/0.476230 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-32281 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.9 | não | 0.003550/0.269720 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-32283 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.9 | não | 0.006210/0.479650 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-33811 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.10 | não | 0.008130/0.555370 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-33814 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.10 | não | 0.007810/0.544270 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-33818 | HIGH | stdlib@1.20.7; stdlib@1.23.12; stdlib@1.26.4 | 1.25.13, 1.26.6 | não | 0.005680/0.451040 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-39820 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.10 | não | 0.007840/0.545020 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-39822 | HIGH | stdlib@1.20.7; stdlib@1.23.12; stdlib@1.26.4 | 1.25.12, 1.26.5 | não | 0.002320/0.128300 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-39836 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.10 | não | 0.006200/0.478740 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-42499 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.10 | não | 0.007980/0.549890 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-42504 | HIGH | stdlib@1.20.7; stdlib@1.23.12 | 1.25.11 | não | 0.005600/0.446600 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-46600 | HIGH | stdlib@1.26.4 | 1.26.6 | não | 0.006300/0.483700 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-48959 | HIGH | debian/perl@5.36.0-7+deb12u3 | não fixado pelo Scout | não | 0.006090/0.473250 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-48962 | HIGH | debian/perl@5.36.0-7+deb12u3 | não fixado pelo Scout | não | 0.004950/0.403630 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-56853 | HIGH | stdlib@1.20.7; stdlib@1.23.12; stdlib@1.26.4 | 1.25.13, 1.26.6 | não | 0.005680/0.451040 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-56859 | HIGH | stdlib@1.20.7; stdlib@1.23.12; stdlib@1.26.4 | 1.25.13, 1.26.6 | não | 0.005680/0.451040 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-56862 | HIGH | stdlib@1.20.7; stdlib@1.23.12; stdlib@1.26.4 | 1.25.13, 1.26.6 | não | 0.005680/0.451040 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-57432 | HIGH | debian/perl@5.36.0-7+deb12u3 | não fixado pelo Scout | não | 0.002110/0.102970 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-69152 | HIGH | brace-expansion@5.0.7 | 5.0.9 | não | 0.006470/0.491930 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-69192 | HIGH | ip-address@10.2.0 | 10.3.1 | não | 0.006630/0.499370 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-73566 | HIGH | tar@7.5.19 | 7.5.21 | não | 0.005310/0.428790 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-76642 | HIGH | debian/util-linux@2.38.1-5+deb12u3 | não fixado pelo Scout | não | 0.002160/0.108890 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-78408 | HIGH | debian/util-linux@2.38.1-5+deb12u3 | não fixado pelo Scout | não | 0.001860/0.074540 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-78409 | HIGH | debian/util-linux@2.38.1-5+deb12u3 | não fixado pelo Scout | não | 0.001540/0.039140 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-78410 | HIGH | debian/util-linux@2.38.1-5+deb12u3 | não fixado pelo Scout | não | 0.001560/0.041070 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-82560 | HIGH | debian/perl@5.36.0-7+deb12u3 | não fixado pelo Scout | não | 0.006300/0.483520 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-93748 | HIGH | http-cache-semantics@4.2.0 | não fixado pelo Scout | não | 0.005310/0.428990 | UNCONFIRMED | UNDER_INVESTIGATION |
| polyhunter-dev:local | CVE-2026-95619 | HIGH | debian/gcc-12@12.2.0-14+deb12u1 | não fixado pelo Scout | não | 0.003630/0.278910 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2025-68121 | CRITICAL | stdlib@1.24.6 | 1.24.13 | não | 0.009150/0.587800 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-39821 | CRITICAL | stdlib@1.24.6 | 1.25.13 | não | 0.006920/0.511890 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2025-58187 | HIGH | stdlib@1.24.6 | 1.24.9 | não | 0.004060/0.325550 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2025-58188 | HIGH | stdlib@1.24.6 | 1.24.8 | não | 0.003810/0.298060 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2025-61723 | HIGH | stdlib@1.24.6 | 1.24.8 | não | 0.006610/0.498920 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2025-61725 | HIGH | stdlib@1.24.6 | 1.24.8 | não | 0.006470/0.492380 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2025-61726 | HIGH | stdlib@1.24.6 | 1.24.12 | não | 0.023260/0.829110 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2025-61729 | HIGH | stdlib@1.24.6 | 1.24.11 | não | 0.004570/0.374270 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-25679 | HIGH | stdlib@1.24.6 | 1.25.8 | não | 0.008340/0.562000 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-32280 | HIGH | stdlib@1.24.6 | 1.25.9 | não | 0.006150/0.476230 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-32281 | HIGH | stdlib@1.24.6 | 1.25.9 | não | 0.003550/0.269720 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-32283 | HIGH | stdlib@1.24.6 | 1.25.9 | não | 0.006210/0.479650 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-33811 | HIGH | stdlib@1.24.6 | 1.25.10 | não | 0.008130/0.555370 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-33814 | HIGH | stdlib@1.24.6 | 1.25.10 | não | 0.007810/0.544270 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-33818 | HIGH | stdlib@1.24.6 | 1.25.13 | não | 0.005680/0.451040 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-39820 | HIGH | stdlib@1.24.6 | 1.25.10 | não | 0.007840/0.545020 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-39822 | HIGH | stdlib@1.24.6 | 1.25.12 | não | 0.002320/0.128300 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-39836 | HIGH | stdlib@1.24.6 | 1.25.10 | não | 0.006200/0.478740 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-42499 | HIGH | stdlib@1.24.6 | 1.25.10 | não | 0.007980/0.549890 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-42504 | HIGH | stdlib@1.24.6 | 1.25.11 | não | 0.005600/0.446600 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-56853 | HIGH | stdlib@1.24.6 | 1.25.13 | não | 0.005680/0.451040 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-56859 | HIGH | stdlib@1.24.6 | 1.25.13 | não | 0.005680/0.451040 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-56862 | HIGH | stdlib@1.24.6 | 1.25.13 | não | 0.005680/0.451040 | UNCONFIRMED | UNDER_INVESTIGATION |
| postgres:17.11-alpine3.24 | CVE-2026-86140 | HIGH | alpine/libxml2@2.13.9-r2 | não fixado pelo Scout | não | 0.001570/0.042550 | UNCONFIRMED | UNDER_INVESTIGATION |

## Interpretação individual

Cada linha da tabela referencia o objeto completo do CVE no JSON, com descrição e advisory CNA/upstream, range afetada, fixes, presença, pré-requisitos, entrada controlável, contexto de rede/privilégio, mitigação, VEX justification, expiry e evidence refs reproduzíveis.

CVE KEV: CVE-2023-44487; EPSS baixo e ausência no KEV não sustentam NOT_AFFECTED. O finding HIGH libxml2 tem processamento XML autenticado observado em teste benigno; o caminho xmlSnprintfElements e controle atacante permanecem desconhecidos. Go/nativos/npm e pacotes do dev foram detectados/presentes; as rotinas vulneráveis não foram rastreadas. gosu e libxml2 existem no digest PostgreSQL; reachability específica não provada.

## Gate

HIGH_ASSURANCE: BLOCKED. Todos os 80 findings ficam UNDER_INVESTIGATION. Nenhum NOT_AFFECTED foi proposto ou autoaprovado; PR #15 não foi alterada.
