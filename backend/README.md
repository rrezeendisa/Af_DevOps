# Backend AF-DevOps

Este backend faz parte do AF-DevOps, uma plataforma de educação corporativa
desenvolvida como atividade acadêmica de Engenharia de Computação. O backend
oferece cadastro e consulta de colaboradores e cursos para o RF01 e integra
os serviços de classificação, recomendação e orientação dos RF02, RF03 e RF04.
Também controla o consentimento para uso da IA, complementa a orientação com
Spring AI e acompanha solicitações de treinamento do RF05.

A aplicação usa a arquitetura de monólito modular. Isso significa que os módulos
compartilham a mesma aplicação Spring Boot e o mesmo banco de dados, mas cada
domínio mantém suas próprias entidades, regras e rotas.

## Organização do backend

O código-fonte principal fica em `src/main/java/br/edu/facens/afdevops`. Os
pacotes `colaborador`, `curso`, `identidade`, `consentimento`, `ia` e `treinamento`
agrupam as classes de cada domínio. O pacote `seguranca` define a
autenticação por sessão, as permissões e a proteção CSRF. Dentro de
cada módulo, os controllers recebem as requisições HTTP, os services aplicam as
regras, os repositories acessam o banco, as entidades representam os dados
persistidos e os DTOs definem os dados recebidos e enviados pela API.

As configurações da aplicação ficam em `src/main/resources/application.yml`.
As migrações do banco ficam em `src/main/resources/db/migration`. Os testes
estão em `src/test/java`, separados entre testes unitários e testes de
integração.

## Tecnologias

- Java 17 como versão de compilação, executado localmente com JDK 21.
- Spring Boot 4.1.3.
- Spring AI 2.0.3 para a geração complementar de próximos passos.
- Ollama com o modelo Qwen 2.5 1.5B para geração de texto local.
- Maven Wrapper 3.10.2.
- PostgreSQL 17 para desenvolvimento.
- RabbitMQ para mensageria das solicitações de treinamento.
- Docker Compose para executar o ambiente integrado.
- Flyway para aplicar as migrações do banco.
- Testcontainers para iniciar um banco de dados temporário nos testes de integração.

As dependências gerenciadas pelo Spring Boot incluem Spring Web MVC, Actuator,
Spring Data JPA, Bean Validation e Spring Security. O projeto não utiliza Lombok.

## Configuração do ambiente

Instale o JDK 21 e o Docker Desktop. Na primeira execução, será necessário
acesso à internet para baixar o Maven, as dependências e a imagem PostgreSQL
usada pelos testes. Para executar a aplicação localmente, também é preciso ter
o PostgreSQL 17 disponível. Os exemplos de segurança usam `htpasswd` e `jq`.
O exemplo de conta individual também pode usar Node.js no lugar de `jq`.

A conexão local usa as variáveis abaixo. Os valores indicados são padrões para
desenvolvimento. A senha deve ser fornecida pelo ambiente.

| Variável | Padrão local |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `afdevops` |
| `DB_USERNAME` | `afdevops` |
| `DB_PASSWORD` | Obrigatória, sem padrão |
| `SERVER_ADDRESS` | `127.0.0.1` |
| `RABBITMQ_URL` | `amqp://localhost:5672` |
| `RABBITMQ_HEALTH_ENABLED` | `false` |
| `INTERNAL_API_TOKEN` | Sem padrão; sem ele a rota interna responde 503 |

### Contas de demonstração

Configure duas contas fictícias com nomes distintos, usando até 64 letras
ASCII, números, pontos, hífens ou sublinhados. A comparação dos nomes não
diferencia maiúsculas de minúsculas.

| Variável | Valor esperado |
| --- | --- |
| `AFDEVOPS_ADMIN_USERNAME` | Nome da conta com perfil `ADMIN` |
| `AFDEVOPS_ADMIN_PASSWORD_HASH` | Hash BCrypt da senha dessa conta |
| `AFDEVOPS_COLABORADOR_USERNAME` | Nome da conta com perfil `COLABORADOR` |
| `AFDEVOPS_COLABORADOR_PASSWORD_HASH` | Hash BCrypt da senha dessa conta |

As quatro variáveis são obrigatórias. A aplicação interrompe a inicialização
se a configuração estiver ausente ou inválida. As senhas usadas no cliente
devem ser diferentes para as duas contas. Guarde os hashes apenas no
ambiente de execução e preserve os caracteres `$` do BCrypt.
Evite registrar credenciais, cookies, tokens ou dados pessoais nos logs do
cliente, do servidor ou do proxy.

Com `htpasswd` disponível, o exemplo abaixo lê os nomes, pede as senhas sem
exibi-las e guarda os hashes em variáveis de ambiente, sem imprimi-los. Execute
no mesmo terminal Bash que será usado para iniciar o backend. Continue somente
se a configuração terminar sem erros.

```sh
configurar_contas() {
  local admin colaborador resultado hash_admin hash_colaborador
  local formato='^\$2[aby]\$12\$[./A-Za-z0-9]{53}$'
  unset AFDEVOPS_ADMIN_USERNAME AFDEVOPS_ADMIN_PASSWORD_HASH
  unset AFDEVOPS_COLABORADOR_USERNAME AFDEVOPS_COLABORADOR_PASSWORD_HASH
  read -r -p 'Usuário ADMIN: ' admin || return 1
  read -r -p 'Usuário COLABORADOR: ' colaborador || return 1
  if ! [[ "$admin" =~ ^[A-Za-z0-9_.-]{1,64}$ ]] ||
     ! [[ "$colaborador" =~ ^[A-Za-z0-9_.-]{1,64}$ ]] ||
     [[ "$(printf '%s' "$admin" | tr '[:upper:]' '[:lower:]')" == "$(printf '%s' "$colaborador" | tr '[:upper:]' '[:lower:]')" ]]; then
    printf '%s\n' 'Nomes de usuário inválidos ou iguais.' >&2
    return 1
  fi
  resultado="$(htpasswd -nBC 12 "$admin")" || {
    printf '%s\n' 'Não foi possível gerar o hash ADMIN.' >&2
    return 1
  }
  hash_admin="${resultado#*:}"
  resultado="$(htpasswd -nBC 12 "$colaborador")" || {
    printf '%s\n' 'Não foi possível gerar o hash COLABORADOR.' >&2
    return 1
  }
  hash_colaborador="${resultado#*:}"
  if ! [[ "$hash_admin" =~ $formato && "$hash_colaborador" =~ $formato ]]; then
    printf '%s\n' 'Os hashes gerados são inválidos.' >&2
    return 1
  fi
  export AFDEVOPS_ADMIN_USERNAME="$admin" AFDEVOPS_ADMIN_PASSWORD_HASH="$hash_admin"
  export AFDEVOPS_COLABORADOR_USERNAME="$colaborador" AFDEVOPS_COLABORADOR_PASSWORD_HASH="$hash_colaborador"
}
configurar_contas || printf '%s\n' 'Configuração não concluída. Execute novamente antes de continuar.' >&2
```

A aplicação aceita custos BCrypt de 10 a 14. Essa faixa evita custos muito
baixos e limita o trabalho necessário para verificar cada senha. O custo 12 é
a recomendação inicial para a demonstração. A verificação BCrypt ocorre somente
no login; as requisições seguintes usam a sessão. Antes de ajustar o custo,
avalie as implicações de segurança e meça novamente.

### Senha do PostgreSQL e inicialização

No Bash ou Zsh, o exemplo a seguir lê a senha sem exibi-la e a disponibiliza
para o processo que inicia a aplicação:

```sh
(
  printf 'Senha do PostgreSQL: '
  read -rs DB_PASSWORD
  printf '\n'
  export DB_PASSWORD
  ./mvnw spring-boot:run
)
```

Se a conexão usar outros valores, defina as variáveis correspondentes no
ambiente. Não coloque senhas em arquivos versionados ou na linha de comando.

## Compilar, testar e executar

Execute os comandos a partir do diretório `backend/`. O Maven Wrapper usa a
versão do Maven definida pelo projeto, sem exigir uma instalação global.

Para compilar, executar os testes e gerar o arquivo JAR em `target/`:

```sh
./mvnw clean package
```

Para executar somente os testes:

```sh
./mvnw test
```

Os testes de integração usam Testcontainers para iniciar um banco de dados
temporário PostgreSQL 17, com porta dinâmica e credenciais próprias. Eles não
usam as variáveis nem o banco de desenvolvimento. O Docker Desktop precisa
estar ativo e acessível. Sem acesso ao Docker, os testes de integração falham
durante a inicialização. Para compilar a aplicação e os testes sem executá-los:

```sh
./mvnw test-compile
```

No Windows, use `mvnw.cmd` no lugar de `./mvnw`.

Para iniciar a aplicação:

```sh
./mvnw spring-boot:run
```

Por padrão, o backend escuta em `127.0.0.1:8080`. A verificação de saúde fica disponível em
`GET /actuator/health`:

```sh
curl http://127.0.0.1:8080/actuator/health
```

Quando a aplicação está saudável, a resposta é HTTP 200 e contém o estado
`UP`. Outros caminhos e métodos do Actuator retornam HTTP 404.

No ambiente integrado com Docker Compose, já validado, o backend usa
`SERVER_ADDRESS=0.0.0.0` dentro do container Java para permitir o acesso pela
rede do Compose. Antes de publicar a porta fora da máquina local,
configure HTTPS e controle o acesso à rede. Mantenha as variáveis com hashes
fora dos arquivos versionados.

## Banco de dados e migrações

O Flyway aplica os scripts versionados em
`src/main/resources/db/migration`. A migração V1 cria a tabela de
colaboradores e um índice que mantém os e-mails únicos, sem diferenciar letras
maiúsculas de minúsculas. A migração V2 cria a tabela de cursos e as restrições
para carga horária e nível. A V3 cria as solicitações de treinamento. A V4
cria as contas individuais e a tabela de decisões de consentimento para IA.
Migrações já aplicadas não devem ser editadas.

O Hibernate verifica se o esquema do banco corresponde às entidades, usando
`ddl-auto: validate`. A opção open-in-view: false evita manter o contexto de persistência aberto durante toda a requisição HTTP. O driver PostgreSQL omite detalhes de erro do
servidor nas mensagens. As validações rejeitam o caractere NUL nos campos
textuais dos cadastros.

## Autenticação e permissões

A API pública usa sessão no servidor, em memória, gerenciada pelo Spring
Security. HTTP Basic não é aceito. O fluxo é:

1. `GET /api/csrf` (público) entrega o token e o cookie `XSRF-TOKEN`.
2. `POST /api/login`, com `username` e `password` em formulário e o cabeçalho
   `X-XSRF-TOKEN`, responde 204 e cria o cookie `EVOLIA_SESSAO`.
3. `GET /api/me` devolve a identidade e o cabeçalho `X-Evolia-Contexto`.
4. As chamadas seguintes enviam o cookie e `X-Evolia-Contexto`. Escritas também
   enviam um token CSRF obtido na hora.
5. `POST /api/logout` invalida a sessão e responde 204.

O cookie é `HttpOnly` e `SameSite=Strict`. Com `SESSION_COOKIE_SECURE=true`
também é `Secure`, o que é obrigatório fora do loopback, com HTTPS. A sessão
expira após 30 minutos de inatividade (`SESSION_TIMEOUT`) e não sobrevive ao
reinício do backend. O contexto muda a cada login e impede que um cliente antigo
use a sessão de outro usuário. A decisão está no
[ADR 002](../docs/arquitetura-af.md#adr-002--sessões-no-servidor-no-lugar-de-http-basic).

| Rota | Acesso |
| --- | --- |
| `GET /actuator/health` | Público |
| `GET /api/colaboradores`, `GET /api/colaboradores/{id}`, `POST /api/colaboradores` | `ADMIN` |
| `POST /api/cursos` e `POST /api/colaboradores/{id}/conta` | `ADMIN` |
| `GET /api/csrf` e `POST /api/login` | Público (o login exige o token CSRF) |
| `POST /api/logout` | Sessão atual, com CSRF e contexto |
| `GET /api/cursos`, `GET /api/cursos/{id}` e `GET /api/me` | `ADMIN` e `COLABORADOR` |
| `GET /api/me/consentimento` e `PUT /api/me/consentimento` | `COLABORADOR` com conta individual |
| `POST /api/ia/classificacoes`, `POST /api/ia/recomendacoes` e `POST /api/ia/orientacoes` | `COLABORADOR` com conta individual e consentimento concedido |
| `POST /api/treinamentos`, `GET /api/treinamentos`, `GET /api/treinamentos/{id}` | `ADMIN` |
| `PATCH /internal/treinamentos/{id}/status` | Serviço interno, com `Authorization: Bearer <INTERNAL_API_TOKEN>` |

Os demais caminhos e métodos são negados. A rota interna usa apenas o Bearer do
worker: uma sessão de usuário não dá acesso a ela, e o token interno não dá
acesso à API pública.

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| 400 Bad Request | `DADOS_INVALIDOS` | Login com parâmetros na URL |
| 401 Unauthorized | `AUTENTICACAO_NECESSARIA` | Sessão ausente ou expirada, ou credenciais inválidas no login |
| 401 Unauthorized | `SESSAO_SUBSTITUIDA` | Contexto ausente ou diferente do da sessão |
| 403 Forbidden | `ACESSO_NEGADO` | Perfil sem permissão |
| 403 Forbidden | `CSRF_INVALIDO` | Token CSRF ausente ou inválido, ou cookie incompatível |

As respostas acima usam `application/problem+json` e incluem o campo `codigo`.
A proteção CSRF é verificada antes da autenticação. No gateway, o excesso de
tentativas de login recebe HTTP 429.

### Sessão e CSRF nos exemplos

Os exemplos usam Bash e `curl`; o cadastro de conta usa também `jq`. Defina as
funções abaixo uma vez no mesmo terminal. A senha é lida sem aparecer na tela, no histórico ou nos argumentos
dos processos, e os cookies ficam em um arquivo temporário removido no logout.
`EVOLIA` aponta para o Java local; pelo gateway do Compose, use
`http://127.0.0.1:8088`.

```sh
EVOLIA="${EVOLIA:-http://127.0.0.1:8080}"

token_csrf() {
  local token
  token="$(curl -fsS -b "$sessao_cookies" -c "$sessao_cookies" "$EVOLIA/api/csrf" |
    sed -n 's/.*"token" *: *"\([A-Za-z0-9_-]*\)".*/\1/p')"
  [ -n "$token" ] && printf '%s' "$token"
}

entrar() {
  local usuario senha token status
  read -r -p 'Usuário: ' usuario || return 1
  read -rs -p 'Senha: ' senha || return 1
  printf '\n'
  sessao_cookies="$(mktemp)" || return 1
  sessao_contexto=
  token="$(token_csrf)" || return 1
  status="$(printf '%s' "$senha" | curl -sS -o /dev/null -w '%{http_code}' \
    -b "$sessao_cookies" -c "$sessao_cookies" -H "X-XSRF-TOKEN: $token" \
    --data-urlencode "username=$usuario" --data-urlencode password@- \
    "$EVOLIA/api/login")"
  if [ "$status" != 204 ]; then
    printf 'Login recusado (HTTP %s).\n' "$status" >&2
    rm -f "$sessao_cookies"
    return 1
  fi
  sessao_contexto="$(curl -fsS -D - -o /dev/null -b "$sessao_cookies" -c "$sessao_cookies" \
    "$EVOLIA/api/me" | tr -d '\r' | awk 'tolower($1) == "x-evolia-contexto:" { print $2 }')"
  [ -n "$sessao_contexto" ]
}

# Uso: api MÉTODO /caminho [corpo JSON, ou @- para ler da entrada padrão]
api() {
  local metodo="$1" rota="$2" token
  local opcoes=(-sS -i -X "$metodo" -b "$sessao_cookies" -c "$sessao_cookies"
    -H "X-Evolia-Contexto: $sessao_contexto")
  if [ "$metodo" != GET ]; then
    token="$(token_csrf)" || return 1
    opcoes+=(-H "X-XSRF-TOKEN: $token")
  fi
  if [ "$#" -ge 3 ]; then
    opcoes+=(-H 'Content-Type: application/json' --data-binary "$3")
  fi
  curl "${opcoes[@]}" "$EVOLIA$rota"
  printf '\n'
}

sair() {
  api POST /api/logout && rm -f "$sessao_cookies"
  sessao_contexto=
}
```

Para os exemplos administrativos, execute `entrar` com a conta ADMIN. Ao trocar
de conta, execute `sair` antes de `entrar`.

## Colaboradores

Os exemplos usam dados fictícios. O módulo permite cadastrar e consultar
colaboradores. A resposta do cadastro inclui o identificador, os dados do
colaborador e `criadoEm` em formato ISO 8601. O e-mail é normalizado: espaços
nas extremidades são removidos e as letras são convertidas para minúsculas. O
valor deve ser único.

| Método e rota | Resposta |
| --- | --- |
| `POST /api/colaboradores` | HTTP 201 Created, com o colaborador e o cabeçalho `Location` para consulta por ID |
| `GET /api/colaboradores` | HTTP 200 OK, com a lista ou `[]` quando não há registros |
| `GET /api/colaboradores/{id}` | HTTP 200 OK para um ID existente ou HTTP 404 Not Found |

Exemplo de cadastro e consultas:

```sh
api POST /api/colaboradores \
  '{"nome":"Pessoa Fictícia","email":"pessoa@example.com","cargo":"Analista","departamento":"Educação"}'

api GET /api/colaboradores
api GET /api/colaboradores/1
```

Troque `1` pelo ID retornado no cadastro. Os erros usam
`application/problem+json` e incluem o campo `codigo`.

| HTTP | Código |
| --- | --- |
| 400 Bad Request | `DADOS_INVALIDOS` |
| 409 Conflict | `EMAIL_DUPLICADO` |
| 404 Not Found | `COLABORADOR_NAO_ENCONTRADO` |

## Conta individual e identidade

O administrador pode criar uma conta para um colaborador já cadastrado.
Informe `nomeUsuario` e `senhaInicial` no corpo JSON. O nome aceita de 1 a 64
letras ASCII, números, pontos, hífens ou sublinhados. O backend salva o nome
em minúsculas e reserva os nomes das contas de demonstração. A senha deve
ter pelo menos 12 caracteres, ocupar até 72 bytes em UTF-8 e conter ao menos
um caractere que não seja espaço em branco. O backend guarda somente o hash
BCrypt com custo 12.

Com a sessão do ADMIN, substitua `1` pelo ID do colaborador. O `jq` monta o
JSON a partir de valores lidos sem expor a senha. Sem `jq`, crie a conta pela
interface, em “Contas”.

```sh
read -r -p 'Nome do usuário: ' usuario
read -rs -p 'Senha inicial: ' senha
printf '\n'
printf '%s\n' "$usuario" "$senha" |
  jq -Rn '{nomeUsuario: input, senhaInicial: input}' |
  api POST /api/colaboradores/1/conta @-
unset senha
```

O cadastro retorna HTTP 201 com o ID da conta, o nome de usuário, o perfil
`COLABORADOR`, o ID do colaborador e a data de criação.

| HTTP | Código |
| --- | --- |
| 400 Bad Request | `DADOS_INVALIDOS` |
| 404 Not Found | `COLABORADOR_NAO_ENCONTRADO` |
| 409 Conflict | `CONTA_DUPLICADA` ou `NOME_USUARIO_INDISPONIVEL` |

O endpoint `GET /api/me` mostra o nome e o perfil da conta autenticada. Para
uma conta individual, também mostra `colaboradorId`. A resposta não tem
senha, hash ou token interno e não é armazenada em cache.

Saia da conta administrativa e entre com a conta individual:

```sh
sair
entrar
api GET /api/me
```

## Consentimento para IA

A conta individual pode consultar, conceder ou revogar o próprio
consentimento. O backend identifica o colaborador pela autenticação. O corpo
do `PUT` aceita apenas `autorizado` com valor `true` ou `false`. Campos extras,
repetidos ou com outros tipos retornam HTTP 400. Contas de demonstração
recebem HTTP 403.

```sh
api GET /api/me/consentimento
api PUT /api/me/consentimento '{"autorizado":true}'
```

Para revogar, use `{"autorizado":false}`. Até a primeira decisão, o retorno é
`{"autorizado":false,"decididoEm":null}`. Cada decisão grava o valor atual e a
data e hora. As respostas não são armazenadas em cache.

O registro representa a decisão atual. Ele não constitui um histórico completo
de auditoria nem garante conformidade legal. O backend verifica a decisão
antes de cada chamada à IA. A revogação bloqueia novas chamadas, mas não
interrompe aquelas que já começaram.

## Integração com o serviço de IA

As três rotas aceitam JSON e exigem sessão de conta individual, contexto e token CSRF. As notas
`logica`, `comunicacao` e `tecnologia` devem ser inteiros de 1 a 5. O backend
rejeita campos extras, campos repetidos e parâmetros na URL. Ele obtém o ID
do colaborador pela autenticação e só o envia ao Python na orientação.

| Rota Java | Corpo JSON | Resposta `200` |
| --- | --- | --- |
| `POST /api/ia/classificacoes` | As três notas | `nivel` e `versaoModelo` |
| `POST /api/ia/recomendacoes` | As três notas e `nivel` | `recomendacoes` com `cursoId`, `nome` e `justificativa`, além de `fontes` |
| `POST /api/ia/orientacoes` | `pergunta` de 1 a 1.000 caracteres e as três notas dentro de `competencias` | `orientacao`, `cursosRecomendados`, `fontes` e, quando disponível, `proximosPassos` |

O nível de competência é `INICIANTE`, `INTERMEDIARIO` ou `AVANCADO`. Códigos como
`CURSO-001` identificam documentos no Python e não correspondem aos IDs
numéricos do catálogo Java.

Depois de conceder o consentimento, use a sessão da mesma conta:

```sh
api POST /api/ia/classificacoes '{"logica":1,"comunicacao":3,"tecnologia":5}'
api POST /api/ia/recomendacoes '{"logica":1,"comunicacao":3,"tecnologia":5,"nivel":"INICIANTE"}'
api POST /api/ia/orientacoes '{"pergunta":"Por onde começo?","competencias":{"logica":1,"comunicacao":3,"tecnologia":5}}'
```

| Variável | Uso |
| --- | --- |
| `AI_SERVICE_URL` | Endereço do FastAPI. O padrão local é `http://127.0.0.1:8000`. No Compose, o Java usa `http://ai-service:8000`. |
| `AI_SERVICE_CONNECT_TIMEOUT` | Prazo de conexão. O padrão é `PT2S`, ou 2 segundos. |
| `AI_SERVICE_READ_TIMEOUT` | Prazo de leitura. O padrão é `PT5S`, ou 5 segundos. |
| `INTERNAL_API_TOKEN` | Bearer compartilhado usado na chamada Java → Python apenas para orientação. O contrato do worker permanece separado. |

O Java usa `RestClient`, valida o JSON de resposta do FastAPI e não repete
chamadas automaticamente. As respostas não são armazenadas em cache.
O Java não repassa a autenticação do usuário nem o corpo de erros do Python.

| HTTP | Código |
| --- | --- |
| 400 | `DADOS_INVALIDOS` |
| 403 | `CONSENTIMENTO_IA_NECESSARIO` quando a decisão é negativa ou inexistente |
| 502 | `IA_RESPOSTA_INVALIDA` quando o Python rejeita a solicitação ou responde fora do contrato |
| 503 | `IA_INDISPONIVEL` em falhas de conexão, indisponibilidade do serviço ou falta do token para orientação |
| 504 | `IA_TEMPO_LIMITE` quando a conexão ou a leitura excede o tempo limite |

### Próximos passos com Spring AI

A orientação base continua vindo do FastAPI. Quando a geração complementar
está habilitada, o Java identifica o nível no texto e consulta o consentimento
novamente antes de chamar o Ollama pelo `ChatClient`. O modelo recebe apenas
uma frase montada pelo Java com um dos três níveis conhecidos. A pergunta,
as notas, os identificadores, os cursos e as fontes ficam fora dessa chamada.

A geração depende do formato textual atual do Python. Ele começa por
“A classificação estimada pelo modelo é”, seguido pelo nível, e termina
com a lista de recomendações ou com a informação de que não há cursos
compatíveis. Se o formato mudar, o Java ainda retorna a orientação original
com os cursos e as fontes. O mesmo vale para consentimento revogado, Ollama
indisponível, tempo limite atingido ou resposta inválida. Nesses casos o
campo `proximosPassos` é omitido.

Quando presente, `proximosPassos` tem de uma a três sugestões curtas em texto.
O backend não executa o conteúdo gerado. O tempo limite vale para a geração
inteira, incluindo a leitura dos fragmentos. A integração não baixa modelos
automaticamente e não precisa do Ollama para iniciar.

| Variável | Padrão |
| --- | --- |
| `IA_GENERATIVA_HABILITADA` | `false` com Java local e `true` no Compose |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` com Java local e `http://ollama:11434` no Compose |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` |
| `OLLAMA_TEMPERATURE` | `0.2` |
| `OLLAMA_NUM_PREDICT` | `128` tokens de saída |
| `OLLAMA_NUM_CTX` | `1024` tokens de contexto |
| `OLLAMA_TIMEOUT` | `PT60S`, ou 60 segundos |

Para validar localmente com o Ollama instalado no macOS, inicie o serviço
em outro terminal com `ollama serve` caso ele ainda não esteja em execução.
Confira se o modelo já está disponível.

```sh
ollama list
curl --fail --silent --show-error http://127.0.0.1:11434/api/tags
```

Para iniciar o backend em Java diretamente no macOS, use a configuração
local de banco, contas e FastAPI descrita neste README.

```sh
cd backend
IA_GENERATIVA_HABILITADA=true OLLAMA_BASE_URL=http://127.0.0.1:11434 \
  OLLAMA_MODEL=qwen2.5:1.5b ./mvnw spring-boot:run
```

Para validar com o backend no Docker e o Ollama nativo no macOS, execute
na raiz do repositório.

```sh
docker compose -f docker-compose.yml -f compose.ollama-nativo.yml up --build
```

Com uma conta individual que autorizou o uso da IA, chame a rota de orientação
e confira `proximosPassos` junto aos campos originais. Com o Ollama
indisponível, repita a chamada e confira o retorno da orientação base sem o
campo complementar. No Compose padrão, o inicializador do Ollama prepara o
modelo em um volume persistente. A preparação do modelo fica fora do Java.

## Cursos

Os campos dos cursos foram definidos para atender às necessidades iniciais do projeto. O cadastro recebe
`nome`, `descricao`, `cargaHoraria` em horas inteiras positivas, `categoria`
e `nivel`. Os níveis aceitos são `BASICO`, `INTERMEDIARIO` e `AVANCADO`.
A resposta inclui o identificador e `criadoEm` em formato ISO 8601.

| Método e rota | Resposta |
| --- | --- |
| `POST /api/cursos` | HTTP 201 Created, com o curso e o cabeçalho `Location` |
| `GET /api/cursos` | HTTP 200 OK, com a lista ou `[]` quando não há registros |
| `GET /api/cursos/{id}` | HTTP 200 OK para um ID existente ou HTTP 404 Not Found |

Exemplo de cadastro e consultas:

O cadastro exige a sessão do ADMIN; a consulta vale para os dois perfis.

```sh
api POST /api/cursos \
  '{"nome":"Curso fictício","descricao":"Introdução fictícia","cargaHoraria":8,"categoria":"Educação","nivel":"BASICO"}'

api GET /api/cursos
api GET /api/cursos/1
```

Troque `1` pelo ID retornado no cadastro. Os erros usam
`application/problem+json`, com `DADOS_INVALIDOS` para HTTP 400 e
`CURSO_NAO_ENCONTRADO` para HTTP 404.

## Solicitações de treinamento

O módulo `treinamento` registra pedidos de retreinamento do modelo de IA e
acompanha o resultado informado pelo worker do ai-service. A mensageria e o
ambiente integrado estão descritos em [infra/README.md](../infra/README.md).

| Método e rota | Resposta |
| --- | --- |
| `POST /api/treinamentos` | HTTP 202 Accepted com a solicitação `PENDENTE` e `Location`; HTTP 503 `FILA_INDISPONIVEL` se o RabbitMQ não confirmar a mensagem (a solicitação fica `FALHOU`) |
| `GET /api/treinamentos` | HTTP 200 OK, com a lista ordenada por ID |
| `GET /api/treinamentos/{id}` | HTTP 200 OK ou HTTP 404 `SOLICITACAO_NAO_ENCONTRADA` |
| `PATCH /internal/treinamentos/{id}/status` | HTTP 204; 400 `DADOS_INVALIDOS`, 401 `AUTENTICACAO_INTERNA_NECESSARIA`, 404, 409 `STATUS_CONFLITANTE` |

Ao criar a solicitação, o backend publica `{"solicitacao_id":"<id>"}` na
exchange `ml.training` com a routing key `training.requested`. O worker
treina o modelo e chama a rota interna com
`{"status":"CONCLUIDO","versaoModelo":"1.0.0","mensagem":"..."}` ou
`{"status":"FALHOU","mensagem":"..."}`. Repetir o mesmo status final é
aceito sem alterações; trocar um status final responde 409.

O `POST` não tem corpo. Com a sessão do ADMIN:

```sh
api POST /api/treinamentos
api GET /api/treinamentos/1
```

A rota `/internal/**` tem cadeia de segurança própria, sem sessão, cookies nem
CSRF: exige `Authorization: Bearer <INTERNAL_API_TOKEN>` e compara o token em
tempo constante. Os testes de integração do
módulo usam RabbitMQ real via Testcontainers.

## Última validação

Na Etapa 14.1 (27–28/11/2026), com a autenticação por sessão, passaram 274
testes Java, 507 testes React, 38 testes integrados pelo gateway e 25 cenários
no navegador. A carga com 300 usuários atingiu a meta do RNF01 nas condições
testadas. Detalhes na [matriz de evidências](../docs/evidencias-af.md). Os
parágrafos abaixo registram validações anteriores.

Em 27/11/2026, 255 testes automatizados foram aprovados antes do ajuste final
do prompt. Após o ajuste para educação corporativa, 24 testes específicos
foram aprovados. Os relatórios do Maven Surefire também registram uma execução
completa posterior ao ajuste, com 255 testes aprovados, sem falhas, erros ou
testes ignorados. A integração REST com o FastAPI real foi validada nas três
rotas de IA.

Na validação real da orientação, o Spring AI usou o `ChatClient`, o Ollama
e o modelo `qwen2.5:1.5b`. A resposta preservou a orientação original,
os cursos e as fontes e acrescentou três próximos passos. A requisição levou
7,747145 segundos, dos quais 7.304 ms foram registrados para a geração.

Também foram validados o fallback para saída inválida e o fallback com o Ollama
indisponível. Neste último caso, a resposta foi HTTP 200 sem `proximosPassos`.
A requisição levou 0,383098 segundo, e a operação generativa registrou 15 ms.

Após a revogação do consentimento, as três rotas retornaram HTTP 403 com o
código `CONSENTIMENTO_IA_NECESSARIO`. Nenhuma nova entrada de geração foi
registrada depois dessas solicitações bloqueadas.

Em 27/11/2026, 186 testes automatizados foram aprovados, sem falhas, erros ou
testes ignorados. O ambiente integrado iniciou com Docker Compose. Também foram
validados manualmente o cadastro de colaboradores, a criação e autenticação de
contas individuais, a identificação por `GET /api/me`, o consentimento negado
por padrão, sua concessão e revogação e a persistência da decisão e do horário
no PostgreSQL. Contas administrativas não conseguiram acessar o consentimento.

## Limitações atuais

As contas em memória servem para demonstração e não têm vínculo com o
cadastro de colaboradores. Para trocar as contas de demonstração, atualize o
ambiente e reinicie o backend. Contas individuais ainda não têm recuperação
ou troca de senha pela API. Use dados fictícios em ambiente controlado. Fora da
máquina local, use HTTPS e `SESSION_COOKIE_SECURE=true`, pois a senha trafega no
login e o cookie identifica a sessão. As sessões ficam em memória, em uma única
instância, sem expiração absoluta, limite por usuário ou bloqueio por conta. O
limite de tentativas de login existe somente no gateway.

As listagens não têm paginação. A carga de classificação foi testada e o RNF01
[foi atendido nas condições ensaiadas](../docs/evidencias-af.md#rnf01--carga-de-classificação);
o desempenho das listagens sob carga não foi medido.
A verificação de consentimento se aplica às chamadas feitas pelo backend Java.
No Compose padrão, o FastAPI só fica acessível ao Java pela rede interna.
O modo de diagnóstico publica uma porta em loopback. Chamadas diretas a
classificação e recomendações por essa porta ficam fora da autenticação e
da verificação de consentimento do Java.

A orientação base usa o texto determinístico do Python. As sugestões do
modelo local complementam esse texto e podem variar entre chamadas.
