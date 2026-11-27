package br.edu.facens.afdevops;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.rabbitmq.RabbitMQContainer;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Testa o acompanhamento das solicitações de treinamento com PostgreSQL e
 * RabbitMQ reais (Testcontainers): publicação na fila combinada com a
 * Frente B e atualização de status pela rota interna usada pelo worker.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({AfdevopsApplicationTests.PostgresConfiguration.class, TreinamentoIntegrationTests.RabbitConfiguration.class})
class TreinamentoIntegrationTests {

    private static final String ROTA = "/api/treinamentos";
    private static final String FILA = "ml.training.requests";
    private static final String TOKEN_INTERNO = UUID.randomUUID().toString();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @LocalServerPort
    private int port;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private RabbitTemplate rabbit;

    @Autowired
    private AmqpAdmin amqpAdmin;

    @Autowired
    private Flyway flyway;

    private final SegurancaHttpTeste http = new SegurancaHttpTeste();

    @BeforeEach
    void limpar() {
        jdbc.update("DELETE FROM solicitacoes_treinamento");
        amqpAdmin.purgeQueue(FILA, false);
    }

    @Test
    void solicitacaoEhRegistradaEPublicadaNaFila() throws Exception {
        var resposta = solicitar(SegurancaHttpTeste.admin());

        assertThat(resposta.statusCode()).isEqualTo(202);
        var corpo = JSON.readTree(resposta.body());
        long id = corpo.get("id").asLong();
        assertThat(corpo.get("status").asString()).isEqualTo("PENDENTE");
        assertThat(corpo.get("solicitadoPor").asString()).startsWith("admin-");
        assertThat(Instant.parse(corpo.get("criadoEm").asString())).isNotNull();
        assertThat(resposta.headers().firstValue("Location")).contains(ROTA + "/" + id);

        var mensagem = rabbit.receive(FILA, 5_000);
        assertThat(mensagem).isNotNull();
        assertThat(mensagem.getMessageProperties().getContentType()).isEqualTo("application/json");
        assertThat(mensagem.getMessageProperties().getReceivedDeliveryMode()).isEqualTo(MessageDeliveryMode.PERSISTENT);
        var conteudo = JSON.readTree(new String(mensagem.getBody(), StandardCharsets.UTF_8));
        assertThat(conteudo.get("solicitacao_id").asString()).isEqualTo(Long.toString(id));
        assertThat(conteudo.size()).isEqualTo(1);
    }

    @Test
    void workerAtualizaStatusEAdminAcompanha() throws Exception {
        long id = JSON.readTree(solicitar(SegurancaHttpTeste.admin()).body()).get("id").asLong();
        String concluido = "{\"status\":\"CONCLUIDO\",\"versaoModelo\":\"1.0.0\",\"mensagem\":\"Modelo treinado.\"}";

        assertThat(patch(id, concluido, "Bearer " + TOKEN_INTERNO).statusCode()).isEqualTo(204);

        var consulta = http.get(port, ROTA + "/" + id, SegurancaHttpTeste.admin());
        assertThat(consulta.statusCode()).isEqualTo(200);
        var corpo = JSON.readTree(consulta.body());
        assertThat(corpo.get("status").asString()).isEqualTo("CONCLUIDO");
        assertThat(corpo.get("versaoModelo").asString()).isEqualTo("1.0.0");
        assertThat(corpo.get("mensagem").asString()).isEqualTo("Modelo treinado.");

        // Reenvio idêntico (retry do worker) é idempotente; trocar o status final é conflito.
        assertThat(patch(id, concluido, "Bearer " + TOKEN_INTERNO).statusCode()).isEqualTo(204);
        var conflito = patch(id, "{\"status\":\"FALHOU\",\"mensagem\":\"Erro\"}", "Bearer " + TOKEN_INTERNO);
        assertProblem(conflito, 409, "STATUS_CONFLITANTE");
    }

    @Test
    void falhaInformadaPeloWorkerNaoGuardaVersao() throws Exception {
        long id = JSON.readTree(solicitar(SegurancaHttpTeste.admin()).body()).get("id").asLong();

        var resposta = patch(id, "{\"status\":\"FALHOU\",\"versaoModelo\":\"9\",\"mensagem\":\"Erro no treino\"}",
                "Bearer " + TOKEN_INTERNO);

        assertThat(resposta.statusCode()).isEqualTo(204);
        var corpo = JSON.readTree(http.get(port, ROTA + "/" + id, SegurancaHttpTeste.admin()).body());
        assertThat(corpo.get("status").asString()).isEqualTo("FALHOU");
        assertThat(corpo.get("versaoModelo").isNull()).isTrue();
    }

    @Test
    void rotaInternaExigeTokenBearer() throws Exception {
        long id = JSON.readTree(solicitar(SegurancaHttpTeste.admin()).body()).get("id").asLong();
        String corpo = "{\"status\":\"CONCLUIDO\",\"versaoModelo\":\"1.0.0\",\"mensagem\":\"ok\"}";

        assertProblem(patch(id, corpo, null), 401, "AUTENTICACAO_INTERNA_NECESSARIA");
        assertProblem(patch(id, corpo, "Bearer " + UUID.randomUUID()), 401, "AUTENTICACAO_INTERNA_NECESSARIA");
        assertProblem(patch(id, corpo, SegurancaHttpTeste.admin()), 401, "AUTENTICACAO_INTERNA_NECESSARIA");
        assertThat(jdbc.queryForObject("SELECT status FROM solicitacoes_treinamento WHERE id = ?", String.class, id))
                .isEqualTo("PENDENTE");
        var outraRota = http.enviar(http.request(port, "/internal/qualquer", "Bearer " + TOKEN_INTERNO).GET().build());
        assertProblem(outraRota, 403, "ACESSO_NEGADO");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{", "{\"status\":\"PENDENTE\",\"mensagem\":\"x\"}",
            "{\"status\":\"OUTRO\",\"mensagem\":\"x\"}", "{\"status\":\"CONCLUIDO\",\"mensagem\":\" \"}",
            "{\"status\":\"CONCLUIDO\",\"mensagem\":\"x\\u0000\"}"})
    void rotaInternaValidaCorpo(String corpo) throws Exception {
        long id = JSON.readTree(solicitar(SegurancaHttpTeste.admin()).body()).get("id").asLong();
        assertProblem(patch(id, corpo, "Bearer " + TOKEN_INTERNO), 400, "DADOS_INVALIDOS");
    }

    @Test
    void solicitacaoInexistente() throws Exception {
        String corpo = "{\"status\":\"CONCLUIDO\",\"mensagem\":\"ok\"}";
        assertProblem(patch(999_999, corpo, "Bearer " + TOKEN_INTERNO), 404, "SOLICITACAO_NAO_ENCONTRADA");
        assertProblem(http.get(port, ROTA + "/999999", SegurancaHttpTeste.admin()), 404, "SOLICITACAO_NAO_ENCONTRADA");
    }

    @Test
    void somenteAdminSolicitaEAcompanha() throws Exception {
        assertProblem(solicitar(SegurancaHttpTeste.colaborador()), 403, "ACESSO_NEGADO");
        assertProblem(http.get(port, ROTA, SegurancaHttpTeste.colaborador()), 403, "ACESSO_NEGADO");
        assertProblem(http.get(port, ROTA, null), 401, "AUTENTICACAO_NECESSARIA");
        var semCsrf = http.post(port, ROTA, "", SegurancaHttpTeste.admin(), null);
        assertProblem(semCsrf, 403, "CSRF_INVALIDO");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM solicitacoes_treinamento", Long.class)).isZero();
    }

    @Test
    void listaEmOrdemDeCriacao() throws Exception {
        var primeira = solicitar(SegurancaHttpTeste.admin());
        var segunda = solicitar(SegurancaHttpTeste.admin());
        var lista = http.get(port, ROTA, SegurancaHttpTeste.admin());
        assertThat(lista.statusCode()).isEqualTo(200);
        assertThat(JSON.readTree(lista.body()).values())
                .containsExactly(JSON.readTree(primeira.body()), JSON.readTree(segunda.body()));
    }

    @Test
    void flywayAplicouV3() {
        assertThat(flyway.info().applied()).anySatisfy(migration -> {
            assertThat(migration.getVersion().getVersion()).isEqualTo("3");
            assertThat(migration.getState()).isEqualTo(MigrationState.SUCCESS);
        });
    }

    @Test
    void healthIncluiRabbitQuandoHabilitado() throws Exception {
        var saude = http.get(port, "/actuator/health", null);
        assertThat(saude.statusCode()).isEqualTo(200);
        assertThat(saude.body()).contains("\"status\":\"UP\"");
    }

    private HttpResponse<String> solicitar(String credencial) throws Exception {
        return http.post(port, ROTA, "", credencial, http.obterCsrf(port));
    }

    private HttpResponse<String> patch(long id, String corpo, String credencial) throws Exception {
        var pedido = http.request(port, "/internal/treinamentos/" + id + "/status", credencial)
                .header("Content-Type", "application/json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(corpo))
                .build();
        return http.enviar(pedido);
    }

    private static void assertProblem(HttpResponse<String> resposta, int status, String codigo) {
        assertThat(resposta.statusCode()).isEqualTo(status);
        assertThat(resposta.headers().firstValue("Content-Type")).hasValueSatisfying(
                tipo -> assertThat(tipo).startsWith("application/problem+json"));
        assertThat(JSON.readTree(resposta.body()).get("codigo").asString()).isEqualTo(codigo);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class RabbitConfiguration {

        @Bean
        @ServiceConnection
        RabbitMQContainer rabbitmq() {
            return new RabbitMQContainer("rabbitmq:4.1-management");
        }

        @Bean
        DynamicPropertyRegistrar tokenInterno() {
            return registro -> {
                registro.add("INTERNAL_API_TOKEN", () -> TOKEN_INTERNO);
                registro.add("RABBITMQ_HEALTH_ENABLED", () -> "true");
            };
        }
    }
}
