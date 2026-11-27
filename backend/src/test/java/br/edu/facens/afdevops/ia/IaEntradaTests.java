package br.edu.facens.afdevops.ia;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IaEntradaTests {
    private static final String NOTAS = "{\"logica\":1,\"comunicacao\":3,\"tecnologia\":5}";
    private final IaEntrada entrada = new IaEntrada(JsonMapper.builder().build());

    @Test
    void aceitaNotasNosLimites() {
        assertThat(entrada.classificacao(requisicao(NOTAS))).isEqualTo(new IaDtos.Competencias(1, 3, 5));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{", "[]", "null", "{} {}", "{\"logica\":1,\"logica\":2,\"comunicacao\":3,\"tecnologia\":5}",
            "{\"logica\":\"1\",\"comunicacao\":3,\"tecnologia\":5}", "{\"logica\":1.0,\"comunicacao\":3,\"tecnologia\":5}",
            "{\"logica\":true,\"comunicacao\":3,\"tecnologia\":5}", "{\"logica\":null,\"comunicacao\":3,\"tecnologia\":5}",
            "{\"logica\":0,\"comunicacao\":3,\"tecnologia\":5}", "{\"logica\":1,\"comunicacao\":6,\"tecnologia\":5}",
            "{\"logica\":1,\"comunicacao\":3,\"tecnologia\":5,\"autorizado\":true}"})
    void rejeitaNotasInvalidasOuCorpoIncompativel(String corpo) {
        assertInvalido(() -> entrada.classificacao(requisicao(corpo)));
    }

    @Test
    void aceitaSomenteNivelDoContratoPython() {
        var pedido = entrada.recomendacao(requisicao(notasComNivel("\"INICIANTE\"")));
        assertThat(pedido.nivel()).isEqualTo(IaDtos.Nivel.INICIANTE);
        for (String invalido : new String[] {"\"BASICO\"", "\"iniciante\"", "1", "null"}) {
            assertInvalido(() -> entrada.recomendacao(requisicao(notasComNivel(invalido))));
        }
    }

    @Test
    void validaTamanhoDaPerguntaERejeitaIdentidadeNoCorpoOuNaUrl() {
        String pergunta = "😀".repeat(1000);
        var pedido = entrada.orientacao(requisicao(orientacao("\"" + pergunta + "\"")));
        assertThat(pedido.pergunta()).isEqualTo(pergunta);
        for (String invalida : new String[] {"\"\"", "1", "null", "\"" + pergunta + "a\""}) {
            assertInvalido(() -> entrada.orientacao(requisicao(orientacao(invalida))));
        }
        assertInvalido(() -> entrada.orientacao(requisicao(
                "{\"colaborador_id\":\"2\",\"pergunta\":\"Olá\",\"competencias\":" + NOTAS + "}")));
        var comIdNaUrl = requisicao(orientacao("\"Olá\""));
        comIdNaUrl.setQueryString("colaboradorId=2");
        assertInvalido(() -> entrada.orientacao(comIdNaUrl));
    }

    @Test
    void exigeContentTypeJson() {
        var pedido = requisicao(NOTAS);
        pedido.setContentType("text/plain");
        assertInvalido(() -> entrada.classificacao(pedido));
    }

    private static String notasComNivel(String nivel) {
        return NOTAS.substring(0, NOTAS.length() - 1) + ",\"nivel\":" + nivel + "}";
    }

    private static String orientacao(String perguntaJson) {
        return "{\"pergunta\":" + perguntaJson + ",\"competencias\":" + NOTAS + "}";
    }

    private static MockHttpServletRequest requisicao(String corpo) {
        var pedido = new MockHttpServletRequest();
        pedido.setContentType("application/json");
        pedido.setContent(corpo.getBytes(StandardCharsets.UTF_8));
        return pedido;
    }

    private static void assertInvalido(Runnable chamada) {
        assertThatThrownBy(chamada::run).isInstanceOfSatisfying(IaFalha.Erro.class,
                erro -> assertThat(erro.falha).isEqualTo(IaFalha.DADOS_INVALIDOS));
    }
}
