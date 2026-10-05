# PH-SEC-WO-003 — Evidence Bundle

## Identidade e escopo

- Repositório: KayzenRoot/poly-hunter.
- Branch exclusiva: security/ph-m01-postgres-libxml2-vex; PR #23: https://github.com/KayzenRoot/poly-hunter/pull/23.
- Work Order: PH-SEC-WO-003; análise apenas do finding CVE-2026-86140 para PostgreSQL.
- Imagem exata: postgres:17.11-alpine3.24@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24, linux/amd64.
- Base do Context Lock / parent PR #15: c04af277990272310ed86eeb9dce02e74e4df523. Canonical policy main: 771f75bbd23fd458e67be1d34024e78e39f5b8af.
- HEAD inspecionado antes da inclusão das evidências: f477907ec890175631c6742e83fba35681806d38. As alterações deste Work Order são limitadas a evidência. O SHA de publicação fica identificável no commit/HEAD da PR, sem embuti-lo neste arquivo para evitar autorreferência.
- Context Lock: PASS. Branch, ancestry, PR #23, pin da imagem, finding SARIF único no índice 54 e os dez fingerprints Git blob do lock foram conferidos antes da análise. Receipts: context-lock-validation.json e manifestos de fontes.
- O worktree estava limpo antes da análise. PR #15 permaneceu fora do escopo e não foi mergeada.

## Disposição

Uma única proposta VEX para CVE-2026-86140: **NOT_AFFECTED / vulnerable_code_not_in_execute_path**. Resultado do executor: **READY_FOR_INDEPENDENT_AUDIT**. Auditor independente e owner approval: **PENDING**. O executor não se autoaprovou; esta proposta ainda não remove gate de promoção.

A identificação exata é libxml2 2.13.9-r2 no APK Alpine, biblioteca /usr/lib/libxml2.so.2.13.9. SHA-256 da biblioteca: c7742d413585cee3e2750472e04da810a7a9883a1c10a8270c2f6e8c56231ad7. Código xmlSnprintfElements PRESENTE, confirmado por APK assinado, Build ID/DWARF compatível e código de máquina na biblioteca exata. PostgreSQL é compilado com --with-libxml, linka libxml2.so.2 e carrega a biblioteca no processo atual.

A aplicação permite parser XML e XPath/XMLTABLE, mas o caminho específico de validação DTD está ausente na implementação XML embutida do PostgreSQL examinada: os parser flags não incluem XML_PARSE_DTDVALID, XMLVALIDATE não está implementado e a documentação PostgreSQL 17 diz que o tipo XML não valida contra DTD. No teste benigno descartável, um documento bem formado que contrariava seu DTD interno foi aceito como bem formado e por XMLPARSE.

A checagem de runtime adicional encontrou xml2 1.1 disponível, mas não instalada no banco atual; somente plpgsql está instalado. O papel SQL atual tem superuser=true. Por isso, xml2 foi avaliada em código e instalada somente no banco descartável: o SQL shipped mapeia xml_valid diretamente para xml_is_well_formed, as rotinas XPath/XSLT usam XML_PARSE_NOENT sem XML_PARSE_DTDVALID, e testes benignos confirmaram que xml_valid, xpath_string e xslt_process aceitam/processam XML bem formado que viola sua DTD interna. A extensão não ativa o formatter vulnerável pelo caminho analisado. Uma extensão customizada ou código nativo futuro que habilite validação DTD exige reavaliação.

## Dados da fonte e prioridade

- MITRE CVE record: HIGH, CVSS 8.0, CWE-121, libxml2 antes de 2.15.4, função xmlSnprintfElements.
- Upstream: fix commit d1686f91dbda141a752200419d35639fd6b38340; corrigido a montante no ramo 2.15.4. O digest analisado não contém o fix. A versão indexada do Alpine v3.24 neste snapshot segue 2.13.9-r2. O APKINDEX/secdb e a assinatura do pacote foram preservados.
- CISA KEV: sem entrada neste snapshot, catálogo versão 2026.10.02. Não é prova de não aplicabilidade.
- FIRST EPSS em 2026-10-03: 0.001570, percentil 0.042550. Prioridade somente.
- Dados brutos, fontes, timestamps de fetch e SHA-256 estão em sources/ e no manifesto receipt-sha256.txt.

## Ambiente atual observado

O processo PostgreSQL roda como UID/GID 70:70, CapEff zero, e a biblioteca está mapeada. O papel da conexão SQL atual é superuser=true. O container está em polyhunter-local_default, bridge project-scoped, Internal=false, com peers web/worker/PostgreSQL; porta 5432 escuta dentro da rede e não está publicada no host. O serviço não é privileged. Esses dados são contexto, não justificativa VEX.

## Testes benignos e limites

Foram executadas consultas benignas de versão, xmloption, well-formedness, XPath e XML round-trip. Um segundo teste, somente no container descartável da imagem exata com network none, sem porta publicada e dados em tmpfs 128 MiB, avaliou um XML internamente inconsistente com DTD mas bem formado. O container foi removido após o teste. Nenhum payload malformado/de exploração ou teste de corrupção/DoS foi usado. A stack normal Compose permaneceu em execução; nenhuma configuração foi alterada.

## Artefatos e escopo de arquivos

- .engineering/evidence/PH-SEC-WO-003-LIBXML2-VEX.json — exatamente um status VEX.
- .engineering/evidence/PH-SEC-WO-003-LIBXML2-VEX.md — parecer legível.
- .engineering/evidence/PH-SEC-WO-003-EVIDENCE.md — este Evidence Bundle.
- .engineering/evidence/PH-SEC-WO-003/ — identidade, APK/ELF/DWARF, fontes, hashes, parser source, runtime, topologia, testes descartáveis, lock receipt e manifestos.
- Somente arquivos de evidência foram criados/modificados. Nenhum Dockerfile, Compose, dependência, aplicação, schema ou migration foi alterado. Nenhuma imagem dev foi analisada.

O arquivo receipt-sha256.txt lista os SHA-256 de todos os artefatos coletados e documentos de saída, exceto o próprio manifesto, para evitar autorreferência.

## Riscos restantes e revalidação

1. O código vulnerável continua presente na imagem e a versão Alpine atual não traz o fix identificado; a proposta depende de o caminho DTD-validation continuar inalcançável pelos caminhos core e pela extensão xml2 fornecida neste digest. O papel SQL atual é superuser, portanto extensões/código adicional são uma mudança material e acionam nova revisão.
2. Uma extensão, API, configuração ou build que ative validação DTD, mudança de parser flags ou mudança no fluxo de XML exige nova análise antes de qualquer execução.
3. A rede bridge não é internal-only: é project-scoped, Internal=false, e PostgreSQL aceita conexões de peers autenticados embora não publique porta no host.
4. A proposta expira em 2026-10-11T02:51:08Z ou antes diante de mudança relevante. Independent audit e aprovação do owner ainda são necessários.
5. Não houve tentativa de reproduzir o overflow, por restrição do Work Order a inspeção estática e testes benignos.

## STOP CONDITION

Work Order concluído para revisão independente. Não iniciar PH-M01-WO-002, não alterar ou analisar a imagem dev, e não mergear PR #15. A PR #23 contém apenas a análise/evidência desse finding.


## Owner approval
- Independent audit: APPROVED for head `e3748820d399fb38da6a0922eeda412cc00bff12`.
- Owner decision: APPROVED.
- Owner statement: `APROVO A DISPOSIÇÃO NOT_AFFECTED DO PH-SEC-WO-003`.
- Final disposition for this finding: `NOT_AFFECTED / vulnerable_code_not_in_execute_path`.
- This approval is limited to the exact local-dev PostgreSQL artifact and does not approve remaining dev-image findings, PR #15 merge, or PH-M01-WO-002.
