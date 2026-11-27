package br.edu.facens.afdevops.consentimento;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConsentimentoRequestTests {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void aceitaConsentimentoSomenteComoBooleano(boolean autorizado) {
        var pedido = JSON.readValue("{\"autorizado\":" + autorizado + "}", ConsentimentoRequest.class);
        assertThat(pedido.autorizado()).isEqualTo(autorizado);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"autorizado\":null}", "{\"autorizado\":0}",
            "{\"autorizado\":\"true\"}", "{\"autorizado\":true,\"autorizado\":false}",
            "{\"autorizado\":true,\"colaboradorId\":1}", "{\"autorizado\":", "{\"autorizado\":true} {}"})
    void rejeitaConsentimentoInvalido(String corpo) {
        assertThatThrownBy(() -> JSON.readValue(corpo, ConsentimentoRequest.class))
                .isInstanceOf(JacksonException.class);
    }
}
