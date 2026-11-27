package br.edu.facens.afdevops.seguranca;

import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.AndRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;

@Configuration(proxyBeanMethods = false)
class SegurancaConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        var rotas = PathPatternRequestMatcher.withDefaults();
        var saude = rotas.matcher(HttpMethod.GET, "/actuator/health");
        var actuatorBloqueado = new AndRequestMatcher(
                rotas.matcher("/actuator/**"), new NegatedRequestMatcher(saude));
        var erros = new ErrosSeguranca(actuatorBloqueado);

        var cookiesCsrf = new CookieCsrfTokenRepository();
        cookiesCsrf.setCookieCustomizer(cookie -> cookie.httpOnly(true).sameSite("Strict"));

        return http
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
                        .requestMatchers(HttpMethod.GET, "/api/csrf",
                                "/api/colaboradores", "/api/colaboradores/{id}").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/colaboradores", "/api/cursos").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/cursos", "/api/cursos/{id}")
                                .hasAnyRole("ADMIN", "COLABORADOR")
                        .anyRequest().denyAll())
                .build();
    }
}
