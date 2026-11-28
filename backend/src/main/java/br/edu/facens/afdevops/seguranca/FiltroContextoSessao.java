package br.edu.facens.afdevops.seguranca;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import br.edu.facens.afdevops.identidade.ContextoSessao;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Exige, em toda requisição autenticada, o contexto do mesmo objeto de autenticação que a autorização
 * usará. Roda depois do CSRF e antes do logout. Não encerra a sessão ao recusar.
 */
final class FiltroContextoSessao extends OncePerRequestFilter {
    private final ErrosSeguranca erros;
    private final RequestMatcher login;
    private final RequestMatcher identidade;
    private final RequestMatcher isentas;

    FiltroContextoSessao(ErrosSeguranca erros) {
        var rotas = PathPatternRequestMatcher.withDefaults();
        this.erros = erros;
        this.login = rotas.matcher(HttpMethod.POST, "/api/login");
        this.identidade = rotas.matcher(HttpMethod.GET, "/api/me");
        this.isentas = new OrRequestMatcher(login, rotas.matcher(HttpMethod.GET, "/api/csrf"),
                rotas.matcher(HttpMethod.GET, "/actuator/health"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest pedido, HttpServletResponse resposta, FilterChain cadeia)
            throws ServletException, IOException {
        // Credenciais na URL acabariam em registros de acesso: o login só aceita o corpo.
        if (login.matches(pedido) && pedido.getQueryString() != null) {
            erros.loginInvalido(resposta);
            return;
        }
        if (!isentas.matches(pedido) && !contextoConfere(pedido)) {
            erros.sessaoSubstituida(resposta);
            return;
        }
        cadeia.doFilter(pedido, resposta);
    }

    private boolean contextoConfere(HttpServletRequest pedido) {
        var autenticacao = SecurityContextHolder.getContextHolderStrategy().getContext().getAuthentication();
        if (autenticacao == null) {
            // Anônimo: a autorização decide.
            return true;
        }
        String informado = pedido.getHeader(ContextoSessao.CABECALHO);
        // Depois de recarregar a página, o cliente ainda não conhece o contexto e o obtém em /api/me.
        if (informado == null && identidade.matches(pedido)) {
            return true;
        }
        return informado != null && autenticacao.getDetails() instanceof ContextoSessao contexto
                && MessageDigest.isEqual(contexto.id().getBytes(StandardCharsets.UTF_8),
                        informado.getBytes(StandardCharsets.UTF_8));
    }
}
