package br.edu.facens.afdevops.treinamento;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = {TreinamentoController.class, TreinamentoInternoController.class})
class TreinamentoExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(TreinamentoExceptionHandler.class);

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class})
    ProblemDetail dadosInvalidos() {
        return problema(HttpStatus.BAD_REQUEST, "Dados inválidos",
                "Verifique os dados informados na requisição.", "DADOS_INVALIDOS");
    }

    @ExceptionHandler(TreinamentoService.SolicitacaoNaoEncontradaException.class)
    ProblemDetail naoEncontrada() {
        return problema(HttpStatus.NOT_FOUND, "Solicitação não encontrada",
                "Nenhuma solicitação de treinamento foi encontrada para o identificador informado.",
                "SOLICITACAO_NAO_ENCONTRADA");
    }

    @ExceptionHandler(SolicitacaoTreinamento.TransicaoInvalidaException.class)
    ProblemDetail transicaoInvalida() {
        return problema(HttpStatus.CONFLICT, "Status conflitante",
                "A solicitação já foi finalizada com outro status.", "STATUS_CONFLITANTE");
    }

    @ExceptionHandler(TreinamentoController.FilaIndisponivelException.class)
    ProblemDetail filaIndisponivel(TreinamentoController.FilaIndisponivelException erro) {
        LOG.warn("Falha ao publicar solicitação de treinamento no RabbitMQ: {}", erro.getCause().toString());
        return problema(HttpStatus.SERVICE_UNAVAILABLE, "Fila indisponível",
                "A solicitação foi registrada como FALHOU porque a fila de treinamento está indisponível.",
                "FILA_INDISPONIVEL");
    }

    private static ProblemDetail problema(HttpStatus status, String titulo, String detalhe, String codigo) {
        var problema = ProblemDetail.forStatusAndDetail(status, detalhe);
        problema.setTitle(titulo);
        problema.setProperty("codigo", codigo);
        return problema;
    }
}
