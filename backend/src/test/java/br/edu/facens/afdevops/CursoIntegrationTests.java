package br.edu.facens.afdevops;

import java.net.http.HttpResponse;
import java.time.Instant;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(AfdevopsApplicationTests.PostgresConfiguration.class)
class CursoIntegrationTests {

    private static final String ROTA = "/api/cursos";
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @LocalServerPort
    private int port;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private Flyway flyway;

    private final SegurancaHttpTeste http = new SegurancaHttpTeste();

    @BeforeEach
    void limparTabela() {
        jdbc.update("DELETE FROM cursos");
    }

    @Test
    void cadastraConsultaEPersiste() throws Exception {
        var criado = post(dados("Curso fictício", "8", "\"BASICO\""));
        assertThat(criado.statusCode()).isEqualTo(201);
        var corpo = JSON.readTree(criado.body());
        long id = corpo.get("id").asLong();
        assertThat(id).isPositive();
        assertThat(corpo.get("nivel").asString()).isEqualTo("BASICO");
        assertThat(corpo.get("cargaHoraria").asInt()).isEqualTo(8);
        assertThat(Instant.parse(corpo.get("criadoEm").asString())).isNotNull();
        assertThat(jdbc.queryForObject("SELECT nivel FROM cursos WHERE id = ?", String.class, id)).isEqualTo("BASICO");
        assertThat(jdbc.queryForObject("SELECT carga_horaria FROM cursos WHERE id = ?", Integer.class, id)).isEqualTo(8);
        String location = criado.headers().firstValue("Location").orElseThrow();
        assertThat(location).isEqualTo(ROTA + "/" + id);
        var consulta = get(location);
        assertThat(consulta.statusCode()).isEqualTo(200);
        assertThat(JSON.readTree(consulta.body())).isEqualTo(corpo);
        assertThat(post(dados("Curso fictício", "8", "\"BASICO\"")).statusCode()).isEqualTo(201);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{",
            "{\"nome\":\" \",\"descricao\":\"Descrição\",\"cargaHoraria\":1,\"categoria\":\"Categoria\",\"nivel\":\"BASICO\"}",
            "{\"nome\":\"Curso\",\"descricao\":\"Descrição\",\"cargaHoraria\":0,\"categoria\":\"Categoria\",\"nivel\":\"BASICO\"}",
            "{\"nome\":\"Curso\",\"descricao\":\"Descrição\",\"cargaHoraria\":1.5,\"categoria\":\"Categoria\",\"nivel\":\"BASICO\"}",
            "{\"nome\":\"Curso\",\"descricao\":\"Descrição\",\"cargaHoraria\":1,\"categoria\":\"Categoria\",\"nivel\":0}",
            "{\"nome\":\"Curso\",\"descricao\":\"Descrição\",\"cargaHoraria\":1,\"categoria\":\"Categoria\",\"nivel\":\"DESCONHECIDO\"}"})
    void rejeitaRequisicoesInvalidas(String body) throws Exception {
        assertProblem(post(body), 400, "DADOS_INVALIDOS");
    }

    @ParameterizedTest
    @ValueSource(strings = {"nome", "descricao", "categoria"})
    void rejeitaNulNosCamposTextuais(String campo) throws Exception {
        var dados = JSON.readTree(dados("Curso fictício", "8", "\"BASICO\""));
        var objeto = (tools.jackson.databind.node.ObjectNode) dados;
        objeto.put(campo, dados.get(campo).asString() + "\0");
        assertProblem(post(JSON.writeValueAsString(objeto)), 400, "DADOS_INVALIDOS");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM cursos", Long.class)).isZero();
    }

    @Test
    void consultaInexistenteEIdentificadorInvalido() throws Exception {
        assertProblem(get(ROTA + "/999999"), 404, "CURSO_NAO_ENCONTRADO");
        assertProblem(get(ROTA + "/texto"), 400, "DADOS_INVALIDOS");
    }

    @Test
    void listaVaziaEDepoisOrdenada() throws Exception {
        var vazia = get(ROTA);
        assertThat(vazia.statusCode()).isEqualTo(200);
        assertThat(JSON.readTree(vazia.body()).toString()).isEqualTo("[]");
        var primeiro = post(dados("Zeta fictício", "1", "\"AVANCADO\""));
        var segundo = post(dados("Alfa fictício", "2", "\"INTERMEDIARIO\""));
        assertThat(primeiro.statusCode()).isEqualTo(201);
        assertThat(segundo.statusCode()).isEqualTo(201);
        var lista = get(ROTA);
        assertThat(lista.statusCode()).isEqualTo(200);
        assertThat(JSON.readTree(lista.body()).values())
                .containsExactly(JSON.readTree(primeiro.body()), JSON.readTree(segundo.body()));
    }

    @Test
    void flywayAplicouV2() {
        assertThat(flyway.info().applied()).anySatisfy(migration -> {
            assertThat(migration.getVersion().getVersion()).isEqualTo("2");
            assertThat(migration.getState()).isEqualTo(MigrationState.SUCCESS);
        });
        assertThat(flyway.info().pending()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"nome", "descricao", "carga_horaria", "categoria", "nivel", "criado_em"})
    void bancoRejeitaCamposNulos(String coluna) {
        String sql = """
                INSERT INTO cursos (nome, descricao, carga_horaria, categoria, nivel, criado_em)
                VALUES ('Curso fictício', 'Descrição', 1, 'Categoria', 'BASICO', CURRENT_TIMESTAMP)
                """;
        String valor = switch (coluna) {
            case "nome" -> "'Curso fictício'";
            case "descricao" -> "'Descrição'";
            case "carga_horaria" -> "1";
            case "categoria" -> "'Categoria'";
            case "nivel" -> "'BASICO'";
            case "criado_em" -> "CURRENT_TIMESTAMP";
            default -> throw new IllegalArgumentException(coluna);
        };
        assertThatThrownBy(() -> jdbc.update(sql.replaceFirst(java.util.regex.Pattern.quote(valor), "NULL")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void bancoAplicaChecksNomeados() {
        assertCheck(0, "BASICO", "ck_cursos_carga_horaria_positiva");
        assertCheck(1, "OUTRO", "ck_cursos_nivel_valido");
    }

    private void assertCheck(int carga, String nivel, String restricao) {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO cursos (nome, descricao, carga_horaria, categoria, nivel, criado_em)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, "Curso fictício", "Descrição", carga, "Categoria", nivel))
                .isInstanceOfSatisfying(DataIntegrityViolationException.class, exception -> {
                    assertThat(exception.getMostSpecificCause()).isInstanceOfSatisfying(PSQLException.class, postgres -> {
                        assertThat(postgres.getSQLState()).isEqualTo("23514");
                        assertThat(postgres.getServerErrorMessage().getConstraint()).isEqualTo(restricao);
                    });
                });
    }

    private static String dados(String nome, String carga, String nivel) {
        return """
                {"nome":"%s","descricao":"Descrição fictícia","cargaHoraria":%s,"categoria":"Educação","nivel":%s}
                """.formatted(nome, carga, nivel);
    }

    private static void assertProblem(HttpResponse<String> resposta, int status, String codigo) {
        assertThat(resposta.statusCode()).isEqualTo(status);
        assertThat(resposta.headers().firstValue("Content-Type").orElseThrow()).startsWith("application/problem+json");
        assertThat(JSON.readTree(resposta.body()).get("codigo").asString()).isEqualTo(codigo);
    }

    private HttpResponse<String> post(String body) throws Exception {
        return http.post(port, ROTA, body, SegurancaHttpTeste.admin(), http.obterCsrf(port));
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.get(port, path, SegurancaHttpTeste.admin());
    }
}
