package br.edu.facens.afdevops;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import tools.jackson.databind.json.JsonMapper;

final class SegurancaHttpTeste {
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

    static String admin() {
        return basic(ADMIN.nome(), ADMIN.senha());
    }

    static String colaborador() {
        return basic(COLABORADOR.nome(), COLABORADOR.senha());
    }

    static String senhaErrada() {
        return basic(ADMIN.nome(), UUID.randomUUID().toString());
    }

    private static String basic(String nome, String senha) {
        return "Basic " + Base64.getEncoder()
                .encodeToString((nome + ":" + senha).getBytes(StandardCharsets.UTF_8));
    }

    HttpRequest.Builder request(int porta, String rota, String credencial) {
        var pedido = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + porta + rota))
                .timeout(Duration.ofSeconds(12));
        return credencial == null ? pedido : pedido.header("Authorization", credencial);
    }

    HttpResponse<String> enviar(HttpRequest pedido) throws Exception {
        return http.send(pedido, HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> get(int porta, String rota, String credencial) throws Exception {
        return enviar(request(porta, rota, credencial).GET().build());
    }

    TokenCsrf obterCsrf(int porta) throws Exception {
        var resposta = get(porta, "/api/csrf", admin());
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
        var pedido = request(porta, rota, credencial).header("Content-Type", "application/json");
        if (csrf != null) {
            pedido.header("Cookie", csrf.cookie()).header(csrf.cabecalho(), csrf.token());
        }
        return enviar(pedido.POST(HttpRequest.BodyPublishers.ofString(corpo)).build());
    }

    record TokenCsrf(String cookie, String cabecalho, String token) {
    }

    private record Conta(String nome, String senha) {
    }
}
