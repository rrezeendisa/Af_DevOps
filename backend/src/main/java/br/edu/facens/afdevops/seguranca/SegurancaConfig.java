package br.edu.facens.afdevops.seguranca;

import br.edu.facens.afdevops.identidade.ContaAutenticada;
import br.edu.facens.afdevops.identidade.ContasIndividuais;
import br.edu.facens.afdevops.identidade.ContextoSessao;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.logout.LogoutFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.AndRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;

@Configuration(proxyBeanMethods = false)
class SegurancaConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ContasIndividuais contas,
            InMemoryUserDetailsManager demonstracao, PasswordEncoder encoder, Environment ambiente) throws Exception {
        contas.verificarNomesDeDemonstracao(ambiente.getRequiredProperty("AFDEVOPS_ADMIN_USERNAME"),
                ambiente.getRequiredProperty("AFDEVOPS_COLABORADOR_USERNAME"));
        var autenticador = new DaoAuthenticationProvider(nome -> {
            if (demonstracao.userExists(nome)) {
                return demonstracao.loadUserByUsername(nome);
            }
            return contas.buscarParaAutenticacao(nome)
                    .orElseThrow(() -> new UsernameNotFoundException("Usuário não encontrado."));
        });
        autenticador.setPasswordEncoder(encoder);

        var rotas = PathPatternRequestMatcher.withDefaults();
        var saude = rotas.matcher(HttpMethod.GET, "/actuator/health");
        var actuatorBloqueado = new AndRequestMatcher(
                rotas.matcher("/actuator/**"), new NegatedRequestMatcher(saude));
        var erros = new ErrosSeguranca(actuatorBloqueado);

        boolean cookieSeguro = ambiente.getProperty("server.servlet.session.cookie.secure", Boolean.class, false);
        String cookieSessao = ambiente.getRequiredProperty("server.servlet.session.cookie.name");
        var cookiesCsrf = new CookieCsrfTokenRepository();
        cookiesCsrf.setCookieCustomizer(cookie -> {
            cookie.httpOnly(true).sameSite("Strict");
            // Sem a variável, vale o padrão do repositório: Secure quando a requisição chega por HTTPS.
            if (cookieSeguro) {
                cookie.secure(true);
            }
        });

        return http
                .authenticationManager(new ProviderManager(autenticador))
                .sessionManagement(sessao -> sessao.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation(fixacao -> fixacao.changeSessionId()))
                .requestCache(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                // O BCrypt roda somente aqui; as demais requisições usam a autenticação guardada na sessão.
                .formLogin(login -> login
                        // Informar a página evita o formulário HTML gerado pelo Spring; GET /api/login é negado.
                        .loginPage("/api/login")
                        .loginProcessingUrl("/api/login")
                        .authenticationDetailsSource(pedido -> ContextoSessao.novo())
                        .successHandler((pedido, resposta, autenticacao) -> {
                            resposta.setStatus(HttpStatus.NO_CONTENT.value());
                            resposta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
                        })
                        .failureHandler(erros::naoAutenticado))
                .logout(logout -> logout
                        .logoutUrl("/api/logout")
                        .deleteCookies(cookieSessao)
                        .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
                .addFilterBefore(new FiltroContextoSessao(erros), LogoutFilter.class)
                .csrf(csrf -> csrf.csrfTokenRepository(cookiesCsrf)
                        .csrfTokenRequestHandler(new XorCsrfTokenRequestAttributeHandler()))
                .exceptionHandling(excecoes -> excecoes
                        .authenticationEntryPoint(erros::naoAutenticado)
                        .accessDeniedHandler(erros::acessoNegado))
                .authorizeHttpRequests(autorizar -> autorizar
                        .requestMatchers(saude).permitAll()
                        // Pública porque o próprio login exige o token. Não devolve dados da conta.
                        .requestMatchers(rotas.matcher(HttpMethod.GET, "/api/csrf")).permitAll()
                        .requestMatchers(actuatorBloqueado).denyAll()
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/colaboradores", "/api/colaboradores/{id}",
                                "/api/treinamentos", "/api/treinamentos/{id}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/colaboradores", "/api/cursos",
                                "/api/treinamentos", "/api/colaboradores/{id}/conta").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/cursos", "/api/cursos/{id}", "/api/me")
                                .hasAnyRole("ADMIN", "COLABORADOR")
                        .requestMatchers(rotas.matcher(HttpMethod.GET, "/api/me/consentimento"),
                                rotas.matcher(HttpMethod.PUT, "/api/me/consentimento"),
                                rotas.matcher(HttpMethod.POST, "/api/ia/classificacoes"),
                                rotas.matcher(HttpMethod.POST, "/api/ia/recomendacoes"),
                                rotas.matcher(HttpMethod.POST, "/api/ia/orientacoes"))
                                .access((autenticacao, contexto) -> new AuthorizationDecision(
                                        autenticacao.get().getPrincipal() instanceof ContaAutenticada))
                        .anyRequest().denyAll())
                .build();
    }
}
