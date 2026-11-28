# Infraestrutura e QA (Frente C)

Este documento descreve o ambiente integrado, a mensageria das solicitações
de treinamento, a pipeline e os testes integrados.

## Visão geral

```text
                     rede "treinamento"                               rede "dados" (interna)
  ┌──────────┐  POST /api/treinamentos  ┌──────────┐   JDBC    ┌────────────┐
  │  Nginx   │ ───────────────────────▶ │ backend  │ ────────▶ │ PostgreSQL │
  └──────────┘                          └──────────┘           └────────────┘
                                          │      ▲
             publica {"solicitacao_id"}   │      │ PATCH /internal/treinamentos/{id}/status
                                          ▼      │ (Bearer INTERNAL_API_TOKEN)
                                   ┌──────────┐  │
                                   │ RabbitMQ │  │
                                   └──────────┘  │
                                          │      │
                     ml.training.requests ▼      │
                                   ┌──────────────┐      volume ai-artifacts      ┌────────────┐
                                   │  ai-worker   │ ◀──────────────────────────▶ │ ai-service │
                                   └──────────────┘  (modelo + ledger)          └────────────┘
```

| Serviço Compose | Imagem | Função |
| --- | --- | --- |
| `gateway` | `frontend/Dockerfile` | Nginx serve o build da Evolia e encaminha `/api` ao Java |
| `postgres` | `postgres:17` | Banco do backend; só na rede interna `dados` |
| `rabbitmq` | `rabbitmq:4.1-management` | Broker AMQP e painel de gerenciamento |
| `rabbitmq-setup` | `curlimages/curl` | Job único que aplica `infra/rabbitmq/definitions.json` |
| `backend` | `backend/Dockerfile` | API Java; publica solicitações e recebe o status |
| `ai-service` | `ai-service/Dockerfile` (`api`) | API FastAPI; treina o modelo inicial se não existir |
| `ai-worker` | `ai-service/Dockerfile` (`worker`) | Consome a fila e treina o modelo |
| `ollama` | `ollama/ollama:0.40.18` | Executa o modelo generativo local por CPU |
| `ollama-modelo` | Mesma imagem do Ollama | Verifica ou baixa o modelo para o volume do Ollama |

Ordem de subida garantida por `healthcheck` + `depends_on`: PostgreSQL e
RabbitMQ → topologia → backend e ai-service → worker. O gateway espera o
backend saudável. O Ollama prepara o modelo em paralelo, e o Java pode
atender com a orientação base enquanto a geração complementar estiver indisponível.

| Rede | Serviços |
| --- | --- |
| `borda` | Gateway, única porta publicada em `127.0.0.1:8088` por padrão |
| `entrada` | Gateway → Java |
| `dados` | Java → PostgreSQL |
| `ia` | Java → FastAPI |
| `treinamento` | Java, RabbitMQ, configuração das filas e worker |
| `generativa` | Java, Ollama e inicializador do modelo |
| `download` | Somente Ollama, para acesso ao registro do modelo |

As redes entre serviços são internas. `/healthz` verifica o gateway.
O gateway não encaminha `/actuator`, `/internal` ou caminhos diretos ao FastAPI.
Os logs de acesso guardam método, status e duração. Fora da máquina local,
use HTTPS e defina `SESSION_COOKIE_SECURE=true`.

A autenticação é por sessão em memória no Java. `SESSION_TIMEOUT` define a
expiração por inatividade (padrão `30m`). Reiniciar o backend encerra as
sessões, e mais de uma instância exigiria afinidade ou armazenamento
compartilhado. O worker continua usando `INTERNAL_API_TOKEN`.

### Diagnóstico local

Para liberar temporariamente as portas diretas do Java, do FastAPI e do
gerenciamento RabbitMQ, use o arquivo adicional. Essas portas ficam em loopback.

```sh
docker compose -f docker-compose.yml -f compose.diagnostico.yml up -d
```

`BACKEND_PORT`, `AI_SERVICE_PORT` e `RABBITMQ_MANAGEMENT_PORT` alteram
essas portas. Use o Compose padrão para a demonstração.

## Variáveis e segredos

Todos os segredos ficam no `.env` da raiz, ignorado pelo Git. Gere-o com
`./scripts/gerar-env.sh` (senhas e token aleatórios, hashes BCrypt custo 12
gerados com o `htpasswd` da imagem `httpd`). O modelo comentado está em
[`.env.example`](../.env.example).

| Variável | Usada por |
| --- | --- |
| `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL e backend |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | Broker, setup, backend e worker (compõem a `RABBITMQ_URL`) |
| `INTERNAL_API_TOKEN` | Backend (rota interna), ai-service (`/orientacoes`) e worker |
| `AFDEVOPS_*_USERNAME`, `AFDEVOPS_*_PASSWORD_HASH` | Contas de demonstração do backend |
| `E2E_ADMIN_PASSWORD`, `E2E_COLABORADOR_PASSWORD` | Somente testes integrados |
| `MAX_MESSAGE_RETRIES` | Worker (padrão 3) |

Dentro da rede do Compose a URL do broker é
`amqp://<RABBITMQ_USER>:<RABBITMQ_PASSWORD>@rabbitmq:5672/%2F`.
Hashes BCrypt devem ficar entre aspas simples no `.env`, pois contêm `$`.

## Mensageria das solicitações de treinamento

Nomes confirmados com a Frente B (`ai-service/worker/consumer.py`):

| Item | Valor |
| --- | --- |
| Exchange | `ml.training` (direct, durável) |
| Routing key | `training.requested` |
| Fila | `ml.training.requests` (durável) |
| Fila de mensagens inválidas/esgotadas | `ml.training.requests.dead-letter` (durável) |
| Mensagem | `{"solicitacao_id":"<id>"}`, JSON, persistente |

Política de retry e dead-letter:

- O worker reenfileira falhas transitórias até `MAX_MESSAGE_RETRIES` vezes
  (cabeçalho `x-ai-retry-count`) e envia à DLQ as mensagens inválidas ou
  esgotadas, com o motivo em `x-ai-failure`.
- A política `ml-training-requests-dlx` também manda para a DLQ mensagens
  rejeitadas (`nack`/`reject` sem requeue) ou expiradas.
- A política `ml-training-dead-letter-retencao` mantém a DLQ por até
  7 dias e no máximo 10.000 mensagens (descarta as mais antigas).
- As filas são declaradas **sem** `x-arguments` em todos os lados
  (broker, backend e worker); por isso o dead-letter é feito por política,
  evitando erros `PRECONDITION_FAILED`.

A topologia é aplicada por `infra/rabbitmq/setup.sh` através da API de
gerenciamento, e não no boot do broker: quando o RabbitMQ importa
definições na inicialização ele não cria o usuário padrão, o que
obrigaria a versionar usuários/senhas.

### Contrato com o backend

| Método e rota | Quem chama | Descrição |
| --- | --- | --- |
| `POST /api/treinamentos` | ADMIN (+ CSRF) | Cria a solicitação `PENDENTE` e publica na fila. 202 + `Location`; 503 `FILA_INDISPONIVEL` se o broker não confirmar |
| `GET /api/treinamentos`, `GET /api/treinamentos/{id}` | ADMIN | Acompanhamento das solicitações |
| `PATCH /internal/treinamentos/{id}/status` | Worker (Bearer `INTERNAL_API_TOKEN`) | Corpo `{"status":"CONCLUIDO\|FALHOU","versaoModelo":"1.0.0","mensagem":"..."}`; 204, 400, 401, 404, 409 |

Estados: `PENDENTE` → `CONCLUIDO` ou `FALHOU`. Reenviar o mesmo status
final é idempotente (204); trocar um status final responde 409.

## Persistência

| Volume | Conteúdo |
| --- | --- |
| `postgres-data` | Dados do PostgreSQL |
| `rabbitmq-data` | Filas e mensagens duráveis (hostname fixo `rabbitmq`) |
| `ai-artifacts` | `/data/artifacts`: modelo (`classifier.joblib`) e ledger do worker (`training-results.json`), compartilhado entre API e worker |
| `ollama-data` | `/root/.ollama`: modelo generativo local, preservado entre inicializações |

O ledger em volume garante a idempotência do worker mesmo após recriar os
containers. A API de IA só carrega um modelo novo ao reiniciar
(`docker compose restart ai-service`).

### Ollama

O ambiente padrão usa o Ollama em container, com um modelo carregado por
vez, uma geração simultânea e fila curta. O Qwen 2.5 1.5B Q4_K_M ocupa cerca
de 986 MB. O job verifica o volume antes do download. Se o registro estiver
indisponível no primeiro uso, a aplicação continua com a orientação base.
Quando o acesso voltar, rode `docker compose up ollama-modelo` para concluir
a preparação. Compare a primeira chamada e as seguintes ao medir latência.

No Mac Intel, reserve inicialmente 8 GiB para o Docker e 20–25 GB em disco.
Esses valores são estimativas para uma geração por vez. Build, treinamento
e geração podem disputar CPU e memória. Evite dois ambientes completos
ativos e não carregue o modelo nativo junto com o containerizado.

Em uma validação local no Mac Intel, a orientação levou 51,12 s na primeira
requisição e 8,01 s e 14,33 s nas duas seguintes, com três sugestões em cada
resposta. Ao parar o Ollama, a orientação base voltou com HTTP 200 em 31,02 s.
O pico amostrado de RAM foi cerca de 1,64 GiB no Ollama e 2,51 GiB no projeto.
Esses resultados são de chamadas individuais e não validam o RNF01. A carga de
classificação foi medida separadamente e, com sessões autenticadas,
[atingiu a meta nas condições testadas](../docs/evidencias-af.md#rnf01--carga-de-classificação).

Para usar o Ollama nativo no desenvolvimento, pare o Ollama do Compose e
inicie o ambiente com o arquivo adicional. O Java acessa o modelo em
`host.docker.internal:11434`; confira que o Ollama local está acessível a
partir do Docker Desktop.

```sh
docker compose stop ollama
docker compose -f docker-compose.yml -f compose.ollama-nativo.yml up --build
```

## Limite de tentativas de login

O gateway limita `POST /api/login` por endereço de origem, com `limit_req`:

| Variável | Padrão | Efeito |
|---|---|---|
| `LOGIN_RATE` | `10r/s` | Taxa sustentada |
| `LOGIN_BURST` | `50` | Excesso atendido de imediato antes de recusar |

Acima disso a resposta é 429 com `Retry-After: 1`. As outras rotas não são afetadas. O padrão
considera redes corporativas atrás de um único IP: admite cerca de 300 logins em 30 s, que é também
o perfil da subida do teste de carga. O teste deve usar o padrão; se precisar de outro valor, ele deve
constar no relatório. O limite contém rajadas e o custo de CPU do BCrypt, mas não impede tentativas
lentas de adivinhação. Atrás de outro proxy ou do Docker Desktop, vários clientes podem aparecer
com o mesmo endereço e dividir o limite. Valores inválidos impedem o gateway de iniciar.

## Testes

| Nível | Onde | Como rodar |
| --- | --- | --- |
| Unitários e integração Java (Testcontainers: PostgreSQL e RabbitMQ) | `backend/src/test` | `cd backend && ./mvnw test` |
| Unitários Python (mocks) | `ai-service/tests` | ver `ai-service/README.md` |
| Ponta a ponta (ambiente Compose real) | `integration-tests/` | `./scripts/testes-integrados.sh` |

Os testes ponta a ponta cobrem saúde dos serviços, topologia do broker,
fluxo completo de treinamento (PENDENTE → CONCLUIDO), autorização,
token interno, DLQ e acesso ao ai-service pela rede do Compose.

## Pipeline

`.github/workflows/ci.yml` executa `backend`, `ai-service`, `frontend` e
`docker` em paralelo. O job `integracao` aguarda esses jobs, gera um
`.env` descartável e roda `./scripts/testes-integrados.sh --down`.
A suíte do gateway e do treinamento inicia apenas os serviços necessários,
sem baixar o modelo generativo. Carga e falhas controladas têm um
[roteiro separado](../integration-tests/carga/README.md), executado localmente
em 27 e 28/11/2026 ([resultados atuais](../docs/evidencias-etapa14-1/README.md)). A pipeline
ainda não foi executada no GitHub.

## Problemas comuns

- **Porta 8088 ocupada**: defina `GATEWAY_PORT` no `.env` ou no terminal.
- **`docker compose up` falha com variável obrigatória**: gere o `.env`
  com `./scripts/gerar-env.sh`.
- **Scripts com `\r` no Windows**: o `.gitattributes` força LF em `*.sh`
  e `mvnw`; se o clone for antigo, rode `git add --renormalize .`.
