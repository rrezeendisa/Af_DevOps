package br.edu.facens.afdevops;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.stream.Collectors;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Optional;
import java.util.Objects;
import java.util.Map;
import java.net.URLEncoder;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import tools.jackson.databind.json.JsonMapper;

final class SegurancaHttpTeste {
    static final String COOKIE_SESSAO = "EVOLIA_SESSAO";
    static final String CONTEXTO = "X-Evolia-Contexto";
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final BCryptPasswordEncoder BCRYPT = new BCryptPasswordEncoder(12);
    private static final Conta ADMIN = new Conta("admin-" + UUID.randomUUID(), UUID.randomUUID().toString());
    private static final Conta COLABORADOR = new Conta("colab-" + UUID.randomUUID(), UUID.randomUUID().toString());
    private static final String HASH_ADMIN = BCRYPT.encode(ADMIN.senha());
    private static final String HASH_COLABORADOR = BCRYPT.encode(COLABORADOR.senha());
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    static void propriedades(DynamicPropertyRegistry registro) {
        registro.add("AFDEVOPS_ADMIN_USERNAME", ADMIN::nome);
        registro.add("AFDEVOPS_ADMIN_PASSWORD_HASH", () -> HASH_ADMIN);
        registro.add("AFDEVOPS_COLABORADOR_USERNAME", COLABORADOR::nome);
        registro.add("AFDEVOPS_COLABORADOR_PASSWORD_HASH", () -> HASH_COLABORADOR);
        registro.add("SERVER_ADDRESS", () -> "127.0.0.1");
    }

    // Uma credencial "nome:senha" significa entrar pelo /api/login e reutilizar a sessão.
    // "Basic ..." e "Bearer ..." são enviados como cabeçalho Authorization, sem login.
    private final Map<String, Sessao> sessoes = new ConcurrentHashMap<>();

    static String admin() {
        return conta(ADMIN.nome(), ADMIN.senha());
    }

    static String colaborador() {
        return conta(COLABORADOR.nome(), COLABORADOR.senha());
    }

    static String conta(String nome, String senha) {
        return nome + ":" + senha;
    }

    static String senha(String credencial) {
        return credencial.substring(credencial.indexOf(':') + 1);
    }

    static String nomeColaboradorDemonstracao() {
        return COLABORADOR.nome();
    }

    static String nomeAdmin() {
        return ADMIN.nome();
    }

    static String basic(String nome, String senha) {
        return "Basic " + Base64.getEncoder()
                .encodeToString((nome + ":" + senha).getBytes(StandardCharsets.UTF_8));
    }

    HttpRequest.Builder request(int porta, String rota, String credencial) {
        var pedido = anonima(porta, rota);
        if (credencial == null) {
            return pedido;
        }
        if (credencial.startsWith("Basic ") || credencial.startsWith("Bearer ")) {
            return pedido.header("Authorization", credencial);
        }
        var sessao = sessao(porta, credencial);
        return pedido.header("Cookie", sessao.cookie()).header(CONTEXTO, sessao.contexto());
    }

    HttpRequest.Builder anonima(int porta, String rota) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + porta + rota))
                .timeout(Duration.ofSeconds(12));
    }

    /** Sessão reutilizada. Falha imediatamente se o login não funcionar. */
    Sessao sessao(int porta, String credencial) {
        return sessoes.computeIfAbsent(porta + " " + credencial, chave -> {
            try {
                return entrar(porta, credencial, null);
            } catch (Exception erro) {
                throw new AssertionError("Falha ao entrar na sessão de teste", erro);
            }
        });
    }

    /** Login completo, opcionalmente enviando um cookie de sessão já existente. */
    Sessao entrar(int porta, String credencial, String cookieAnterior) throws Exception {
        var resposta = login(porta, credencial, cookieAnterior, obterCsrf(porta, (String) null));
        if (resposta.statusCode() != 204) {
            throw new AssertionError("Esperado HTTP 204 no login, recebido " + resposta.statusCode());
        }
        String cookie = cookie(resposta, COOKIE_SESSAO)
                .orElseThrow(() -> new AssertionError("Cookie de sessão ausente"));
        var identidade = enviar(anonima(porta, "/api/me").header("Cookie", cookie).GET().build());
        if (identidade.statusCode() != 200) {
            throw new AssertionError("Esperado HTTP 200 em /api/me, recebido " + identidade.statusCode());
        }
        return new Sessao(cookie, identidade.headers().firstValue(CONTEXTO)
                .orElseThrow(() -> new AssertionError("Contexto da sessão ausente")));
    }

    /** POST /api/login sem verificar o resultado. */
    HttpResponse<String> login(int porta, String credencial, String cookieAnterior, TokenCsrf csrf)
            throws Exception {
        int separador = credencial.indexOf(':');
        String corpo = "username=" + codificar(credencial.substring(0, separador))
                + "&password=" + codificar(credencial.substring(separador + 1));
        var pedido = anonima(porta, "/api/login").header("Content-Type", "application/x-www-form-urlencoded");
        comCookies(pedido, cookieAnterior, csrf);
        return enviar(pedido.POST(HttpRequest.BodyPublishers.ofString(corpo)).build());
    }

    static Optional<String> cookie(HttpResponse<String> resposta, String nome) {
        return resposta.headers().allValues("Set-Cookie").stream()
                .map(valor -> valor.split(";", 2)[0])
                .filter(valor -> valor.startsWith(nome + "=") && !valor.equals(nome + "="))
                .findFirst();
    }

    private static void comCookies(HttpRequest.Builder pedido, String cookieSessao, TokenCsrf csrf) {
        var cookies = Stream.of(cookieSessao, csrf == null ? null : csrf.cookie())
                .filter(Objects::nonNull).collect(Collectors.joining("; "));
        if (!cookies.isEmpty()) {
            pedido.setHeader("Cookie", cookies);
        }
        if (csrf != null) {
            pedido.header(csrf.cabecalho(), csrf.token());
        }
    }

    private static String codificar(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }

    HttpResponse<String> enviar(HttpRequest pedido) throws Exception {
        return http.send(pedido, HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> get(int porta, String rota, String credencial) throws Exception {
        return enviar(request(porta, rota, credencial).GET().build());
    }

    /** Obtém o token com a sessão do ADMIN, como as telas autenticadas fazem. */
    TokenCsrf obterCsrf(int porta) throws Exception {
        return obterCsrf(porta, admin());
    }

    TokenCsrf obterCsrf(int porta, String credencial) throws Exception {
        var resposta = get(porta, "/api/csrf", credencial);
        if (resposta.statusCode() != 200) {
            throw new AssertionError("Esperado HTTP 200 em /api/csrf, recebido " + resposta.statusCode());
        }
        String cookie = resposta.headers().allValues("Set-Cookie").stream()
                .map(valor -> valor.split(";", 2)[0])
                .filter(valor -> valor.startsWith("XSRF-TOKEN="))
                .findFirst().orElseThrow(() -> new AssertionError("Cookie CSRF ausente"));
        var corpo = JSON.readTree(resposta.body());
        return new TokenCsrf(cookie, corpo.get("headerName").asString(), corpo.get("token").asString());
    }

    HttpResponse<String> post(int porta, String rota, String corpo, String credencial, TokenCsrf csrf)
            throws Exception {
        return escrever("POST", porta, rota, corpo, credencial, csrf);
    }

    HttpResponse<String> put(int porta, String rota, String corpo, String credencial, TokenCsrf csrf)
            throws Exception {
        return escrever("PUT", porta, rota, corpo, credencial, csrf);
    }

    private HttpResponse<String> escrever(String metodo, int porta, String rota, String corpo, String credencial,
            TokenCsrf csrf) throws Exception {
        var pedido = request(porta, rota, credencial).header("Content-Type", "application/json");
        boolean comSessao = credencial != null && !credencial.startsWith("Basic ")
                && !credencial.startsWith("Bearer ");
        comCookies(pedido, comSessao ? sessao(porta, credencial).cookie() : null, csrf);
        return enviar(pedido.method(metodo, HttpRequest.BodyPublishers.ofString(corpo)).build());
    }

    record Sessao(String cookie, String contexto) {
    }

    record TokenCsrf(String cookie, String cabecalho, String token) {
    }

    private record Conta(String nome, String senha) {
    }
}
