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
pacotes `colaborador` e `curso` agrupam as classes de cada domínio. Dentro de
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
Spring Data JPA e Bean Validation. O projeto não utiliza Lombok.

## Configuração do ambiente

Instale o JDK 21 e o Docker Desktop. Na primeira execução, será necessário
acesso à internet para baixar o Maven, as dependências e a imagem PostgreSQL
usada pelos testes. Para executar a aplicação localmente, também é preciso ter
o PostgreSQL 17 disponível.

A conexão local usa as variáveis abaixo. Os valores indicados são padrões para
desenvolvimento. A senha deve ser fornecida pelo ambiente.

| Variável | Padrão local |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `afdevops` |
| `DB_USERNAME` | `afdevops` |
| `DB_PASSWORD` | Obrigatória, sem padrão |

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

O backend utiliza a porta 8080. A verificação de saúde fica disponível em
`GET /actuator/health`:

```sh
curl http://localhost:8080/actuator/health
```

Quando a aplicação está saudável, a resposta é HTTP 200 e contém o estado
`UP`. Essa é a única rota do Actuator exposta por HTTP.

## Banco de dados e migrações

O Flyway aplica os scripts versionados em
`src/main/resources/db/migration`. A migração V1 cria a tabela de
colaboradores e um índice que mantém os e-mails únicos, sem diferenciar letras
maiúsculas de minúsculas. A migração V2 cria a tabela de cursos e as restrições
para carga horária e nível. Migrações já aplicadas não devem ser editadas.

O Hibernate verifica se o esquema do banco corresponde às entidades, usando
`ddl-auto: validate`. A opção open-in-view: false evita manter o contexto de persistência aberto durante toda a requisição HTTP. O driver PostgreSQL omite detalhes de erro do
servidor nas mensagens. As validações rejeitam o caractere NUL nos campos
textuais dos cadastros.

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
curl -i http://localhost:8080/api/colaboradores \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Pessoa Fictícia","email":"pessoa@example.com","cargo":"Analista","departamento":"Educação"}'

curl http://localhost:8080/api/colaboradores
curl http://localhost:8080/api/colaboradores/1
```

Troque `1` pelo ID retornado no cadastro. Os erros usam
`application/problem+json` e incluem o campo `codigo`.

| HTTP | Código |
| --- | --- |
| 400 Bad Request | `DADOS_INVALIDOS` |
| 409 Conflict | `EMAIL_DUPLICADO` |
| 404 Not Found | `COLABORADOR_NAO_ENCONTRADO` |

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
curl -i http://localhost:8080/api/cursos \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Curso fictício","descricao":"Introdução fictícia","cargaHoraria":8,"categoria":"Educação","nivel":"BASICO"}'

curl http://localhost:8080/api/cursos
curl http://localhost:8080/api/cursos/1
```

Troque `1` pelo ID retornado no cadastro. Os erros usam
`application/problem+json`, com `DADOS_INVALIDOS` para HTTP 400 e
`CURSO_NAO_ENCONTRADO` para HTTP 404.

## Última validação

Em 26/11/2026, foram executados e aprovados 92 testes automatizados, sem falhas,
erros ou testes ignorados. Também foram feitas validações manuais dos endpoints
dos dois módulos e da persistência no PostgreSQL.

## Limitações atuais

Os endpoints ainda não têm autenticação ou autorização. As listas retornam
todos os registros e não têm paginação. A integração funcional com o serviço
de IA ainda será desenvolvida. No momento, o serviço Python do repositório
oferece somente o endpoint de saúde `GET /health`.
Como os endpoints ainda não possuem autenticação ou autorização, recomenda-se utilizar a aplicação em um ambiente controlado e com dados fictícios.
