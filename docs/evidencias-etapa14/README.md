# Evidências da Etapa 14

Resumos sanitizados das execuções de 27/11/2026, sem senhas, tokens, cookies ou dados pessoais. A análise está na [matriz de evidências](../evidencias-af.md).

| Arquivo | Requisito | Conteúdo |
|---|---|---|
| [rnf01.json](rnf01.json) | RNF01 | Metadados, métricas por patamar, picos de CPU e RAM |
| [rnf01.csv](rnf01.csv) | RNF01 | Tabela agregada |
| [rnf01-falhas-k6.json](rnf01-falhas-k6.json) | RNF01 | Tempos limite registrados pelo k6 na execução inteira |
| [rnf02-rnf04.json](rnf02-rnf04.json) | RNF02 e RNF04 | Falhas controladas de FastAPI e RabbitMQ |
| [rnf05.json](rnf05.json) | RNF05 | Amostras de memória |
| [testes.json](testes.json) | RF e RNF03 | Resultados Java, frontend e integração pelo gateway |

## Reprodução e rastreabilidade

- Roteiros: [`integration-tests/carga/`](../../integration-tests/carga/README.md).
- As medições registram a revisão Git `23ea620844fae87860fb0654839b9d566b3585db`. Havia alterações não commitadas durante a execução (Compose, gateway, frontend e roteiros), portanto essa revisão sozinha não reproduz o ambiente medido. `backend/src` e `ai-service/` não diferiam dela na consolidação. Os digests das imagens estão em `rnf01.json`.
- As séries brutas e os logs completos são mantidos pela equipe fora do repositório, com somas SHA-256.
