package br.edu.facens.afdevops.ia;

import br.edu.facens.afdevops.identidade.ContaAutenticada;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ia")
class IaController {
    private final IaService ia;
    private final IaEntrada entrada;

    IaController(IaService ia, IaEntrada entrada) {
        this.ia = ia;
        this.entrada = entrada;
    }

    @PostMapping("/classificacoes")
    ResponseEntity<IaDtos.Classificacao> classificar(@AuthenticationPrincipal ContaAutenticada conta,
            HttpServletRequest pedido) {
        return semCache(ia.classificar(conta, entrada.classificacao(pedido)));
    }

    @PostMapping("/recomendacoes")
    ResponseEntity<IaDtos.Recomendacoes> recomendar(@AuthenticationPrincipal ContaAutenticada conta,
            HttpServletRequest pedido) {
        return semCache(ia.recomendar(conta, entrada.recomendacao(pedido)));
    }

    @PostMapping("/orientacoes")
    ResponseEntity<IaDtos.Orientacao> orientar(@AuthenticationPrincipal ContaAutenticada conta,
            HttpServletRequest pedido) {
        return semCache(ia.orientar(conta, entrada.orientacao(pedido)));
    }

    @ExceptionHandler(IaFalha.Erro.class)
    ResponseEntity<ProblemDetail> falha(IaFalha.Erro erro) {
        var falha = erro.falha;
        var problema = ProblemDetail.forStatusAndDetail(falha.status, falha.detalhe);
        problema.setProperty("codigo", falha.name());
        return ResponseEntity.status(falha.status).cacheControl(CacheControl.noStore()).body(problema);
    }

    private static <T> ResponseEntity<T> semCache(T resposta) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(resposta);
    }
}
