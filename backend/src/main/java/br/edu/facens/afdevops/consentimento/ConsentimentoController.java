package br.edu.facens.afdevops.consentimento;

import br.edu.facens.afdevops.identidade.ContaAutenticada;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/consentimento")
class ConsentimentoController {
    private final ConsentimentoService consentimentos;

    ConsentimentoController(ConsentimentoService consentimentos) {
        this.consentimentos = consentimentos;
    }

    @GetMapping
    ResponseEntity<ConsentimentoService.Decisao> consultar(@AuthenticationPrincipal ContaAutenticada conta) {
        return semCache(consentimentos.consultar(conta.colaboradorId()));
    }

    @PutMapping
    ResponseEntity<ConsentimentoService.Decisao> decidir(@AuthenticationPrincipal ContaAutenticada conta,
            @RequestBody ConsentimentoRequest pedido) {
        return semCache(consentimentos.decidir(conta.colaboradorId(), pedido.autorizado()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> dadosInvalidos() {
        var problema = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Informe somente o campo autorizado com valor true ou false.");
        problema.setProperty("codigo", "DADOS_INVALIDOS");
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore()).body(problema);
    }

    private ResponseEntity<ConsentimentoService.Decisao> semCache(ConsentimentoService.Decisao decisao) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(decisao);
    }
}
