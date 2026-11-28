# Evidências da AF — Evolia

Referência: enunciado oficial da AF (Estudo de Caso 1, DevOps e QA, 01/12/2026, páginas 1–3; não distribuído neste repositório). Decisões: [arquitetura](arquitetura-af.md). Arquivos: [Etapa 14.1](evidencias-etapa14-1/README.md), com sessões autenticadas (estado atual), e [Etapa 14](evidencias-etapa14/README.md), com HTTP Basic (histórico).

## Situação resumida

| Requisito | Avaliação |
|---|---|
| [RF01](#requisitos-funcionais) Cadastro e consulta | Atendido |
| [RF02](#requisitos-funcionais) Classificação por ML | Atendido |
| [RF03](#rf03--recomendação-por-rag) Recomendação por RAG | Atendido com ressalva |
| [RF04](#rf04--orientação-e-acompanhamento-por-agente) Agente com autorização | Parcial |
| [RF05](#requisitos-funcionais) Acompanhamento de treinamento | Atendido |
| [RNF01](#rnf01--carga-de-classificação) 95% em até 2 s com 300 usuários | **Atendido nas condições testadas** |
| [RNF02](#rnf02--disponibilidade-do-treinamento) Treinamento com ML indisponível | Atendido no cenário executado |
| [RNF03](#rnf03--proteção-de-dados) Proteção de dados e acesso | Atendido no recorte local |
| [RNF04](#rnf04--evolução-independente-do-serviço-de-ia) Evolução independente da IA | Atendido no cenário executado |
| [RNF05](#rnf05--custo-operacional) Custo operacional | Evidência favorável, restrita à demonstração local |

## Testes e CI

| Verificação | Resultado atual (Etapa 14.1) | Histórico (Etapa 14) |
|---|---|---|
| Java (unitários e Testcontainers) | 274 aprovados | 255 |
| Frontend (Vitest) | 507 aprovados | 454 |
| Integração pelo gateway | 38 aprovados | 30 |
| Cenários no navegador (aplicação real) | 25 aprovados | — |
| Typecheck, lint, build e `nginx -t` | Aprovados | Aprovados |

Contagens e casos em [testes.json](evidencias-etapa14-1/testes.json) e [navegador.json](evidencias-etapa14-1/navegador.json); o histórico está em [testes.json da Etapa 14](evidencias-etapa14/testes.json). O build mantém o aviso de pacote JavaScript acima de 500 kB. A [CI](../.github/workflows/ci.yml) está configurada e **ainda não foi executada no GitHub**.

## Requisitos funcionais

Os cinco fluxos foram repetidos na Etapa 14.1 pela interface, com autenticação por sessão. As avaliações e os limites abaixo não mudaram com a migração.

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

**Atendido nas condições testadas** (28/11/2026), depois da migração de HTTP Basic para sessões autenticadas. Com 300 usuários e 300 sessões independentes, as 17.826 interações iniciadas na janela de 120 s terminaram com classificação válida em até 2 s. Na arquitetura anterior, a meta não era atendida.

| Indicador em 300 usuários | Resultado | Meta |
|---|---:|---:|
| Oficial: classificações válidas em até 2 s | 100% | 95% |
| Complementar: interações completas (sessão, CSRF e POST) válidas em até 2 s | 100% | 95% |
| p95 da classificação (POST) | 33 ms | 2.000 ms |
| p95 da interação completa | 42 ms | 2.000 ms |
| Classificações por segundo | 148,55 | — |
| Falhas e tempos limite | 0 | — |

### Decisão de migração

O [diagnóstico original](#diagnóstico-original) apontou a verificação BCrypt em cada requisição autenticada como o principal trabalho repetido. A senha passou a ser verificada **somente no login**, com sessão no servidor, mantendo o custo 12, o CSRF e a consulta de consentimento a cada operação. A decisão e as alternativas estão no [ADR 002](arquitetura-af.md#adr-002--sessões-no-servidor-no-lugar-de-http-basic). Um teste Java conta uma execução do BCrypt no login e nenhuma nas operações seguintes.

### Resultados com sessões

| Usuários / sessões | Interações válidas | POST/s | POST p50 / p90 / p95 / p99 (ms) | Interação p95 (ms) | Em até 2 s |
|---:|---:|---:|---|---:|---:|
| 10 / 10 | 599 / 599 | 4,99 | 13 / 16 / 18 / 22 | 26 | 100% |
| 50 / 50 | 2.972 / 2.972 | 24,77 | 10 / 14 / 16 / 23 | 22 | 100% |
| 100 / 100 | 5.954 / 5.954 | 49,61 | 9 / 14 / 16 / 21 | 21 | 100% |
| 200 / 200 | 11.923 / 11.923 | 99,36 | 9 / 16 / 21 / 40 | 25 | 100% |
| 300 / 300 | 17.826 / 17.826 | 148,55 | 12 / 26 / 33 / 54 | 42 | 100% |

Nenhum patamar teve falha de login (inclusive 429), de sessão ou de CSRF, tempo limite ou resposta 4xx/5xx no gateway. Relatório completo, JSON e CSV em [incremento-d](evidencias-etapa14-1/incremento-d/README.md).

### Antes e depois

| Usuários | p95 do POST | Redução do p95 | Em até 2 s | POST/s | Pico de CPU Java (núcleos) | Pico de RAM (MiB) |
|---:|---|---:|---|---|---|---|
| 10 | 453 → 18 ms | 96,0% | 100% → 100% | 3,58 → 4,99 | 3,08 → 0,28 | 946 → 910 |
| 50 | 4.339 → 16 ms | 99,6% | 15,88% → 100% | 6,51 → 24,77 | 7,72 → 0,94 | 999 → 966 |
| 100 | 8.156 → 16 ms | 99,8% | 0,25% → 100% | 6,77 → 49,61 | 7,73 → 1,79 | 1.071 → 1.005 |
| 200 | 16.505 → 21 ms | 99,9% | 0,14% → 100% | 5,87 → 99,36 | 7,93 → 3,50 | 1.187 → 1.099 |
| 300 | sem amostra válida → 33 ms | não calculada | sem amostra válida → 100% | 0,02 → 148,55 | 7,72 → 5,25 | 1.258 → 1.198 |

Não há redução percentual para 300 usuários: a rodada anterior teve apenas 2 POSTs, sem resposta. Os picos de CPU e RAM consideram a execução inteira; com sessões, o pico do Java ocorre na subida, durante os logins. Dentro da janela de 300 usuários, as médias foram: Java 0,61, FastAPI 0,57, gateway 0,51 e PostgreSQL 0,07 núcleo.

### Diferenças metodológicas

- Sessão no lugar de HTTP Basic: o BCrypt sai de todas as requisições medidas.
- O login acontece durante a subida, **fora da janela medida**, em média 10 por segundo.
- `GET /api/csrf` passou a ser público; continua havendo um GET antes de cada POST.
- Cada requisição leva o cabeçalho de contexto da sessão.
- O POST é enviado mesmo que o CSRF termine após a janela, e há um critério complementar por interação.

Mantidos: patamares, janelas, pausas de 1 a 3 s, notas, tempos limite, limites de segurança, hardware, recursos do Docker, consentimento e BCrypt custo 12. Condições: Mac Intel i5 de 4 núcleos, 16 GB, Docker com 8 CPUs virtuais e 7,75 GiB, k6 no mesmo host, Ollama desligado, limite de login padrão, revisão `676ad62`.

### Limitações da conclusão

- Uma rodada por patamar, com janela de 120 s, sem medida de variação.
- Ambiente local, uma instância por serviço, HTTP em loopback. Não se extrapola para outro ambiente.
- Sessões em memória: reiniciar o Java encerra todas, e escalar horizontalmente exigiria outra solução.
- Os logins foram distribuídos na subida. Entrada em massa esbarraria no limite do gateway e no custo do BCrypt.
- Carga de ciclo fechado: a vazão é limitada pelas pausas. A capacidade máxima é desconhecida.
- Sem ensaio prolongado.
- O host tinha navegador e IDEs abertos durante a medição.

### Histórico: HTTP Basic (Etapa 14)

**Não atendido naquela arquitetura.** Já com 50 usuários, apenas 15,88% dos POSTs terminaram em até 2 s. Com 300 usuários houve 2 POSTs na primeira rodada, ambos sem resposta, e nenhum na repetição: a amostra era insuficiente para calcular o p95. Os resultados abaixo são preservados como medidos.

#### Metodologia e resultados

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

#### Diagnóstico original

**Fatos confirmados no código da época** (tag `checkpoint-etapa14`, commit `13264b4`; os arquivos citados mudaram depois)

- A API usava HTTP Basic sem sessão (`STATELESS`) e um `DaoAuthenticationProvider` sem cache (`SegurancaConfig`). A senha era verificada com BCrypt em toda requisição autenticada.
- O custo BCrypt era (e continua) 12 nas contas individuais e nas contas de demonstração geradas (`ContasDemonstracao` e `gerar-env.sh`).
- Cada interação do teste fazia um GET `/api/csrf` e um POST de classificação, ambos autenticados: **duas verificações BCrypt por interação** (roteiro k6 da Etapa 14).
- O POST ainda consultava a conta e o consentimento no PostgreSQL e chamava o FastAPI. O GET de CSRF não chamava o serviço de IA nem consultava o consentimento.

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

Na Etapa 14.1, as duas falhas foram repetidas com sessões e tiveram o mesmo comportamento ([resultados](evidencias-etapa14-1/rnf02-rnf04.json)).

## RNF03 — Proteção de dados

| Controle | Evidência e limite |
|---|---|
| Autenticação e sessão | Login com BCrypt custo 12; cookie `HttpOnly` e `SameSite=Strict` (`Secure` com HTTPS); troca do ID no login; logout invalida a sessão; expiração por inatividade; principal sem senha nem hash. [Testes de sessão](../backend/src/test/java/br/edu/facens/afdevops/SessaoIntegrationTests.java) e [do gateway](../integration-tests/test_gateway.py). HTTP Basic não autentica mais. |
| Perfis, CSRF e consentimento | Perfis e regras inalterados; CSRF no login, no logout e nas escritas; consentimento consultado antes de cada operação de IA, sem cache. A revogação bloqueia novas chamadas e não encerra o processamento já iniciado. |
| Abas e identidade | O contexto da sessão impede que uma aba antiga aja como outro usuário; logout sem confirmação não é restaurado em silêncio ([cenários no navegador](evidencias-etapa14-1/navegador.json)). |
| Abuso do login | Limite por IP no gateway (10 r/s, rajada 50). Contém rajadas; não impede tentativas lentas, e não há bloqueio por conta. |
| Fronteira de rede | O Compose padrão publica apenas o Nginx em loopback. O gateway devolve 404 nos caminhos internos e manipulados. O perfil explícito de diagnóstico cria portas adicionais em loopback; a execução local normal usa o Compose padrão. |
| Dados enviados ao modelo | [O teste do adaptador](../backend/src/test/java/br/edu/facens/afdevops/ia/OllamaConfiguracaoTests.java) verifica o payload de geração e ausência de ferramentas. O FastAPI recebe competências e, na orientação, pergunta e identificador por rota interna autenticada. O Ollama recebe instruções fixas e o nível. |
| Limites do agente | [Testes do agente](../ai-service/tests/test_agent.py) verificam ferramentas permitidas e rejeição de ferramenta desconhecida. O agente Python segue uma sequência fixa de três leituras com dados da própria requisição e do acervo de cursos. |
| CSP e credenciais | A CSP usa o hash do script do tema e JIT do Zod desabilitado; a validação da Etapa 14.1 no navegador não registrou violações. Senhas de demonstração e tokens ficam no `.env` local, ignorado pelo Git. A inspeção dos arquivos versionáveis não encontrou padrões de chaves privadas, tokens de provedores ou hashes BCrypt literais. A preparação preserva o arquivo existente. |
| Transporte e escopo | Demonstração em HTTP no loopback. Implantação externa exige HTTPS e `SESSION_COOKIE_SECURE=true`. A rota interna do worker usa Bearer próprio e não aceita sessão. A evidência local não certifica conformidade legal ou segurança operacional. |

**Avaliação:** atendido no recorte local demonstrado. A implantação externa
precisa de validação com HTTPS e configuração operacional própria.

## RNF04 — Evolução independente do serviço de IA

**Atendido no cenário executado.** A repetição da Etapa 14.1 confirmou o comportamento, com o FastAPI recuperado em 4,21 s sem reiniciar o Java ([resultados](evidencias-etapa14-1/rnf02-rnf04.json)). Com o FastAPI parado, colaboradores e
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

Na carga da Etapa 14.1, pilha e k6 atingiram 1.197,7 MiB amostrados com 300 usuários. A migração não acrescentou serviços: as sessões ficam na memória do Java.

**Avaliação:** evidência favorável para o perfil de demonstração local.
Energia e custo monetário de operação, inclusive sob carga, permanecem sem medição.
