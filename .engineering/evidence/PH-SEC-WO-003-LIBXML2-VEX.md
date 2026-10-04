# PH-SEC-WO-003 — VEX libxml2 / PostgreSQL 17

## Resultado

**READY_FOR_INDEPENDENT_AUDIT**. Este é um parecer proposto pelo executor; a disposição única é **NOT_AFFECTED**, com justificativa **vulnerable_code_not_in_execute_path**. Auditoria independente e aprovação explícita do owner continuam pendentes. Nenhuma aprovação automática foi feita.

## Finding e artefato exato

- CVE: CVE-2026-86140, severidade HIGH; CWE-121; CVSS 3.1 8.0, vetor AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:L.
- Imagem analisada: postgres:17.11-alpine3.24, digest sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24, linux/amd64.
- Pacote instalado: Alpine libxml2 2.13.9-r2, em /usr/lib/libxml2.so.2.13.9.
- SHA-256 da biblioteca instalada: c7742d413585cee3e2750472e04da810a7a9883a1c10a8270c2f6e8c56231ad7.
- O APK oficial Alpine 2.13.9-r2 foi verificado com as chaves confiáveis do Alpine; a biblioteca extraída dele tem o mesmo hash da imagem. O APK oficial de debug tem o mesmo GNU Build ID da biblioteca instalada.
- O CVE Program identifica xmlSnprintfElements em valid.c e a falha de strcat em versões anteriores a 2.15.4. O commit upstream d1686f91dbda141a752200419d35639fd6b38340 adiciona verificações de espaço às concatenações afetadas. A API do GitHub registra o commit como sem assinatura verificada; essa limitação de proveniência está preservada no receipt. A página do [commit GNOME/libxml2](https://github.com/GNOME/libxml2/commit/d1686f91dbda141a752200419d35639fd6b38340) mostra as correções.
- A versão indexada no Alpine v3.24 x86_64 no snapshot coletado continua 2.13.9-r2; o APKINDEX e o secdb coletados não mostram pacote corrigido para este CVE. Veja os snapshots e hashes em sources/ e em receipt-sha256.txt.

## Prova de presença do código afetado

A biblioteca exata não foi inferida somente pela versão. O binário instalado foi hasheado; o APK oficial de debug, com assinatura Alpine válida e o mesmo Build ID, fornece DWARF que mapeia xmlSnprintfElements e o callsite inline de valid.c. A desassemblagem da biblioteca exata mostra as chamadas strcat correspondentes. Assim, o código vulnerável está presente no digest examinado.

## Compile, link e load

PostgreSQL 17.11 foi compilado com --with-libxml. O ELF postgres declara DT_NEEDED para libxml2.so.2 e importa xmlCtxtReadMemory. No processo PostgreSQL em execução, o arquivo /usr/lib/libxml2.so.2.13.9 está mapeado. A feature XML do PostgreSQL está habilitada; XMLPARSE, tipo XML, XPath e XMLTABLE são caminhos de parser disponíveis.

## Caminho vulnerável e alcançabilidade

O fonte upstream v2.13.9 coloca xmlSnprintfElements no caminho de diagnóstico de xmlValidateElementContent: quando a validação do modelo de conteúdo DTD encontra incompatibilidade e emite diagnóstico, a rotina formata a lista recebida. O CVE não foi classificado como não afetado por ausência da biblioteca, por baixa pontuação, por isolamento de rede ou por encerramento rápido de processo.

O código exato de PostgreSQL REL_17_11 faz parse de documentos com XML_PARSE_NOENT e XML_PARSE_DTDATTR, além de XML_PARSE_NOBLANKS opcional. Os pontos de leitura usados por XPath/XMLTABLE passam opções zero. Os pontos inspecionados não habilitam XML_PARSE_DTDVALID nem chamam as APIs de validação de libxml2. A função PostgreSQL xmlvalidate é um stub que retorna FEATURE_NOT_SUPPORTED com a mensagem xmlvalidate is not implemented. A documentação PostgreSQL 17 declara que o tipo XML não valida a entrada contra DTD, mesmo quando ela é especificada.

Também foi verificada a extensão xml2 que a imagem disponibiliza. No banco Compose atual ela não está instalada (somente plpgsql aparece instalado), mas o papel SQL observado é superuser e pode criar extensões, então a possibilidade foi testada em container descartável. O SQL da extensão mapeia xml_valid(text) diretamente para xml_is_well_formed. O código REL_17_11 de XPath/XSLT usa XML_PARSE_NOENT e não XML_PARSE_DTDVALID; a biblioteca pgxml.so importa xmlReadMemory e não importa as funções de validação afetadas. Após CREATE EXTENSION xml2 no banco descartável, xml_valid retornou true para o documento bem formado que viola a DTD interna. As funções XPath e XSLT da extensão também processaram o mesmo documento e produziram suas saídas benignas esperadas. Assim, a extensão fornecida não adiciona o caminho de validação DTD. Uma extensão nativa/customizada ou mudança futura que o adicione exige nova análise.

O teste benigno no digest exato passou um documento XML bem formado com DTD interno que declara root como EMPTY, embora o documento contenha child. xml_is_well_formed_document retornou true e XMLPARSE retornou o documento. Isso confirma a diferença entre parse de XML e validação DTD sem usar entrada malformada ou payload de exploração. Os receipts do SQL, saída, isolamento e limpeza estão em .engineering/evidence/PH-SEC-WO-003/.

Clientes autenticados do PostgreSQL podem controlar valores XML enviados em consultas. O serviço está na rede bridge project-scoped polyhunter-local_default, com Internal=false, escuta em * na porta 5432 e não publica essa porta no host. Web e worker são peers da rede. Esse contexto foi registrado; a justificativa se baseia no caminho de validação DTD indisponível na implementação SQL embutida observada.

## KEV e EPSS

- CISA KEV: não listado no snapshot 2026.10.02. A ausência é somente dado de priorização e não sustenta a disposição.
- FIRST EPSS, data 2026-10-03: score 0.001570, percentil 0.042550. EPSS é somente priorização e não sustenta a disposição.

## Limites, expiração e revalidação

A proposta vale somente para o digest PostgreSQL 17.11 usado em local-dev. Expira em 2026-10-11T02:51:08Z ou antes se mudar digest, pacote, biblioteca, build/opções XML do PostgreSQL, caminho de entrada, se for adicionada extensão/API que permita DTD validation, surgir novo advisory/fix, houver mudança KEV ou a evidência ficar stale. Reavaliar antes de qualquer uso além de local-dev.

Não foram testados payloads de exploração, XML malformado, corrupção de memória nem DoS. A proposta precisa de verificação independente e aprovação do owner. Até lá, não libera gate de promoção.

## Arquivos de evidência

- JSON VEX único: .engineering/evidence/PH-SEC-WO-003-LIBXML2-VEX.json
- Evidence Bundle: .engineering/evidence/PH-SEC-WO-003-EVIDENCE.md
- Context Lock validado e receipts completos: .engineering/evidence/PH-SEC-WO-003/
- Alterações de produto/runtime: nenhuma.
