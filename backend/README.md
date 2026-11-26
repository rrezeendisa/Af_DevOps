# Backend AF-DevOps

Aplicação Java com Spring Boot, organizada para receber módulos por domínio conforme as funcionalidades forem implementadas.

## Requisitos

- JDK 21 para executar os comandos. O projeto compila com Java 17 como versão-alvo.
- Acesso à internet na primeira execução para baixar o Maven, as dependências e as imagens Docker dos testes.
- PostgreSQL 17 para executar a aplicação em desenvolvimento.
- Docker Desktop em execução, com acesso ao Docker Engine para os testes de integração.

O Maven Wrapper fornece a versão do Maven definida no projeto, sem exigir instalação global.

## Compilar e testar

No diretório `backend/`, execute:

```sh
./mvnw clean package
```

O comando executa os testes e gera o JAR em `target/`. Para executar apenas os testes:

```sh
./mvnw test
```

No Windows, use `mvnw.cmd` no lugar de `./mvnw`.

Os testes usam Testcontainers para iniciar um PostgreSQL 17 descartável, com porta
dinâmica e credenciais próprias. As variáveis de conexão de desenvolvimento não
são necessárias. Se o Docker estiver indisponível, a suíte falha durante a
inicialização. Para verificar apenas a compilação do código e dos testes, execute
`./mvnw test-compile`.

## Executar

O backend usa as seguintes variáveis de ambiente para a conexão local.

| Variável | Padrão local |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `afdevops` |
| `DB_USERNAME` | `afdevops` |
| `DB_PASSWORD` | Obrigatória, sem padrão |

Forneça `DB_PASSWORD` no ambiente da execução. No Bash ou Zsh, os comandos abaixo
leem a senha sem exibi-la e a disponibilizam apenas no subshell que inicia a
aplicação. Se o ambiente já fornece a variável, basta executar
`./mvnw spring-boot:run`.

```sh
(
  printf 'Senha do PostgreSQL: '
  read -rs DB_PASSWORD
  printf '\n'
  export DB_PASSWORD
  ./mvnw spring-boot:run
)
```

Exporte as demais variáveis nesse mesmo ambiente se sua conexão usar valores
diferentes dos padrões. Mantenha a senha fora de arquivos versionados e da linha
de comando.

A aplicação escuta na porta 8080. Para consultar sua saúde:

```sh
curl http://localhost:8080/actuator/health
```

Uma aplicação saudável retorna HTTP 200 e status `UP`. O Actuator disponibiliza apenas a verificação de saúde pela interface HTTP.

## Migrações

O Flyway usa o mesmo datasource da aplicação e procura por scripts versionados
em `src/main/resources/db/migration`. Os primeiros scripts serão adicionados
com as tabelas de domínio. O Hibernate valida o esquema e a sessão JPA não
permanece aberta durante a renderização da resposta HTTP.
