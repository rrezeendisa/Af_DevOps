# Arquitetura da Evolia

Resposta aos itens do enunciado oficial da AF (Estudo de Caso 1, DevOps e QA, 01/12/2026, páginas 1–3; não distribuído neste repositório). Os resultados de cada requisito estão na [matriz de evidências](evidencias-af.md).

- [a) Organização no código](#a-organização-arquitetural-no-código)
- [b) C4 nível 2](#b-c4-nível-2)
- [c) Comunicação](#c-comunicação-arquitetural)
- [d) ASRs](#d-requisitos-arquiteturalmente-significativos)
- [e) ADR](#e-adr--monólito-modular-híbrido)
- [ADR 002 — Sessões no lugar de HTTP Basic](#adr-002--sessões-no-servidor-no-lugar-de-http-basic)
- [Trade-offs e limitações](#trade-offs-e-limitações)

## a) Organização arquitetural no código

### Escolha

**Monólito modular híbrido** (Alternativa A): as regras de negócio ficam em uma aplicação Spring Boot organizada por domínio, e as cargas de IA rodam em processos separados.

| Critério | Efeito da escolha |
|---|---|
| Modularidade | Um pacote por domínio no Java, uma pasta por *feature* no React e processos próprios para IA. |
| Acoplamento | Poucas dependências diretas entre pacotes. IA acessada por interfaces no Java; treinamento desacoplado por fila. |
| Escalabilidade | FastAPI, worker e Ollama são implantáveis à parte. O Java escala como uma unidade. |
| Manutenção | Um único banco, build e implantação para o negócio. Mudanças de IA não exigem alterar o cadastro. |
| Complexidade operacional | Evita descoberta de serviços, banco por serviço e transações distribuídas entre cadastros, adequado a uma equipe pequena. |

Microsserviços permitiriam escalar cada domínio isoladamente, ao custo de mais implantações, contratos de rede e consistência distribuída, sem necessidade demonstrada para cadastro, identidade e consentimento.

### Backend Java

```text
backend/src/main/java/br/edu/facens/afdevops/
├── AfdevopsApplication.java
├── colaborador/     cadastro e consulta de colaboradores (com dto/)
├── curso/           cadastro e consulta de cursos (com dto/)
├── identidade/      contas individuais, usuário autenticado e contexto da sessão
├── consentimento/   decisão de uso da IA por colaborador
├── ia/              casos de uso de IA, portas e adaptadores
├── treinamento/     solicitações, estados e publicação na fila (com dto/)
└── seguranca/       cadeias de segurança, sessão, CSRF e contas de demonstração
```

A organização é por funcionalidade: cada pacote reúne controller, serviço, persistência, DTOs e tratamento de erros do seu domínio. Não há pacotes globais `controller`, `service` e `repository`.

| Módulo | Responsabilidade | Usa diretamente |
|---|---|---|
| `colaborador` | Dados do colaborador e e-mail único | — |
| `curso` | Catálogo cadastrado | — |
| `identidade` | Criação e carga de contas, vinculadas a um colaborador; identidade e contexto da sessão | Beans de senha e contas definidos em `seguranca` |
| `consentimento` | Consultar e registrar a autorização | `identidade` |
| `ia` | Validar entrada, exigir consentimento e integrar os modelos | `identidade`, `consentimento` |
| `treinamento` | Registrar, publicar e atualizar o estado | — |
| `seguranca` | Login e logout, sessão, filtro de contexto, autorização e rota interna | `identidade` |

Os módulos conversam por chamadas Java no mesmo processo. Contas e consentimentos referenciam `colaboradores` por chave estrangeira ([migração V4](../backend/src/main/resources/db/migration/V4__create_contas_e_consentimentos.sql)).

### Regras de negócio e infraestrutura

O fluxo comum é controller (HTTP e validação) → serviço (regra e transação) → repositório. Exemplos de regra isolada do transporte: [`IaService`](../backend/src/main/java/br/edu/facens/afdevops/ia/IaService.java) decide quando a IA pode ser chamada, e [`TreinamentoService`](../backend/src/main/java/br/edu/facens/afdevops/treinamento/TreinamentoService.java) controla os estados.

### Ports and Adapters nas integrações de IA

| Porta | Adaptador | Papel |
|---|---|---|
| [`ServicoIaPort`](../backend/src/main/java/br/edu/facens/afdevops/ia/ServicoIaPort.java) | [`FastApiIaAdapter`](../backend/src/main/java/br/edu/facens/afdevops/ia/FastApiIaAdapter.java) | REST, tempos limite, limite de resposta e tradução de falhas |
| [`ProximosPassosPort`](../backend/src/main/java/br/edu/facens/afdevops/ia/ProximosPassosPort.java) | [`OllamaProximosPassosAdapter`](../backend/src/main/java/br/edu/facens/afdevops/ia/OllamaProximosPassosAdapter.java) | Spring AI/Ollama, ativado por configuração |

O padrão é aplicado **somente nessas integrações**. A publicação no RabbitMQ é uma classe concreta, os serviços usam Spring e Spring Data diretamente e as entidades são JPA. A aplicação, como um todo, não segue Arquitetura Hexagonal nem Clean Architecture.

### Frontend React

```text
frontend/src/
├── app/          rotas, providers e cache de consultas
├── features/     auth, colaboradores, consentimento, contas, cursos, ia, landing, painel, treinamentos
├── components/   interface compartilhada
└── lib/api/      cliente HTTP, sessão e contexto, CSRF e erros
```

Cada *feature* reúne páginas, componentes e chamadas do domínio. O [cliente HTTP](../frontend/src/lib/api/cliente.ts) é o ponto único de acesso a `/api`. A autorização é decidida no backend; a proteção de rotas no navegador serve à navegação.

### Serviço de IA e worker

| Componente | Código | Responsabilidade |
|---|---|---|
| FastAPI | [`ai-service/app/`](../ai-service/app/main.py) | Classificação (ML), recomendação com busca documental e agente de orientação |
| Worker | [`ai-service/worker/`](../ai-service/worker/consumer.py) | Consumir a fila, treinar, repetir de forma limitada, enviar à DLQ e informar o Java |

Os dois usam a mesma imagem em containers separados e compartilham o volume do modelo.

## b) C4 nível 2

O [diagrama de contêineres está no README principal](../README.md#6-item-b--arquitetura-em-c4), com os limites de implantação.

**API Gateway:** o [Nginx](../frontend/nginx/evolia.conf) serve o frontend e encaminha `/api` ao Java na mesma origem. Ele aceita apenas os caminhos previstos (login e logout só por `POST`), limita as tentativas de login, não repassa `Authorization`, responde 404 às rotas internas e não registra URL nem cabeçalhos.

**Persistência e isolamento:** somente o Java acessa o PostgreSQL, com esquema versionado por Flyway. FastAPI e worker usam o volume de artefatos. No [Compose padrão](../docker-compose.yml), só o gateway publica porta, e redes internas separam as fronteiras:

| Rede | Participantes |
|---|---|
| `entrada` | gateway, backend |
| `dados` | backend, PostgreSQL |
| `ia` | backend, FastAPI |
| `treinamento` | backend, RabbitMQ, worker, job de topologia |
| `generativa` | backend, Ollama, job do modelo |

`borda` publica o gateway e `download` permite ao Ollama obter o modelo.

## c) Comunicação arquitetural

| Interação | Meio | Justificativa e falhas |
|---|---|---|
| Navegador → gateway → Java | REST com cookie de sessão, contexto e CSRF | O usuário espera a resposta. Sessão ausente, expirada ou substituída responde 401. |
| Java → FastAPI (classificar, recomendar, orientar) | REST | Resposta imediata. Tempos limite de 2 s (conexão) e 5 s (leitura); falhas viram erros controlados (`IA_INDISPONIVEL`, `IA_TEMPO_LIMITE`). |
| Java → Ollama | HTTP via Spring AI | Complemento opcional: sem ele, a orientação base é retornada. |
| Java → RabbitMQ → worker | AMQP | O treinamento dura além da requisição. Mensagem persistente com confirmação do broker; resposta 202. |
| Worker → Java (estado) | REST interno com Bearer | Atualiza `/internal/treinamentos/{id}/status`, fora do gateway. |

Se a publicação falhar, a solicitação fica `FALHOU` e a API responde 503. Mensagens inválidas ou que esgotam as tentativas vão para a [DLQ](../infra/rabbitmq/definitions.json). Banco e fila não são atualizados atomicamente: uma interrupção entre a gravação e a publicação pode deixar um pedido `PENDENTE`. Não há garantia de entrega exatamente uma vez.

## d) Requisitos arquiteturalmente significativos

| ASR | Por que é significativo | Decisão influenciada |
|---|---|---|
| **RNF01** — 95% das classificações em até 2 s com 300 usuários | Define capacidade e pesa sobre o desenho da autenticação | Classificação síncrona por REST, separada da geração do Ollama. A primeira [medição](evidencias-af.md#rnf01--carga-de-classificação) não atingiu a meta e levou ao [ADR 002](#adr-002--sessões-no-servidor-no-lugar-de-http-basic); com sessões, a meta foi atingida nas condições testadas. |
| **RNF02** — aceitar treinamento com ML indisponível | Exige desacoplamento temporal | Fila RabbitMQ e worker em processo distinto do FastAPI; estado persistido no Java. |
| **RNF03** — proteger dados e controlar o acesso dos agentes | Atravessa todos os componentes | Identidade, sessão e consentimento no Java, redes internas, agente com três ferramentas de leitura fixas e apenas o nível enviado ao Ollama. |

## e) ADR — Monólito modular híbrido

**Status:** aceito.

**Contexto.** Equipe reduzida, previsão de crescimento e necessidade de evoluir a IA de forma independente. Classificação, busca documental, agente e treinamento têm tecnologias e ciclos de execução diferentes dos cadastros.

**Decisão.** Regras de negócio em módulos de uma aplicação Spring Boot; IA em processos Python e Ollama; treinamento integrado por fila.

**Justificativa.** Reduz integrações distribuídas entre os domínios de cadastro e mantém a IA implantável separadamente. A fila absorve a diferença entre o tempo de resposta e o de treinamento.

**Consequências.** O Java é implantado e escalado como uma unidade, e uma falha nele afeta todos os domínios. O sistema híbrido ainda exige operar broker, serviço de IA e modelo local. Com o FastAPI parado, cadastro e consulta continuaram funcionando ([RNF04](evidencias-af.md#rnf04--evolução-independente-do-serviço-de-ia)).

## ADR 002 — Sessões no servidor no lugar de HTTP Basic

**Status:** aceito e implementado na Etapa 14.1. Complementa o ADR acima, que continua válido.

**Contexto.** A API pública usava HTTP Basic sem sessão. A meta do RNF01 exige 95% das classificações em até 2 s com 300 usuários, no hardware acadêmico disponível.

**Problema identificado.** A senha era verificada com BCrypt custo 12 em toda requisição autenticada, duas vezes por classificação (token CSRF e POST). Com 50 usuários só 15,88% ficavam no prazo; com 300 o serviço não respondia, com o Java saturando as CPUs e o FastAPI quase ocioso ([diagnóstico](evidencias-af.md#diagnóstico-original)).

**Alternativas consideradas.**

| Alternativa | Avaliação |
|---|---|
| Reduzir o custo do BCrypt | Enfraquece todos os hashes e, pela estimativa, não bastaria: o ganho teórico ficaria muito abaixo do necessário. Rejeitada. |
| Cachear credenciais já verificadas | Mantém a senha trafegando em cada chamada e cria um mecanismo próprio de autenticação, com revogação delicada. Rejeitada. |
| Apenas tirar a autenticação do `GET /api/csrf` | No máximo reduziria pela metade o trabalho repetido. Insuficiente. |
| JWT | Exige emissão, guarda no navegador, rotação de chaves e uma lista de revogação para o logout, que recria estado no servidor. Sem benefício com uma única instância. Rejeitada. |
| Sessões compartilhadas em Redis ou serviço de identidade (OAuth2) | Resolvem problemas de várias instâncias ou de login federado que o projeto não tem, ao custo de operar mais um serviço (RNF05). Rejeitada por ora. |
| **Sessão em memória com Spring Security** | Recursos nativos, nenhum serviço novo e BCrypt apenas no login. **Escolhida.** |

**Decisão.** `POST /api/login` (formulário nativo) cria a sessão; cookie `EVOLIA_SESSAO` `HttpOnly` e `SameSite=Strict`, `Secure` com HTTPS; troca do ID no login; expiração por inatividade de 30 min; `POST /api/logout` invalida. CSRF em login, logout e escritas. Um filtro próprio exige o cabeçalho `X-Evolia-Contexto`, gravado nos detalhes da autenticação, para que uma aba antiga não aja como outro usuário. HTTP Basic foi removido da API pública. O Bearer de `/internal/**` não mudou.

**Justificativa.** Elimina o trabalho repetido sem baixar a proteção da senha. O custo 12 foi mantido porque protege o armazenamento contra ataque aos hashes e, com sessão, passa a pesar só no login. Uma única instância do Java não justifica estado externo.

**Consequências.**

- Quebra de contrato: scripts, testes, frontend e exemplos passaram a usar login e cookie.
- O frontend deixou de guardar a senha, restaura a sessão ao recarregar e confirma o logout no servidor, com um marcador booleano no `localStorage` quando não há confirmação.
- O servidor passa a ter estado: reiniciar o Java encerra as sessões.
- O gateway ganhou limite de tentativas de login.

**Resultados mensurados.** Em 300 usuários e 300 sessões: 17.826 de 17.826 interações válidas em até 2 s, p95 de 33 ms na classificação e 42 ms na interação, 148,55 classificações/s, sem falhas ou tempos limite. Detalhes e comparação na [matriz de evidências](evidencias-af.md#rnf01--carga-de-classificação).

**Trade-offs.**

| Ganho | Custo |
|---|---|
| BCrypt só no login | Estado em memória no Java |
| Senha trafega uma vez | Cookie passa a ser o ativo a proteger; exige CSRF e HTTPS fora do host |
| Logout e expiração reais | Fluxos de abas, marcador e contexto mais complexos que o Basic |
| Sem serviço novo | Escala horizontal exige afinidade de sessão ou armazenamento compartilhado |

**Limitações.** Uma rodada por patamar, janela de 120 s, ambiente local, login distribuído na subida, capacidade máxima desconhecida e sem ensaio prolongado. Não há expiração absoluta, limite de sessões por usuário nem bloqueio por conta. Não existe API de troca de senha ou permissões; uma futura deverá invalidar sessões. Um login que falha mantém a sessão anterior.

## Trade-offs e limitações

| Tema | Trade-off ou limitação |
|---|---|
| Autenticação | Sessão em memória: BCrypt só no login, ao custo de estado no Java e de sessões perdidas no reinício ([ADR 002](#adr-002--sessões-no-servidor-no-lugar-de-http-basic)). |
| Transporte | Demonstração em loopback; acesso externo exige HTTPS. |
| Fronteiras dos módulos | Mantidas por convenção; não há módulos de build nem testes de arquitetura que as imponham. |
| Serviço de IA | Classificação e recomendação dependem do isolamento de rede; só a orientação exige token interno. |
| Modelo | Base sintética. Um retreino só é usado após reiniciar o FastAPI. |
| RAG e agente | Geração determinística, sequência fixa e sem acompanhamento persistente ([RF03 e RF04](evidencias-af.md#rf03--recomendação-por-rag)). |
| Catálogos | Os documentos da recomendação são independentes dos cursos cadastrados. |
| Inicialização | O worker aguarda o FastAPI saudável em uma partida a frio. |
| Operação | Instância única de cada serviço, sem alta disponibilidade. |
