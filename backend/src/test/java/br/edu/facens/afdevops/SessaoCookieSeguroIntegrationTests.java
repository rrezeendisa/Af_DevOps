package br.edu.facens.afdevops;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

import static br.edu.facens.afdevops.SegurancaHttpTeste.admin;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "SESSION_COOKIE_SECURE=true")
@Import(AfdevopsApplicationTests.PostgresConfiguration.class)
class SessaoCookieSeguroIntegrationTests {
    @LocalServerPort
    private int porta;

    private final SegurancaHttpTeste http = new SegurancaHttpTeste();

    @Test
    void cookiesDeSessaoECsrfRecebemSecure() throws Exception {
        var csrf = http.get(porta, "/api/csrf", null);
        assertThat(csrf.headers().allValues("Set-Cookie")).singleElement().asString()
                .contains("XSRF-TOKEN=", "Secure", "HttpOnly", "SameSite=Strict");

        var login = http.login(porta, admin(), null, http.obterCsrf(porta, (String) null));
        assertThat(login.statusCode()).isEqualTo(204);
        assertThat(login.headers().allValues("Set-Cookie"))
                .anySatisfy(valor -> assertThat(valor).startsWith("EVOLIA_SESSAO=")
                        .contains("Secure", "HttpOnly", "SameSite=Strict"));
    }
}
