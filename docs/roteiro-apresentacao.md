# Roteiro da apresentação — Evolia

Duração planejada: **18 minutos**, com 2 de folga (limite informado de 20). O enunciado disponível no projeto não
traz regras de apresentação: **confirmem duração e formato com o professor**.

A divisão abaixo segue as contribuições registradas no Git; ajustem se a equipe combinou outra. Nomes
completos e RAs não estão no repositório.

| Quem | Passos | Tempo |
| --- | --- | --- |
| `mjdutil` | 1, 2, 6, 7, 12, 16 (conclusão) | 6 min |
| Felipe Brito | 3, 4, 5, 11, 13, 14, 15 | 7 min |
| `rrezeendisa` | 2 (requisitos), 8, 9, 10, 16 (limitações) | 5 min |

Os 16 passos são os mesmos do [guia de demonstração](../README.md#15-guia-de-demonstração), que indica a
tela, o arquivo a abrir e o requisito de cada um.

## Antes de começar (véspera e 15 minutos antes)

```bash
docker compose up -d --build            # na raiz; não use "down -v"
curl -fsS http://127.0.0.1:8088/healthz
python3 scripts/preencher_catalogo.py   # não duplica
docker compose ps                       # serviços "healthy"
docker compose exec ollama ollama list  # modelo baixado, para os próximos passos
```

- Criar antes um colaborador e a conta individual de apresentação (senha com 12 ou mais caracteres).
- Deixar o consentimento **sem autorização**, para autorizar ao vivo.
- Abrir três janelas ou perfis de navegador (cada um com sua sessão): admin, colaborador, demonstração.
- Não mostrar o `.env` na tela. Fazer uma classificação de teste antes (aquece os serviços).
- Fazer uma orientação de teste antes: a primeira geração do Ollama levou cerca de 34 s; depois, cerca de 4 s.
- Ter à mão capturas de reserva, o README e `docs/evidencias-af.md`.

## Roteiro

### 1. Equipe e problema — 1 min (`mjdutil`)
Os três integrantes e o Estudo de Caso 1: educação corporativa com avaliação, recomendações e
acompanhamento, equipe reduzida e crescimento previsto.

### 2. Visão geral — 2 min
- `mjdutil` (1 min): página pública `/`, o que a Evolia faz, os três perfis; projeto acadêmico local.
- `rrezeendisa` (1 min): RF01 a RF05, apontando que **RF03 tem ressalva** e **RF04 é parcial**.

### 3. Organização arquitetural e justificativas — 2 min (Felipe)
Item A, o de maior peso. Comparar monólito modular híbrido e microsserviços nos cinco critérios; mostrar os
pacotes do backend, `CursoService` e as duas portas de IA. Portas e adaptadores **somente** nessa
integração; não chamar a aplicação de hexagonal.

### 4. C4 — 1 min (Felipe)
Diagrama de contêineres, limite de implantação e os componentes internos do serviço de IA.

### 5. REST e RabbitMQ — 1,5 min (Felipe)
REST quando há alguém esperando; fila no treinamento. Confirmações, DLQ, idempotência e o limite: banco e
fila não são atômicos.

### 6. Demonstração como administrador — 1,5 min (`mjdutil`)
Visão geral, colaboradores, catálogo, "Novo colaborador" e criação de conta.

### 7. Demonstração do colaborador — 0,5 min (`mjdutil`)
Início e catálogo. Na conta de demonstração, abrir `/orientacao` e mostrar "Acesso não permitido".

### 8. Classificação — 1 min (`rrezeendisa`)
Conta individual: Privacidade e IA → **Autorizar**; Minhas competências → Lógica 2, Comunicação 4,
Tecnologia 3 → **Classificar**. É uma estimativa de um modelo treinado com base sintética.

### 9. Recomendações e fontes — 1 min (`rrezeendisa`)
Gerar recomendações e mostrar as fontes. TF-IDF sobre 12 documentos fictícios, sem LLM redigindo.

### 10. Orientador e consentimento — 1,5 min (`rrezeendisa`)
Enviar uma sugestão; mostrar os próximos passos gerados (Ollama, genéricos). **Revogar** o consentimento ao
vivo: os resultados somem; o que já foi enviado pode ter sido processado.

### 11. Treinamento assíncrono — 1 min (Felipe)
Admin → Treinamentos → solicitar; acompanhar `PENDENTE` → `CONCLUIDO`. O modelo novo só é carregado ao
reiniciar o FastAPI.

Opcional, se sobrar tempo (RNF02 e RNF04): o treinamento não depende da API de IA.

```bash
docker compose stop ai-service      # solicitar um treinamento: aceito, e o worker (já ativo) conclui
                                    # o catálogo continua; o Orientador mostra erro claro
docker compose start ai-service
```

### 12. Segurança — 1 min (`mjdutil`)
Sessão com cookie `HttpOnly`, CSRF, contexto de sessão, perfis, redes internas e CSP.

### 13. Desempenho — 0,5 min (Felipe)
Antes, com HTTP Basic, a 300 usuários a amostra ficou inconclusiva (200 usuários: p95 de 16,5 s); depois,
com sessões, 17.826 de 17.826 no prazo e p95 de 33 ms. Medição local e histórica, revisão `676ad62`.

### 14. ASRs — 0,5 min (Felipe)
RNF01, RNF02 e RNF03 e a decisão que cada um provocou.

### 15. ADRs — 0,5 min (Felipe)
Monólito modular híbrido; sessões no lugar de HTTP Basic, com os trade-offs.

### 16. Limitações e conclusão — 1 min
- `rrezeendisa` (0,5 min): RF03 e RF04, base sintética, documentos sem ligação com o catálogo, ambiente
  local, sessões em memória.
- `mjdutil` (0,5 min): retomar as decisões e o que viria depois: acompanhamento persistente, HTTPS e
  observabilidade.

## Se algo falhar

| Sintoma | O que fazer |
| --- | --- |
| "Serviço de IA indisponível" | `docker compose ps`; `docker compose up -d ai-service`. É também a demonstração do tratamento de erro. |
| Sem próximos passos gerados | Ollama indisponível ou modelo baixando; a orientação base é o comportamento esperado. |
| Treinamento parado em `PENDENTE` | `docker compose up -d ai-worker`. |
| Sessão caiu | Entrar de novo; reiniciar o backend encerra as sessões. |
| Muitas tentativas de login | Aguardar alguns segundos (limite do gateway). |
