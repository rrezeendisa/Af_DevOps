package br.edu.facens.afdevops.treinamento;

import java.security.Principal;
import java.time.Instant;
import java.util.stream.Stream;

import br.edu.facens.afdevops.treinamento.dto.AtualizacaoStatusRequest;
import br.edu.facens.afdevops.treinamento.dto.SolicitacaoTreinamentoResponse;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.amqp.AmqpConnectException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TreinamentoUnitTests {

    private static final Instant AGORA = Instant.parse("2026-11-27T10:00:00Z");

    @Test
    void novaSolicitacaoComecaPendente() {
        var solicitacao = new SolicitacaoTreinamento("admin", AGORA);
        assertThat(solicitacao.getStatus()).isEqualTo(StatusTreinamento.PENDENTE);
        assertThat(solicitacao.getCriadoEm()).isEqualTo(AGORA);
        assertThat(solicitacao.getAtualizadoEm()).isEqualTo(AGORA);
    }

    @Test
    void concluiUmaVezEAceitaReenvioIgual() {
        var solicitacao = new SolicitacaoTreinamento("admin", AGORA);
        var depois = AGORA.plusSeconds(30);

        assertThat(solicitacao.atualizar(StatusTreinamento.CONCLUIDO, "1.0.0", "ok", depois)).isTrue();
        assertThat(solicitacao.atualizar(StatusTreinamento.CONCLUIDO, "1.0.0", "ok", depois.plusSeconds(1))).isFalse();
        assertThat(solicitacao.getAtualizadoEm()).isEqualTo(depois);
        assertThat(solicitacao.getVersaoModelo()).isEqualTo("1.0.0");
    }

    @Test
    void naoTrocaStatusFinalNemVoltaParaPendente() {
        var solicitacao = new SolicitacaoTreinamento("admin", AGORA);
        assertThatThrownBy(() -> solicitacao.atualizar(StatusTreinamento.PENDENTE, null, "x", AGORA))
                .isInstanceOf(SolicitacaoTreinamento.TransicaoInvalidaException.class);
        solicitacao.atualizar(StatusTreinamento.FALHOU, null, "erro", AGORA);
        assertThatThrownBy(() -> solicitacao.atualizar(StatusTreinamento.CONCLUIDO, "1.0.0", "ok", AGORA))
                .isInstanceOf(SolicitacaoTreinamento.TransicaoInvalidaException.class);
    }

    @ParameterizedTest
    @MethodSource("corposInvalidos")
    void validaCorpoDoWorker(AtualizacaoStatusRequest request, String campo) {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(request))
                    .anySatisfy(violacao -> assertThat(violacao.getPropertyPath().toString()).isEqualTo(campo));
        }
    }

    static Stream<Arguments> corposInvalidos() {
        return Stream.of(
                Arguments.of(new AtualizacaoStatusRequest(null, null, "ok"), "status"),
                Arguments.of(new AtualizacaoStatusRequest("PENDENTE", null, "ok"), "status"),
                Arguments.of(new AtualizacaoStatusRequest("concluido", null, "ok"), "status"),
                Arguments.of(new AtualizacaoStatusRequest("CONCLUIDO", "v".repeat(51), "ok"), "versaoModelo"),
                Arguments.of(new AtualizacaoStatusRequest("CONCLUIDO", "1\0", "ok"), "versaoModelo"),
                Arguments.of(new AtualizacaoStatusRequest("CONCLUIDO", "1.0.0", null), "mensagem"),
                Arguments.of(new AtualizacaoStatusRequest("CONCLUIDO", "1.0.0", " "), "mensagem"),
                Arguments.of(new AtualizacaoStatusRequest("FALHOU", null, "m".repeat(1001)), "mensagem"));
    }

    @Test
    void corpoValidoDoWorkerPassa() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(
                    new AtualizacaoStatusRequest("FALHOU", null, "Falha no processamento"))).isEmpty();
        }
    }

    @Test
    void falhaAoPublicarMarcaFalhouEResponde503() {
        var service = mock(TreinamentoService.class);
        var publicador = mock(PublicadorTreinamento.class);
        var criada = new SolicitacaoTreinamentoResponse(7L, StatusTreinamento.PENDENTE, "admin",
                null, null, AGORA, AGORA);
        when(service.criar("admin")).thenReturn(criada);
        doThrow(new AmqpConnectException(new RuntimeException("broker fora"))).when(publicador).publicar(anyLong());
        Principal usuario = () -> "admin";

        var controller = new TreinamentoController(service, publicador);

        assertThatThrownBy(() -> controller.solicitar(usuario))
                .isInstanceOf(TreinamentoController.FilaIndisponivelException.class);
        verify(service).registrarFalhaEnfileiramento(7L);
    }
}
