package br.edu.facens.afdevops.seguranca;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

import static org.assertj.core.api.Assertions.assertThat;

class TokenInternoFilterTests {

    private static final String ROTA = "/internal/treinamentos/{id}/status";

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void semTokenConfiguradoRotaDeStatusResponde503() throws Exception {
        var resposta = executar("", "PATCH", "/internal/treinamentos/1/status", "Bearer qualquer");
        assertThat(resposta.getStatus()).isEqualTo(503);
        assertThat(resposta.getContentAsString()).contains("AUTENTICACAO_INTERNA_INDISPONIVEL");
    }

    @Test
    void rotaForaDaListaResponde403MesmoSemToken() throws Exception {
        var resposta = executar("", "GET", "/internal/treinamentos", null);
        assertThat(resposta.getStatus()).isEqualTo(403);
        assertThat(resposta.getContentAsString()).contains("ACESSO_NEGADO");
    }

    @Test
    void tokenCorretoAutenticaServicoInterno() throws Exception {
        var cadeia = new MockFilterChain();
        executar("segredo", "PATCH", "/internal/treinamentos/1/status", "Bearer segredo", cadeia);
        assertThat(cadeia.getRequest()).isNotNull();
        var autenticacao = SecurityContextHolder.getContext().getAuthentication();
        assertThat(autenticacao).isNotNull();
        assertThat(autenticacao.getAuthorities()).extracting(Object::toString)
                .containsExactly("ROLE_" + SegurancaInternaConfig.PAPEL_SERVICO);
    }

    @Test
    void tokenIncorretoSegueSemAutenticacao() throws Exception {
        var cadeia = new MockFilterChain();
        executar("segredo", "PATCH", "/internal/treinamentos/1/status", "Bearer segred0", cadeia);
        assertThat(cadeia.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private static MockHttpServletResponse executar(String token, String metodo, String uri, String autorizacao)
            throws Exception {
        return executar(token, metodo, uri, autorizacao, new MockFilterChain());
    }

    private static MockHttpServletResponse executar(String token, String metodo, String uri, String autorizacao,
            MockFilterChain cadeia) throws Exception {
        var filtro = new SegurancaInternaConfig.TokenInternoFilter(token,
                PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.PATCH, ROTA),
                new SegurancaInternaConfig.RespostasInternas());
        var pedido = new MockHttpServletRequest(metodo, uri);
        if (autorizacao != null) {
            pedido.addHeader("Authorization", autorizacao);
        }
        var resposta = new MockHttpServletResponse();
        filtro.doFilter(pedido, resposta, cadeia);
        return resposta;
    }
}
