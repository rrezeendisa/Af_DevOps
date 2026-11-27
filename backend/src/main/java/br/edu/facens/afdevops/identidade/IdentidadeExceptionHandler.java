package br.edu.facens.afdevops.identidade;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = IdentidadeController.class)
class IdentidadeExceptionHandler {
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ProblemDetail dadosInvalidos() {
        return problema(HttpStatus.BAD_REQUEST, "DADOS_INVALIDOS", "Informe dados válidos para a conta.");
    }

    @ExceptionHandler(ContasIndividuais.Falha.class)
    ProblemDetail falhaDaConta(ContasIndividuais.Falha falha) {
        return problema(falha.status, falha.codigo, falha.getMessage());
    }

    private ProblemDetail problema(HttpStatus status, String codigo, String detalhe) {
        var problema = ProblemDetail.forStatusAndDetail(status, detalhe);
        problema.setProperty("codigo", codigo);
        return problema;
    }
}
