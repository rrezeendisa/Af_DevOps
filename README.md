# Af_DevOps
Projeto AF da matéria de DevOps — Plataforma Inteligente de Educação Corporativa

## Estrutura

| Pasta | Conteúdo | Frente |
| --- | --- | --- |
| `backend/` | API REST Java/Spring Boot, PostgreSQL, Flyway, segurança | A |
| `ai-service/` | Classificação (ML), recomendações, orientação e worker de treinamento | B |
| `infra/` | Topologia RabbitMQ e documentação do ambiente integrado | C |
| `integration-tests/` | Testes ponta a ponta contra o ambiente Docker Compose | C |
| `scripts/` | Geração do `.env` local e execução dos testes integrados | C |
| `.github/workflows/` | Pipeline de CI | C |

Detalhes de cada parte: [backend/README.md](backend/README.md),
[ai-service/README.md](ai-service/README.md) e [infra/README.md](infra/README.md).

## Ambiente integrado com Docker Compose

Requisitos: Docker Desktop (com Docker Compose v2), Git Bash no Windows e
Python 3.12+ para os testes integrados.

```bash
./scripts/gerar-env.sh                   # cria .env com segredos aleatórios (não versionado)
docker compose up -d --build --wait      # sobe PostgreSQL, RabbitMQ, backend, IA e worker
./scripts/testes-integrados.sh           # executa os testes ponta a ponta
docker compose down                      # derruba (use -v para apagar os volumes)
```

| Serviço | Endereço local |
| --- | --- |
| Backend | <http://127.0.0.1:8080> (`/actuator/health`) |
| AI Service | <http://127.0.0.1:8000/docs> |
| RabbitMQ (gerenciamento) | <http://127.0.0.1:15672> (usuário/senha `RABBITMQ_*` do `.env`) |

As portas podem ser alteradas no `.env` (`BACKEND_PORT`, `AI_SERVICE_PORT`,
`RABBITMQ_AMQP_PORT`, `RABBITMQ_MANAGEMENT_PORT`), por exemplo quando o
backend já está rodando pela IDE na porta 8080.

## Integração contínua

A pipeline [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em
pull requests e na `main`: testes do backend (com Testcontainers), testes
do ai-service, validação/build das imagens Docker e, por fim, os testes
integrados com o ambiente completo.
