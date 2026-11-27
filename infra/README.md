# Infraestrutura e QA (Frente C)

Este documento descreve o ambiente integrado, a mensageria das solicitações
de treinamento, a pipeline e os testes integrados.

## Visão geral

```text
                     rede "servicos"                                  rede "dados" (interna)
  ┌──────────┐  POST /api/treinamentos  ┌──────────┐   JDBC    ┌────────────┐
  │  ADMIN   │ ───────────────────────▶ │ backend  │ ────────▶ │ PostgreSQL │
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
| `postgres` | `postgres:17` | Banco do backend; só na rede interna `dados` |
| `rabbitmq` | `rabbitmq:4.1-management` | Broker AMQP e painel de gerenciamento |
| `rabbitmq-setup` | `curlimages/curl` | Job único que aplica `infra/rabbitmq/definitions.json` |
| `backend` | `backend/Dockerfile` | API Java; publica solicitações e recebe o status |
| `ai-service` | `ai-service/Dockerfile` (`api`) | API FastAPI; treina o modelo inicial se não existir |
| `ai-worker` | `ai-service/Dockerfile` (`worker`) | Consome a fila e treina o modelo |

Ordem de subida garantida por `healthcheck` + `depends_on`: PostgreSQL e
RabbitMQ → topologia → backend e ai-service → worker.

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
`amqp://<RABBITMQ_USER>:<RABBITMQ_PASSWORD>@rabbitmq:5672/%2F`. Fora dela
(worker rodando na máquina), use `localhost` no lugar de `rabbitmq`.
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

O ledger em volume garante a idempotência do worker mesmo após recriar os
containers. A API de IA só carrega um modelo novo ao reiniciar
(`docker compose restart ai-service`).

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

`.github/workflows/ci.yml` executa os jobs `backend`, `ai-service` e
`docker` em paralelo e, se todos passarem, o job `integracao`, que gera um
`.env` descartável e roda `./scripts/testes-integrados.sh --down`.

## Problemas comuns

- **Porta 8080 ocupada** (backend rodando na IDE): defina `BACKEND_PORT`
  no `.env` ou no terminal, por exemplo `BACKEND_PORT=18080`.
- **`docker compose up` falha com variável obrigatória**: gere o `.env`
  com `./scripts/gerar-env.sh`.
- **Scripts com `\r` no Windows**: o `.gitattributes` força LF em `*.sh`
  e `mvnw`; se o clone for antigo, rode `git add --renormalize .`.
