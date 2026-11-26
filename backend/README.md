# Backend AF-DevOps

Aplicação Java com Spring Boot, organizada para receber módulos por domínio conforme as funcionalidades forem implementadas.

## Requisitos

- JDK 21 para executar os comandos. O projeto compila com Java 17 como versão-alvo.
- Acesso à internet na primeira execução para baixar o Maven e as dependências.

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

## Executar

```sh
./mvnw spring-boot:run
```

A aplicação escuta na porta 8080. Para consultar sua saúde:

```sh
curl http://localhost:8080/actuator/health
```

Uma aplicação saudável retorna HTTP 200 e status `UP`. O Actuator disponibiliza apenas a verificação de saúde pela interface HTTP.
