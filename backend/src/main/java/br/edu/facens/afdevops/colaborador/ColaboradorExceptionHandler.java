package br.edu.facens.afdevops.colaborador;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = ColaboradorController.class)
class ColaboradorExceptionHandler {

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class})
    ProblemDetail dadosInvalidos() {
        return problema(HttpStatus.BAD_REQUEST, "Dados inválidos",
                "Verifique os dados informados na requisição.", "DADOS_INVALIDOS");
    }

    @ExceptionHandler(ColaboradorService.EmailDuplicadoException.class)
    ProblemDetail emailDuplicado() {
        return problema(HttpStatus.CONFLICT, "E-mail duplicado",
                "Já existe um colaborador com esse e-mail.", "EMAIL_DUPLICADO");
    }

    @ExceptionHandler(ColaboradorService.ColaboradorNaoEncontradoException.class)
    ProblemDetail colaboradorNaoEncontrado() {
        return problema(HttpStatus.NOT_FOUND, "Colaborador não encontrado",
                "Nenhum colaborador foi encontrado para o identificador informado.", "COLABORADOR_NAO_ENCONTRADO");
    }

    private static ProblemDetail problema(HttpStatus status, String titulo, String detalhe, String codigo) {
        var problema = ProblemDetail.forStatusAndDetail(status, detalhe);
        problema.setTitle(titulo);
        problema.setProperty("codigo", codigo);
        return problema;
    }
}
