package br.edu.facens.afdevops.curso;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = CursoController.class)
class CursoExceptionHandler {

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class})
    ProblemDetail dadosInvalidos() {
        return problema(HttpStatus.BAD_REQUEST, "Dados inválidos",
                "Verifique os dados informados na requisição.", "DADOS_INVALIDOS");
    }

    @ExceptionHandler(CursoService.CursoNaoEncontradoException.class)
    ProblemDetail cursoNaoEncontrado() {
        return problema(HttpStatus.NOT_FOUND, "Curso não encontrado",
                "Nenhum curso foi encontrado para o identificador informado.", "CURSO_NAO_ENCONTRADO");
    }

    private static ProblemDetail problema(HttpStatus status, String titulo, String detalhe, String codigo) {
        var problema = ProblemDetail.forStatusAndDetail(status, detalhe);
        problema.setTitle(titulo);
        problema.setProperty("codigo", codigo);
        return problema;
    }
}
