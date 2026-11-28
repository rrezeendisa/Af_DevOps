# Evidências da AF — Evolia

Referência: enunciado oficial da AF (Estudo de Caso 1, DevOps e QA, 01/12/2026, páginas 1–3; não distribuído neste repositório). Decisões: [arquitetura](arquitetura-af.md). Arquivos: [evidências da Etapa 14](evidencias-etapa14/README.md).

## Situação resumida

| Requisito | Avaliação |
|---|---|
| [RF01](#requisitos-funcionais) Cadastro e consulta | Atendido |
| [RF02](#requisitos-funcionais) Classificação por ML | Atendido |
| [RF03](#rf03--recomendação-por-rag) Recomendação por RAG | Atendido com ressalva |
| [RF04](#rf04--orientação-e-acompanhamento-por-agente) Agente com autorização | Parcial |
| [RF05](#requisitos-funcionais) Acompanhamento de treinamento | Atendido |
| [RNF01](#rnf01--carga-de-classificação) 95% em até 2 s com 300 usuários | **Não atendido no ambiente testado** |
| [RNF02](#rnf02--disponibilidade-do-treinamento) Treinamento com ML indisponível | Atendido no cenário executado |
| [RNF03](#rnf03--proteção-de-dados) Proteção de dados e acesso | Atendido no recorte local |
| [RNF04](#rnf04--evolução-independente-do-serviço-de-ia) Evolução independente da IA | Atendido no cenário executado |
| [RNF05](#rnf05--custo-operacional) Custo operacional | Evidência favorável, restrita à demonstração local |

## Testes e CI

| Verificação | Resultado | Observação |
|---|---|---|
| Java (unitários e Testcontainers) | 255 aprovados | Execução de 27/11, anterior à Etapa 14 |
| Frontend (Vitest) | 454 aprovados | Etapa 14, relatório JUnit |
| Integração pelo gateway | 30 aprovados | Geração complementar desabilitada |
| Build do frontend | Concluído | Aviso de pacote JavaScript acima de 500 kB |
| Typecheck e lint | Aprovados na Etapa 14 | Sem log preservado |

Contagens e casos em [testes.json](evidencias-etapa14/testes.json). A [CI](../.github/workflows/ci.yml) está configurada e **ainda não foi executada no GitHub**.

## Requisitos funcionais

| Requisito | Implementado e demonstrado | Limitações |
|---|---|---|
| RF01 | Cadastro e consulta de colaboradores e cursos pelo gateway, com CSRF nas escritas. | Listagens sem paginação. |
| RF02 | Nível estimado por modelo de ML, com conta individual e consentimento. | Modelo treinado com base sintética; as notas são informadas na requisição. |
| RF05 | O ADMIN solicita o treinamento e acompanha os estados de `PENDENTE` até `CONCLUIDO` ou `FALHOU`. | Restrito ao ADMIN. O modelo novo é carregado ao reiniciar o FastAPI. |

### RF03 — Recomendação por RAG

Redação do enunciado: “Recomendar cursos utilizando informações recuperadas de documentos institucionais por RAG.”

- **Implementado:** o [serviço de recomendação](../ai-service/app/recommendation_service.py) recupera documentos Markdown por TF-IDF e similaridade de cosseno ([base documental](../ai-service/app/knowledge_base.py)), filtra por nível e competência, retorna até três cursos com justificativa montada a partir do texto recuperado e informa a fonte de cada um.
- **Atendimento:** atendido com ressalva. Os nove documentos são fictícios porque o cenário é um estudo de caso; eles fazem o papel do acervo institucional, e isso por si só não reduz o atendimento.
- **Ressalva:** a etapa de geração é determinística. Nenhum modelo de linguagem redige a resposta a partir dos trechos recuperados; o Ollama recebe apenas o nível. Quem exigir RAG com geração por LLM pode considerar o atendimento parcial.
- **Outros limites:** a seleção depende muito dos metadados (nível e competência), e a base documental é independente do catálogo de cursos cadastrado no Java.

### RF04 — Orientação e acompanhamento por agente

Redação do enunciado: “Permitir que agentes de IA coordenem atividades de orientação e acompanhamento, com autorização do usuário.”

- **Implementado:** um [agente determinístico](../ai-service/app/guidance_agent.py) executa três ferramentas de leitura em sequência fixa (consultar competências, classificar e recomendar). O Java exige consentimento antes da chamada e o verifica de novo antes da geração complementar de próximos passos.
- **Atendimento:** parcial. Orientação e autorização estão atendidas; o acompanhamento não.
- **Ausente:** não há histórico persistido, metas, progresso de cursos nem retomada entre sessões. A jornada exibida no frontend vale apenas para a sessão atual. O agente não planeja nem escolhe ferramentas dinamicamente.

## RNF01 — Carga de classificação

**Não atendido no ambiente testado.** Já com 50 usuários, apenas 15,88% dos POSTs terminaram em até 2 s. Com 300 usuários houve 2 POSTs na primeira rodada, ambos sem resposta, e nenhum na repetição: a amostra é insuficiente para calcular o p95.

### Metodologia e resultados

Em 27/11/2026, o k6 1.8.2 usou o gateway do projeto descartável no Mac Intel,
com 16 GB no host e Docker com 8 CPUs virtuais e 7,75 GiB. O provisionamento de
300 contas exclusivas levou 258,89 s e ficou fora da medição. Cada interação
usou Basic e um token CSRF novo. O Ollama não participou da classificação.

| Usuários | POSTs medidos | POST/s | p50 / p90 / p95 / p99 (ms) | Válidos em até 2 s | Falhas na etapa CSRF |
|---:|---:|---:|---|---:|---:|
| 10 | 430 | 3,58 | 385 / 435 / 453 / 481 | 100% | 0 |
| 50 | 781 | 6,51 | 2.782 / 3.759 / 4.339 / 5.514 | 15,88% | 0 |
| 100 | 812 | 6,77 | 6.493 / 7.858 / 8.156 / 8.624 | 0,25% | 0 |
| 200 | 704 | 5,87 | 13.020 / 15.747 / 16.505 / 17.602 | 0,14% | 200 |
| 300 | 2 | 0,02 | Amostra insuficiente; ambos sem resposta, cerca de 20 s | 0% dos 2 | 2.115 |
| 300, repetição interrompida | 0 | 0 | Sem POSTs na janela medida | — | 1.435 |

Todos os POSTs nos quatro primeiros patamares retornaram HTTP 200 com
contrato válido. A janela medida foi de 120 s por patamar. A repetição previa
300 s e foi interrompida pelo monitor. Os totais do POST e da preparação
CSRF usam a janela de início de cada operação; por isso podem divergir nas
bordas da janela. Arquivos agregados: [JSON](evidencias-etapa14/rnf01.json)
e [CSV](evidencias-etapa14/rnf01.csv).

### Diagnóstico

**Fatos confirmados no código**

- A API usa HTTP Basic sem sessão (`STATELESS`) e um `DaoAuthenticationProvider` sem cache ([SegurancaConfig](../backend/src/main/java/br/edu/facens/afdevops/seguranca/SegurancaConfig.java)). A senha é verificada com BCrypt em toda requisição autenticada.
- O custo BCrypt é 12 nas contas individuais e nas contas de demonstração geradas ([ContasDemonstracao](../backend/src/main/java/br/edu/facens/afdevops/seguranca/ContasDemonstracao.java), [gerar-env.sh](../scripts/gerar-env.sh)).
- Cada interação do teste faz um GET `/api/csrf` e um POST de classificação, ambos autenticados: **duas verificações BCrypt por interação** ([roteiro k6](../integration-tests/carga/classificacoes.js)).
- O POST ainda consulta a conta e o consentimento no PostgreSQL e chama o FastAPI. O GET de CSRF não chama o serviço de IA nem consulta o consentimento.

**Fatos observados nas métricas**

| Usuários | GET CSRF p50 / p95 (ms) | POST p50 / p95 (ms) | Pico de CPU Java / FastAPI (núcleos) |
|---:|---|---|---|
| 10 | 380 / 448 | 385 / 453 | 3,08 / 0,07 |
| 50 | 2.784 / 4.280 | 2.782 / 4.339 | 7,72 / 0,13 |
| 100 | 6.496 / 8.414 | 6.493 / 8.156 | 7,73 / 0,11 |
| 200 | 13.807 / 15.004 | 13.020 / 16.505 | 7,93 / 0,11 |
| 300 | 15.002 / 15.011 | amostra insuficiente | 7,72 / 0,13 |
| 300, repetição | 15.002 / 15.011 | sem POSTs | 8,17 / 0,09 |

- O GET de CSRF tem tempo limite de 15 s no k6, e o POST, de 20 s. Falhas de preparação CSRF na janela medida: 200 (200 usuários), 2.115 (300) e 1.435 (repetição). Os tempos limite da execução inteira estão em [rnf01-falhas-k6.json](evidencias-etapa14/rnf01-falhas-k6.json).
- O pico combinado de RAM dos serviços e do gerador foi de aproximadamente 1,23 GiB.
- A repetição de 300 usuários previa 300 s e foi interrompida pelo monitor após 30 s sem saúde.

**Inferências sustentadas pelas métricas**

- GET e POST têm latências próximas de 10 a 200 usuários, o que indica que a maior parte do tempo está no que as duas requisições têm em comum, incluindo a autenticação e a espera por CPU. A diferença entre as medianas **não mede** o processamento interno: são requisições distintas, sem instrumentação por etapa.
- A saturação do Java (perto das 8 CPUs virtuais) com FastAPI abaixo de 0,14 núcleo aponta o limite no Java. Pelo código, a verificação BCrypt é o principal trabalho de CPU repetido nesse caminho.
- De 50 a 200 usuários, a vazão estabilizou em torno de 13 a 14 requisições por segundo, somando GET e POST. Com pausas médias de 2 s, 300 usuários demandariam, por estimativa, mais de 200 requisições autenticadas por segundo, cerca de 15 vezes o observado.

**Hipóteses não instrumentadas**

- Fila de requisições maior que o tempo limite do cliente, com o servidor ainda processando pedidos já abandonados.
- Esgotamento das threads do servidor (configuração padrão), com o healthcheck na mesma fila.
- Limites adicionais no banco, no pool HTTP ou no FastAPI de um único processo, que só apareceriam depois de removido o gargalo atual.

**Limitações do ambiente:** Mac Intel Core i5 com 4 núcleos físicos a 2 GHz, 16 GB de RAM e Docker com 8 CPUs virtuais e 7,75 GiB. O k6 disputou o mesmo host com os serviços. Os resultados não se generalizam para outro hardware.

### Evolução proposta (não implementada)

Autenticação baseada em sessão, com BCrypt apenas no login e cookie `HttpOnly` e `SameSite`. Exige expiração, logout, proteção contra fixação de sessão, CSRF vinculado à sessão, invalidação na troca ou desativação de conta e mudanças no frontend, nos contratos e nos testes; o consentimento continuaria verificado a cada chamada. A proposta remove o principal custo repetido, mas **não há garantia de que atenda à meta**: é preciso repetir o roteiro, separando o login da janela medida e declarando a mudança no perfil das requisições. Uma execução em hardware de referência ajudaria a separar o limite da VM do limite da aplicação. Reduzir o custo BCrypt ou desligar controles de segurança não é a solução adotada.

## RNF02 — Disponibilidade do treinamento

**Atendido no cenário executado, com o FastAPI temporariamente indisponível.** O Java continuou
saudável. O pedido recebeu HTTP 202 em `PENDENTE`, a consulta por `Location`
retornou HTTP 200, o contador de publicações da exchange aumentou em 1 e
o worker finalizou como `CONCLUIDO`. O worker já estava ativo antes da queda.
Sua inicialização a frio no Compose depende do healthcheck do FastAPI.

Em uma falha separada, com o RabbitMQ parado, o POST respondeu HTTP 503
`FILA_INDISPONIVEL`. O registro persistiu como `FALHOU`, a consulta respondeu
HTTP 200 e a saúde do Java indicou `DOWN` devido à dependência indisponível.
O teste confirma o comportamento de cada falha. O modelo atual de publicação
tem uma fronteira de confirmação entre banco e broker, descrita no [ADR](arquitetura-af.md#e-adr--monólito-modular-híbrido). Dados em [rnf02-rnf04.json](evidencias-etapa14/rnf02-rnf04.json).

## RNF03 — Proteção de dados

| Controle | Evidência e limite |
|---|---|
| Perfis, identidade, CSRF e consentimento | Testes do Java e [testes do gateway](../integration-tests/test_gateway.py) cobrem Basic, erro 401 sem desafio nativo, CSRF, cookie HttpOnly/SameSite e papel administrativo. As etapas anteriores também demonstraram revogação nas três rotas de IA e isolamento por sessão, inclusive descarte entre abas ao retornar. A revogação bloqueia novas chamadas e não encerra o processamento já iniciado no servidor. |
| Fronteira de rede | O Compose padrão publica apenas o Nginx em loopback. O gateway devolve 404 nos caminhos internos e manipulados. O perfil explícito de diagnóstico cria portas adicionais em loopback; a execução local normal usa o Compose padrão. |
| Dados enviados ao modelo | [O teste do adaptador](../backend/src/test/java/br/edu/facens/afdevops/ia/OllamaConfiguracaoTests.java) verifica o payload de geração e ausência de ferramentas. O FastAPI recebe competências e, na orientação, pergunta e identificador por rota interna autenticada. O Ollama recebe instruções fixas e o nível. |
| Limites do agente | [Testes do agente](../ai-service/tests/test_agent.py) verificam ferramentas permitidas e rejeição de ferramenta desconhecida. O agente Python segue uma sequência fixa de três leituras com dados da própria requisição e do acervo de cursos. |
| CSP e credenciais | Na validação anterior no Chromium, o tema e os diálogos funcionaram com a CSP, usando hash do script e JIT do Zod desabilitado. Senhas de demonstração e tokens ficam no `.env` local, ignorado pelo Git. A inspeção dos arquivos versionáveis desta etapa não encontrou padrões de chaves privadas, tokens de provedores ou hashes BCrypt literais. A preparação preserva o arquivo existente. |
| Transporte e escopo | HTTP Basic em loopback foi demonstrado. HTTPS é obrigatório para acesso externo. A evidência local não certifica conformidade legal ou segurança operacional de uma implantação externa. |

**Avaliação:** atendido no recorte local demonstrado. A implantação externa
precisa de validação com HTTPS e configuração operacional própria.

## RNF04 — Evolução independente do serviço de IA

**Atendido no cenário executado.** Com o FastAPI parado, colaboradores e
cursos responderam HTTP 200 na listagem, 201 no cadastro e 200 na consulta
dos registros recém-criados. Classificação, recomendações e orientação
responderam HTTP 503 `IA_INDISPONIVEL`. Após recriar somente o FastAPI, as três
rotas voltaram a HTTP 200. O Java manteve ID de container e contador de
reinício durante essa verificação.

A pilha isolada foi recuperada da saturação antes de iniciar os testes de
RNF02 e RNF04. Esse reinício de preparação ficou fora da janela de medição
da independência. A API carrega o artefato de ML no startup; um retreino
persiste o novo modelo, e sua ativação ocorre ao reiniciar o FastAPI.
Veja os [resultados das duas falhas](evidencias-etapa14/rnf02-rnf04.json).

## RNF05 — Custo operacional

A stack padrão inclui Nginx/React, Java, PostgreSQL, RabbitMQ, FastAPI, worker e Ollama; dois jobs preparam filas e modelo. Não há API comercial obrigatória. O primeiro uso requer Docker, rede para os registros de imagens e do modelo e preparação das credenciais. A manutenção envolve volumes, atualização de imagens e recarga do FastAPI após retreino. A geração e o treinamento concorrem pelos recursos locais.

Como referência histórica das etapas 12 e 13, o Mac Intel com 16 GB de RAM e Docker com 7,75 GiB apresentou pico amostrado de 2,51 GiB durante a orientação, com 1,64 GiB no Ollama. Após a demonstração, o Docker reportou 10,78 GB em imagens e 4,09 GB em cache. Esses valores incluem os recursos já presentes no ambiente e não equivalem a consumo exclusivo da Evolia.

Nesta etapa, foi relatado o uso de cerca de 841 MiB pela pilha de classificação
em repouso, sem o Ollama; não há arquivo bruto dessa amostra. A primeira amostra
preservada da carga, sem o k6, soma 880 MiB. Na medição de carga, pilha e k6
atingiram 1,23 GiB amostrados ([rnf05.json](evidencias-etapa14/rnf05.json)). O Docker reportou 10,90 GB em imagens, 1,13 GB em
volumes e 4,09 GB de cache no host de teste. Esses totais incluem o
ambiente preservado e a imagem do gerador.

Para calcular energia, medir a potência do host durante uma janela definida, registrar duração e integrar potência pelo tempo em kWh. Essa medição não foi realizada. Tarifas e tempo de operação seriam necessários para converter o consumo em custo monetário. A inferência local dispensa cobrança por chamada, mas usa CPU, armazenamento e energia. Essa configuração é adequada como demonstração acadêmica; capacidade de produção exige medições e orçamento próprios.

**Avaliação:** evidência favorável para o perfil de demonstração local.
O custo de operação sob a carga do RNF01 permanece sem comprovação.
