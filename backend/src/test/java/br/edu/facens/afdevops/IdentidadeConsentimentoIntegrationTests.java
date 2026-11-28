package br.edu.facens.afdevops;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import br.edu.facens.afdevops.consentimento.ConsentimentoService;
import br.edu.facens.afdevops.identidade.ContasIndividuais;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.json.JsonMapper;

import static br.edu.facens.afdevops.SegurancaHttpTeste.admin;
import static br.edu.facens.afdevops.SegurancaHttpTeste.basic;
import static br.edu.facens.afdevops.SegurancaHttpTeste.colaborador;
import static br.edu.facens.afdevops.SegurancaHttpTeste.conta;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(AfdevopsApplicationTests.PostgresConfiguration.class)
class IdentidadeConsentimentoIntegrationTests {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String CONSENTIMENTO = "/api/me/consentimento";
    private static final String TOKEN_INTERNO = UUID.randomUUID().toString();

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private ConsentimentoService consentimentos;

    @Autowired
    private ContasIndividuais contas;

    @LocalServerPort
    private int porta;

    private final SegurancaHttpTeste http = new SegurancaHttpTeste();

    @DynamicPropertySource
    static void tokenInterno(DynamicPropertyRegistry registro) {
        registro.add("INTERNAL_API_TOKEN", () -> TOKEN_INTERNO);
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void adminCriaContaEColaboradorAutenticaSemExporSenha(CapturedOutput saida) throws Exception {
        long id = novoColaborador();
        String nome = novoNome();
        String senha = "á".repeat(36);
        var criada = criar(id, nome.toUpperCase(Locale.ROOT), senha);
        assertThat(criada.statusCode()).isEqualTo(201);
        var corpo = JSON.readTree(criada.body());
        assertThat(corpo.get("id").asLong()).isPositive();
        assertThat(corpo.get("nomeUsuario").asString()).isEqualTo(nome);
        assertThat(corpo.get("colaboradorId").asLong()).isEqualTo(id);
        assertThat(corpo.get("perfil").asString()).isEqualTo("COLABORADOR");
        assertThat(corpo.get("criadoEm").asString()).isNotBlank();

        String hash = jdbc.queryForObject("SELECT senha_hash FROM contas_colaborador WHERE colaborador_id = ?",
                String.class, id);
        assertThat(encoder.matches(senha, hash)).isTrue();

        var me = http.get(porta, "/api/me", conta(nome.toUpperCase(Locale.ROOT), senha));
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(me.headers().firstValue("Cache-Control")).hasValue("no-store");
        var identidade = JSON.readTree(me.body());
        assertThat(identidade.size()).isEqualTo(3);
        assertThat(identidade.get("nomeUsuario").asString()).isEqualTo(nome);
        assertThat(identidade.get("colaboradorId").asLong()).isEqualTo(id);
        assertThat(identidade.get("perfil").asString()).isEqualTo("COLABORADOR");
        problema(http.login(porta, conta(nome, UUID.randomUUID().toString()), null,
                http.obterCsrf(porta, (String) null)), 401, "AUTENTICACAO_NECESSARIA");
        problema(http.get(porta, "/api/me", basic(nome, senha)), 401, "AUTENTICACAO_NECESSARIA");
        assertThat(http.get(porta, "/api/treinamentos", conta(nome, senha)).statusCode()).isEqualTo(403);
        var chamadaInterna = http.request(porta, "/internal/treinamentos/1/status", basic(nome, senha))
                .method("PATCH", HttpRequest.BodyPublishers.noBody()).build();
        problema(http.enviar(chamadaInterna), 401, "AUTENTICACAO_INTERNA_NECESSARIA");
        assertThat((criada.body() + me.body() + saida.getAll()).contains(senha)).isFalse();
        assertThat((criada.body() + me.body() + saida.getAll()).contains(hash)).isFalse();
    }

    @Test
    void contaGenericaNaoTemVinculoEAutenticacaoEObrigatoria() throws Exception {
        for (var entrada : Map.of(admin(), "ADMIN", colaborador(), "COLABORADOR").entrySet()) {
            var resposta = http.get(porta, "/api/me", entrada.getKey());
            assertThat(resposta.statusCode()).isEqualTo(200);
            var identidade = JSON.readTree(resposta.body());
            assertThat(identidade.size()).isEqualTo(2);
            assertThat(identidade.get("perfil").asString()).isEqualTo(entrada.getValue());
        }
        problema(http.get(porta, "/api/me", null), 401, "AUTENTICACAO_NECESSARIA");
    }

    @Test
    void recusaColaboradorInexistenteEConflitosDeConta() throws Exception {
        String nome = novoNome();
        String senha = UUID.randomUUID().toString();
        problema(criar(Long.MAX_VALUE, nome, senha), 404, "COLABORADOR_NAO_ENCONTRADO");
        long id = novoColaborador();
        long outroId = novoColaborador();
        assertThat(criar(id, nome, senha).statusCode()).isEqualTo(201);
        problema(criar(id, novoNome(), senha), 409, "CONTA_DUPLICADA");
        problema(criar(outroId, nome.toUpperCase(Locale.ROOT), senha), 409, "NOME_USUARIO_INDISPONIVEL");
        problema(criar(outroId, SegurancaHttpTeste.nomeColaboradorDemonstracao().toUpperCase(Locale.ROOT), senha),
                409, "NOME_USUARIO_INDISPONIVEL");
        assertThatThrownBy(() -> contas.verificarNomesDeDemonstracao(nome.toUpperCase(Locale.ROOT)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("A configuração de demonstração conflita com uma conta individual.");
    }

    @Test
    void concorrenciaPreservaNomeDeUsuarioUnico() throws Exception {
        String nome = novoNome();
        String senha = UUID.randomUUID().toString();
        long primeiroId = novoColaborador();
        long segundoId = novoColaborador();
        var inicio = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        var csrf = http.obterCsrf(porta);
        try {
            var primeiro = executor.submit(() -> {
                inicio.await();
                return http.post(porta, rotaConta(primeiroId), dadosConta(nome, senha), admin(), csrf);
            });
            var segundo = executor.submit(() -> {
                inicio.await();
                return http.post(porta, rotaConta(segundoId), dadosConta(nome.toUpperCase(Locale.ROOT), senha),
                        admin(), csrf);
            });
            inicio.countDown();
            var resposta1 = primeiro.get(20, TimeUnit.SECONDS);
            var resposta2 = segundo.get(20, TimeUnit.SECONDS);
            assertThat(new int[] {resposta1.statusCode(), resposta2.statusCode()}).containsExactlyInAnyOrder(201, 409);
            problema(resposta1.statusCode() == 409 ? resposta1 : resposta2, 409, "NOME_USUARIO_INDISPONIVEL");
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    @ExtendWith(OutputCaptureExtension.class)
    void recusaSenhaInvalidaEProtegeCriacaoComCsrfEPerfil(CapturedOutput saida) throws Exception {
        long id = novoColaborador();
        String nome = novoNome();
        String senha = UUID.randomUUID().toString();
        for (String invalida : new String[] {"curta", " ".repeat(12), "á".repeat(37), senha + (char) 0}) {
            problema(criar(id, nome, invalida), 400, "DADOS_INVALIDOS");
        }
        var jsonInvalido = "{\"nomeUsuario\":\"" + nome + "\",\"senhaInicial\":\"" + senha + "\",}";
        var csrfAdmin = http.obterCsrf(porta);
        var resposta = http.post(porta, rotaConta(id), jsonInvalido, admin(), csrfAdmin);
        problema(resposta, 400, "DADOS_INVALIDOS");
        assertThat((resposta.body() + saida.getAll()).contains(senha)).isFalse();
        problema(http.post(porta, rotaConta(id), dadosConta(nome, senha), admin(), null),
                403, "CSRF_INVALIDO");
        problema(http.post(porta, rotaConta(id), dadosConta(nome, senha), colaborador(),
                http.obterCsrf(porta, colaborador())), 403, "ACESSO_NEGADO");
    }

    @Test
    void decideRevogaEPersisteSomenteParaOColaboradorAutenticado() throws Exception {
        long id = novoColaborador();
        long outroId = novoColaborador();
        String credencial = novaCredencial(id);
        String outraCredencial = novaCredencial(outroId);
        var inicial = http.get(porta, CONSENTIMENTO, credencial);
        verificarDecisao(inicial, false, null);
        assertThat(consentimentos.autorizadoParaIa(id)).isFalse();

        var csrf = http.obterCsrf(porta, credencial);
        problema(http.put(porta, CONSENTIMENTO, "{\"autorizado\":true}", credencial, null),
                403, "CSRF_INVALIDO");
        problema(http.put(porta, CONSENTIMENTO, "{\"autorizado\":true,\"colaboradorId\":" + outroId + "}",
                credencial, csrf), 400, "DADOS_INVALIDOS");

        var concedida = http.put(porta, CONSENTIMENTO, "{\"autorizado\":true}", credencial, csrf);
        assertThat(concedida.statusCode()).isEqualTo(200);
        Instant concedidoEm = Instant.parse(JSON.readTree(concedida.body()).get("decididoEm").asString());
        verificarDecisao(concedida, true, concedidoEm);
        verificarDecisao(http.get(porta, CONSENTIMENTO, credencial), true, concedidoEm);
        verificarDecisao(http.get(porta, CONSENTIMENTO, outraCredencial), false, null);
        assertThat(consentimentos.autorizadoParaIa(id)).isTrue();
        assertThat(consentimentos.autorizadoParaIa(outroId)).isFalse();

        var revogada = http.put(porta, CONSENTIMENTO, "{\"autorizado\":false}", credencial, csrf);
        assertThat(revogada.statusCode()).isEqualTo(200);
        Instant revogadoEm = Instant.parse(JSON.readTree(revogada.body()).get("decididoEm").asString());
        assertThat(revogadoEm).isAfter(concedidoEm);
        verificarDecisao(revogada, false, revogadoEm);
        verificarDecisao(http.get(porta, CONSENTIMENTO, credencial), false, revogadoEm);
        assertThat(consentimentos.autorizadoParaIa(id)).isFalse();
        assertThat(jdbc.queryForObject("SELECT decidido_em FROM consentimentos_ia WHERE colaborador_id = ?",
                OffsetDateTime.class, id).toInstant()).isEqualTo(revogadoEm);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"autorizado\":null}", "{\"autorizado\":1}", "{\"autorizado\":\"true\"}",
            "{\"autorizado\":true,\"autorizado\":false}", "{\"autorizado\":true,\"outro\":0}",
            "{\"autorizado\":", "{\"autorizado\":true} {}", "true"})
    void recusaJsonDeConsentimentoInvalido(String corpo) throws Exception {
        long id = novoColaborador();
        String credencial = novaCredencial(id);
        problema(http.put(porta, CONSENTIMENTO, corpo, credencial, http.obterCsrf(porta, credencial)),
                400, "DADOS_INVALIDOS");
        verificarDecisao(http.get(porta, CONSENTIMENTO, credencial), false, null);
    }

    @Test
    void contasDemonstrativasNaoPodemConsultarNemDecidirConsentimento() throws Exception {
        for (String credencial : new String[] {admin(), colaborador()}) {
            var csrf = http.obterCsrf(porta, credencial);
            problema(http.get(porta, CONSENTIMENTO, credencial), 403, "ACESSO_NEGADO");
            problema(http.put(porta, CONSENTIMENTO, "{\"autorizado\":true}", credencial, csrf),
                    403, "ACESSO_NEGADO");
        }
        problema(http.get(porta, CONSENTIMENTO, null), 401, "AUTENTICACAO_NECESSARIA");
    }

    private static void verificarDecisao(HttpResponse<String> resposta, boolean autorizado, Instant decididoEm) {
        assertThat(resposta.statusCode()).isEqualTo(200);
        assertThat(resposta.headers().firstValue("Cache-Control")).hasValue("no-store");
        var corpo = JSON.readTree(resposta.body());
        assertThat(corpo.get("autorizado").asBoolean()).isEqualTo(autorizado);
        if (decididoEm == null) {
            assertThat(corpo.get("decididoEm").isNull()).isTrue();
        } else {
            assertThat(Instant.parse(corpo.get("decididoEm").asString())).isEqualTo(decididoEm);
        }
    }

    private static void problema(HttpResponse<String> resposta, int status, String codigo) {
        assertThat(resposta.statusCode()).isEqualTo(status);
        assertThat(resposta.headers().firstValue("Content-Type"))
                .hasValueSatisfying(tipo -> assertThat(tipo).startsWith("application/problem+json"));
        assertThat(JSON.readTree(resposta.body()).get("codigo").asString()).isEqualTo(codigo);
    }

    private String novaCredencial(long id) throws Exception {
        String nome = novoNome();
        String senha = UUID.randomUUID().toString();
        assertThat(criar(id, nome, senha).statusCode()).isEqualTo(201);
        return conta(nome, senha);
    }

    private HttpResponse<String> criar(long id, String nome, String senha) throws Exception {
        return http.post(porta, rotaConta(id), dadosConta(nome, senha), admin(), http.obterCsrf(porta));
    }

    private static String rotaConta(long id) {
        return "/api/colaboradores/" + id + "/conta";
    }

    private static String dadosConta(String nome, String senha) {
        return JSON.writeValueAsString(Map.of("nomeUsuario", nome, "senhaInicial", senha));
    }

    private static String novoNome() {
        return "usuario-" + UUID.randomUUID();
    }

    private long novoColaborador() {
        return jdbc.queryForObject("""
                INSERT INTO colaboradores (nome, email, cargo, departamento, criado_em)
                VALUES ('Pessoa Fictícia', ?, 'Analista', 'Educação', CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, UUID.randomUUID() + "@example.com");
    }
}
