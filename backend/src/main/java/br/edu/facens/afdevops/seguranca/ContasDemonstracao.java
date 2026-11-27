package br.edu.facens.afdevops.seguranca;

import java.util.regex.Pattern;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

@Configuration(proxyBeanMethods = false)
class ContasDemonstracao {
    private static final Pattern NOME = Pattern.compile("[A-Za-z0-9_.-]{1,64}");
    private static final Pattern HASH_BCRYPT =
            Pattern.compile("\\$2[aby]\\$(1[0-4])\\$[./A-Za-z0-9]{53}");

    @Bean
    BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    InMemoryUserDetailsManager usuarios(Environment ambiente) {
        String admin = valor(ambiente, "AFDEVOPS_ADMIN_USERNAME", NOME);
        String colaborador = valor(ambiente, "AFDEVOPS_COLABORADOR_USERNAME", NOME);
        if (admin.equalsIgnoreCase(colaborador)) {
            throw new IllegalStateException("As contas de demonstração devem usar nomes de usuário distintos.");
        }

        String hashAdmin = valor(ambiente, "AFDEVOPS_ADMIN_PASSWORD_HASH", HASH_BCRYPT);
        String hashColaborador = valor(ambiente, "AFDEVOPS_COLABORADOR_PASSWORD_HASH", HASH_BCRYPT);
        return new InMemoryUserDetailsManager(
                User.withUsername(admin).password(hashAdmin).roles("ADMIN").build(),
                User.withUsername(colaborador).password(hashColaborador).roles("COLABORADOR").build());
    }

    private static String valor(Environment ambiente, String variavel, Pattern formato) {
        String valor;
        try {
            valor = ambiente.getProperty(variavel);
        } catch (IllegalArgumentException erro) {
            throw configuracaoInvalida(variavel);
        }
        if (valor == null || !formato.matcher(valor).matches()) {
            throw configuracaoInvalida(variavel);
        }
        return valor;
    }

    private static IllegalStateException configuracaoInvalida(String variavel) {
        return new IllegalStateException("Configuração ausente ou inválida: " + variavel);
    }
}
