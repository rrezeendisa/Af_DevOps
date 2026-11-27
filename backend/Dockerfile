# syntax=docker/dockerfile:1

# ---- Etapa de build: compila o JAR com o Maven Wrapper do projeto ----
FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace

# Copia primeiro apenas o necessário para resolver dependências e aproveitar o cache.
COPY .mvn .mvn
COPY mvnw pom.xml ./
# Remove CR caso o arquivo tenha sido clonado no Windows com core.autocrlf=true.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw \
    && ./mvnw -B -q dependency:go-offline

COPY src src
# Os testes rodam na pipeline (com Testcontainers); aqui só empacotamos.
RUN ./mvnw -B -q package -DskipTests \
    && cp target/afdevops-*.jar /workspace/app.jar

# ---- Etapa de execução: somente JRE, usuário sem privilégios ----
FROM eclipse-temurin:17-jre

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system spring \
    && useradd --system --gid spring --no-create-home spring

WORKDIR /app
COPY --from=build --chown=spring:spring /workspace/app.jar app.jar

USER spring

# Dentro do container o backend precisa escutar em todas as interfaces da rede do Compose.
ENV SERVER_ADDRESS=0.0.0.0 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
