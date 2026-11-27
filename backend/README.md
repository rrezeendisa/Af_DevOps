# Backend AF-DevOps

Este backend faz parte do AF-DevOps, uma plataforma de educação corporativa
desenvolvida como atividade acadêmica de Engenharia de Computação. Seu objetivo
é oferecer os serviços REST de cadastro e consulta de colaboradores e cursos,
atendendo ao escopo atual do RF01.

A aplicação usa a arquitetura de monólito modular. Isso significa que os módulos
compartilham a mesma aplicação Spring Boot e o mesmo banco de dados, mas cada
domínio mantém suas próprias entidades, regras e rotas.

## Organização do backend

O código-fonte principal fica em `src/main/java/br/edu/facens/afdevops`. Os
pacotes `colaborador`, `curso`, `identidade`, `consentimento` e `treinamento`
agrupam as classes de cada domínio. O pacote `seguranca` define a
autenticação, as permissões e a proteção CSRF. Dentro de
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
- Maven Wrapper 3.10.2.
- PostgreSQL 17 para desenvolvimento.
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
a recomendação inicial para a demonstração. A verificação BCrypt
ocorre a cada requisição autenticada e pode aumentar o tempo de resposta e o
uso de CPU. Antes de definir uma carga suportada ou ajustar o custo, meça o
desempenho em um ambiente representativo.

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

Em uma futura configuração com Docker Compose, a equipe de infraestrutura
deverá definir `SERVER_ADDRESS=0.0.0.0` dentro do container Java para permitir
acesso pela rede do Compose. Antes de publicar a porta fora da máquina local,
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

A API usa HTTP Basic. Envie as credenciais em cada chamada protegida. O
backend não mantém sessão de autenticação.

| Rota | Acesso |
| --- | --- |
| `GET /actuator/health` | Público |
| `GET /api/colaboradores`, `GET /api/colaboradores/{id}`, `POST /api/colaboradores` | `ADMIN` |
| `POST /api/cursos` e `POST /api/colaboradores/{id}/conta` | `ADMIN` |
| `GET /api/cursos`, `GET /api/cursos/{id}`, `GET /api/csrf` e `GET /api/me` | `ADMIN` e `COLABORADOR` |
| `GET /api/me/consentimento` e `PUT /api/me/consentimento` | `COLABORADOR` com conta individual |
| `POST /api/treinamentos`, `GET /api/treinamentos`, `GET /api/treinamentos/{id}` | `ADMIN` |
| `PATCH /internal/treinamentos/{id}/status` | Serviço interno, com `Authorization: Bearer <INTERNAL_API_TOKEN>` |

Os demais caminhos e métodos são negados. Nos exemplos, `curl --user` recebe
apenas o nome de usuário e pede a senha de forma interativa. Use os nomes
configurados para suas contas.

| HTTP | Código | Quando ocorre |
| --- | --- | --- |
| 401 Unauthorized | `AUTENTICACAO_NECESSARIA` | Credenciais ausentes ou inválidas |
| 403 Forbidden | `ACESSO_NEGADO` | Perfil sem permissão |
| 403 Forbidden | `CSRF_INVALIDO` | Token CSRF ausente ou inválido, ou cookie incompatível |

As respostas acima usam `application/problem+json` e incluem o campo
`codigo`. A resposta 401 também inclui `WWW-Authenticate: Basic realm="AF-DevOps"`.
Nas operações de escrita, a proteção CSRF é verificada antes da autenticação. Se faltar o
token ou o cookie correspondente, a resposta será 403 mesmo sem credenciais.

### Token CSRF para operações de escrita

Antes de enviar um `POST` ou `PUT`, obtenha o token com uma chamada autenticada
a `GET /api/csrf`. O acesso agora é permitido para `ADMIN` e `COLABORADOR`.
A resposta fornece um cookie `XSRF-TOKEN` e um
JSON com `headerName` e `token`. Envie o cookie e o valor de `token` no
cabeçalho `X-XSRF-TOKEN`, além das credenciais HTTP Basic. Use o valor do
JSON no cabeçalho, pois ele vem mascarado pelo Spring Security.

O exemplo abaixo usa `jq` para ler o token. Como alternativa, o Node.js pode
validar e extrair o mesmo campo. Ambas as opções verificam o formato antes de
continuar. Execute os próximos cadastros no mesmo terminal Bash e preserve o
arquivo temporário até concluir os exemplos.

```sh
obter_csrf() {
  local usuario="${1:-$AFDEVOPS_ADMIN_USERNAME}" arquivo resposta token
  if [[ -n "${csrf_cookie:-}" ]]; then
    rm -f "$csrf_cookie"
  fi
  unset csrf_cookie csrf_token
  arquivo="$(mktemp)" || { printf '%s\n' 'Não foi possível criar o arquivo temporário.' >&2; return 1; }
  resposta="$(curl --fail --silent --show-error --user "$usuario" \
    --cookie-jar "$arquivo" http://127.0.0.1:8080/api/csrf)" || {
      rm -f "$arquivo"
      printf '%s\n' 'Não foi possível obter o token CSRF.' >&2
      return 1
    }
  token="$(printf '%s' "$resposta" | jq -er \
    'select(.headerName == "X-XSRF-TOKEN") | .token | select(type == "string" and test("^[A-Za-z0-9_-]+$"))')" || {
      rm -f "$arquivo"
      printf '%s\n' 'A resposta CSRF é inválida.' >&2
      return 1
    }
  if ! awk 'NF >= 7 && $6 == "XSRF-TOKEN" && $7 != "" { encontrado=1 } END { exit !encontrado }' "$arquivo"; then
    rm -f "$arquivo"
    printf '%s\n' 'O cookie CSRF está ausente.' >&2
    return 1
  fi
  csrf_cookie="$arquivo"
  csrf_token="$token"
  trap 'rm -f "$csrf_cookie"' EXIT
}
obter_csrf || printf '%s\n' 'Obtenção do token não concluída. Execute novamente antes de continuar.' >&2
```

Para usar Node.js no lugar de `jq`, substitua a atribuição de `token` dentro
da função `obter_csrf` pelo comando abaixo. Ele verifica o nome do cabeçalho
e aceita somente um token não vazio no formato Base64 URL seguro. Se o JSON
estiver inválido ou o token não corresponder ao formato, o comando falha e a
função interrompe o fluxo.

```sh
token="$(printf '%s' "$resposta" | node -e '
let texto = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", parte => texto += parte);
process.stdin.on("end", () => {
  try {
    const dados = JSON.parse(texto);
    if (dados.headerName !== "X-XSRF-TOKEN" ||
        typeof dados.token !== "string" ||
        !/^[A-Za-z0-9_-]+$/.test(dados.token)) process.exitCode = 1;
    else process.stdout.write(dados.token);
  } catch {
    process.exitCode = 1;
  }
});
')" || {
  rm -f "$arquivo"
  printf '%s\n' 'A resposta CSRF é inválida.' >&2
  return 1
}
```

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
curl -i --user "$AFDEVOPS_ADMIN_USERNAME" --cookie "$csrf_cookie" \
  -H "X-XSRF-TOKEN: $csrf_token" http://127.0.0.1:8080/api/colaboradores \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Pessoa Fictícia","email":"pessoa@example.com","cargo":"Analista","departamento":"Educação"}'

curl --user "$AFDEVOPS_ADMIN_USERNAME" http://127.0.0.1:8080/api/colaboradores
curl --user "$AFDEVOPS_ADMIN_USERNAME" http://127.0.0.1:8080/api/colaboradores/1
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

Antes dos exemplos, informe o usuário e a senha administrativa em variáveis
locais do Bash. A senha é lida sem aparecer na tela, no histórico ou nos
argumentos dos processos. Mantenha esse terminal aberto durante os comandos.

```sh
read -r -p 'Usuário ADMIN: ' AFDEVOPS_ADMIN_USERNAME
read -rs -p 'Senha ADMIN: ' AFDEVOPS_ADMIN_PASSWORD
printf '\n'
export AFDEVOPS_ADMIN_USERNAME AFDEVOPS_ADMIN_PASSWORD
```

O curl receberá a senha pela entrada padrão usando uma configuração temporária
com permissão restrita, removida ao final. Defina esta função uma vez no mesmo
terminal. Ela também permite usar `jq` ou Node.js para conferir e extrair o
token CSRF.

```sh
curl_seguro() {
  local arquivo status
  arquivo="$(mktemp)" || return 1
  chmod 600 "$arquivo" || { rm -f "$arquivo"; return 1; }
  printf 'user = "%s:%s"\n' "$AFDEVOPS_ADMIN_USERNAME" "$AFDEVOPS_ADMIN_PASSWORD" > "$arquivo"
  curl --config "$arquivo" "$@"
  status=$?
  rm -f "$arquivo"
  return "$status"
}

extrair_token_csrf() {
  if command -v jq >/dev/null 2>&1; then
    jq -er 'select(.headerName == "X-XSRF-TOKEN") | .token | select(type == "string" and test("^[A-Za-z0-9_-]+$"))'
  else
    node -e '
      let texto = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", parte => texto += parte);
      process.stdin.on("end", () => {
        try {
          const resposta = JSON.parse(texto);
          if (resposta.headerName !== "X-XSRF-TOKEN" ||
              typeof resposta.token !== "string" ||
              !/^[A-Za-z0-9_-]+$/.test(resposta.token)) process.exitCode = 1;
          else process.stdout.write(resposta.token);
        } catch { process.exitCode = 1; }
      });
    '
  fi
}
```

Substitua `1` pelo ID do colaborador. O exemplo abaixo usa `jq` para montar
o JSON. Para usar Node.js, troque a linha indicada pela alternativa logo
depois do exemplo.

```sh
(
  set -o pipefail
  resposta="$(curl_seguro --fail --silent --show-error --cookie-jar "$csrf_cookie" \
    http://127.0.0.1:8080/api/csrf)" || exit 1
  csrf_token="$(printf '%s' "$resposta" | extrair_token_csrf)" || exit 1
  read -r -p 'Nome do usuário: ' usuario || exit 1
  read -rs -p 'Senha inicial: ' senha || exit 1
  printf '\n'
  printf '%s\n' "$usuario" "$senha" |
    jq -Rn '{nomeUsuario: input, senhaInicial: input}' |
    curl_seguro -i --cookie "$csrf_cookie" \
      -H "X-XSRF-TOKEN: $csrf_token" -H 'Content-Type: application/json' \
      --data-binary @- http://127.0.0.1:8080/api/colaboradores/1/conta
)
```

Para extrair o token CSRF com Node.js, use esta linha no lugar da linha
`csrf_token=...` do exemplo. O comando confirma o cabeçalho esperado e rejeita
respostas JSON inválidas ou tokens fora do formato antes de continuar.

```sh
csrf_token="$(printf '%s' "$resposta" | node -e '
let texto = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", parte => texto += parte);
process.stdin.on("end", () => {
  try {
    const resposta = JSON.parse(texto);
    if (resposta.headerName !== "X-XSRF-TOKEN" ||
        typeof resposta.token !== "string" ||
        !/^[A-Za-z0-9_-]+$/.test(resposta.token)) process.exitCode = 1;
    else process.stdout.write(resposta.token);
  } catch { process.exitCode = 1; }
});
')"
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

```sh
read -r -p 'Nome da conta individual: ' usuario_individual
curl --user "$usuario_individual" http://127.0.0.1:8080/api/me
```

## Consentimento para IA

A conta individual pode consultar, conceder ou revogar o próprio
consentimento. O backend identifica o colaborador pela autenticação. O corpo
do `PUT` aceita apenas `autorizado` com valor `true` ou `false`. Campos extras,
repetidos ou com outros tipos retornam HTTP 400. Contas de demonstração
recebem HTTP 403.

```sh
curl --user "$usuario_individual" http://127.0.0.1:8080/api/me/consentimento

if obter_csrf "$usuario_individual"; then
  curl -i --user "$usuario_individual" --cookie "$csrf_cookie" \
    -X PUT -H "X-XSRF-TOKEN: $csrf_token" -H 'Content-Type: application/json' \
    --data '{"autorizado":true}' http://127.0.0.1:8080/api/me/consentimento
fi
```

Para revogar, use `{"autorizado":false}`. Até a primeira decisão, o retorno é
`{"autorizado":false,"decididoEm":null}`. Cada decisão grava o valor atual e a
data e hora. As respostas não são armazenadas em cache.

O registro representa a decisão atual. Ele não constitui um histórico completo
de auditoria nem garante conformidade legal. A verificação do consentimento
antes de enviar dados à IA será implementada na próxima etapa.

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

```sh
curl -i --user "$AFDEVOPS_ADMIN_USERNAME" --cookie "$csrf_cookie" \
  -H "X-XSRF-TOKEN: $csrf_token" http://127.0.0.1:8080/api/cursos \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Curso fictício","descricao":"Introdução fictícia","cargaHoraria":8,"categoria":"Educação","nivel":"BASICO"}'

curl --user "$AFDEVOPS_COLABORADOR_USERNAME" http://127.0.0.1:8080/api/cursos
curl --user "$AFDEVOPS_COLABORADOR_USERNAME" http://127.0.0.1:8080/api/cursos/1
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

O `POST` não tem corpo e segue o fluxo CSRF descrito acima:

```sh
curl -i --user "$AFDEVOPS_ADMIN_USERNAME" --cookie "$csrf_cookie" \
  -H "X-XSRF-TOKEN: $csrf_token" -X POST http://127.0.0.1:8080/api/treinamentos

curl --user "$AFDEVOPS_ADMIN_USERNAME" http://127.0.0.1:8080/api/treinamentos/1
```

A rota `/internal/**` tem cadeia de segurança própria, sem cookies nem
CSRF, e compara o token em tempo constante. Os testes de integração do
módulo usam RabbitMQ real via Testcontainers.

## Última validação

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
ou troca de senha pela API. HTTP Basic deve ser usado com dados
fictícios em ambiente controlado. Fora da máquina local, use HTTPS, pois o
cabeçalho de autenticação contém credenciais codificadas em Base64.

As listagens não têm paginação. O backend Java ainda não tem integração
funcional com o serviço de IA. A verificação efetiva do consentimento antes
das chamadas ao serviço de IA será implementada na próxima etapa. O desempenho
sob carga ainda não foi medido.
