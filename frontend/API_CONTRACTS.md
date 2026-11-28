# Evolia: contratos da API, segurança e permissões

Este documento resume a API do backend Java que o frontend usa. Tudo aqui foi conferido em
`backend/src/main/java/br/edu/facens/afdevops` (indicado como `…/` abaixo) e em
`backend/README.md`. **Se algo divergir, vale o código do backend.** Não acrescente rotas ou
campos que não existam lá.

## 1. Princípios de integração

- O frontend chama somente caminhos relativos `/api/...`. Não há CORS no backend. Em dev,
  o proxy do Vite encaminha para o backend. No Compose, o Nginx serve o build e encaminha a API.
- O frontend nunca acessa FastAPI, PostgreSQL, RabbitMQ, Ollama nem `/internal/**`.
- Todas as chamadas passam por um único cliente em `frontend/src/lib/api`.
- Datas (`criadoEm`, `decididoEm`, `atualizadoEm`) são `Instant` em ISO 8601 UTC. Formate
  em pt-BR só na exibição.
- As listagens não têm paginação, filtro, edição nem exclusão.

## 2. Autenticação e identidade

- HTTP Basic sem sessão (`SessionCreationPolicy.STATELESS`): toda requisição protegida envia
  `Authorization: Basic base64(usuario:senha)`. Não há rota de login nem de logout.
- **Login:** chamar `GET /api/me` com as credenciais digitadas. Resposta 200 significa
  autenticado; 401 significa credenciais inválidas.
- **Logout:** é apenas local (ver seção 6).

`GET /api/me` responde com `IdentidadeResponse` (`…/identidade/IdentidadeController.java`), com `Cache-Control: no-store`:

```ts
type Identidade = {
  nomeUsuario: string;          // nome autenticado
  perfil: 'ADMIN' | 'COLABORADOR';
  colaboradorId?: number;       // presente só em conta individual (JSON omite quando null)
};
```

**Três tipos de conta**, que o frontend deve distinguir:

| Tipo | Como identificar | Pode usar |
| --- | --- | --- |
| Administrador (demonstração) | `perfil === 'ADMIN'` | Área administrativa e catálogo |
| Colaborador individual | `perfil === 'COLABORADOR'` **e** `colaboradorId` presente | Catálogo, consentimento, IA |
| Colaborador de demonstração | `perfil === 'COLABORADOR'` **sem** `colaboradorId` | Só o catálogo. Consentimento e IA respondem 403 `ACESSO_NEGADO` |

As contas de demonstração ficam em memória no servidor e não têm vínculo com colaborador
(`…/seguranca/ContasDemonstracao.java`). O colaborador **não** consegue ler o próprio cadastro:
`GET /api/colaboradores/{id}` é exclusivo de ADMIN. O painel individual mostra `nomeUsuario`.

### Cabeçalho `WWW-Authenticate`

O 401 inclui `WWW-Authenticate: Basic realm="AF-DevOps"` (`…/seguranca/ErrosSeguranca.java`).
Em `fetch`, isso faz o navegador abrir a janela nativa de login. O backend **não** será
alterado. A solução fica no proxy:

- **Vite (dev):** remover o cabeçalho na resposta, em `configure` → `proxy.on('proxyRes', r => delete r.headers['www-authenticate'])`.
- **Nginx no Compose:** `proxy_hide_header WWW-Authenticate;`.
- ⚠️ **Pendente:** validar no navegador real (Chrome, Firefox, Safari) que nenhuma janela nativa
  aparece em 401, tanto no login com senha errada quanto em credenciais expiradas.

## 3. CSRF nas operações de escrita

Configuração (`…/seguranca/SegurancaConfig.java`):

- `CookieCsrfTokenRepository` com o cookie `XSRF-TOKEN` **HttpOnly** e **SameSite=Strict**. O
  JavaScript não lê esse cookie, e isso é esperado.
- `XorCsrfTokenRequestAttributeHandler`: o token do JSON é **mascarado** e é ele que vai no cabeçalho.
- Em escritas, o CSRF é verificado **antes** da autenticação. Sem token válido, a resposta é
  403 `CSRF_INVALIDO`, mesmo sem credenciais.

`GET /api/csrf` (ADMIN e COLABORADOR, autenticado), com `Cache-Control: no-store`:

```ts
type TokenCsrf = { headerName: 'X-XSRF-TOKEN'; token: string }; // token: [A-Za-z0-9_-]+
```

**Fluxo obrigatório para cada `POST` e `PUT`:**

1. `GET /api/csrf` com Basic. O navegador grava o cookie `XSRF-TOKEN`.
2. Enviar a escrita com Basic, `X-XSRF-TOKEN: <token do JSON>` e `credentials: 'same-origin'`
   (cookie enviado automaticamente).
3. Validar `headerName === 'X-XSRF-TOKEN'` e o formato do token antes de usá-lo.

**Serialização obrigatória.** O cliente HTTP mantém uma **fila única** (cadeia de *promises*)
para o par “obter CSRF e executar escrita”. Assim, duas escritas concorrentes não intercalam
`GET /api/csrf`, o que poderia trocar o cookie entre o token obtido e o envio e gerar
`CSRF_INVALIDO`. Leituras (`GET`) não entram na fila.

**Sem retentativa automática.** Nenhuma escrita é repetida pelo cliente, nem em 403
`CSRF_INVALIDO`. O erro volta para quem chamou, e a interface decide se oferece “Tentar novamente”.

**Implementação:** `criarSessaoApi(credenciais)` em `frontend/src/lib/api/cliente.ts` cria uma sessão
por login, com as credenciais apenas no *closure*. A sessão expõe:

- `obter`, `enviar` e `substituir`, que exigem resposta JSON validada.
- `escreverSemResposta`, que admite sucesso sem corpo.
- `encerrar()`, que cancela o que está em andamento e o que espera na fila, descarta as credenciais
  e impede novas chamadas.

Só aceita caminhos `/api/<segmentos>` simples. Os erros (`ApiError` em `erros.ts`) guardam apenas
`tipo`, `status` e um `codigo` reconhecido.

## 4. Permissões por rota

Transcrito de `SegurancaConfig.java`. Qualquer outra rota ou método é negado (`anyRequest().denyAll()`).

| Método e rota | Perfil |
| --- | --- |
| `GET /api/me`, `GET /api/csrf` | ADMIN, COLABORADOR |
| `GET /api/cursos`, `GET /api/cursos/{id}` | ADMIN, COLABORADOR |
| `POST /api/cursos` | ADMIN |
| `GET /api/colaboradores`, `GET /api/colaboradores/{id}`, `POST /api/colaboradores` | ADMIN |
| `POST /api/colaboradores/{id}/conta` | ADMIN |
| `POST /api/treinamentos`, `GET /api/treinamentos`, `GET /api/treinamentos/{id}` | ADMIN |
| `GET /api/me/consentimento`, `PUT /api/me/consentimento` | Somente conta individual |
| `POST /api/ia/classificacoes`, `/recomendacoes`, `/orientacoes` | Conta individual **com consentimento concedido** |
| `GET /actuator/health` | Público (o frontend não usa) |

Conta individual é aquela cujo *principal* é `ContaAutenticada`, ou seja, que tem `colaboradorId`.
ADMIN e o colaborador de demonstração recebem 403 `ACESSO_NEGADO` nas rotas de consentimento e IA.

## 5. Contratos por recurso

Convenções: `?` indica campo opcional ou omitido. Os limites de tamanho valem para cada campo de texto, e
todos os textos rejeitam o caractere NUL (`\x00`). Status de sucesso entre parênteses.

### Colaboradores (`…/colaborador/dto`)

`POST /api/colaboradores` (201 + `Location`)

| Campo | Regra |
| --- | --- |
| `nome` | obrigatório, até 150 |
| `email` | obrigatório, e-mail válido, até 254. O backend remove espaços das extremidades e converte para minúsculas, e o valor precisa ser único |
| `cargo` | obrigatório, até 100 |
| `departamento` | obrigatório, até 100 |

```ts
type Colaborador = { id: number; nome: string; email: string; cargo: string; departamento: string; criadoEm: string };
```

`GET /api/colaboradores` devolve `Colaborador[]` (200, `[]` se vazio). `GET /api/colaboradores/{id}` responde 200 ou 404.

Erros: 400 `DADOS_INVALIDOS`, 409 `EMAIL_DUPLICADO`, 404 `COLABORADOR_NAO_ENCONTRADO`.

### Conta individual (`…/identidade`)

`POST /api/colaboradores/{id}/conta` (201, `no-store`). O corpo aceita **exatamente** dois campos string:

| Campo | Regra |
| --- | --- |
| `nomeUsuario` | `^[A-Za-z0-9_.-]{1,64}$`. É salvo em minúsculas, e os nomes das contas de demonstração são reservados |
| `senhaInicial` | no mínimo 12 caracteres (*code points*), no máximo 72 bytes UTF-8, não pode ser só espaço em branco, sem NUL |

```ts
type ContaCriada = { id: number; nomeUsuario: string; perfil: 'COLABORADOR'; colaboradorId: number; criadoEm: string };
```

Erros: 400 `DADOS_INVALIDOS`, 404 `COLABORADOR_NAO_ENCONTRADO`, 409 `CONTA_DUPLICADA` (o colaborador
já tem conta) e 409 `NOME_USUARIO_INDISPONIVEL`.

Limitações: não há rota para listar contas, consultar se um colaborador já tem conta, trocar
nem recuperar senha. A UI só descobre uma conta existente pelo 409 `CONTA_DUPLICADA`. A senha
inicial nunca é exibida de volta nem guardada no frontend após o envio.

### Cursos (`…/curso`)

`POST /api/cursos` (201 + `Location`). Exclusivo de ADMIN.

| Campo | Regra |
| --- | --- |
| `nome` | obrigatório, até 150 |
| `descricao` | obrigatório, até 2000 |
| `cargaHoraria` | inteiro positivo (horas), **número JSON inteiro**, sem string nem decimal |
| `categoria` | obrigatório, até 100 |
| `nivel` | `'BASICO' \| 'INTERMEDIARIO' \| 'AVANCADO'` |

```ts
type NivelCurso = 'BASICO' | 'INTERMEDIARIO' | 'AVANCADO';
type Curso = { id: number; nome: string; descricao: string; cargaHoraria: number; categoria: string; nivel: NivelCurso; criadoEm: string };
```

`GET /api/cursos` devolve `Curso[]`. `GET /api/cursos/{id}` responde 200 ou 404 `CURSO_NAO_ENCONTRADO`. Também pode haver 400 `DADOS_INVALIDOS`.

### Consentimento para IA (`…/consentimento`)

- `GET /api/me/consentimento` (200, `no-store`).
- `PUT /api/me/consentimento` (200, `no-store`) com o corpo **exato** `{"autorizado": true}` ou
  `{"autorizado": false}`. Qualquer campo extra ou tipo diferente gera 400 `DADOS_INVALIDOS`.

```ts
type Consentimento = { autorizado: boolean; decididoEm: string | null }; // antes da 1ª decisão: { autorizado: false, decididoEm: null }
```

O registro é a decisão atual, não um histórico. A revogação bloqueia novas chamadas à IA, mas
não interrompe as que já estão em andamento.

### IA (`…/ia/IaEntrada.java`, `IaDtos.java`, `IaFalha.java`)

Regras comuns de entrada:

- `Content-Type: application/json`, sem query string.
- **Somente** os campos listados, sem extras nem repetidos.
- Notas são inteiros JSON de 1 a 5.

Todas as respostas vêm com `no-store`.

```ts
type Nota = 1 | 2 | 3 | 4 | 5;
type NivelCompetencia = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO'; // ≠ NivelCurso
```

| Rota | Corpo | Resposta 200 |
| --- | --- | --- |
| `POST /api/ia/classificacoes` | `{ logica, comunicacao, tecnologia }` | `{ nivel: NivelCompetencia; versaoModelo: string }` |
| `POST /api/ia/recomendacoes` | `{ logica, comunicacao, tecnologia, nivel }` (notas **planas**) | `{ recomendacoes: { cursoId: string; nome: string; justificativa: string }[]; fontes: string[] }` |
| `POST /api/ia/orientacoes` | `{ pergunta, competencias: { logica, comunicacao, tecnologia } }` (notas **aninhadas**) | `{ orientacao: string; cursosRecomendados: string[]; fontes: string[]; proximosPassos?: string[] }` |

- `pergunta` tem de 1 a 1000 *code points*. Valide com `[...texto].length`, não com `texto.length`.
- `cursoId` e `cursosRecomendados[]` são **códigos documentais** do ai-service (por exemplo `CURSO-001`).
  Eles **não** correspondem ao `id` numérico de `/api/cursos` e não podem virar link para o catálogo.
- `fontes` são nomes de arquivos do catálogo documental do ai-service. Exiba como texto, não como link.
- `recomendacoes` e `fontes` podem vir vazias. Nesse caso, mostre o estado vazio com uma mensagem honesta.
- `proximosPassos` é **opcional**. Quando vem, tem de 1 a 3 frases curtas geradas por modelo local
  (podem variar entre chamadas). **A ausência é resposta válida** (geração desabilitada, Ollama
  indisponível, tempo esgotado, saída inválida ou consentimento revogado) e não é erro. Renderize
  sempre como texto puro, nunca como HTML.
- Fluxo da UI: avaliação → classificação → recomendações (com o `nivel` retornado) → orientação.
  As notas e as respostas ficam só no estado da sessão, nunca no armazenamento do navegador.

Erros: 400 `DADOS_INVALIDOS`, 403 `CONSENTIMENTO_IA_NECESSARIO`, 403 `ACESSO_NEGADO`,
502 `IA_RESPOSTA_INVALIDA`, 503 `IA_INDISPONIVEL`, 504 `IA_TEMPO_LIMITE`. O backend não repete chamadas,
e o frontend também não repete automaticamente.

### Solicitações de treinamento (`…/treinamento`)

- `POST /api/treinamentos`, **sem corpo**, com CSRF. Responde **202** + `Location` com a solicitação `PENDENTE`.
  Se o RabbitMQ não confirmar, responde 503 `FILA_INDISPONIVEL`, e a solicitação fica registrada como `FALHOU`.
- `GET /api/treinamentos` lista as solicitações em ordem de ID. `GET /api/treinamentos/{id}` responde 200 ou 404 `SOLICITACAO_NAO_ENCONTRADA`.

```ts
type StatusTreinamento = 'PENDENTE' | 'CONCLUIDO' | 'FALHOU';
type SolicitacaoTreinamento = {
  id: number; status: StatusTreinamento; solicitadoPor: string;
  versaoModelo: string | null; mensagem: string | null; criadoEm: string; atualizadoEm: string;
};
```

Não há *push*. O acompanhamento é feito por atualização manual ou por consulta periódica curta,
**somente** enquanto houver `PENDENTE` e a tela estiver visível. Depois de um 503, recarregue a lista
para mostrar o registro `FALHOU`.

## 6. Sessão no cliente

- Credenciais ficam **exclusivamente em memória** (estado React ou módulo). Nunca em
  `localStorage`, `sessionStorage`, cookies legíveis, IndexedDB, URL ou logs.
- O `localStorage` pode guardar **apenas** preferências de interface. Hoje, só o tema
  (`evolia:tema` = `claro | escuro | sistema`). Credenciais, dados pessoais, avaliações de
  competências e respostas da IA nunca são persistidos.
- Recarregar a página encerra a sessão. Isso é esperado.
- **Logout ou troca de usuário**, nesta ordem:
  1. Abortar as requisições pendentes (`AbortController` da sessão).
  2. `queryClient.cancelQueries()`.
  3. `queryClient.clear()` e limpar o cache de *mutations*.
  4. Descartar credenciais, identidade e todo estado privado (formulários, avaliações, respostas da IA).
  5. Esvaziar a fila de escrita.
  6. Voltar para a tela de entrada.
  Respostas que chegarem de uma sessão anterior são ignoradas (identificador de sessão no cliente).
- Um 401 durante o uso encerra a sessão da mesma forma. Um 403 nunca encerra a sessão.

**Implementação** (`frontend/src/features/auth`):

- `AuthProvider` cria uma `SessaoApi` por tentativa de login e entrega as credenciais direto a
  `criarSessaoApi`, sem guardá-las.
- Toda mudança de sessão (login, troca, logout, 401 ou desmontagem) incrementa uma **geração**.
  Continuações assíncronas de gerações antigas não alteram o estado.
- `entrar()` nunca lança erro e não repete a tentativa. O resultado é:

  | Resultado | Quando |
  | --- | --- |
  | `credenciais-invalidas` | 401 no próprio login |
  | `servico-indisponivel` | Rede, tempo limite ou 5xx |
  | `resposta-invalida` | Contrato violado ou status inesperado |
  | `cancelado` | Tentativa substituída por outro login ou por logout |

- O 401 durante o uso chega por `criarSessaoApi(credenciais, { aoNaoAutenticado })`, no máximo uma
  vez por sessão. Ele só encerra a sessão (`anonimo/sessao-expirada`) quando vem da sessão
  autenticada atual. A requisição continua rejeitando com o 401 original.
- O destino após o login passa por `destinoAposLogin(de, tipoConta, podeAcessar)`, que aceita só
  caminhos internos simples, fora de `/entrar` e `/api`, e permitidos para o tipo de conta. Em
  qualquer outro caso, vai para `/`.

**Regras obrigatórias para as features:**

1. Usar `useSessaoApi()` e começar **toda** chave de query com o `chave` retornado:
   `[...chave, 'cursos']`. O prefixo identifica a sessão. No encerramento, o cache é limpo e o
   prefixo antigo é removido de novo, depois do cancelamento das queries. Assim, continuações atrasadas não
   recriam dados visíveis para a sessão atual.
2. Todo `queryFn` e `mutationFn` usa o `api` da sessão e repassa o `signal` do TanStack Query.
   Uma sessão encerrada rejeita com `cancelado` e não entrega dados.
3. Não gravar no cache (`setQueryData`) fora do prefixo da sessão, nem guardar o `api` ou dados
   privados em módulos, variáveis globais ou armazenamento do navegador.
4. Não repetir chamadas automaticamente: o `QueryClient` usa `retry: false`.
5. Depois de uma escrita bem-sucedida, usar `invalidateQueries` com o prefixo **da sessão que fez a
   chamada**, e nunca `setQueryData`. Invalidar um prefixo já removido não recria nada.
6. **Requisições com senha não usam `useMutation`**, porque o cache de mutations guardaria a senha em
   `variables`. Use um *handler* local, limpe os campos logo depois da chamada e não guarde a senha
   em estado de erro ou de sucesso. Esse é o caso de `features/contas`, e também do login.
7. Formulários bloqueiam envio duplicado (botão desabilitado e guarda no *handler*). Ao final de cada
   envio, conferem se a sessão foi encerrada (`api.encerrada` ou erro `cancelado`) antes de atualizar
   a tela.
8. Identificadores de rota passam por `lerIdPositivo` (`src/lib/identificador.ts`): só inteiros
   positivos seguros em JavaScript. Query strings de navegação (como `?colaborador=`) são validadas e
   usadas só na interface, nunca repassadas ao cliente HTTP.

**Implementação por feature** (esquemas Zod conferidos com os DTOs Java):

| Feature | Arquivo | Esquemas e hooks | Observações |
| --- | --- | --- | --- |
| Cursos | `src/features/cursos/api.ts` | `lerCurso(s)`, `esquemaFormularioCurso`, `useCursos`, `useCurso`, `useCadastrarCurso` | O cadastro é só para ADMIN. A carga horária é enviada como número inteiro JSON |
| Colaboradores | `src/features/colaboradores/api.ts` | `lerColaborador(es)`, `esquemaFormularioColaborador`, `useColaboradores`, `useColaborador`, `useCadastrarColaborador` | O e-mail é enviado aparado e em minúsculas. O 409 `EMAIL_DUPLICADO` aparece no campo |
| Contas | `src/features/contas/api.ts` | `lerContaCriada`, `problemaNaSenha`, `esquemaFormularioConta`, `criarConta` | Sem TanStack Query. A senha segue `ContasIndividuais.senhaValida` |
| Treinamentos | `src/features/treinamentos/api.ts` | `lerSolicitacao(oes)`, `useTreinamentos`, `useTreinamento`, `useSolicitarTreinamento` | `versaoModelo` e `mensagem` podem ser `null`. *Polling* de 5 s só com `PENDENTE` e aba visível. A lista é invalidada também em erro (503 já registra `FALHOU`) |
| Painel | `src/features/painel/PainelAdmin.tsx` | Reaproveita as três listas | Mostra só os totais (`length`) e a distribuição por status |
| Consentimento | `src/features/consentimento/api.ts` e `acesso.ts` | `lerConsentimento`, `useConsentimento`, `useDecidirConsentimento`, `useAcessoIa` | O PUT envia exatamente `{ autorizado }`. Nada é concedido sem clique |
| IA | `src/features/ia/api.ts` | `lerClassificacao`, `lerRecomendacoes`, `lerOrientacao`, `classificar`, `recomendar`, `orientar` | Corpos exatos de `IaEntrada`. `cursoId`, `cursosRecomendados` e `fontes` continuam texto. `proximosPassos` é opcional (1 a 3) |
| Jornada | `src/features/ia/JornadaProvider.tsx` | `useJornada` | Notas e resultados de IA só em memória, com `key` igual à geração da sessão |
| Painel do colaborador | `src/features/painel/PainelColaborador.tsx` | `useAcessoIa`, `useJornada` | Mostra a classificação da sessão enquanto o consentimento estiver confirmado |

**Regras da jornada de IA** (consentimento, RF02, RF03 e RF04):

1. **Sem disparo automático.** Toda chamada de IA parte de um clique. Não há POST ao abrir uma tela, o que também vale para a montagem dupla do StrictMode.
2. **Versões.** Cada operação tem `AbortController` e número de chamada, e a jornada tem uma versão.
   Uma resposta só é aplicada se ainda for a chamada mais recente daquela operação **e** a versão não
   tiver mudado. Alterar uma nota muda a versão e descarta classificação, recomendações e orientação.
   Uma nova classificação descarta as recomendações anteriores.
3. **Liberação da IA** (`useAcessoIa`): exige consentimento confirmado. Ao retornar à aba, a conta
   individual consulta a decisão novamente. Durante a espera ou se a leitura falhar, as telas de IA
   e a classificação no painel ficam indisponíveis. Uma negativa confirmada descarta a jornada e
   cancela a espera por respostas de IA. Cada aba consulta o servidor, sem trocar dados com outras abas.
4. **Revogar:**
   1. Descartar a jornada e abortar as operações; isso também libera a fila de escrita, ocupada por uma orientação de até 90 s.
   2. Enviar o PUT.
   3. Fazer uma única releitura após o PUT, mantendo o uso da IA bloqueado até concluir a consulta.

   A interface só diz “revogada” depois da confirmação do servidor e não afirma que o processamento
   já iniciado foi interrompido.
5. **Falha na decisão:** mensagem e nova consulta do estado. Os resultados descartados não são restaurados.
6. **`CONSENTIMENTO_IA_NECESSARIO`** em qualquer chamada: descarta a jornada, bloqueia e consulta o consentimento de novo, mesmo que o cache ainda diga “autorizado”.
7. **Orientação:**
   - Prazo de 90 s (`TEMPOS_LIMITE_MS.orientacao`).
   - “Cancelar espera” aborta só no cliente.
   - A ausência de `proximosPassos` é resposta válida.
8. **Texto puro.** Respostas, códigos e fontes são renderizados como texto. Não há `dangerouslySetInnerHTML`.

Datas: `z.iso.datetime({ offset: true })`, porque o backend grava `Instant` com microssegundos.

## 7. Erros (`application/problem+json`)

Formato (Spring `ProblemDetail`): `{ type?, title?, status, detail?, instance?, codigo }`. Erros 400/404/409 vêm dos
*exception handlers* de cada módulo; erros de segurança vêm de `ErrosSeguranca.java`. Há respostas sem corpo
(por exemplo erros de infraestrutura no proxy), então o cliente precisa tolerar corpo vazio ou de outro tipo.

| HTTP | `codigo` | Tratamento na UI |
| --- | --- | --- |
| 400 | `DADOS_INVALIDOS` | Mensagem no formulário. A validação Zod deve evitar que isso aconteça |
| 401 | `AUTENTICACAO_NECESSARIA` | No login: “Usuário ou senha inválidos”. Durante o uso: encerrar a sessão |
| 403 | `ACESSO_NEGADO` | “Seu perfil não tem acesso a esta área.” A navegação já esconde o que não é permitido |
| 403 | `CSRF_INVALIDO` | Sem retentativa automática (seção 3): “Não foi possível confirmar a operação. Tente novamente.” |
| 403 | `CONSENTIMENTO_IA_NECESSARIO` | Direcionar para a tela de consentimento |
| 404 | `*_NAO_ENCONTRADO`, `SOLICITACAO_NAO_ENCONTRADA` | Estado “não encontrado” |
| 409 | `EMAIL_DUPLICADO`, `CONTA_DUPLICADA`, `NOME_USUARIO_INDISPONIVEL` | Erro no campo correspondente |
| 502 | `IA_RESPOSTA_INVALIDA` | “O serviço de IA retornou uma resposta inesperada.” |
| 503 | `IA_INDISPONIVEL`, `FILA_INDISPONIVEL` | “Serviço temporariamente indisponível.” (no treinamento, informar que foi registrado como FALHOU) |
| 504 | `IA_TEMPO_LIMITE` | “A IA demorou mais que o esperado.” |

Mostre a mensagem traduzida pelo `codigo`, não o `detail` cru. Nunca registre corpo de
requisição, cabeçalho `Authorization` ou token CSRF em `console` ou em telemetria.

## 8. Tempos limite

Valores padrão do backend (`backend/src/main/resources/application.yml`):

| Etapa | Variável | Padrão |
| --- | --- | --- |
| Conexão Java → FastAPI | `AI_SERVICE_CONNECT_TIMEOUT` | 2 s |
| Leitura Java → FastAPI | `AI_SERVICE_READ_TIMEOUT` | 5 s |
| Geração complementar (Spring AI/Ollama), geração inteira | `OLLAMA_TIMEOUT` | 60 s |

- **Classificação e recomendações:** até cerca de 7 s no backend.
- **Orientação:** FastAPI (até cerca de 7 s), depois a geração complementar (até 60 s) e o
  *fallback* sem `proximosPassos`. O pior caso fica em torno de 67 s, mais a verificação BCrypt e
  as consultas de consentimento. Na validação real, levou cerca de 7,7 s com geração e 0,4 s em *fallback*.

Regra: **todo intermediário precisa esperar mais que o backend**, para que o *fallback* e os erros
504 `IA_TEMPO_LIMITE` do próprio backend cheguem ao usuário.

| Camada | Valor proposto |
| --- | --- |
| Cliente HTTP, `POST /api/ia/orientacoes` | 90 s (`AbortSignal.timeout`) |
| Cliente HTTP, demais rotas de IA | 20 s |
| Cliente HTTP, demais rotas | 15 s |
| Proxy do Vite | `timeout` e `proxyTimeout` ≥ 90 s, definidos explicitamente |
| Nginx no Compose | `proxy_read_timeout 110s` na API, inclusive na orientação |

Se `OLLAMA_TIMEOUT` ou os tempos do FastAPI mudarem no ambiente, revise esta tabela. Durante a
orientação, a UI mostra progresso e permite cancelar (abortar no cliente).

## 9. Proxy de desenvolvimento (Vite)

- Destino: `/api` → `http://127.0.0.1:${BACKEND_PORT:-8080}`, com a porta configurável por variável de ambiente do Vite.
- Remover `WWW-Authenticate` da resposta (seção 2) e aplicar os tempos limite da seção 8.
- Manter mesma origem: sem `changeOrigin` desnecessário e sem reescrever cookies. O cookie
  `XSRF-TOKEN` é *host-only* e funciona em `localhost` pelo proxy.

## 10. Fora de escopo (sem suporte na API)

Certificados, matrículas, progresso de cursos, notificações, trilhas persistidas, edição ou
exclusão de cadastros, listagem de contas, troca ou recuperação de senha, histórico de
consentimento, histórico de avaliações e qualquer métrica que não seja contagem direta das
listas acima.
