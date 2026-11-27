package br.edu.facens.afdevops;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

import static br.edu.facens.afdevops.SegurancaHttpTeste.admin;
import static br.edu.facens.afdevops.SegurancaHttpTeste.colaborador;
import static br.edu.facens.afdevops.SegurancaHttpTeste.senhaErrada;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(AfdevopsApplicationTests.PostgresConfiguration.class)
class SegurancaIntegrationTests {
    private static final String CURSOS = "/api/cursos";
    private static final String COLABORADORES = "/api/colaboradores";
    private static final String DADOS_CURSO = """
            {"nome":"Curso fictício","descricao":"Descrição fictícia","cargaHoraria":8,"categoria":"Educação","nivel":"BASICO"}
            """;
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @LocalServerPort
    private int porta;

    @Autowired
    private JdbcTemplate jdbc;

    private final SegurancaHttpTeste http = new SegurancaHttpTeste();

    @ParameterizedTest
    @ValueSource(strings = {CURSOS, CURSOS + "/-1", COLABORADORES, COLABORADORES + "/-1", "/api/csrf"})
    void consultasProtegidasExigemAutenticacao(String rota) throws Exception {
        assertProblema(http.get(porta, rota, null), 401, "AUTENTICACAO_NECESSARIA");
    }

    @Test
    void senhaInvalidaRecebeDesafioBasic() throws Exception {
        assertProblema(http.get(porta, CURSOS, senhaErrada()), 401, "AUTENTICACAO_NECESSARIA");
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void recusasNaoRevelamCredenciaisTokenOuDadosDoPedido(CapturedOutput saida) throws Exception {
        var csrf = http.obterCsrf(porta);
        var credencialInvalida = senhaErrada();
        var negada = http.get(porta, CURSOS, credencialInvalida);
        var emailFicticio = "ficticio-" + UUID.randomUUID() + "@example.com";
        var cadastro = http.post(porta, COLABORADORES, "{\"email\":\"" + emailFicticio + "\"}",
                colaborador(), csrf);
        assertProblema(negada, 401, "AUTENTICACAO_NECESSARIA");
        assertProblema(cadastro, 403, "ACESSO_NEGADO");

        String conteudo = negada.body() + cadastro.body() + saida.getAll();
        for (String valor : new String[] {credencialInvalida, colaborador(), csrf.token(), csrf.cookie(), emailFicticio}) {
            assertThat(conteudo.contains(valor)).isFalse();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {COLABORADORES, COLABORADORES + "/-1", "/api/csrf"})
    void colaboradorNaoPodeLerRotasAdministrativas(String rota) throws Exception {
        assertProblema(http.get(porta, rota, colaborador()), 403, "ACESSO_NEGADO");
    }

    @Test
    void ambosOsPerfisPodemConsultarCursos() throws Exception {
        long id = jdbc.queryForObject("""
                INSERT INTO cursos (nome, descricao, carga_horaria, categoria, nivel, criado_em)
                VALUES ('Curso fictício', 'Descrição fictícia', 8, 'Educação', 'BASICO', CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class);
        try {
            for (String credencial : new String[] {admin(), colaborador()}) {
                assertThat(http.get(porta, CURSOS, credencial).statusCode()).isEqualTo(200);
                assertThat(http.get(porta, CURSOS + "/" + id, credencial).statusCode()).isEqualTo(200);
            }
        } finally {
            jdbc.update("DELETE FROM cursos WHERE id = ?", id);
        }
    }

    @Test
    void autenticacaoNaoPersisteEntreRequisicoes() throws Exception {
        var autenticada = http.get(porta, CURSOS, colaborador());
        assertThat(autenticada.statusCode()).isEqualTo(200);
        assertQueNaoHouveSessao(autenticada);
        var anonima = http.get(porta, CURSOS, null);
        assertProblema(anonima, 401, "AUTENTICACAO_NECESSARIA");
        assertQueNaoHouveSessao(anonima);
    }

    @Test
    void csrfForneceTokenMascaradoEmRespostaSemCache() throws Exception {
        var resposta = http.get(porta, "/api/csrf", admin());
        assertThat(resposta.statusCode()).isEqualTo(200);
        assertThat(resposta.headers().firstValue("Cache-Control")).hasValue("no-store");
        var cookie = resposta.headers().allValues("Set-Cookie").stream()
                .filter(valor -> valor.startsWith("XSRF-TOKEN=")).findFirst().orElseThrow();
        assertThat(cookie.contains("HttpOnly") && cookie.contains("SameSite=Strict")
                && !cookie.contains("Domain=")).isTrue();
        var corpo = JSON.readTree(resposta.body());
        assertThat(corpo.get("headerName").asString()).isEqualTo("X-XSRF-TOKEN");
        assertThat(cookie.startsWith("XSRF-TOKEN=" + corpo.get("token").asString() + ";")).isFalse();
        assertQueNaoHouveSessao(resposta);
    }

    @Test
    void csrfAusenteOuInvalidoImpedeCadastro() throws Exception {
        Integer antes = quantidadeCursos();
        var csrf = http.obterCsrf(porta);
        var invalido = new SegurancaHttpTeste.TokenCsrf(csrf.cookie(), csrf.cabecalho(), UUID.randomUUID().toString());
        var semCookie = http.request(porta, CURSOS, admin())
                .header("Content-Type", "application/json").header(csrf.cabecalho(), csrf.token())
                .POST(HttpRequest.BodyPublishers.ofString(DADOS_CURSO)).build();

        assertProblema(http.post(porta, CURSOS, DADOS_CURSO, admin(), null), 403, "CSRF_INVALIDO");
        assertProblema(http.post(porta, CURSOS, DADOS_CURSO, colaborador(), null), 403, "CSRF_INVALIDO");
        assertProblema(http.post(porta, CURSOS, DADOS_CURSO, null, null), 403, "CSRF_INVALIDO");
        assertProblema(http.post(porta, CURSOS, DADOS_CURSO, admin(), invalido), 403, "CSRF_INVALIDO");
        assertProblema(http.enviar(semCookie), 403, "CSRF_INVALIDO");
        assertThat(quantidadeCursos()).isEqualTo(antes);
    }

    @Test
    void csrfValidoNaoSubstituiCredenciaisNemPermissoes() throws Exception {
        Integer antesCursos = quantidadeCursos();
        Integer antesColaboradores = jdbc.queryForObject("SELECT count(*) FROM colaboradores", Integer.class);
        var csrf = http.obterCsrf(porta);
        assertProblema(http.post(porta, CURSOS, DADOS_CURSO, null, csrf), 401, "AUTENTICACAO_NECESSARIA");
        assertProblema(http.post(porta, CURSOS, DADOS_CURSO, senhaErrada(), csrf), 401, "AUTENTICACAO_NECESSARIA");
        assertProblema(http.post(porta, CURSOS, DADOS_CURSO, colaborador(), csrf), 403, "ACESSO_NEGADO");
        assertProblema(http.post(porta, COLABORADORES, "{}", colaborador(), csrf), 403, "ACESSO_NEGADO");
        assertThat(quantidadeCursos()).isEqualTo(antesCursos);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM colaboradores", Integer.class))
                .isEqualTo(antesColaboradores);
    }

    @Test
    void adminComCookieTokenECredenciaisPodeCadastrar() throws Exception {
        var resposta = http.post(porta, CURSOS, DADOS_CURSO, admin(), http.obterCsrf(porta));
        assertThat(resposta.statusCode()).isEqualTo(201);
        long id = JSON.readTree(resposta.body()).get("id").asLong();
        try {
            assertThat(resposta.headers().firstValue("Location")).hasValue(CURSOS + "/" + id);
            assertQueNaoHouveSessao(resposta);
        } finally {
            jdbc.update("DELETE FROM cursos WHERE id = ?", id);
        }
    }

    @ParameterizedTest
    @MethodSource("rotasActuatorBloqueadas")
    void actuatorNaoAutorizadoRetorna404(String metodo, String rota) throws Exception {
        for (String credencial : new String[] {null, admin(), colaborador(), senhaErrada()}) {
            var resposta = http.enviar(http.request(porta, rota, credencial)
                    .method(metodo, HttpRequest.BodyPublishers.noBody()).build());
            assertThat(resposta.statusCode()).isEqualTo(404);
            assertThat(resposta.headers().firstValue("WWW-Authenticate")).isEmpty();
        }
    }

    static Stream<Arguments> rotasActuatorBloqueadas() {
        return Stream.of(Arguments.of("GET", "/actuator"), Arguments.of("GET", "/actuator/env"),
                Arguments.of("POST", "/actuator/env"), Arguments.of("GET", "/actuator/health/db"),
                Arguments.of("POST", "/actuator/health"), Arguments.of("HEAD", "/actuator/health"),
                Arguments.of("OPTIONS", "/actuator/health"));
    }

    @Test
    void rotaOuMetodoForaDaListaSaoNegadosMesmoParaAdmin() throws Exception {
        assertProblema(http.get(porta, "/error", admin()), 403, "ACESSO_NEGADO");
        assertProblema(http.get(porta, "/internal/treinamentos", admin()), 403, "ACESSO_NEGADO");
        var csrf = http.obterCsrf(porta);
        var pedido = http.request(porta, CURSOS + "/1", admin())
                .header("Cookie", csrf.cookie()).header(csrf.cabecalho(), csrf.token()).DELETE().build();
        assertProblema(http.enviar(pedido), 403, "ACESSO_NEGADO");
    }

    private Integer quantidadeCursos() {
        return jdbc.queryForObject("SELECT count(*) FROM cursos", Integer.class);
    }

    private static void assertQueNaoHouveSessao(HttpResponse<String> resposta) {
        assertThat(resposta.headers().allValues("Set-Cookie").stream()
                .anyMatch(cookie -> cookie.startsWith("JSESSIONID="))).isFalse();
    }

    private static void assertProblema(HttpResponse<String> resposta, int status, String codigo) throws Exception {
        assertThat(resposta.statusCode()).isEqualTo(status);
        assertThat(resposta.headers().firstValue("Content-Type")).hasValueSatisfying(
                valor -> assertThat(valor).startsWith("application/problem+json"));
        var corpo = JSON.readTree(resposta.body());
        assertThat(corpo.get("status").asInt()).isEqualTo(status);
        assertThat(corpo.get("codigo").asString()).isEqualTo(codigo);
        if (status == 401) {
            assertThat(resposta.headers().firstValue("WWW-Authenticate")).hasValue("Basic realm=\"AF-DevOps\"");
        } else {
            assertThat(resposta.headers().firstValue("WWW-Authenticate")).isEmpty();
        }
    }
}
