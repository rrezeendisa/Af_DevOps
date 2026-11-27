package br.edu.facens.afdevops.ia;

import java.io.IOException;
import java.util.Arrays;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

@Component
class IaEntrada {
    private final ObjectReader leitor;

    IaEntrada(JsonMapper json) {
        this.leitor = json.reader()
                .with(DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY)
                .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    IaDtos.Competencias classificacao(HttpServletRequest pedido) {
        return competencias(ler(pedido), "logica", "comunicacao", "tecnologia");
    }

    IaDtos.PedidoRecomendacao recomendacao(HttpServletRequest pedido) {
        var corpo = ler(pedido);
        var competencias = competencias(corpo, "logica", "comunicacao", "tecnologia", "nivel");
        JsonNode nivel = corpo.get("nivel");
        if (!nivel.isString()) {
            throw IaFalha.DADOS_INVALIDOS.erro();
        }
        try {
            return new IaDtos.PedidoRecomendacao(competencias, IaDtos.Nivel.valueOf(nivel.asString()));
        } catch (IllegalArgumentException erro) {
            throw IaFalha.DADOS_INVALIDOS.erro();
        }
    }

    IaDtos.PedidoOrientacao orientacao(HttpServletRequest pedido) {
        var corpo = ler(pedido);
        exigirCampos(corpo, "pergunta", "competencias");
        JsonNode pergunta = corpo.get("pergunta");
        if (!pergunta.isString()) {
            throw IaFalha.DADOS_INVALIDOS.erro();
        }
        String texto = pergunta.asString();
        if (texto.isEmpty() || texto.codePointCount(0, texto.length()) > 1000) {
            throw IaFalha.DADOS_INVALIDOS.erro();
        }
        return new IaDtos.PedidoOrientacao(texto,
                competencias(corpo.get("competencias"), "logica", "comunicacao", "tecnologia"));
    }

    private JsonNode ler(HttpServletRequest pedido) {
        if (pedido.getQueryString() != null || pedido.getContentType() == null) {
            throw IaFalha.DADOS_INVALIDOS.erro();
        }
        try {
            if (!MediaType.APPLICATION_JSON.includes(MediaType.parseMediaType(pedido.getContentType()))) {
                throw IaFalha.DADOS_INVALIDOS.erro();
            }
            return leitor.readTree(pedido.getInputStream());
        } catch (IOException | JacksonException | IllegalArgumentException erro) {
            throw IaFalha.DADOS_INVALIDOS.erro();
        }
    }

    private static IaDtos.Competencias competencias(JsonNode corpo, String... campos) {
        exigirCampos(corpo, campos);
        return new IaDtos.Competencias(nota(corpo.get("logica")), nota(corpo.get("comunicacao")),
                nota(corpo.get("tecnologia")));
    }

    private static void exigirCampos(JsonNode corpo, String... campos) {
        if (corpo == null || !corpo.isObject() || corpo.size() != campos.length
                || Arrays.stream(campos).anyMatch(campo -> !corpo.hasNonNull(campo))) {
            throw IaFalha.DADOS_INVALIDOS.erro();
        }
    }

    private static int nota(JsonNode valor) {
        if (!valor.isIntegralNumber() || !valor.canConvertToInt() || valor.asInt() < 1 || valor.asInt() > 5) {
            throw IaFalha.DADOS_INVALIDOS.erro();
        }
        return valor.asInt();
    }
}
