# Roteiro da apresentação — Evolia

Duração planejada: **18 minutos**, com 2 de folga (limite informado de 20). O enunciado disponível no projeto não
traz regras de apresentação: **confirmem duração e formato com o professor**.

A divisão abaixo segue as contribuições registradas no Git; ajustem se a equipe combinou outra. Nomes
completos e RAs não estão no repositório.

| Quem | Blocos | Tempo |
| --- | --- | --- |
| `mjdutil` | 1, 2, 6, 8, 11 | 6,5 min |
| Felipe Brito | 3 (RNFs), 4, 5, 9 | 7 min |
| `rrezeendisa` | 3 (RFs), 7, 10 | 4,5 min |

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
- Ter à mão capturas de reserva e os documentos `docs/arquitetura-af.md` e `docs/evidencias-af.md`.

## Roteiro

### 1. Equipe e contexto — 1 min (`mjdutil`)
Apresentar os três integrantes e o Estudo de Caso 1: educação corporativa com avaliação, recomendações e
acompanhamento, equipe reduzida e crescimento previsto.

### 2. Problema e solução — 1,5 min (`mjdutil`)
Landing em `/`. Dizer o que a Evolia faz e, já de início, que é um projeto acadêmico local.

### 3. Requisitos — 2 min
- `rrezeendisa`: RF01 a RF05, apontando que **RF04 é parcial** e RF03 tem ressalva.
- Felipe: RNF01 a RNF05 e os três requisitos arquiteturalmente significativos (RNF01, RNF02, RNF03).

### 4. Arquitetura e C4 — 2,5 min (Felipe)
Diagrama do README. Monólito modular híbrido: por que não microsserviços (equipe reduzida, RNF05) e por
que a IA fica em processos separados (RNF04). Portas e adaptadores **somente** nas integrações de IA; não
chamar a aplicação de hexagonal.

### 5. Gateway, REST e RabbitMQ — 2 min (Felipe)
Nginx como única porta publicada; limite de login; CSP. REST no que precisa de resposta; fila no
treinamento. Explicar o trade-off: banco e fila não são atômicos.

### 6. Demonstração dos perfis — 2,5 min (`mjdutil`)
1. **Admin:** início, colaboradores, cursos (catálogo preenchido), "Novo colaborador", criar conta.
2. **Demonstração:** só início e catálogo; abrir `/orientacao` e mostrar "Acesso não permitido".

### 7. Inteligência artificial — 3 min (`rrezeendisa`)
Com a conta individual:
1. Privacidade e IA → **Autorizar**.
2. Minhas competências → Lógica 2, Comunicação 4, Tecnologia 3 → **Classificar** (modelo de ML; é
   estimativa).
3. Recomendações → gerar; mostrar fontes e dizer que a recuperação é TF-IDF sobre 12 documentos
   fictícios, sem LLM redigindo.
4. Orientador → enviar uma sugestão; mostrar próximos passos (Ollama) e explicar que sem ele a orientação
   base continua.

### 8. Segurança e consentimento — 1 min (`mjdutil`)
Sessão com cookie `HttpOnly`, CSRF, contexto de sessão. **Revogar** o consentimento ao vivo e mostrar que
os resultados somem; o que já foi enviado pode ter sido processado.

### 9. Treinamento assíncrono e desempenho — 1,5 min (Felipe)
- Admin → Treinamentos → solicitar; acompanhar `PENDENTE` → `CONCLUIDO`. O modelo novo só é carregado ao
  reiniciar o FastAPI.
- RNF01: antes, com HTTP Basic, a 300 usuários a amostra ficou inconclusiva (200 usuários: p95 de 16,5 s);
  depois, com sessões, 17.826 de 17.826 no prazo e p95 de 33 ms. Medição local, revisão `676ad62`.

Opcional, se sobrar tempo (RNF02 e RNF04): o treinamento não depende da API de IA.

```bash
docker compose stop ai-service      # solicitar um treinamento: aceito, e o worker (já ativo) conclui
                                    # o catálogo continua; o Orientador mostra erro claro
docker compose start ai-service
```

### 10. Limitações — 0,5 min (`rrezeendisa`)
RF04 parcial; ambiente local sem HTTPS nem alta disponibilidade; base sintética; documentos sem ligação
com o catálogo; sessões em memória.

### 11. Conclusão — 0,5 min (`mjdutil`)
Retomar as decisões e o que viria depois: acompanhamento persistente, HTTPS e observabilidade, ligação
entre acervo e catálogo.

## Se algo falhar

| Sintoma | O que fazer |
| --- | --- |
| "Serviço de IA indisponível" | `docker compose ps`; `docker compose up -d ai-service`. É também a demonstração do tratamento de erro. |
| Sem próximos passos gerados | Ollama indisponível ou modelo baixando; a orientação base é o comportamento esperado. |
| Treinamento parado em `PENDENTE` | `docker compose up -d ai-worker`. |
| Sessão caiu | Entrar de novo; reiniciar o backend encerra as sessões. |
| Muitas tentativas de login | Aguardar alguns segundos (limite do gateway). |
