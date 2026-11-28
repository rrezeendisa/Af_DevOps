# Roteiro da apresentação — Evolia

**Evolia — Inteligência que desenvolve pessoas.** Facens · DevOps e QA · Prova AF (Estudo de Caso 1) ·
01/12/2026.

A ordem de A a I segue as orientações da professora e não deve mudar. Duração planejada: cerca de
18 minutos, 6 por integrante.

| Quem | Partes | Tempo |
| --- | --- | --- |
| Isadora Gesaro Rezende | A, B, C | 6 min |
| Maria Julia de Paula Dutil | D, E (com ADR), F | 6 min |
| Felipe de Brito Lima | G (com os três ASRs), H, I | 6 min |

Os RAs ficam na identificação privada da equipe, fora do repositório público. Telas e arquivos de cada
parte: [guia de demonstração](../README.md#15-guia-de-demonstração).

## Antes de gravar

```bash
docker compose up -d --build            # na raiz; não use "down -v"
curl -fsS http://127.0.0.1:8088/healthz
python3 scripts/preencher_catalogo.py   # não duplica
docker compose ps                       # serviços "healthy"; o ai-worker aparece como "Up"
```

- Abrir a identificação privada (parte A) e o README no GitHub, com os diagramas carregados.
- Deixar logadas duas janelas: administrador e conta individual de colaborador.
- Na conta individual, autorizar a IA, classificar (Lógica 2, Comunicação 4, Tecnologia 3), gerar
  recomendações e uma orientação. A primeira geração do Ollama levou cerca de 34 s; depois, cerca de 4 s.
- Não mostrar o `.env`, senhas nem terminal com segredos.

## Roteiro

### Isadora — 6 min

**A. Equipe — 0,5 min.** Nomes completos e RAs dos três, nome do projeto (Evolia) e data (01/12/2026).

**B. Problema e requisitos — 2,5 min.** README, seções 1, 3 e 4.
- Educação corporativa: avaliar competências, recomendar cursos e acompanhar a evolução, com equipe
  reduzida, crescimento previsto e IA que evolua sem afetar o restante.
- RF01 a RF05: cadastro, classificação, recomendação, orientação com autorização e treinamento.
  **RF03 tem ressalva** e **RF04 é parcial**.
- RNF01 a RNF05: desempenho, disponibilidade do treinamento, proteção de dados, evolução independente e
  custo.

**C. Arquitetura C4 — 3 min.** README, seção 6, direto no diagrama.
- Pessoas: administrador e colaborador.
- Contêineres: gateway com frontend, backend, PostgreSQL, serviço de IA, RabbitMQ, *worker*, Ollama.
- Classificação, recuperação e agente são **componentes** do serviço de IA, não serviços separados.
- Limite de implantação: um Docker Compose em uma máquina; só o gateway publica porta, em `127.0.0.1`.

### Maria Julia — 6 min

**D. Serviços e módulos — 2,5 min.** README, seções 5.4 e 5.6, e a aplicação aberta.
- Módulos do backend: `colaborador`, `curso`, `identidade`, `consentimento`, `treinamento`, `ia`,
  `seguranca`.
- Na aplicação, passar rápido: administrador (colaboradores, cursos, treinamentos) e colaborador
  (classificação, recomendações com fontes, Orientador).
- Dizer o que é cada IA: árvore de decisão com base sintética; busca TF-IDF em 12 documentos fictícios,
  sem LLM redigindo; Ollama só gera próximos passos genéricos a partir do nível.

**E. Microsserviços, monólito modular híbrido e gateway — 2,5 min.** README, seções 5.2, 5.3 e 9.
- Microsserviços: cada domínio com código, implantação e dados próprios. Comparar nos cinco critérios:
  modularidade, acoplamento, escalabilidade, manutenção e complexidade operacional.
- Escolha: monólito modular híbrido. O negócio fica em um backend; IA e *worker* são serviços separados.
  **Não** é uma arquitetura de microsserviços completa.
- Gateway Nginx: entrada única, serve a interface, encaminha `/api`, aplica CSP e limite de login e não
  expõe rotas internas.
- ADR: contexto (equipe reduzida), decisão, justificativa e trade-off (menos independência em troca de
  simplicidade). Citar o ADR complementar: sessões no lugar de HTTP Basic.

**F. Hexagonal e Clean Architecture — 1 min.** README, seção 5.5.
- Aplicamos Ports and Adapters **apenas na integração com IA**: `ServicoIaPort` → `FastApiIaAdapter` e
  `ProximosPassosPort` → `OllamaProximosPassosAdapter`.
- RabbitMQ e banco são usados diretamente. O projeto **não** é hexagonal nem Clean Architecture por
  inteiro; o restante segue camadas por módulo.

### Felipe — 6 min

**G. Comunicação síncrona e assíncrona — 4 min.** README, seções 7 e 8.
- REST quando alguém espera a resposta: login, cadastros, classificação, recomendações, orientação. Há
  tempos limite e erros claros; se o Ollama falha, a orientação segue sem os próximos passos.
- RabbitMQ no treinamento, que é demorado: grava `PENDENTE`, publica com confirmação, o *worker* consome,
  treina, informa o estado e só então confirma a mensagem. Há novas tentativas, DLQ e idempotência.
- Limite: banco e fila não são atômicos (não há *outbox*).
- Os três ASRs e a decisão de cada um:
  - **RNF01** (95% em até 2 s com 300 usuários) → sessão no servidor. Medição local e histórica, não
    repetida na versão final: 17.826 de 17.826 no prazo, p95 de 33 ms.
  - **RNF02** (treinar com o ML indisponível) → fila durável e *worker* separado. Vale com o *worker* já em
    execução.
  - **RNF03** (dados e acesso dos agentes) → consentimento no backend, ferramentas fixas, token interno e
    redes internas.

**H. Limitações — 1,5 min.** README, seção 16.
- RF03: há recuperação, sem geração por LLM a partir dos documentos. RF04: parcial, sem acompanhamento
  persistente.
- Ports and Adapters só na integração com IA.
- Dados sintéticos, documentos fictícios e acervo sem ligação com o catálogo.
- Sessões em memória; ambiente local, sem HTTPS, alta disponibilidade ou observabilidade.

**I. Considerações finais — 0,5 min.** A arquitetura é proporcional à equipe: negócio simples de operar, IA
separada para evoluir e treinamento desacoplado. Próximos passos: acompanhamento persistente, HTTPS e
observabilidade.

## Se algo falhar

| Sintoma | O que fazer |
| --- | --- |
| "Serviço de IA indisponível" | `docker compose ps`; `docker compose up -d ai-service`. É também a demonstração do tratamento de erro. |
| Sem próximos passos gerados | Ollama indisponível ou modelo baixando; a orientação base é o comportamento esperado. |
| Treinamento parado em `PENDENTE` | `docker compose up -d ai-worker`. |
| Sessão caiu | Entrar de novo; reiniciar o backend encerra as sessões. |
| Muitas tentativas de login | Aguardar alguns segundos (limite do gateway). |
