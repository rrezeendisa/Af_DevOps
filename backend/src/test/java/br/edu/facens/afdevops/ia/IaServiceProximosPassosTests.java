package br.edu.facens.afdevops.ia;

import java.util.List;
import java.util.Map;

import br.edu.facens.afdevops.consentimento.ConsentimentoService;
import br.edu.facens.afdevops.identidade.ContaAutenticada;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class IaServiceProximosPassosTests {
    private static final IaDtos.PedidoOrientacao PEDIDO = new IaDtos.PedidoOrientacao("Pergunta fictícia",
            new IaDtos.Competencias(2, 3, 4));
    private static final IaDtos.Orientacao BASE = new IaDtos.Orientacao(
            "A classificação estimada pelo modelo é INICIANTE. "
                    + "Os documentos consultados recomendam: Introdução à lógica de programação.",
            List.of("CURSO-001"), List.of("logica-iniciacao.md"));

    private final ConsentimentoService consentimento = mock(ConsentimentoService.class);
    private final ServicoIaPort python = mock(ServicoIaPort.class);
    private final ProximosPassosPort ollama = mock(ProximosPassosPort.class);
    private final ContaAutenticada conta = mock(ContaAutenticada.class);

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "INICIANTE|A classificação estimada pelo modelo é INICIANTE. Os documentos consultados recomendam: Introdução à lógica de programação.",
            "INTERMEDIARIO|A classificação estimada pelo modelo é INTERMEDIARIO. Os documentos consultados recomendam: Resolução estruturada de problemas, Segurança da informação no cotidiano.",
            "AVANCADO|A classificação estimada pelo modelo é AVANCADO. Não foram encontrados cursos compatíveis nos documentos disponíveis."
    })
    void reconheceFormatosDoGuidanceAgentEEnviaSomenteONivel(IaDtos.Nivel nivel, String texto) {
        var base = new IaDtos.Orientacao(texto, BASE.cursosRecomendados(), BASE.fontes());
        when(conta.colaboradorId()).thenReturn(42L);
        when(consentimento.autorizadoParaIa(42)).thenReturn(true);
        when(python.orientar(42, PEDIDO)).thenReturn(base);
        when(ollama.gerar(nivel)).thenReturn(List.of("Pratique um exercício curto."));

        var resposta = servico(true).orientar(conta, PEDIDO);

        var ordem = inOrder(consentimento, python, ollama);
        ordem.verify(consentimento).autorizadoParaIa(42);
        ordem.verify(python).orientar(42, PEDIDO);
        ordem.verify(consentimento).autorizadoParaIa(42);
        ordem.verify(ollama).gerar(nivel);
        assertThat(resposta.orientacao()).isEqualTo(texto);
        assertThat(resposta.cursosRecomendados()).isEqualTo(base.cursosRecomendados());
        assertThat(resposta.fontes()).isEqualTo(base.fontes());
        assertThat(resposta.proximosPassos()).containsExactly("Pratique um exercício curto.");
        assertThat(JsonMapper.builder().build().valueToTree(resposta).has("proximosPassos")).isTrue();
    }

    @Test
    void revogacaoDepoisDaChamadaPythonOmiteComplemento() {
        prepararBase();
        when(consentimento.autorizadoParaIa(42)).thenReturn(true, false);
        assertThat(servico(true).orientar(conta, PEDIDO)).isSameAs(BASE);
        verifyNoInteractions(ollama);
    }

    @Test
    void consentimentoNegadoBloqueiaAmbosOsServicos() {
        when(conta.colaboradorId()).thenReturn(42L);
        assertThatThrownBy(() -> servico(true).orientar(conta, PEDIDO))
                .isInstanceOfSatisfying(IaFalha.Erro.class,
                        erro -> assertThat(erro.falha).isEqualTo(IaFalha.CONSENTIMENTO_IA_NECESSARIO));
        verifyNoInteractions(python, ollama);
    }

    @Test
    void desabilitadoPreservaFormatoOriginalDaResposta() {
        prepararBase();
        var resultado = servico(false).orientar(conta, PEDIDO);
        assertThat(resultado).isSameAs(BASE);
        assertThat(JsonMapper.builder().build().valueToTree(resultado).has("proximosPassos")).isFalse();
        verifyNoInteractions(ollama);
    }

    @Test
    void textoNaoReconhecidoNaoChegaAoModelo() {
        prepararBase();
        var textoLivre = new IaDtos.Orientacao("Mensagem fora do formato com dados fictícios.", List.of(), List.of());
        when(python.orientar(42, PEDIDO)).thenReturn(textoLivre);
        assertThat(servico(true).orientar(conta, PEDIDO)).isSameAs(textoLivre);
        verifyNoInteractions(ollama);
    }

    @Test
    void semSugestoesValidasDevolveOrientacaoOriginal() {
        prepararBase();
        when(ollama.gerar(IaDtos.Nivel.INICIANTE)).thenReturn(List.of());
        assertThat(servico(true).orientar(conta, PEDIDO)).isSameAs(BASE);
    }

    private void prepararBase() {
        when(conta.colaboradorId()).thenReturn(42L);
        when(consentimento.autorizadoParaIa(42)).thenReturn(true);
        when(python.orientar(42, PEDIDO)).thenReturn(BASE);
    }

    private IaService servico(boolean habilitado) {
        var beans = new StaticListableBeanFactory(habilitado ? Map.of("gerador", ollama) : Map.of());
        return new IaService(consentimento, python, beans.getBeanProvider(ProximosPassosPort.class));
    }
}
