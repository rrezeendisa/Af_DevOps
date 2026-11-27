package br.edu.facens.afdevops.identidade;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class CriarContaRequestTests {
    @Test
    void pedidoDeContaNaoExpoeSenhaEmRepresentacaoTextual() {
        String senha = UUID.randomUUID().toString();
        var json = JsonMapper.builder().build();
        var pedido = json.readValue("{\"nomeUsuario\":\"pessoa\",\"senhaInicial\":\"" + senha + "\"}",
                        CriarContaRequest.class);
        assertThat(pedido.toString().contains(senha)).isFalse();
        assertThat(json.writeValueAsString(pedido)).isEqualTo("{\"nomeUsuario\":\"pessoa\"}");
    }
}
