package br.edu.facens.afdevops;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.json.JsonMapper;

import static br.edu.facens.afdevops.SegurancaHttpTeste.admin;
import static br.edu.facens.afdevops.SegurancaHttpTeste.colaborador;
import static br.edu.facens.afdevops.SegurancaHttpTeste.conta;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(AfdevopsApplicationTests.PostgresConfiguration.class)
class IaIntegrationTests {
    private static final String API = "/api/ia";
    private static final String NOTAS = "{\"logica\":1,\"comunicacao\":3,\"tecnologia\":5}";
    private static final String PERFIL = "{\"logica\":1,\"comunicacao\":3,\"tecnologia\":5,\"nivel\":\"INICIANTE\"}";
    private static final String PERGUNTA = "{\"pergunta\":\"Por onde começar?\",\"competencias\":" + NOTAS + "}";
    private static final String TOKEN_INTERNO = UUID.randomUUID().toString();
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final AtomicInteger CHAMADAS = new AtomicInteger();
    private static final AtomicReference<Chamada> ULTIMA = new AtomicReference<>();
    private static HttpServer servidor;

    @LocalServerPort
    private int porta;

    @Autowired
    private JdbcTemplate jdbc;

    private final SegurancaHttpTeste http = new SegurancaHttpTeste();

    @DynamicPropertySource
    static void propriedades(DynamicPropertyRegistry registro) throws IOException {
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/", troca -> {
            try (troca) {
                String caminho = troca.getRequestURI().getPath();
                ULTIMA.set(new Chamada(troca.getRequestHeaders().getFirst("Authorization"),
                        new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
                CHAMADAS.incrementAndGet();
                String corpo = switch (caminho) {
                    case "/classificacoes" -> "{\"nivel\":\"INICIANTE\",\"versao_modelo\":\"teste\"}";
                    case "/recomendacoes" ->
                        """
                        {"recomendacoes":[{"curso_id":"CURSO-001","nome":"Lógica","justificativa":"Prática"}],"fontes":[]}
                        """;
                    case "/orientacoes" ->
                        "{\"orientacao\":\"Comece por lógica.\",\"cursos_recomendados\":[\"CURSO-001\"],\"fontes\":[]}";
                    default -> "{}";
                };
                byte[] bytes = corpo.getBytes(StandardCharsets.UTF_8);
                troca.getResponseHeaders().set("Content-Type", "application/json");
                troca.sendResponseHeaders(200, bytes.length);
                troca.getResponseBody().write(bytes);
            }
        });
        servidor.start();
        registro.add("AI_SERVICE_URL", () -> "http://127.0.0.1:" + servidor.getAddress().getPort());
        registro.add("INTERNAL_API_TOKEN", () -> TOKEN_INTERNO);
    }

    @AfterAll
    static void pararFastApiSimulado() {
        if (servidor != null) {
            servidor.stop(0);
        }
    }

    @Test
    void exigeSessaoDeContaIndividualECsrfSemChamarFastApi() throws Exception {
        var conta = novaConta();
        var csrf = http.obterCsrf(porta, conta.credencial());
        int antes = CHAMADAS.get();

        problema(post("/classificacoes", NOTAS, null, csrf), 401, "AUTENTICACAO_NECESSARIA");
        problema(post("/classificacoes", NOTAS, admin(), csrf), 403, "ACESSO_NEGADO");
        problema(post("/recomendacoes", PERFIL, colaborador(), csrf), 403, "ACESSO_NEGADO");
        problema(post("/orientacoes", PERGUNTA, conta.credencial(), null), 403, "CSRF_INVALIDO");
        assertThat(CHAMADAS.get()).isEqualTo(antes);
    }

    @Test
    void usaConsentimentoAtualEIdentidadeDaConta() throws Exception {
        var conta = novaConta();
        var csrf = http.obterCsrf(porta, conta.credencial());
        int antes = CHAMADAS.get();

        for (var fluxo : Map.of("/classificacoes", NOTAS, "/recomendacoes", PERFIL, "/orientacoes", PERGUNTA).entrySet()) {
            problema(post(fluxo.getKey(), fluxo.getValue(), conta.credencial(), csrf), 403, "CONSENTIMENTO_IA_NECESSARIO");
        }
        assertThat(CHAMADAS.get()).isEqualTo(antes);

        assertThat(http.put(porta, "/api/me/consentimento", "{\"autorizado\":true}", conta.credencial(), csrf)
                .statusCode()).isEqualTo(200);
        problema(post("/orientacoes", "{\"colaborador_id\":\"2\",\"pergunta\":\"Olá\",\"competencias\":" + NOTAS + "}",
                conta.credencial(), csrf), 400, "DADOS_INVALIDOS");
        problema(post("/classificacoes", NOTAS.replace("5}", "5,\"autorizado\":true}"), conta.credencial(), csrf),
                400, "DADOS_INVALIDOS");
        problema(post("/orientacoes?colaboradorId=2", PERGUNTA, conta.credencial(), csrf), 400, "DADOS_INVALIDOS");
        assertThat(CHAMADAS.get()).isEqualTo(antes);

        assertThat(corpo(post("/classificacoes", NOTAS, conta.credencial(), csrf)).get("versaoModelo").asString())
                .isEqualTo("teste");
        assertThat(ULTIMA.get().autorizacao() == null).isTrue();
        var recomendacoes = corpo(post("/recomendacoes", PERFIL, conta.credencial(), csrf));
        assertThat(recomendacoes.get("recomendacoes").get(0).get("cursoId").asString()).isEqualTo("CURSO-001");
        assertThat(ULTIMA.get().autorizacao() == null).isTrue();
        var orientacao = corpo(post("/orientacoes", PERGUNTA, conta.credencial(), csrf));
        assertThat(orientacao.get("cursosRecomendados").get(0).asString()).isEqualTo("CURSO-001");
        assertThat(("Bearer " + TOKEN_INTERNO).equals(ULTIMA.get().autorizacao())).isTrue();
        assertThat(JSON.readTree(ULTIMA.get().corpo()).get("colaborador_id").asString()).isEqualTo(Long.toString(conta.id()));
        assertThat(CHAMADAS.get()).isEqualTo(antes + 3);

        assertThat(http.put(porta, "/api/me/consentimento", "{\"autorizado\":false}", conta.credencial(), csrf)
                .statusCode()).isEqualTo(200);
        problema(post("/orientacoes", PERGUNTA, conta.credencial(), csrf), 403, "CONSENTIMENTO_IA_NECESSARIO");
        assertThat(CHAMADAS.get()).isEqualTo(antes + 3);
    }

    private Conta novaConta() throws Exception {
        long id = jdbc.queryForObject("""
                INSERT INTO colaboradores (nome, email, cargo, departamento, criado_em)
                VALUES ('Pessoa Fictícia', ?, 'Analista', 'Educação', CURRENT_TIMESTAMP) RETURNING id
                """, Long.class, UUID.randomUUID() + "@example.com");
        String nome = "teste-" + UUID.randomUUID();
        String senha = UUID.randomUUID().toString();
        var cadastro = JSON.writeValueAsString(Map.of("nomeUsuario", nome, "senhaInicial", senha));
        assertThat(http.post(porta, "/api/colaboradores/" + id + "/conta", cadastro, admin(), http.obterCsrf(porta))
                .statusCode()).isEqualTo(201);
        return new Conta(id, conta(nome, senha));
    }

    private HttpResponse<String> post(String rota, String json, String credencial, SegurancaHttpTeste.TokenCsrf csrf)
            throws Exception {
        return http.post(porta, API + rota, json, credencial, csrf);
    }

    private static tools.jackson.databind.JsonNode corpo(HttpResponse<String> resposta) {
        assertThat(resposta.statusCode()).isEqualTo(200);
        assertThat(resposta.headers().firstValue("Cache-Control")).hasValue("no-store");
        return JSON.readTree(resposta.body());
    }

    private static void problema(HttpResponse<String> resposta, int status, String codigo) {
        assertThat(resposta.statusCode()).isEqualTo(status);
        assertThat(resposta.headers().firstValue("Cache-Control")).hasValueSatisfying(
                valor -> assertThat(valor).contains("no-store"));
        assertThat(resposta.headers().firstValue("Content-Type")).hasValueSatisfying(
                valor -> assertThat(valor).startsWith("application/problem+json"));
        assertThat(JSON.readTree(resposta.body()).get("codigo").asString()).isEqualTo(codigo);
    }

    private record Conta(long id, String credencial) {
    }

    private record Chamada(String autorizacao, String corpo) {
    }
}
