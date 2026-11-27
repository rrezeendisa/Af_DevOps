package br.edu.facens.afdevops.seguranca;

import br.edu.facens.afdevops.identidade.ContaAutenticada;
import br.edu.facens.afdevops.identidade.ContasIndividuais;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
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

        var cookiesCsrf = new CookieCsrfTokenRepository();
        cookiesCsrf.setCookieCustomizer(cookie -> cookie.httpOnly(true).sameSite("Strict"));

        return http
                .authenticationManager(new ProviderManager(autenticador))
                .sessionManagement(sessao -> sessao.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .csrf(csrf -> csrf.csrfTokenRepository(cookiesCsrf)
                        .csrfTokenRequestHandler(new XorCsrfTokenRequestAttributeHandler()))
                .httpBasic(basic -> basic.authenticationEntryPoint(erros::naoAutenticado))
                .exceptionHandling(excecoes -> excecoes
                        .authenticationEntryPoint(erros::naoAutenticado)
                        .accessDeniedHandler(erros::acessoNegado))
                .authorizeHttpRequests(autorizar -> autorizar
                        .requestMatchers(saude).permitAll()
                        .requestMatchers(actuatorBloqueado).denyAll()
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/colaboradores", "/api/colaboradores/{id}",
                                "/api/treinamentos", "/api/treinamentos/{id}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/colaboradores", "/api/cursos",
                                "/api/treinamentos", "/api/colaboradores/{id}/conta").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/cursos", "/api/cursos/{id}", "/api/me", "/api/csrf")
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
