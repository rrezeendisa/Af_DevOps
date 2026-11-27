package br.edu.facens.afdevops.seguranca;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Cadeia de segurança das rotas chamadas apenas por outros serviços
 * (/internal/**), como o worker de IA atualizando o status do treinamento.
 *
 * <p>Autenticação por {@code Authorization: Bearer <INTERNAL_API_TOKEN>},
 * o mesmo segredo usado pelo ai-service. Sem token configurado as rotas
 * respondem 503, espelhando o comportamento do serviço Python. As rotas
 * internas não usam cookies, por isso o CSRF não se aplica a elas.
 */
@Configuration(proxyBeanMethods = false)
class SegurancaInternaConfig {

    static final String PAPEL_SERVICO = "SERVICO_INTERNO";
    private static final String VARIAVEL_TOKEN = "INTERNAL_API_TOKEN";
    private static final String ROTA_STATUS = "/internal/treinamentos/{id}/status";

    @Bean
    @Order(1)
    SecurityFilterChain cadeiaInterna(HttpSecurity http, Environment ambiente) throws Exception {
        var token = ambiente.getProperty(VARIAVEL_TOKEN, "").strip();
        var respostas = new RespostasInternas();
        var rotaStatus = PathPatternRequestMatcher.withDefaults()
                .matcher(HttpMethod.PATCH, ROTA_STATUS);

        return http
                .securityMatcher("/internal/**")
                .sessionManagement(sessao -> sessao.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .csrf(AbstractHttpConfigurer::disable)
                .addFilterBefore(new TokenInternoFilter(token, rotaStatus, respostas), AuthorizationFilter.class)
                .exceptionHandling(excecoes -> excecoes
                        .authenticationEntryPoint((pedido, resposta, erro) -> respostas.naoAutenticado(resposta))
                        .accessDeniedHandler((pedido, resposta, erro) -> respostas.acessoNegado(resposta)))
                .authorizeHttpRequests(autorizar -> autorizar
                        .requestMatchers(rotaStatus).hasRole(PAPEL_SERVICO)
                        .anyRequest().denyAll())
                .build();
    }

    static final class TokenInternoFilter extends OncePerRequestFilter {
        private final byte[] esperado;
        private final RequestMatcher rotaPermitida;
        private final RespostasInternas respostas;

        TokenInternoFilter(String token, RequestMatcher rotaPermitida, RespostasInternas respostas) {
            this.esperado = token.isEmpty() ? null : ("Bearer " + token).getBytes(StandardCharsets.UTF_8);
            this.rotaPermitida = rotaPermitida;
            this.respostas = respostas;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest pedido, HttpServletResponse resposta, FilterChain cadeia)
                throws ServletException, IOException {
            // Caminhos e métodos fora da lista são negados como no restante da API.
            if (!rotaPermitida.matches(pedido)) {
                respostas.acessoNegado(resposta);
                return;
            }
            if (esperado == null) {
                respostas.naoConfigurado(resposta);
                return;
            }
            String cabecalho = pedido.getHeader(HttpHeaders.AUTHORIZATION);
            if (cabecalho != null
                    && MessageDigest.isEqual(esperado, cabecalho.getBytes(StandardCharsets.UTF_8))) {
                var contexto = SecurityContextHolder.getContextHolderStrategy().createEmptyContext();
                contexto.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                        "servico-interno", null, List.of(new SimpleGrantedAuthority("ROLE_" + PAPEL_SERVICO))));
                SecurityContextHolder.getContextHolderStrategy().setContext(contexto);
            }
            cadeia.doFilter(pedido, resposta);
        }
    }

    static final class RespostasInternas {
        private final JacksonJsonHttpMessageConverter json = new JacksonJsonHttpMessageConverter();

        void naoAutenticado(HttpServletResponse resposta) throws IOException {
            resposta.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
            escrever(resposta, HttpStatus.UNAUTHORIZED, "Autenticação interna necessária",
                    "Informe o token interno válido para acessar este recurso.", "AUTENTICACAO_INTERNA_NECESSARIA");
        }

        void acessoNegado(HttpServletResponse resposta) throws IOException {
            escrever(resposta, HttpStatus.FORBIDDEN, "Acesso negado",
                    "Esta rota interna não está disponível.", "ACESSO_NEGADO");
        }

        void naoConfigurado(HttpServletResponse resposta) throws IOException {
            escrever(resposta, HttpStatus.SERVICE_UNAVAILABLE, "Autenticação interna não configurada",
                    "A autenticação entre serviços ainda não foi configurada.", "AUTENTICACAO_INTERNA_INDISPONIVEL");
        }

        private void escrever(HttpServletResponse resposta, HttpStatus status, String titulo, String detalhe,
                String codigo) throws IOException {
            var problema = ProblemDetail.forStatusAndDetail(status, detalhe);
            problema.setTitle(titulo);
            problema.setProperty("codigo", codigo);
            resposta.setStatus(status.value());
            resposta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
            json.write(problema, MediaType.APPLICATION_PROBLEM_JSON, new ServletServerHttpResponse(resposta));
        }
    }
}
