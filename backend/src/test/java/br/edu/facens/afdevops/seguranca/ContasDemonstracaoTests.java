package br.edu.facens.afdevops.seguranca;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.util.Throwables.getStackTrace;

class ContasDemonstracaoTests {
    private static final String ADMIN = "AFDEVOPS_ADMIN_USERNAME";
    private static final String HASH_ADMIN = "AFDEVOPS_ADMIN_PASSWORD_HASH";
    private static final String COLABORADOR = "AFDEVOPS_COLABORADOR_USERNAME";
    private static final String HASH_COLABORADOR = "AFDEVOPS_COLABORADOR_PASSWORD_HASH";

    private final ContasDemonstracao config = new ContasDemonstracao();

    @Test
    void criaApenasAsContasConfiguradasComSeusPerfis() {
        var encoder = config.passwordEncoder();
        String senha = UUID.randomUUID().toString();
        String hash = encoder.encode(senha);
        var ambiente = new MockEnvironment().withProperty(ADMIN, "admin-teste")
                .withProperty(COLABORADOR, "colab-teste")
                .withProperty(HASH_ADMIN, hash)
                .withProperty(HASH_COLABORADOR, encoder.encode(UUID.randomUUID().toString()));
        InMemoryUserDetailsManager usuarios = config.usuarios(ambiente);
        var admin = usuarios.loadUserByUsername("admin-teste");
        assertThat(encoder.matches(senha, admin.getPassword())).isTrue();
        assertThat(admin.getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
        assertThat(usuarios.loadUserByUsername("colab-teste").getAuthorities())
                .extracting("authority").containsExactly("ROLE_COLABORADOR");
        assertThat(usuarios.userExists("service")).isFalse();
    }

    @Test
    void recusaInicializacaoQuandoFaltaHash() {
        contexto(Map.of(ADMIN, "admin-teste", COLABORADOR, "colab-teste")).run(contexto ->
                assertThat(contexto.getStartupFailure()).hasRootCauseMessage(
                        "Configuração ausente ou inválida: " + HASH_ADMIN));
    }

    @Test
    void recusaHashInvalidoSemExporValor() {
        String valorFicticio = UUID.randomUUID().toString();
        contexto(Map.of(ADMIN, "admin-teste", COLABORADOR, "colab-teste", HASH_ADMIN, valorFicticio))
                .run(contexto -> {
                    var erro = contexto.getStartupFailure();
                    assertThat(erro).hasRootCauseMessage("Configuração ausente ou inválida: " + HASH_ADMIN);
                    assertThat(getStackTrace(erro).contains(valorFicticio)).isFalse();
                });
    }

    @Test
    void recusaNomesIguaisMesmoComMaiusculasDiferentes() {
        contexto(Map.of(ADMIN, "Pessoa-Teste", COLABORADOR, "pessoa-teste")).run(contexto ->
                assertThat(contexto.getStartupFailure()).hasRootCauseMessage(
                        "As contas de demonstração devem usar nomes de usuário distintos."));
    }

    @ParameterizedTest
    @ValueSource(strings = {"10", "12", "14"})
    void aceitaCustosDentroDaFaixa(String custo) {
        String hashFicticio = "$2b$" + custo + "$" + "A".repeat(53);
        var ambiente = new MockEnvironment().withProperty(ADMIN, "admin-teste")
                .withProperty(COLABORADOR, "colab-teste")
                .withProperty(HASH_ADMIN, hashFicticio)
                .withProperty(HASH_COLABORADOR, hashFicticio);
        assertThat(config.usuarios(ambiente).userExists("admin-teste")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"04", "09", "15", "31"})
    void rejeitaCustosForaDaFaixa(String custo) {
        String hashFicticio = "$2b$" + custo + "$" + "A".repeat(53);
        contexto(Map.of(ADMIN, "admin-teste", COLABORADOR, "colab-teste", HASH_ADMIN, hashFicticio))
                .run(contexto -> assertThat(contexto.getStartupFailure())
                        .hasRootCauseMessage("Configuração ausente ou inválida: " + HASH_ADMIN));
    }

    private ApplicationContextRunner contexto(Map<String, String> valores) {
        return new ApplicationContextRunner().withInitializer(contexto -> {
            var ambiente = contexto.getEnvironment();
            ambiente.getPropertySources().remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
            ambiente.getPropertySources().remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        }).withUserConfiguration(ContasDemonstracao.class)
                .withPropertyValues(valores.entrySet().stream().map(item -> item.getKey() + "=" + item.getValue())
                        .toArray(String[]::new));
    }
}
