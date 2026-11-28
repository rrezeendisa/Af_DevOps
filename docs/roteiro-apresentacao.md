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

Na raiz do projeto:

```bash
docker compose up -d --build            # não use "down -v"
curl http://localhost:8088/healthz      # deve responder "ok"
python3 scripts/preencher_catalogo.py   # não duplica cursos
```

- Abrir o README no GitHub (com os diagramas carregados) e a identificação privada com os RAs.
- Deixar duas janelas abertas: uma com o administrador e uma anônima com um colaborador individual.
- Na conta individual, autorizar a IA, classificar (Lógica 2, Comunicação 4, Tecnologia 3), gerar
  recomendações e fazer uma pergunta ao Orientador. Assim o modelo já fica carregado.
- Não mostrar o `.env`, senhas nem terminais com segredos.

## Roteiro

As falas abaixo são uma sugestão. Cada um pode usar as próprias palavras, mantendo os pontos e as ressalvas.

### Isadora — 6 min

**A. Equipe (0,5 min)**
"Nós somos Isadora, Maria Julia e Felipe." Dizer os nomes completos e os RAs, o nome do projeto, Evolia, e a
data, 01/12/2026.

**B. Problema e requisitos (2,5 min)** — README, seções 1, 3 e 4
- "O problema é de uma empresa de educação corporativa: avaliar competências, recomendar cursos e acompanhar
  a evolução das pessoas."
- "A equipe é pequena, espera crescer e precisa evoluir a IA sem parar o resto."
- "Os requisitos funcionais são cadastro, classificação, recomendação, orientação com autorização e
  treinamento do modelo."
- "Já adiantamos: a recomendação tem uma ressalva e a orientação por agente foi atendida só em parte."
- "Os não funcionais falam de desempenho, treinamento com o ML fora do ar, proteção de dados, evolução da IA
  e custo."

**C. Arquitetura C4 (3 min)** — README, seção 6
- "Este é o diagrama de contêineres. Temos duas pessoas: o administrador e o colaborador."
- "Elas entram pelo gateway, que entrega o frontend e encaminha as chamadas ao backend."
- "O backend usa o PostgreSQL, chama o serviço de IA e o Ollama e publica treinamentos no RabbitMQ."
- "Classificação, busca de documentos e agente são partes do mesmo serviço de IA, não serviços separados."
- "Tudo roda em um Docker Compose, e só o gateway tem porta publicada, na própria máquina."

### Maria Julia — 6 min

**D. Serviços e módulos (2,5 min)** — README, seções 5.4 e 5.6, e a aplicação aberta
- "No backend, separamos os módulos por assunto: colaborador, curso, identidade, consentimento, treinamento,
  IA e segurança."
- Mostrar rápido: como administrador, colaboradores, cursos e treinamentos; como colaborador, classificação,
  recomendações com fontes e Orientador.
- "A classificação usa uma árvore de decisão treinada com dados sintéticos."
- "A recomendação busca em 12 documentos fictícios, por similaridade de texto. Nenhum modelo de linguagem
  escreve essa resposta."
- "O Ollama só gera próximos passos genéricos, a partir do nível."

**E. Microsserviços, monólito modular híbrido e gateway (2,5 min)** — README, seções 5.2, 5.3 e 9
- "Em microsserviços, cada parte tem código, implantação e dados próprios."
- Comparar nos cinco critérios: modularidade, acoplamento, escalabilidade, manutenção e complexidade de
  operação.
- "Escolhemos o monólito modular híbrido: o negócio fica em um backend, e a IA e o *worker* ficam separados.
  Não é uma arquitetura de microsserviços completa."
- "O gateway Nginx é a única entrada: serve a interface, encaminha a API, limita tentativas de login e não
  expõe as rotas internas."
- ADR: "O contexto era a equipe pequena. A decisão foi o monólito híbrido. O que perdemos é a independência
  entre os módulos de negócio; o que ganhamos é simplicidade." Citar o segundo ADR: trocamos o login em cada
  requisição por sessões no servidor.

**F. Arquitetura Hexagonal e Ports and Adapters (1 min)** — README, seção 5.5
- "Na Arquitetura Hexagonal, o negócio conversa com o mundo externo por portas, e adaptadores implementam
  essas portas."
- "Usamos essa ideia **só na integração com a IA**: `ServicoIaPort` com `FastApiIaAdapter`, e
  `ProximosPassosPort` com `OllamaProximosPassosAdapter`."
- "O RabbitMQ e o banco são usados diretamente. Por isso, não dizemos que o projeto é hexagonal nem Clean
  Architecture."

### Felipe — 6 min

**G. Comunicação síncrona e assíncrona (4 min)** — README, seções 7 e 8
- "Usamos REST quando alguém está esperando: login, cadastros, classificação, recomendações e orientação."
- "Há tempo limite e mensagens de erro. Se o Ollama falhar, a orientação aparece sem os próximos passos."
- "O treinamento é demorado, então usamos o RabbitMQ: o pedido é gravado como pendente, publicado com
  confirmação, o *worker* treina, avisa o backend e só depois confirma a mensagem."
- "Há novas tentativas, uma fila para mensagens que falharam e proteção contra treinar duas vezes."
- "Um limite: gravar no banco e publicar na fila não acontecem na mesma transação."
- Os três ASRs:
  - "**RNF01**, responder em até 2 segundos com 300 usuários: passamos a usar sessões. Na medição local feita
    antes da versão final, as 17.826 classificações ficaram no prazo, com p95 de 33 ms."
  - "**RNF02**, aceitar treinamentos com o ML fora do ar: usamos a fila, com o *worker* já em execução."
  - "**RNF03**, proteger os dados: o consentimento é verificado no backend, o agente tem ferramentas fixas e as
    redes são internas."

**H. Limitações (1,5 min)** — README, seção 16
- "A recomendação não gera texto com um modelo de linguagem, e o acompanhamento do colaborador não foi
  implementado por completo."
- "Os dados são sintéticos, os documentos são fictícios e o acervo não está ligado ao catálogo."
- "As sessões ficam na memória, e o ambiente é local, sem HTTPS nem alta disponibilidade."

**I. Considerações finais (0,5 min)**
"Buscamos uma arquitetura do tamanho da nossa equipe: o negócio fica simples de operar, a IA pode evoluir
separada e o treinamento não trava o usuário. Os próximos passos seriam o acompanhamento do colaborador,
HTTPS e observabilidade."

## Se algo falhar

| Sintoma | O que fazer |
| --- | --- |
| "O serviço de IA está indisponível no momento" | `docker compose ps`; `docker compose up -d --force-recreate ai-service`. É também a demonstração do tratamento de erro. |
| Sem próximos passos gerados | Ollama indisponível ou modelo baixando; a orientação base é o comportamento esperado. |
| Treinamento parado em `PENDENTE` | `docker compose up -d ai-worker`. |
| Sessão caiu | Entrar de novo; reiniciar o backend encerra as sessões. |
| Muitas tentativas de login | Aguardar alguns segundos (limite do gateway). |
