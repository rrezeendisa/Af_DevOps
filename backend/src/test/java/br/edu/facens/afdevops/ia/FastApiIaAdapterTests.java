package br.edu.facens.afdevops.ia;

import java.io.InputStream;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpResponse;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class FastApiIaAdapterTests {
    private static final String URL = "http://ai.test";
    private static final String TOKEN = "token-de-teste";
    private static final IaDtos.Competencias NOTAS = new IaDtos.Competencias(1, 3, 5);
    private static final String NOTAS_JSON = "{\"logica\":1,\"comunicacao\":3,\"tecnologia\":5}";

    private final RestClient.Builder builder = RestClient.builder().baseUrl(URL);
    private final MockRestServiceServer servidor = MockRestServiceServer.bindTo(builder).build();
    private final FastApiIaAdapter adapter = new FastApiIaAdapter(JsonMapper.builder().build(), builder.build(), TOKEN);

    @AfterEach
    void verificaChamadas() {
        servidor.verify();
    }

    @Test
    void classificaComNotasSemCredenciais() {
        servidor.expect(requestTo(URL + "/classificacoes")).andExpect(method(HttpMethod.POST))
                .andExpect(headerDoesNotExist(HttpHeaders.AUTHORIZATION))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(content().json(NOTAS_JSON, JsonCompareMode.STRICT))
                .andRespond(withSuccess("""
                        {"nivel":"INICIANTE","versao_modelo":"modelo-teste"}
                        """, MediaType.APPLICATION_JSON));

        assertThat(adapter.classificar(NOTAS)).isEqualTo(new IaDtos.Classificacao(IaDtos.Nivel.INICIANTE, "modelo-teste"));
    }

    @Test
    void recomendaComNivelEIdsDocumentaisSemCredenciais() {
        servidor.expect(requestTo(URL + "/recomendacoes")).andExpect(method(HttpMethod.POST))
                .andExpect(headerDoesNotExist(HttpHeaders.AUTHORIZATION))
                .andExpect(content().json("""
                        {"logica":1,"comunicacao":3,"tecnologia":5,"nivel":"INTERMEDIARIO"}
                        """, JsonCompareMode.STRICT))
                .andRespond(withSuccess("""
                        {"recomendacoes":[{"curso_id":"CURSO-002","nome":"Lógica","justificativa":"Prática"}],
                         "fontes":["logica.md"]}
                        """, MediaType.APPLICATION_JSON));

        var resposta = adapter.recomendar(new IaDtos.PedidoRecomendacao(NOTAS, IaDtos.Nivel.INTERMEDIARIO));
        assertThat(resposta.recomendacoes()).containsExactly(new IaDtos.CursoDocumental("CURSO-002", "Lógica", "Prática"));
        assertThat(resposta.fontes()).containsExactly("logica.md");
    }

    @Test
    void orientaComIdentificadorTextualEBearerInterno() {
        servidor.expect(requestTo(URL + "/orientacoes")).andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer " + TOKEN))
                .andExpect(content().json("""
                        {"colaborador_id":"42","pergunta":"Por onde começar?","competencias":
                        {"logica":1,"comunicacao":3,"tecnologia":5}}
                        """, JsonCompareMode.STRICT))
                .andRespond(withSuccess("""
                        {"orientacao":"Comece por lógica.","cursos_recomendados":["CURSO-001"],"fontes":[]}
                        """, MediaType.APPLICATION_JSON));

        assertThat(adapter.orientar(42, new IaDtos.PedidoOrientacao("Por onde começar?", NOTAS)))
                .isEqualTo(new IaDtos.Orientacao("Comece por lógica.", List.of("CURSO-001"), List.of()));
    }

    @Test
    void recusaOrientacaoSemTokenSemFazerRequisicao() {
        var semToken = new FastApiIaAdapter(JsonMapper.builder().build(), builder.build(), " ");
        assertFalha(() -> semToken.orientar(42, new IaDtos.PedidoOrientacao("Por onde começar?", NOTAS)),
                IaFalha.IA_INDISPONIVEL);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{", "[]", "{\"nivel\":\"BASICO\",\"versao_modelo\":\"v1\"}",
            "{\"nivel\":\"INICIANTE\",\"versao_modelo\":1}", "{\"nivel\":\"INICIANTE\",\"versao_modelo\":null}",
            "{\"nivel\":\"INICIANTE\",\"nivel\":\"AVANCADO\",\"versao_modelo\":\"v1\"}"})
    void rejeitaClassificacaoIncompativel(String resposta) {
        servidor.expect(requestTo(URL + "/classificacoes")).andRespond(withSuccess(resposta, MediaType.APPLICATION_JSON));
        assertFalha(() -> adapter.classificar(NOTAS), IaFalha.IA_RESPOSTA_INVALIDA);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"recomendacoes\":[],\"fontes\":null}",
            "{\"recomendacoes\":[null],\"fontes\":[]}",
            "{\"recomendacoes\":[{\"curso_id\":1,\"nome\":\"Lógica\",\"justificativa\":\"Teste\"}],\"fontes\":[]}"})
    void rejeitaRecomendacaoIncompativel(String resposta) {
        servidor.expect(requestTo(URL + "/recomendacoes")).andRespond(withSuccess(resposta, MediaType.APPLICATION_JSON));
        assertFalha(() -> adapter.recomendar(new IaDtos.PedidoRecomendacao(NOTAS, IaDtos.Nivel.INICIANTE)),
                IaFalha.IA_RESPOSTA_INVALIDA);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"orientacao\":\"Texto\",\"fontes\":[]}",
            "{\"orientacao\":\"Texto\",\"cursos_recomendados\":[1],\"fontes\":[]}",
            "{\"orientacao\":\"Texto\",\"cursos_recomendados\":[],\"fontes\":[false]}"})
    void rejeitaOrientacaoIncompativel(String resposta) {
        servidor.expect(requestTo(URL + "/orientacoes")).andRespond(withSuccess(resposta, MediaType.APPLICATION_JSON));
        assertFalha(() -> adapter.orientar(42, new IaDtos.PedidoOrientacao("Pergunta", NOTAS)),
                IaFalha.IA_RESPOSTA_INVALIDA);
    }

    @ParameterizedTest
    @ValueSource(ints = {302, 401, 422, 500, 503, 504})
    void mapeiaStatusExternoSemExporCorpo(int status) {
        String detalheInterno = "detalhe-privado";
        servidor.expect(requestTo(URL + "/classificacoes"))
                .andRespond(withStatus(HttpStatus.valueOf(status)).body(detalheInterno));
        IaFalha esperada = switch (status) {
            case 503 -> IaFalha.IA_INDISPONIVEL;
            case 504 -> IaFalha.IA_TEMPO_LIMITE;
            default -> IaFalha.IA_RESPOSTA_INVALIDA;
        };
        assertThatThrownBy(() -> adapter.classificar(NOTAS)).isInstanceOfSatisfying(IaFalha.Erro.class, erro -> {
            assertThat(erro.falha).isEqualTo(esperada);
            assertThat(erro).hasMessage(esperada.detalhe).hasNoCause();
        });
    }

    @Test
    void mapeiaTimeoutSemRepetirRequisicao() {
        servidor.expect(requestTo(URL + "/classificacoes")).andRespond(withException(new SocketTimeoutException()));
        assertFalha(() -> adapter.classificar(NOTAS), IaFalha.IA_TEMPO_LIMITE);
    }

    @Test
    void mapeiaConexaoRecusadaSemRepetirRequisicao() {
        servidor.expect(requestTo(URL + "/classificacoes")).andRespond(withException(new ConnectException()));
        assertFalha(() -> adapter.classificar(NOTAS), IaFalha.IA_INDISPONIVEL);
    }

    @Test
    void mapeiaTimeoutDuranteLeituraDoCorpo() {
        servidor.expect(requestTo(URL + "/classificacoes")).andRespond(pedido -> {
            var resposta = new MockClientHttpResponse(new byte[0], HttpStatus.OK) {
                @Override
                public InputStream getBody() {
                    return new InputStream() {
                        @Override
                        public int read() throws SocketTimeoutException {
                            throw new SocketTimeoutException();
                        }
                    };
                }
            };
            resposta.getHeaders().setContentType(MediaType.APPLICATION_JSON);
            return resposta;
        });
        assertFalha(() -> adapter.classificar(NOTAS), IaFalha.IA_TEMPO_LIMITE);
    }

    private static void assertFalha(Runnable chamada, IaFalha esperada) {
        assertThatThrownBy(chamada::run).isInstanceOfSatisfying(IaFalha.Erro.class,
                erro -> assertThat(erro.falha).isEqualTo(esperada));
    }
}
