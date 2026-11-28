package br.edu.facens.afdevops;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import br.edu.facens.afdevops.identidade.ContaAutenticada;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import tools.jackson.databind.json.JsonMapper;

import static br.edu.facens.afdevops.SegurancaHttpTeste.CONTEXTO;
import static br.edu.facens.afdevops.SegurancaHttpTeste.COOKIE_SESSAO;
import static br.edu.facens.afdevops.SegurancaHttpTeste.admin;
import static br.edu.facens.afdevops.SegurancaHttpTeste.basic;
import static br.edu.facens.afdevops.SegurancaHttpTeste.colaborador;
import static br.edu.facens.afdevops.SegurancaHttpTeste.conta;
import static br.edu.facens.afdevops.SegurancaHttpTeste.nomeAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({AfdevopsApplicationTests.PostgresConfiguration.class, SessaoIntegrationTests.Sessoes.class})
class SessaoIntegrationTests {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String TOKEN_INTERNO = UUID.randomUUID().toString();
    private static final String CURSO = """
            {"nome":"Curso de sessão","descricao":"Fictício","cargaHoraria":1,"categoria":"Teste","nivel":"BASICO"}
            """;

    @LocalServerPort
    private int porta;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private Sessoes sessoes;

    @MockitoSpyBean
    private BCryptPasswordEncoder encoder;

    private final SegurancaHttpTeste http = new SegurancaHttpTeste();

    @DynamicPropertySource
    static void tokenInterno(DynamicPropertyRegistry registro) {
        registro.add("INTERNAL_API_TOKEN", () -> TOKEN_INTERNO);
    }

    @BeforeEach
    void limpar() {
        sessoes.criadas.clear();
    }

    @Test
    void loginCriaCookieProtegidoEContexto() throws Exception {
        var resposta = http.login(porta, admin(), null, anonimo());
        assertThat(resposta.statusCode()).isEqualTo(204);
        assertThat(resposta.body()).isEmpty();
        String cookie = resposta.headers().allValues("Set-Cookie").stream()
                .filter(valor -> valor.startsWith(COOKIE_SESSAO + "=")).findFirst().orElseThrow();
        assertThat(cookie).contains("HttpOnly", "SameSite=Strict", "Path=/")
                .doesNotContain("Secure", "Domain=", "Max-Age", "Expires");

        var me = comSessao("/api/me", cookie.split(";", 2)[0], null);
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(me.headers().firstValue(CONTEXTO)).isPresent();
        assertThat(sessoes.criadas).hasSize(1);
        assertThat(sessoes.criadas.get(0).getMaxInactiveInterval()).isEqualTo(30 * 60);
    }

    @Test
    void credenciaisInvalidasNaoCriamSessaoNemRevelamOMotivo() throws Exception {
        var corpos = new ArrayList<String>();
        for (String credencial : new String[] {conta(nomeAdmin(), "senha-incorreta"),
                conta("inexistente-" + UUID.randomUUID(), "senha-incorreta"), ":"}) {
            var resposta = http.login(porta, credencial, null, anonimo());
            problema(resposta, 401, "AUTENTICACAO_NECESSARIA");
            assertThat(SegurancaHttpTeste.cookie(resposta, COOKIE_SESSAO)).isEmpty();
            corpos.add(resposta.body());
        }
        assertThat(corpos).containsOnly(corpos.get(0));
        assertThat(sessoes.criadas).isEmpty();
    }

    @Test
    void loginExigeCsrfECredenciaisSomenteNoCorpo() throws Exception {
        var csrf = anonimo();
        var invalido = new SegurancaHttpTeste.TokenCsrf(csrf.cookie(), csrf.cabecalho(), UUID.randomUUID().toString());
        problema(http.login(porta, admin(), null, null), 403, "CSRF_INVALIDO");
        problema(http.login(porta, admin(), null, invalido), 403, "CSRF_INVALIDO");

        var naUrl = http.anonima(porta, "/api/login?username=" + nomeAdmin() + "&password=x")
                .header("Cookie", csrf.cookie()).header(csrf.cabecalho(), csrf.token())
                .POST(HttpRequest.BodyPublishers.noBody()).build();
        problema(http.enviar(naUrl), 400, "DADOS_INVALIDOS");
        assertThat(sessoes.criadas).isEmpty();
        verifyNoInteractions(encoder);
    }

    @Test
    void loginELogoutRenovamOCookieCsrf() throws Exception {
        var csrf = anonimo();
        var login = http.login(porta, admin(), null, csrf);
        assertThat(cookieCsrfSubstituido(login, csrf.cookie())).isTrue();

        var sessao = http.entrar(porta, admin(), null);
        var autenticado = csrfDa(sessao);
        var logout = sair(sessao, autenticado);
        assertThat(logout.statusCode()).isEqualTo(204);
        assertThat(cookieCsrfSubstituido(logout, autenticado.cookie())).isTrue();
    }

    @Test
    void endpointCsrfNaoCriaSessaoNemExpoeDados() throws Exception {
        var resposta = http.get(porta, "/api/csrf", null);
        assertThat(resposta.statusCode()).isEqualTo(200);
        assertThat(JSON.readTree(resposta.body()).propertyNames()).containsExactlyInAnyOrder("headerName", "token");
        assertThat(resposta.headers().firstValue(CONTEXTO)).isEmpty();
        http.get(porta, "/api/cursos", null);
        http.get(porta, "/actuator/health", null);
        assertThat(sessoes.criadas).isEmpty();
    }

    @Test
    void loginTrocaOIdentificadorDaSessaoENaoAdotaIdEscolhidoPeloCliente() throws Exception {
        var primeira = http.entrar(porta, admin(), null);
        var segunda = http.entrar(porta, admin(), primeira.cookie());
        assertThat(segunda.cookie()).isNotEqualTo(primeira.cookie());
        assertThat(segunda.contexto()).isNotEqualTo(primeira.contexto());
        problema(comSessao("/api/me", primeira.cookie(), null), 401, "AUTENTICACAO_NECESSARIA");

        String escolhido = COOKIE_SESSAO + "=0123456789ABCDEF0123456789ABCDEF";
        var terceira = http.entrar(porta, admin(), escolhido);
        assertThat(terceira.cookie()).isNotEqualTo(escolhido);
        problema(comSessao("/api/me", escolhido, null), 401, "AUTENTICACAO_NECESSARIA");
    }

    @Test
    void logoutInvalidaASessaoEOCookieNaoPodeSerReutilizado() throws Exception {
        var sessao = http.entrar(porta, admin(), null);
        var csrf = csrfDa(sessao);
        var semCsrf = http.anonima(porta, "/api/logout").header("Cookie", sessao.cookie())
                .header(CONTEXTO, sessao.contexto()).POST(HttpRequest.BodyPublishers.noBody()).build();
        problema(http.enviar(semCsrf), 403, "CSRF_INVALIDO");
        assertThat(usar(sessao).statusCode()).isEqualTo(200);

        var logout = sair(sessao, csrf);
        assertThat(logout.statusCode()).isEqualTo(204);
        assertThat(logout.headers().allValues("Set-Cookie"))
                .anyMatch(valor -> valor.startsWith(COOKIE_SESSAO + "=;") && valor.contains("01 Jan 1970"));
        problema(usar(sessao), 401, "AUTENTICACAO_NECESSARIA");
        problema(comSessao("/api/me", sessao.cookie(), null), 401, "AUTENTICACAO_NECESSARIA");
        // Repetir o logout de uma sessão já encerrada é inofensivo.
        assertThat(sair(sessao, anonimo()).statusCode()).isEqualTo(204);
    }

    @Test
    void contextoAusenteInvalidoOuAlheioERecusadoSemEfeitoESemEncerrarASessao() throws Exception {
        var sessao = http.entrar(porta, admin(), null);
        var outra = http.entrar(porta, admin(), null);
        var csrf = csrfDa(sessao);
        int cursos = jdbc.queryForObject("SELECT count(*) FROM cursos", Integer.class);

        for (String contexto : new String[] {null, "", "invalido", outra.contexto()}) {
            problema(comSessao("/api/cursos", sessao.cookie(), contexto), 401, "SESSAO_SUBSTITUIDA");
            var escrita = http.anonima(porta, "/api/cursos").header("Content-Type", "application/json")
                    .header("Cookie", sessao.cookie() + "; " + csrf.cookie()).header(csrf.cabecalho(), csrf.token());
            if (contexto != null) {
                escrita.header(CONTEXTO, contexto);
            }
            problema(http.enviar(escrita.POST(HttpRequest.BodyPublishers.ofString(CURSO)).build()),
                    401, "SESSAO_SUBSTITUIDA");
            problema(sair(new SegurancaHttpTeste.Sessao(sessao.cookie(), contexto), csrf),
                    401, "SESSAO_SUBSTITUIDA");
        }
        // Em /api/me só a ausência é tolerada; um valor errado continua recusado.
        problema(comSessao("/api/me", sessao.cookie(), outra.contexto()), 401, "SESSAO_SUBSTITUIDA");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM cursos", Integer.class)).isEqualTo(cursos);
        assertThat(usar(sessao).statusCode()).isEqualTo(200);
        // As exceções valem apenas para o método e o caminho declarados.
        assertThat(comSessao("/api/csrf", sessao.cookie(), null).statusCode()).isEqualTo(200);
        assertThat(comSessao("/actuator/health", sessao.cookie(), null).statusCode()).isEqualTo(200);
        problema(comSessao("/api/me/consentimento", sessao.cookie(), null), 401, "SESSAO_SUBSTITUIDA");
        var meHead = http.anonima(porta, "/api/me").header("Cookie", sessao.cookie())
                .method("HEAD", HttpRequest.BodyPublishers.noBody()).build();
        assertThat(http.enviar(meHead).statusCode()).isEqualTo(401);
    }

    @Test
    void trocaDeIdentidadeNoMesmoNavegadorNaoReaproveitaContextoNemPapeis() throws Exception {
        var antiga = http.entrar(porta, admin(), null);
        var nova = http.entrar(porta, colaborador(), antiga.cookie());
        var csrf = csrfDa(nova);

        // A aba antiga envia o cookie atual do navegador com o contexto que conhecia.
        var abaAntiga = new SegurancaHttpTeste.Sessao(nova.cookie(), antiga.contexto());
        problema(usar(abaAntiga), 401, "SESSAO_SUBSTITUIDA");
        problema(sair(abaAntiga, csrf), 401, "SESSAO_SUBSTITUIDA");
        problema(usar(antiga), 401, "AUTENTICACAO_NECESSARIA");

        assertThat(usar(nova).statusCode()).isEqualTo(200);
        problema(comSessao("/api/colaboradores", nova.cookie(), nova.contexto()), 403, "ACESSO_NEGADO");
    }

    @Test
    void loginFracassadoNaoConcedeNadaAlemDaSessaoExistente() throws Exception {
        var sessao = http.entrar(porta, colaborador(), null);
        problema(http.login(porta, conta(nomeAdmin(), "senha-incorreta"), sessao.cookie(), anonimo()),
                401, "AUTENTICACAO_NECESSARIA");
        problema(comSessao("/api/colaboradores", sessao.cookie(), sessao.contexto()), 403, "ACESSO_NEGADO");
    }

    @Test
    void requisicoesConcorrentesNuncaRecebemOutraIdentidade() throws Exception {
        var executor = Executors.newFixedThreadPool(8);
        try {
            for (int rodada = 0; rodada < 3; rodada++) {
                var antiga = http.entrar(porta, admin(), null);
                var cookieDoNavegador = new AtomicReference<>(antiga.cookie());
                var terminar = new AtomicBoolean();
                var iniciadas = new CountDownLatch(8);
                var respostas = new CopyOnWriteArrayList<HttpResponse<String>>();
                var abas = new ArrayList<Future<?>>();
                for (int i = 0; i < 8; i++) {
                    abas.add(executor.submit(() -> {
                        iniciadas.countDown();
                        while (!terminar.get()) {
                            respostas.add(comSessao("/api/me", cookieDoNavegador.get(), antiga.contexto()));
                        }
                        return null;
                    }));
                }
                assertThat(iniciadas.await(10, TimeUnit.SECONDS)).isTrue();
                var nova = http.entrar(porta, colaborador(), antiga.cookie());
                cookieDoNavegador.set(nova.cookie());
                var csrf = csrfDa(nova);
                assertThat(comSessao("/api/me", nova.cookie(), antiga.contexto()).statusCode()).isEqualTo(401);
                assertThat(sair(nova, csrf).statusCode()).isEqualTo(204);
                terminar.set(true);
                for (var aba : abas) {
                    aba.get(20, TimeUnit.SECONDS);
                }
                assertThat(respostas).isNotEmpty().allSatisfy(resposta -> {
                    assertThat(resposta.statusCode()).isIn(200, 401);
                    if (resposta.statusCode() == 200) {
                        assertThat(JSON.readTree(resposta.body()).get("nomeUsuario").asString()).isEqualTo(nomeAdmin());
                    }
                });
            }
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void basicNaoAutenticaNenhumaRotaPublica() throws Exception {
        String senha = UUID.randomUUID().toString();
        String individual = novaConta(senha);
        String cabecalho = basic(individual, senha);
        // Descarta a sessão do ADMIN usada somente para criar a conta.
        sessoes.criadas.clear();
        for (String rota : new String[] {"/api/me", "/api/cursos", "/api/me/consentimento"}) {
            problema(http.get(porta, rota, cabecalho), 401, "AUTENTICACAO_NECESSARIA");
        }
        var csrf = anonimo();
        problema(http.post(porta, "/api/ia/classificacoes", "{}", cabecalho, csrf), 401, "AUTENTICACAO_NECESSARIA");
        var login = http.anonima(porta, "/api/login").header("Authorization", cabecalho)
                .header("Cookie", csrf.cookie()).header(csrf.cabecalho(), csrf.token())
                .POST(HttpRequest.BodyPublishers.noBody()).build();
        problema(http.enviar(login), 401, "AUTENTICACAO_NECESSARIA");
        assertThat(sessoes.criadas).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/login", "/api/logout"})
    void consultaDasRotasDeLoginELogoutNaoEPermitida(String rota) throws Exception {
        problema(http.get(porta, rota, null), 401, "AUTENTICACAO_NECESSARIA");
        problema(http.get(porta, rota, admin()), 403, "ACESSO_NEGADO");
        assertThat(usar(http.sessao(porta, admin())).statusCode()).isEqualTo(200);
    }

    @Test
    void principalDaSessaoNaoGuardaSenhaNemHash() throws Exception {
        String senha = "senha-çã-" + UUID.randomUUID();
        String individual = novaConta(senha);
        sessoes.criadas.clear();
        // Duas entradas por conta: apagar o hash da sessão não pode afetar o login seguinte.
        for (String credencial : new String[] {conta(individual, senha), admin(), conta(individual, senha), admin()}) {
            http.entrar(porta, credencial, null);
        }
        assertThat(sessoes.criadas).hasSize(4).allSatisfy(sessao -> {
            var contexto = (SecurityContext) sessao.getAttribute("SPRING_SECURITY_CONTEXT");
            var autenticacao = contexto.getAuthentication();
            assertThat(autenticacao.getCredentials()).isNull();
            assertThat(((User) autenticacao.getPrincipal()).getPassword()).isNull();
        });
        assertThat(sessoes.criadas).anySatisfy(sessao -> assertThat(
                ((SecurityContext) sessao.getAttribute("SPRING_SECURITY_CONTEXT")).getAuthentication().getPrincipal())
                .isInstanceOf(ContaAutenticada.class));
    }

    @Test
    void sessaoExpiradaPorInatividadeERecusada() throws Exception {
        var sessao = http.entrar(porta, admin(), null);
        sessoes.criadas.get(0).setMaxInactiveInterval(1);
        Thread.sleep(2_100);
        problema(usar(sessao), 401, "AUTENTICACAO_NECESSARIA");
    }

    @Test
    void bcryptRodaNoLoginENaoNasOperacoesAutenticadas() throws Exception {
        String senha = UUID.randomUUID().toString();
        String individual = novaConta(senha);
        // Primeiro login qualquer: o provedor prepara uma única vez o hash usado contra enumeração.
        http.entrar(porta, admin(), null);
        clearInvocations(encoder);

        var sessao = http.entrar(porta, conta(individual, senha), null);
        verify(encoder, times(1)).matches(any(), any());
        clearInvocations(encoder);

        var csrf = csrfDa(sessao);
        var consentimento = http.anonima(porta, "/api/me/consentimento").header("Content-Type", "application/json")
                .header("Cookie", sessao.cookie() + "; " + csrf.cookie()).header(CONTEXTO, sessao.contexto())
                .header(csrf.cabecalho(), csrf.token())
                .PUT(HttpRequest.BodyPublishers.ofString("{\"autorizado\":true}")).build();
        assertThat(http.enviar(consentimento).statusCode()).isEqualTo(200);
        for (int i = 0; i < 20; i++) {
            csrfDa(sessao);
            assertThat(usar(sessao).statusCode()).isEqualTo(200);
            assertThat(comSessao("/api/me/consentimento", sessao.cookie(), sessao.contexto()).statusCode())
                    .isEqualTo(200);
        }
        assertThat(sair(sessao, csrf).statusCode()).isEqualTo(204);
        verifyNoInteractions(encoder);
    }

    @Test
    void sessaoNaoAcessaRotaInternaEBearerNaoAcessaApiPublica() throws Exception {
        var sessao = http.entrar(porta, admin(), null);
        var csrf = csrfDa(sessao);
        var interna = http.anonima(porta, "/internal/treinamentos/1/status").header("Content-Type", "application/json")
                .header("Cookie", sessao.cookie() + "; " + csrf.cookie()).header(CONTEXTO, sessao.contexto())
                .header(csrf.cabecalho(), csrf.token())
                .method("PATCH", HttpRequest.BodyPublishers.ofString("{\"status\":\"CONCLUIDO\"}")).build();
        // A cadeia interna mantém o próprio desafio Bearer, sem relação com a sessão do navegador.
        var recusada = http.enviar(interna);
        assertThat(recusada.statusCode()).isEqualTo(401);
        assertThat(recusada.headers().firstValue("WWW-Authenticate")).hasValue("Bearer");
        assertThat(JSON.readTree(recusada.body()).get("codigo").asString())
                .isEqualTo("AUTENTICACAO_INTERNA_NECESSARIA");
        problema(http.get(porta, "/api/cursos", "Bearer " + TOKEN_INTERNO), 401, "AUTENTICACAO_NECESSARIA");
    }

    private SegurancaHttpTeste.TokenCsrf anonimo() throws Exception {
        return http.obterCsrf(porta, (String) null);
    }

    private SegurancaHttpTeste.TokenCsrf csrfDa(SegurancaHttpTeste.Sessao sessao) throws Exception {
        var resposta = comSessao("/api/csrf", sessao.cookie(), sessao.contexto());
        assertThat(resposta.statusCode()).isEqualTo(200);
        var corpo = JSON.readTree(resposta.body());
        return new SegurancaHttpTeste.TokenCsrf(SegurancaHttpTeste.cookie(resposta, "XSRF-TOKEN").orElseThrow(),
                corpo.get("headerName").asString(), corpo.get("token").asString());
    }

    private HttpResponse<String> comSessao(String rota, String cookie, String contexto) throws Exception {
        var pedido = http.anonima(porta, rota).header("Cookie", cookie);
        if (contexto != null) {
            pedido.header(CONTEXTO, contexto);
        }
        return http.enviar(pedido.GET().build());
    }

    private HttpResponse<String> usar(SegurancaHttpTeste.Sessao sessao) throws Exception {
        return comSessao("/api/cursos", sessao.cookie(), sessao.contexto());
    }

    private HttpResponse<String> sair(SegurancaHttpTeste.Sessao sessao, SegurancaHttpTeste.TokenCsrf csrf)
            throws Exception {
        var pedido = http.anonima(porta, "/api/logout")
                .header("Cookie", sessao.cookie() + "; " + csrf.cookie()).header(csrf.cabecalho(), csrf.token());
        if (sessao.contexto() != null) {
            pedido.header(CONTEXTO, sessao.contexto());
        }
        return http.enviar(pedido.POST(HttpRequest.BodyPublishers.noBody()).build());
    }

    private static boolean cookieCsrfSubstituido(HttpResponse<String> resposta, String anterior) {
        return resposta.headers().allValues("Set-Cookie").stream()
                .filter(valor -> valor.startsWith("XSRF-TOKEN="))
                .anyMatch(valor -> !valor.split(";", 2)[0].equals(anterior));
    }

    private String novaConta(String senha) throws Exception {
        long id = jdbc.queryForObject("""
                INSERT INTO colaboradores (nome, email, cargo, departamento, criado_em)
                VALUES ('Pessoa Fictícia', ?, 'Analista', 'Educação', CURRENT_TIMESTAMP) RETURNING id
                """, Long.class, UUID.randomUUID() + "@example.com");
        String nome = "sessao-" + UUID.randomUUID();
        var corpo = JSON.writeValueAsString(Map.of("nomeUsuario", nome, "senhaInicial", senha));
        assertThat(http.post(porta, "/api/colaboradores/" + id + "/conta", corpo, admin(), http.obterCsrf(porta))
                .statusCode()).isEqualTo(201);
        return nome;
    }

    private static void problema(HttpResponse<String> resposta, int status, String codigo) {
        assertThat(resposta.statusCode()).isEqualTo(status);
        assertThat(resposta.headers().firstValue("Content-Type"))
                .hasValueSatisfying(tipo -> assertThat(tipo).startsWith("application/problem+json"));
        assertThat(resposta.headers().firstValue("WWW-Authenticate")).isEmpty();
        assertThat(JSON.readTree(resposta.body()).get("codigo").asString()).isEqualTo(codigo);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class Sessoes implements HttpSessionListener {
        final List<HttpSession> criadas = new CopyOnWriteArrayList<>();

        @Bean
        HttpSessionListener observadorDeSessoes() {
            return new HttpSessionListener() {
                @Override
                public void sessionCreated(HttpSessionEvent evento) {
                    criadas.add(evento.getSession());
                }
            };
        }
    }
}
