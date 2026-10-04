# PH-SEC-WO-004 — VEX Go stdlib na imagem dev

**Resultado: `BLOCKED_UNRESOLVED`**
**Branch:** `security/ph-m01-dev-go-vex`
**PR:** [#25](https://github.com/KayzenRoot/poly-hunter/pull/25)
**Head de entrada da análise:** `1023a02a201d9e1dc347645c83c686e59d783eac`
**Parent/base travado:** `339ef9ae3100b022623dfd0cfaa49b66a56cb7f0`

## Reconciliação e binários

- Context Lock válido; 11 fingerprints revalidados.
- SARIF parent: `.engineering/evidence/PH-M01-WO-001-container-scans/polyhunter-dev-final.sarif` (SHA-256 `e811c090d0748d3ebac6ab550e186b6480252e7d63b1733265e25f1561e3c372`). 56 CVEs HIGH/CRITICAL únicos (50 HIGH, 6 CRITICAL); 35 Go stdlib únicos; 64 ocorrências.
- Versões scanner: `1.20.7, 1.23.12, 1.26.4`; caminhos binários iguais aos três do Context Lock.
- O `package-lock.json` extraído da imagem é byte a byte igual ao travado no parent. Os três binários foram comparados byte a byte com os membros dos tarballs npm resolvidos pelo lockfile; SRI e SHA-256 coincidem.

| Binário | Go / npm | SHA-256 |
|---|---|---|
| `/workspace/node_modules/@esbuild-kit/core-utils/node_modules/@esbuild/linux-x64/bin/esbuild` | Go `1.20.7` / nested esbuild 0.18.20 | `82afa0d18098bef823ba5b5c89bb5cfbea1a25f0721416d29a9dd7ba73fd237d` |
| `/workspace/node_modules/@esbuild/linux-x64/bin/esbuild` | Go `1.23.12` / top-level esbuild 0.25.12 | `bab29b2ca7a9e89b67cf720b77b2d743f9f31f5cf0d5bd74ee8c8de30ced7014` |
| `/workspace/node_modules/@typescript/typescript-linux-x64/lib/tsc` | Go `1.26.4` / native tsc 7.0.2 | `4f2de678286401759b3fb4475bafe35b8f32b4b3a07d92642bbf37eadc9b34a4` |

## Govulncheck / símbolo

- Hash SHA-256 do executável govulncheck: `0f5cad04c333d9e2b563dfb9d45b66700fc67ab70ee0adcf28b9622d938bae75`; module sum `h1:clG4qBU6zH5VKjti8n5j8BBuYzoSha392xXMkXS351U=`; imagem de análise `golang@sha256:a688600ca24f8a4d3ca77f95b0dd40704a9fc787c826660eb7ba0b641b8b175d`.
- `govulncheck v1.8.0`, modo `binary`, nível `symbol`; Go DB atualizado em `2026-10-01T20:24:15Z`. Outputs brutos JSON e `go version -m` estão em `.engineering/evidence/PH-SEC-WO-004/govulncheck/`.
- Símbolos vulneráveis exatos encontrados em 61/64 ocorrências. Três ocorrências sem hit: CVE-2022-30635, CVE-2023-44487 e CVE-2023-45283. Não foi inferida ausência de código.
- `go tool nm` foi tentado nos três binários e falhou com “no symbol section/no symbols”; stderr/exit codes preservados em `.engineering/evidence/PH-SEC-WO-004/nm/`.
- O modo binário identifica símbolos presentes, mas não prova o call chain para o caminho vulnerável no comando real. Os probes benignos verificaram a execução dos binários, sem acionar as funções vulneráveis.

## Caminho local e input

- Nested esbuild: comando Compose `db:migrate` encadeia Drizzle Kit, loader ESM, core-utils e o `esbuild` travado. O caminho pelo pacote foi verificado com probe em memória dentro do container; migração não foi executada porque pode alterar PostgreSQL.
- Top esbuild: `db:test:integration` encadeia Vitest/Vite/esbuild. O probe em memória iniciou o binário exato; a suíte de integração não foi executada por poder alterar PostgreSQL. O web ativo está em Next `--webpack` e não tinha filho esbuild na captura.
- Native tsc: comandos root/workspace `typecheck` e `build` encadeiam o wrapper TypeScript ao executável nativo; `tsc --help` executou o binário exato sem compilar. O startup Compose não executa tsc.
- Os inputs dos fluxos são código, testes, configuração e schema no workspace. Não foi identificada chamada direta de child process/esbuild/tsc em `apps/` ou `packages/` na busca registrada. Se um contribuinte não confiável controla esses arquivos, essa fronteira não foi resolvida aqui; por isso nenhuma dispensa VEX foi proposta.
- Web saudável, porta publicada apenas no host em `127.0.0.1:3000`; dentro da rede Compose escuta em `0.0.0.0:3000`. Worker sem porta publicada; processo nodemon relança o shell que encerra limpo. Processos amostrados como `node` uid 1000, CapEff 0. Contexto apoiador, não prova de não afetado.

## CVEs únicos

| CVE | Sev. | Ocorr. | Pacotes Go | KEV | EPSS (percentil) | Símbolos encontrados | Status agregado |
|---|---:|---:|---|---|---|---:|---|
| `CVE-2022-30635` | HIGH | 1 | encoding/gob | NOT_LISTED_IN_CISA_SNAPSHOT | 0.018100000 (0.778690000) | 0 | `UNDER_INVESTIGATION` |
| `CVE-2023-39325` | HIGH | 1 | net/http | NOT_LISTED_IN_CISA_SNAPSHOT | 0.037960000 (0.896730000) | 9 | `UNDER_INVESTIGATION` |
| `CVE-2023-44487` | HIGH | 1 | sem atribuição Go direta | LISTED | 0.999990000 (0.999980000) | 0 | `UNDER_INVESTIGATION` |
| `CVE-2023-45283` | HIGH | 1 | internal/safefilepath, path/filepath | NOT_LISTED_IN_CISA_SNAPSHOT | 0.027580000 (0.857520000) | 0 | `UNDER_INVESTIGATION` |
| `CVE-2023-45288` | HIGH | 1 | net/http | NOT_LISTED_IN_CISA_SNAPSHOT | 0.919690000 (0.998180000) | 189 | `UNDER_INVESTIGATION` |
| `CVE-2024-24784` | HIGH | 1 | net/mail | NOT_LISTED_IN_CISA_SNAPSHOT | 0.010500000 (0.630700000) | 6 | `UNDER_INVESTIGATION` |
| `CVE-2024-24790` | CRITICAL | 1 | net/netip | NOT_LISTED_IN_CISA_SNAPSHOT | 0.019520000 (0.795530000) | 6 | `UNDER_INVESTIGATION` |
| `CVE-2024-24791` | HIGH | 1 | net/http | NOT_LISTED_IN_CISA_SNAPSHOT | 0.014140000 (0.718050000) | 13 | `UNDER_INVESTIGATION` |
| `CVE-2024-34156` | HIGH | 1 | encoding/gob | NOT_LISTED_IN_CISA_SNAPSHOT | 0.011270000 (0.651790000) | 2 | `UNDER_INVESTIGATION` |
| `CVE-2024-34158` | HIGH | 1 | go/build/constraint | NOT_LISTED_IN_CISA_SNAPSHOT | 0.010460000 (0.629580000) | 1 | `UNDER_INVESTIGATION` |
| `CVE-2025-22871` | CRITICAL | 1 | net/http/internal | NOT_LISTED_IN_CISA_SNAPSHOT | 0.008110000 (0.554840000) | 1 | `UNDER_INVESTIGATION` |
| `CVE-2025-58187` | HIGH | 2 | crypto/x509 | NOT_LISTED_IN_CISA_SNAPSHOT | 0.004060000 (0.325550000) | 62 | `UNDER_INVESTIGATION` |
| `CVE-2025-58188` | HIGH | 2 | crypto/x509 | NOT_LISTED_IN_CISA_SNAPSHOT | 0.003810000 (0.298060000) | 2 | `UNDER_INVESTIGATION` |
| `CVE-2025-61723` | HIGH | 2 | encoding/pem | NOT_LISTED_IN_CISA_SNAPSHOT | 0.006610000 (0.498920000) | 2 | `UNDER_INVESTIGATION` |
| `CVE-2025-61725` | HIGH | 2 | net/mail | NOT_LISTED_IN_CISA_SNAPSHOT | 0.006470000 (0.492380000) | 10 | `UNDER_INVESTIGATION` |
| `CVE-2025-61726` | HIGH | 2 | net/url | NOT_LISTED_IN_CISA_SNAPSHOT | 0.023260000 (0.829110000) | 4 | `UNDER_INVESTIGATION` |
| `CVE-2025-61729` | HIGH | 2 | crypto/x509 | NOT_LISTED_IN_CISA_SNAPSHOT | 0.004570000 (0.374270000) | 4 | `UNDER_INVESTIGATION` |
| `CVE-2025-68121` | CRITICAL | 2 | crypto/tls | NOT_LISTED_IN_CISA_SNAPSHOT | 0.009150000 (0.587800000) | 18 | `UNDER_INVESTIGATION` |
| `CVE-2026-25679` | HIGH | 2 | net/url | NOT_LISTED_IN_CISA_SNAPSHOT | 0.008340000 (0.562000000) | 10 | `UNDER_INVESTIGATION` |
| `CVE-2026-32280` | HIGH | 2 | crypto/x509 | NOT_LISTED_IN_CISA_SNAPSHOT | 0.006150000 (0.476230000) | 2 | `UNDER_INVESTIGATION` |
| `CVE-2026-32281` | HIGH | 2 | crypto/x509 | NOT_LISTED_IN_CISA_SNAPSHOT | 0.003550000 (0.269720000) | 2 | `UNDER_INVESTIGATION` |
| `CVE-2026-32283` | HIGH | 2 | crypto/tls | NOT_LISTED_IN_CISA_SNAPSHOT | 0.006210000 (0.479650000) | 20 | `UNDER_INVESTIGATION` |
| `CVE-2026-33811` | HIGH | 2 | net | NOT_LISTED_IN_CISA_SNAPSHOT | 0.008130000 (0.555370000) | 4 | `UNDER_INVESTIGATION` |
| `CVE-2026-33814` | HIGH | 2 | net/http | NOT_LISTED_IN_CISA_SNAPSHOT | 0.007810000 (0.544270000) | 50 | `UNDER_INVESTIGATION` |
| `CVE-2026-33818` | HIGH | 3 | encoding/asn1 | NOT_LISTED_IN_CISA_SNAPSHOT | 0.005680000 (0.451040000) | 6 | `UNDER_INVESTIGATION` |
| `CVE-2026-39820` | HIGH | 2 | net/mail | NOT_LISTED_IN_CISA_SNAPSHOT | 0.007840000 (0.545020000) | 14 | `UNDER_INVESTIGATION` |
| `CVE-2026-39821` | CRITICAL | 3 | net/http, net/http/internal/http2 | NOT_LISTED_IN_CISA_SNAPSHOT | 0.006920000 (0.511890000) | 66 | `UNDER_INVESTIGATION` |
| `CVE-2026-39822` | HIGH | 3 | os | NOT_LISTED_IN_CISA_SNAPSHOT | 0.002320000 (0.128300000) | 30 | `UNDER_INVESTIGATION` |
| `CVE-2026-39836` | HIGH | 2 | net | NOT_LISTED_IN_CISA_SNAPSHOT | 0.006200000 (0.478740000) | 62 | `UNDER_INVESTIGATION` |
| `CVE-2026-42499` | HIGH | 2 | net/mail | NOT_LISTED_IN_CISA_SNAPSHOT | 0.007980000 (0.549890000) | 10 | `UNDER_INVESTIGATION` |
| `CVE-2026-42504` | HIGH | 2 | mime | NOT_LISTED_IN_CISA_SNAPSHOT | 0.005600000 (0.446600000) | 2 | `UNDER_INVESTIGATION` |
| `CVE-2026-46600` | HIGH | 1 | net | NOT_LISTED_IN_CISA_SNAPSHOT | 0.006300000 (0.483700000) | 2 | `UNDER_INVESTIGATION` |
| `CVE-2026-56853` | HIGH | 3 | net/http | NOT_LISTED_IN_CISA_SNAPSHOT | 0.005680000 (0.451040000) | 24 | `UNDER_INVESTIGATION` |
| `CVE-2026-56859` | HIGH | 3 | encoding/xml | NOT_LISTED_IN_CISA_SNAPSHOT | 0.005680000 (0.451040000) | 18 | `UNDER_INVESTIGATION` |
| `CVE-2026-56862` | HIGH | 3 | crypto/tls | NOT_LISTED_IN_CISA_SNAPSHOT | 0.005680000 (0.451040000) | 30 | `UNDER_INVESTIGATION` |

CVE-2023-44487 está no CISA KEV e EPSS o coloca em 0.99999 (percentil 0.99998, data 2026-10-03). O índice Go não contém alias direto; o scanner ainda o relata como `stdlib@1.20.7`, e não houve correspondência govulncheck. Mantido como bloqueador até atribuição e símbolos serem esclarecidos.

## Matriz de 64 ocorrências

| SARIF | CVE | Binário | Go | Símbolo vulnerável no binário | Pré-condição/adversary input (advisory) | Status |
|---|---|---|---:|---|---|---|
| `SARIF-0127-CVE-2022-30635` | `CVE-2022-30635` | nested esbuild | 1.20.7 | não confirmado | Stack exhaustion when decoding certain messages in encoding/gob; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0128-CVE-2023-39325` | `CVE-2023-39325` | nested esbuild | 1.20.7 | net/http.ListenAndServe, net/http.ListenAndServeTLS, net/http.Serve … +6 | HTTP/2 rapid reset can cause excessive work in net/http; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0129-CVE-2023-44487` | `CVE-2023-44487` | nested esbuild | 1.20.7 | não confirmado | NVD: HTTP/2 rapid stream-reset DoS; atribuição do scanner a Go stdlib não resolvida; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0130-CVE-2023-45283` | `CVE-2023-45283` | nested esbuild | 1.20.7 | não confirmado | Insecure parsing of Windows paths with a \??\ prefix in path/filepath; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0131-CVE-2023-45288` | `CVE-2023-45288` | nested esbuild | 1.20.7 | net/http.CanonicalHeaderKey, net/http.Client.CloseIdleConnections, net/http.Client.Do … +186 | HTTP/2 CONTINUATION flood in net/http; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0132-CVE-2024-24784` | `CVE-2024-24784` | nested esbuild | 1.20.7 | net/mail.Address.String, net/mail.AddressParser.Parse, net/mail.AddressParser.ParseList … +3 | Comments in display names are incorrectly handled in net/mail; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0133-CVE-2024-24791` | `CVE-2024-24791` | nested esbuild | 1.20.7 | net/http.Client.CloseIdleConnections, net/http.Client.Do, net/http.Client.Get … +10 | Denial of service due to improper 100-continue handling in net/http; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0134-CVE-2024-34156` | `CVE-2024-34156` | nested esbuild | 1.20.7 | encoding/gob.Decoder.Decode, encoding/gob.Decoder.DecodeValue | Stack exhaustion in Decoder.Decode in encoding/gob; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0135-CVE-2024-34158` | `CVE-2024-34158` | nested esbuild | 1.20.7 | go/build/constraint.Parse | Stack exhaustion in Parse in go/build/constraint; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0136-CVE-2025-58187` | `CVE-2025-58187` | top-level esbuild | 1.23.12 | crypto/x509.CertPool.AppendCertsFromPEM, crypto/x509.Certificate.CheckCRLSignature, crypto/x509.Certificate.CheckSignature … +28 | Quadratic complexity when checking name constraints in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0137-CVE-2025-58187` | `CVE-2025-58187` | nested esbuild | 1.20.7 | crypto/x509.CertPool.AppendCertsFromPEM, crypto/x509.Certificate.CheckCRLSignature, crypto/x509.Certificate.CheckSignature … +28 | Quadratic complexity when checking name constraints in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0138-CVE-2025-58188` | `CVE-2025-58188` | nested esbuild | 1.20.7 | crypto/x509.Certificate.Verify | Panic when validating certificates with DSA public keys in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0139-CVE-2025-58188` | `CVE-2025-58188` | top-level esbuild | 1.23.12 | crypto/x509.Certificate.Verify | Panic when validating certificates with DSA public keys in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0140-CVE-2025-61723` | `CVE-2025-61723` | top-level esbuild | 1.23.12 | encoding/pem.Decode | Quadratic complexity when parsing some invalid inputs in encoding/pem; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0141-CVE-2025-61723` | `CVE-2025-61723` | nested esbuild | 1.20.7 | encoding/pem.Decode | Quadratic complexity when parsing some invalid inputs in encoding/pem; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0142-CVE-2025-61725` | `CVE-2025-61725` | nested esbuild | 1.20.7 | net/mail.AddressParser.Parse, net/mail.AddressParser.ParseList, net/mail.Header.AddressList … +2 | Excessive CPU consumption in ParseAddress in net/mail; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0143-CVE-2025-61725` | `CVE-2025-61725` | top-level esbuild | 1.23.12 | net/mail.AddressParser.Parse, net/mail.AddressParser.ParseList, net/mail.Header.AddressList … +2 | Excessive CPU consumption in ParseAddress in net/mail; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0144-CVE-2025-61726` | `CVE-2025-61726` | nested esbuild | 1.20.7 | net/url.ParseQuery, net/url.URL.Query | Memory exhaustion in query parameter parsing in net/url; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0145-CVE-2025-61726` | `CVE-2025-61726` | top-level esbuild | 1.23.12 | net/url.ParseQuery, net/url.URL.Query | Memory exhaustion in query parameter parsing in net/url; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0146-CVE-2025-61729` | `CVE-2025-61729` | nested esbuild | 1.20.7 | crypto/x509.Certificate.Verify, crypto/x509.Certificate.VerifyHostname | Excessive resource consumption when printing error string for host certificate validation in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0147-CVE-2025-61729` | `CVE-2025-61729` | top-level esbuild | 1.23.12 | crypto/x509.Certificate.Verify, crypto/x509.Certificate.VerifyHostname | Excessive resource consumption when printing error string for host certificate validation in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0152-CVE-2026-25679` | `CVE-2026-25679` | nested esbuild | 1.20.7 | net/url.JoinPath, net/url.Parse, net/url.ParseRequestURI … +2 | Incorrect parsing of IPv6 host literals in net/url; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0153-CVE-2026-25679` | `CVE-2026-25679` | top-level esbuild | 1.23.12 | net/url.JoinPath, net/url.Parse, net/url.ParseRequestURI … +2 | Incorrect parsing of IPv6 host literals in net/url; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0154-CVE-2026-32280` | `CVE-2026-32280` | nested esbuild | 1.20.7 | crypto/x509.Certificate.Verify | Unexpected work during chain building in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0155-CVE-2026-32280` | `CVE-2026-32280` | top-level esbuild | 1.23.12 | crypto/x509.Certificate.Verify | Unexpected work during chain building in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0156-CVE-2026-32281` | `CVE-2026-32281` | top-level esbuild | 1.23.12 | crypto/x509.Certificate.Verify | Inefficient policy validation in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0157-CVE-2026-32281` | `CVE-2026-32281` | nested esbuild | 1.20.7 | crypto/x509.Certificate.Verify | Inefficient policy validation in crypto/x509; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0158-CVE-2026-32283` | `CVE-2026-32283` | nested esbuild | 1.20.7 | crypto/tls.Conn.Handshake, crypto/tls.Conn.HandshakeContext, crypto/tls.Conn.Read … +7 | Unauthenticated TLS 1.3 KeyUpdate record can cause persistent connection retention and DoS in crypto/tls; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0159-CVE-2026-32283` | `CVE-2026-32283` | top-level esbuild | 1.23.12 | crypto/tls.Conn.Handshake, crypto/tls.Conn.HandshakeContext, crypto/tls.Conn.Read … +7 | Unauthenticated TLS 1.3 KeyUpdate record can cause persistent connection retention and DoS in crypto/tls; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0160-CVE-2026-33811` | `CVE-2026-33811` | top-level esbuild | 1.23.12 | net.LookupCNAME, net.Resolver.LookupCNAME | Crash when handling long CNAME response in net; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0161-CVE-2026-33811` | `CVE-2026-33811` | nested esbuild | 1.20.7 | net.LookupCNAME, net.Resolver.LookupCNAME | Crash when handling long CNAME response in net; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0162-CVE-2026-33814` | `CVE-2026-33814` | nested esbuild | 1.20.7 | net/http.Client.CloseIdleConnections, net/http.Client.Do, net/http.Client.Get … +22 | Infinite loop in HTTP/2 transport when given bad SETTINGS_MAX_FRAME_SIZE in net/http/internal/http2 in golang.org/x/net; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0163-CVE-2026-33814` | `CVE-2026-33814` | top-level esbuild | 1.23.12 | net/http.Client.CloseIdleConnections, net/http.Client.Do, net/http.Client.Get … +22 | Infinite loop in HTTP/2 transport when given bad SETTINGS_MAX_FRAME_SIZE in net/http/internal/http2 in golang.org/x/net; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0164-CVE-2026-33818` | `CVE-2026-33818` | nested esbuild | 1.20.7 | encoding/asn1.Unmarshal, encoding/asn1.UnmarshalWithParams | Enforce maximum recursion depth in encoding/asn1; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0165-CVE-2026-33818` | `CVE-2026-33818` | native tsc | 1.26.4 | encoding/asn1.Unmarshal, encoding/asn1.UnmarshalWithParams | Enforce maximum recursion depth in encoding/asn1; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0166-CVE-2026-33818` | `CVE-2026-33818` | top-level esbuild | 1.23.12 | encoding/asn1.Unmarshal, encoding/asn1.UnmarshalWithParams | Enforce maximum recursion depth in encoding/asn1; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0167-CVE-2026-39820` | `CVE-2026-39820` | nested esbuild | 1.20.7 | net/mail.AddressParser.Parse, net/mail.AddressParser.ParseList, net/mail.Header.AddressList … +4 | Quadratic string concatentation in consumeComment in net/mail; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0168-CVE-2026-39820` | `CVE-2026-39820` | top-level esbuild | 1.23.12 | net/mail.AddressParser.Parse, net/mail.AddressParser.ParseList, net/mail.Header.AddressList … +4 | Quadratic string concatentation in consumeComment in net/mail; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0169-CVE-2026-39836` | `CVE-2026-39836` | top-level esbuild | 1.23.12 | net.Dial, net.DialTimeout, net.Dialer.Dial … +28 | Panic in Dial and LookupPort when handling NUL byte on Windows in net; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0170-CVE-2026-39836` | `CVE-2026-39836` | nested esbuild | 1.20.7 | net.Dial, net.DialTimeout, net.Dialer.Dial … +28 | Panic in Dial and LookupPort when handling NUL byte on Windows in net; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0171-CVE-2026-42499` | `CVE-2026-42499` | nested esbuild | 1.20.7 | net/mail.AddressParser.Parse, net/mail.AddressParser.ParseList, net/mail.Header.AddressList … +2 | Quadratic string concatenation in consumePhrase in net/mail; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0172-CVE-2026-42499` | `CVE-2026-42499` | top-level esbuild | 1.23.12 | net/mail.AddressParser.Parse, net/mail.AddressParser.ParseList, net/mail.Header.AddressList … +2 | Quadratic string concatenation in consumePhrase in net/mail; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0173-CVE-2026-42504` | `CVE-2026-42504` | nested esbuild | 1.20.7 | mime.WordDecoder.DecodeHeader | Quadratic complexity in WordDecoder.DecodeHeader in mime; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0174-CVE-2026-42504` | `CVE-2026-42504` | top-level esbuild | 1.23.12 | mime.WordDecoder.DecodeHeader | Quadratic complexity in WordDecoder.DecodeHeader in mime; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0175-CVE-2026-46600` | `CVE-2026-46600` | native tsc | 1.26.4 | net.LookupCNAME, net.Resolver.LookupCNAME | Parsing an invalid SVCB or HTTPS RR can panic in golang.org/x/net/dns/dnsmessage; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0177-CVE-2026-56853` | `CVE-2026-56853` | nested esbuild | 1.20.7 | net/http.ListenAndServe, net/http.ListenAndServeTLS, net/http.Serve … +5 | Apply ReadHeaderTimeout when doing unencrypted HTTP/2 check in net/http; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0178-CVE-2026-56853` | `CVE-2026-56853` | native tsc | 1.26.4 | net/http.ListenAndServe, net/http.ListenAndServeTLS, net/http.Serve … +5 | Apply ReadHeaderTimeout when doing unencrypted HTTP/2 check in net/http; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0179-CVE-2026-56853` | `CVE-2026-56853` | top-level esbuild | 1.23.12 | net/http.ListenAndServe, net/http.ListenAndServeTLS, net/http.Serve … +5 | Apply ReadHeaderTimeout when doing unencrypted HTTP/2 check in net/http; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0180-CVE-2026-56859` | `CVE-2026-56859` | nested esbuild | 1.20.7 | encoding/xml.Decoder.Decode, encoding/xml.Decoder.DecodeElement, encoding/xml.Decoder.RawToken … +3 | Add recursion depth guard during decode in encoding/xml; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0181-CVE-2026-56859` | `CVE-2026-56859` | native tsc | 1.26.4 | encoding/xml.Decoder.Decode, encoding/xml.Decoder.DecodeElement, encoding/xml.Decoder.RawToken … +3 | Add recursion depth guard during decode in encoding/xml; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0182-CVE-2026-56859` | `CVE-2026-56859` | top-level esbuild | 1.23.12 | encoding/xml.Decoder.Decode, encoding/xml.Decoder.DecodeElement, encoding/xml.Decoder.RawToken … +3 | Add recursion depth guard during decode in encoding/xml; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0183-CVE-2026-56862` | `CVE-2026-56862` | nested esbuild | 1.20.7 | crypto/tls.Conn.Handshake, crypto/tls.Conn.HandshakeContext, crypto/tls.Conn.Read … +7 | Limit handshake messages we are willing to accept post-handshake in crypto/tls; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0184-CVE-2026-56862` | `CVE-2026-56862` | top-level esbuild | 1.23.12 | crypto/tls.Conn.Handshake, crypto/tls.Conn.HandshakeContext, crypto/tls.Conn.Read … +7 | Limit handshake messages we are willing to accept post-handshake in crypto/tls; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0185-CVE-2026-56862` | `CVE-2026-56862` | native tsc | 1.26.4 | crypto/tls.Conn.Handshake, crypto/tls.Conn.HandshakeContext, crypto/tls.Conn.Read … +7 | Limit handshake messages we are willing to accept post-handshake in crypto/tls; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0192-CVE-2026-39822` | `CVE-2026-39822` | nested esbuild | 1.20.7 | os.OpenInRoot, os.Root.Create, os.Root.Open … +7 | Root escape via symlink plus trailing slash in os; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0193-CVE-2026-39822` | `CVE-2026-39822` | native tsc | 1.26.4 | os.OpenInRoot, os.Root.Create, os.Root.Open … +7 | Root escape via symlink plus trailing slash in os; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0194-CVE-2026-39822` | `CVE-2026-39822` | top-level esbuild | 1.23.12 | os.OpenInRoot, os.Root.Create, os.Root.Open … +7 | Root escape via symlink plus trailing slash in os; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0200-CVE-2025-22871` | `CVE-2025-22871` | nested esbuild | 1.20.7 | net/http/internal.chunkedReader.Read | Request smuggling due to acceptance of invalid chunked data in net/http; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0203-CVE-2026-39821` | `CVE-2026-39821` | native tsc | 1.26.4 | net/http.Client.CloseIdleConnections, net/http.Client.Do, net/http.Client.Get … +19 | Invoking failure to reject ASCII-only Punycode-encoded labels in golang.org/x/net/idna; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0204-CVE-2026-39821` | `CVE-2026-39821` | top-level esbuild | 1.23.12 | net/http.Client.CloseIdleConnections, net/http.Client.Do, net/http.Client.Get … +19 | Invoking failure to reject ASCII-only Punycode-encoded labels in golang.org/x/net/idna; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0205-CVE-2026-39821` | `CVE-2026-39821` | nested esbuild | 1.20.7 | net/http.Client.CloseIdleConnections, net/http.Client.Do, net/http.Client.Get … +19 | Invoking failure to reject ASCII-only Punycode-encoded labels in golang.org/x/net/idna; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0206-CVE-2024-24790` | `CVE-2024-24790` | nested esbuild | 1.20.7 | net/netip.Addr.IsGlobalUnicast, net/netip.Addr.IsInterfaceLocalMulticast, net/netip.Addr.IsLinkLocalMulticast … +3 | Unexpected behavior from Is methods for IPv4-mapped IPv6 addresses in net/netip; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0207-CVE-2025-68121` | `CVE-2025-68121` | nested esbuild | 1.20.7 | crypto/tls.Conn.Handshake, crypto/tls.Conn.HandshakeContext, crypto/tls.Conn.Read … +6 | Unexpected session resumption in crypto/tls; caminho de input/controle não provado | `UNDER_INVESTIGATION` |
| `SARIF-0208-CVE-2025-68121` | `CVE-2025-68121` | top-level esbuild | 1.23.12 | crypto/tls.Conn.Handshake, crypto/tls.Conn.HandshakeContext, crypto/tls.Conn.Read … +6 | Unexpected session resumption in crypto/tls; caminho de input/controle não provado | `UNDER_INVESTIGATION` |

## Bloqueio

- 64/64 ocorrências continuam `UNDER_INVESTIGATION`; nenhuma recebeu `FIXED` ou proposta `NOT_AFFECTED`.
- Em 61 ocorrências, os símbolos estão presentes, mas não há prova por função de reachability e input controlável por adversário. Nas outras três a ausência também não foi provada.
- Auditor independente e aprovação do owner são requisitos para qualquer proposta NOT_AFFECTED. Nenhuma autoaprovação foi feita.

## Limites

- Nenhum Dockerfile, Compose, dependência, package-lock, código de produto, schema ou migration foi modificado.
- Os 21 CVEs únicos não-Go foram contados para reconciliação, sem análise. PR #15 permanece aberta e não mergeada.
- Fontes: [Go Vulnerability Database](https://vuln.go.dev/), [documentação oficial govulncheck](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck), [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog), [FIRST EPSS](https://www.first.org/epss/), [NVD CVE-2023-44487](https://nvd.nist.gov/vuln/detail/CVE-2023-44487).
