# Evidências da Etapa 14.1 — regressão da autenticação por sessão

Execuções de 27–28/11/2026 em um projeto Compose isolado, pelo Nginx, com imagens e volumes próprios.
Nenhum teste de carga foi executado. As [evidências da Etapa 14](../evidencias-etapa14/README.md) não mudaram.

| Arquivo | Conteúdo |
|---|---|
| [testes.json](testes.json) | Java, React e integração pelo gateway |
| [navegador.json](navegador.json) | Cenários no Chrome headless: sessão, abas, falhas, RF01–RF05 e CSP |
| [rnf02-rnf04.json](rnf02-rnf04.json) | FastAPI e RabbitMQ indisponíveis |

## Limites

- O complemento generativo usou o Ollama nativo do host (`compose.ollama-nativo.yml`).
- A expiração foi ensaiada com `SESSION_TIMEOUT=1m`; o padrão é 30 min.
- A requisição atrasada foi retida antes do envio. Resposta atrasada é coberta pelos testes React.
- Cache de consultas e *mutations* é verificado pelos testes React; no navegador, o que está visível.
- Sem HTTPS: o cookie `Secure` é coberto pelos testes Java.

## Defeito encontrado e corrigido

Ao restaurar uma sessão, o teste de gravação do `localStorage` disparava o evento `storage` nas outras
abas, que descartavam o estado. O filtro agora só reage à entrada e à saída do estado pendente. Há teste
React e cenário no navegador.
