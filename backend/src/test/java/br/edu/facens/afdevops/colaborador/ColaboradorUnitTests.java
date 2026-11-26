package br.edu.facens.afdevops.colaborador;

import java.lang.reflect.Proxy;
import java.util.stream.Stream;

import br.edu.facens.afdevops.colaborador.dto.ColaboradorRequest;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.postgresql.util.PSQLException;
import org.postgresql.util.ServerErrorMessage;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ColaboradorUnitTests {

    @Test
    void normalizaAntesDeValidar() {
        var request = new ColaboradorRequest("Pessoa Fictícia", " ".repeat(254) + "PESSOA@EXAMPLE.COM ",
                "Analista", "Educação");
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(request)).isEmpty();
        }
        assertThat(request.email()).isEqualTo("pessoa@example.com");
    }

    @ParameterizedTest
    @MethodSource("dadosInvalidos")
    void validaCampos(ColaboradorRequest request, String campo) {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(request))
                    .anySatisfy(violacao -> assertThat(violacao.getPropertyPath().toString()).isEqualTo(campo));
        }
    }

    static Stream<Arguments> dadosInvalidos() {
        return Stream.of(
                Arguments.of(new ColaboradorRequest(null, "pessoa@example.com", "Analista", "Educação"), "nome"),
                Arguments.of(new ColaboradorRequest("Pessoa Fictícia", " ", "Analista", "Educação"), "email"),
                Arguments.of(new ColaboradorRequest("Pessoa Fictícia", "invalido", "Analista", "Educação"), "email"),
                Arguments.of(new ColaboradorRequest("Pessoa Fictícia", "pessoa@example.com", " ", "Educação"), "cargo"),
                Arguments.of(new ColaboradorRequest("Pessoa Fictícia", "pessoa@example.com", "Analista", null), "departamento"),
                Arguments.of(new ColaboradorRequest("n".repeat(151), "pessoa@example.com", "Analista", "Educação"), "nome"),
                Arguments.of(new ColaboradorRequest("Pessoa Fictícia", "pessoa@example.com", "c".repeat(101), "Educação"), "cargo"),
                Arguments.of(new ColaboradorRequest("Pessoa Fictícia", "pessoa@example.com", "Analista", "d".repeat(101)), "departamento"),
                Arguments.of(new ColaboradorRequest("Pessoa Fictícia",
                        "a@%s.%s.%s.%s".formatted("b".repeat(63), "c".repeat(63), "d".repeat(63), "e".repeat(63)),
                        "Analista", "Educação"), "email"));
    }

    @Test
    void traduzSomenteUnicidadeDoIndiceDeEmail() {
        var violacao = violacao("23505", "ux_colaboradores_email_lower");
        var service = serviceComFalha(violacao);

        assertThatThrownBy(() -> service.cadastrar(requestValido()))
                .isInstanceOf(ColaboradorService.EmailDuplicadoException.class)
                .hasCause(violacao);
    }

    @ParameterizedTest
    @ValueSource(strings = {"colaboradores_pkey", ""})
    void preservaOutrasViolacoesDeUnicidade(String restricao) {
        var violacao = violacao("23505", restricao);
        var service = serviceComFalha(violacao);

        assertThatThrownBy(() -> service.cadastrar(requestValido())).isSameAs(violacao);
    }

    @Test
    void preservaViolacaoComOutroSqlState() {
        var violacao = violacao("23502", "ux_colaboradores_email_lower");
        var service = serviceComFalha(violacao);

        assertThatThrownBy(() -> service.cadastrar(requestValido())).isSameAs(violacao);
    }

    private static ColaboradorRequest requestValido() {
        return new ColaboradorRequest("Pessoa Fictícia", "pessoa@example.com", "Analista", "Educação");
    }

    private static ColaboradorService serviceComFalha(DataIntegrityViolationException violacao) {
        var repository = (ColaboradorRepository) Proxy.newProxyInstance(
                ColaboradorRepository.class.getClassLoader(),
                new Class<?>[]{ColaboradorRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("saveAndFlush")) {
                        throw violacao;
                    }
                    throw new AssertionError("Método inesperado: " + method.getName());
                });
        return new ColaboradorService(repository);
    }

    private static DataIntegrityViolationException violacao(String sqlState, String restricao) {
        // Campos do protocolo PostgreSQL: C (SQLSTATE), n (restrição) e M (mensagem).
        var erro = new ServerErrorMessage("C" + sqlState + "\0n" + restricao + "\0MErro sintético\0\0");
        return new DataIntegrityViolationException("Erro sintético de teste", new PSQLException(erro));
    }
}
