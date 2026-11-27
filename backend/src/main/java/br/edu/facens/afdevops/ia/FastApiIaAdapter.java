package br.edu.facens.afdevops.ia;

import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.StreamingHttpOutputMessage;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

@Component
class FastApiIaAdapter implements ServicoIaPort {
    private static final int TAMANHO_MAXIMO_RESPOSTA = 64 * 1024;

    private final RestClient cliente;
    private final JsonMapper json;
    private final ObjectReader leitor;
    private final String tokenInterno;

    @Autowired
    FastApiIaAdapter(JsonMapper json, @Value("${afdevops.ia.url}") String url,
            @Value("${afdevops.ia.token}") String token,
            @Value("${afdevops.ia.timeout-conexao}") Duration timeoutConexao,
            @Value("${afdevops.ia.timeout-leitura}") Duration timeoutLeitura) {
        this(json, cliente(url, timeoutConexao, timeoutLeitura), token);
    }

    FastApiIaAdapter(JsonMapper json, RestClient cliente, String token) {
        this.cliente = cliente;
        this.json = json;
        this.leitor = json.reader().with(DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY)
                .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
        this.tokenInterno = token.strip();
    }

    private static RestClient cliente(String url, Duration timeoutConexao, Duration timeoutLeitura) {
        if (timeoutConexao.toMillis() < 1 || timeoutLeitura.toMillis() < 1) {
            throw new IllegalArgumentException("Os tempos limite da IA devem ser positivos.");
        }
        var fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(timeoutConexao);
        fabrica.setReadTimeout(timeoutLeitura);
        return RestClient.builder().requestFactory(fabrica).baseUrl(url).build();
    }

    @Override
    public IaDtos.Classificacao classificar(IaDtos.Competencias competencias) {
        var corpo = enviar("/classificacoes", competencias, false);
        try {
            return new IaDtos.Classificacao(IaDtos.Nivel.valueOf(texto(corpo, "nivel")),
                    texto(corpo, "versao_modelo"));
        } catch (IllegalArgumentException erro) {
            throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
        }
    }

    @Override
    public IaDtos.Recomendacoes recomendar(IaDtos.PedidoRecomendacao pedido) {
        var notas = pedido.competencias();
        var corpo = enviar("/recomendacoes", new RecomendacaoPython(notas.logica(), notas.comunicacao(),
                notas.tecnologia(), pedido.nivel()), false);
        return new IaDtos.Recomendacoes(lista(corpo, "recomendacoes", item -> new IaDtos.CursoDocumental(
                texto(item, "curso_id"), texto(item, "nome"), texto(item, "justificativa"))),
                lista(corpo, "fontes", FastApiIaAdapter::texto));
    }

    @Override
    public IaDtos.Orientacao orientar(long colaboradorId, IaDtos.PedidoOrientacao pedido) {
        if (tokenInterno.isEmpty()) {
            throw IaFalha.IA_INDISPONIVEL.erro();
        }
        var corpo = enviar("/orientacoes", new OrientacaoPython(Long.toString(colaboradorId), pedido.pergunta(),
                pedido.competencias()), true);
        return new IaDtos.Orientacao(texto(corpo, "orientacao"),
                lista(corpo, "cursos_recomendados", FastApiIaAdapter::texto),
                lista(corpo, "fontes", FastApiIaAdapter::texto));
    }

    private JsonNode enviar(String caminho, Object dados, boolean autenticado) {
        var requisicao = cliente.post().uri(caminho).contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON);
        if (autenticado) {
            requisicao.headers(headers -> headers.setBearerAuth(tokenInterno));
        }
        try {
            return requisicao.body((StreamingHttpOutputMessage.Body) saida -> json.writeValue(saida, dados))
                    .exchange((pedido, resposta) -> {
                        int status = resposta.getStatusCode().value();
                        switch (status) {
                            case 200 -> { }
                            case 503 -> throw IaFalha.IA_INDISPONIVEL.erro();
                            case 504 -> throw IaFalha.IA_TEMPO_LIMITE.erro();
                            default -> throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
                        }
                        if (!MediaType.APPLICATION_JSON.includes(resposta.getHeaders().getContentType())) {
                            throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
                        }
                        byte[] corpo = resposta.getBody().readNBytes(TAMANHO_MAXIMO_RESPOSTA + 1);
                        if (corpo.length > TAMANHO_MAXIMO_RESPOSTA) {
                            throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
                        }
                        var arvore = leitor.readTree(corpo);
                        if (arvore == null || !arvore.isObject()) {
                            throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
                        }
                        return arvore;
                    });
        } catch (JacksonException | IllegalArgumentException erro) {
            throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
        } catch (RestClientException erro) {
            for (Throwable causa = erro; causa != null; causa = causa.getCause()) {
                if (causa instanceof SocketTimeoutException) {
                    throw IaFalha.IA_TEMPO_LIMITE.erro();
                }
                if (causa instanceof JacksonException) {
                    throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
                }
            }
            throw IaFalha.IA_INDISPONIVEL.erro();
        }
    }

    private static String texto(JsonNode objeto, String campo) {
        return texto(objeto.get(campo));
    }

    private static String texto(JsonNode valor) {
        if (valor == null || !valor.isString()) {
            throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
        }
        return valor.asString();
    }

    private static <T> List<T> lista(JsonNode objeto, String campo, Function<JsonNode, T> converter) {
        var itens = objeto.get(campo);
        if (itens == null || !itens.isArray()) {
            throw IaFalha.IA_RESPOSTA_INVALIDA.erro();
        }
        var resultado = new ArrayList<T>();
        for (JsonNode item : itens) {
            resultado.add(converter.apply(item));
        }
        return List.copyOf(resultado);
    }

    private record RecomendacaoPython(int logica, int comunicacao, int tecnologia, IaDtos.Nivel nivel) {
    }

    private record OrientacaoPython(@JsonProperty("colaborador_id") String colaboradorId, String pergunta,
            IaDtos.Competencias competencias) {
    }
}
