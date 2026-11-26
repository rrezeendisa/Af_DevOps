package br.edu.facens.afdevops;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(AfdevopsApplicationTests.PostgresConfiguration.class)
class ColaboradorIntegrationTests {

    private static final String ROTA = "/api/colaboradores";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @LocalServerPort
    private int port;

    @Autowired
    private JdbcTemplate jdbc;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @BeforeEach
    void limparTabela() {
        jdbc.update("DELETE FROM colaboradores");
    }

    @Test
    void cadastraPersisteEConsulta() throws Exception {
        var criado = post(dados("  PESSOA@EXAMPLE.COM  "));
        assertThat(criado.statusCode()).isEqualTo(201);
        var corpo = JSON.readTree(criado.body());
        long id = corpo.get("id").asLong();
        assertThat(id).isPositive();
        assertThat(corpo.get("email").asString()).isEqualTo("pessoa@example.com");
        assertThat(Instant.parse(corpo.get("criadoEm").asString())).isNotNull();
        assertThat(jdbc.queryForObject("SELECT email FROM colaboradores WHERE id = ?", String.class, id))
                .isEqualTo("pessoa@example.com");

        String location = criado.headers().firstValue("Location").orElseThrow();
        assertThat(location).isEqualTo(ROTA + "/" + id);
        var consulta = get(location);
        assertThat(consulta.statusCode()).isEqualTo(200);
        assertThat(JSON.readTree(consulta.body())).isEqualTo(corpo);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{", """
            {"nome":" ","email":"pessoa@example.com","cargo":"Analista","departamento":"Educação"}
            """, """
            {"nome":"Pessoa Fictícia","email":"inválido","cargo":"Analista","departamento":"Educação"}
            """})
    void rejeitaDadosInvalidos(String payload) throws Exception {
        assertProblem(post(payload), 400, "DADOS_INVALIDOS");
    }

    @Test
    void rejeitaEmailDuplicado() throws Exception {
        assertThat(post(dados("pessoa@example.com")).statusCode()).isEqualTo(201);
        assertProblem(post(dados("pessoa@example.com")), 409, "EMAIL_DUPLICADO");
        assertProblem(post(dados("PESSOA@EXAMPLE.COM")), 409, "EMAIL_DUPLICADO");
    }

    @Test
    void indiceRejeitaDiferencaDeCaixaEmEscritaDireta() {
        inserirDiretamente("Pessoa@EXAMPLE.COM");
        assertThatThrownBy(() -> inserirDiretamente("pessoa@example.com"))
                .isInstanceOfSatisfying(DuplicateKeyException.class, exception -> {
                    assertThat(exception.getMostSpecificCause()).isInstanceOfSatisfying(PSQLException.class, postgres -> {
                        assertThat(postgres.getSQLState()).isEqualTo("23505");
                        assertThat(postgres.getServerErrorMessage().getConstraint())
                                .isEqualTo("ux_colaboradores_email_lower");
                    });
                });
    }

    @Test
    void cadastroConcorrenteCriaSomenteUmRegistro() throws Exception {
        var barreira = new CyclicBarrier(2);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var primeiro = executor.submit(cadastroSincronizado(barreira, "pessoa@example.com"));
            var segundo = executor.submit(cadastroSincronizado(barreira, "PESSOA@EXAMPLE.COM"));
            var respostas = List.of(primeiro.get(20, TimeUnit.SECONDS), segundo.get(20, TimeUnit.SECONDS));
            assertThat(respostas).extracting(HttpResponse::statusCode).containsExactlyInAnyOrder(201, 409);
            for (var resposta : respostas) {
                if (resposta.statusCode() == 409) {
                    assertProblem(resposta, 409, "EMAIL_DUPLICADO");
                }
            }
            assertThat(jdbc.queryForObject("SELECT count(*) FROM colaboradores", Long.class)).isEqualTo(1L);
        }
        finally {
            executor.shutdownNow();
        }
    }

    @Test
    void consultaIdentificadoresInexistenteEInvalido() throws Exception {
        assertProblem(get(ROTA + "/999999"), 404, "COLABORADOR_NAO_ENCONTRADO");
        assertProblem(get(ROTA + "/texto"), 400, "DADOS_INVALIDOS");
    }

    @Test
    void listaVaziaEDepoisOrdenadaPorId() throws Exception {
        var vazia = get(ROTA);
        assertThat(vazia.statusCode()).isEqualTo(200);
        assertThat(JSON.readTree(vazia.body()).toString()).isEqualTo("[]");

        var primeiro = post(dados("zeta@example.com"));
        var segundo = post(dados("alfa@example.com"));
        assertThat(primeiro.statusCode()).isEqualTo(201);
        assertThat(segundo.statusCode()).isEqualTo(201);
        var lista = get(ROTA);
        assertThat(lista.statusCode()).isEqualTo(200);
        assertThat(JSON.readTree(lista.body()).values())
                .containsExactly(JSON.readTree(primeiro.body()), JSON.readTree(segundo.body()));
    }

    private void inserirDiretamente(String email) {
        jdbc.update("""
                INSERT INTO colaboradores (nome, email, cargo, departamento, criado_em)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, "Pessoa Fictícia", email, "Analista", "Educação");
    }

    private Callable<HttpResponse<String>> cadastroSincronizado(CyclicBarrier barreira, String email) {
        return () -> {
            barreira.await(5, TimeUnit.SECONDS);
            return post(dados(email));
        };
    }

    private static String dados(String email) {
        return """
                {"nome":"Pessoa Fictícia","email":"%s","cargo":"Analista","departamento":"Educação"}
                """.formatted(email);
    }

    private static void assertProblem(HttpResponse<String> resposta, int status, String codigo) {
        assertThat(resposta.statusCode()).isEqualTo(status);
        assertThat(resposta.headers().firstValue("Content-Type").orElseThrow())
                .startsWith("application/problem+json");
        assertThat(JSON.readTree(resposta.body()).get("codigo").asString()).isEqualTo(codigo);
    }

    private HttpResponse<String> post(String body) throws Exception {
        var request = request(ROTA).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(request(path).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .timeout(Duration.ofSeconds(12));
    }
}
