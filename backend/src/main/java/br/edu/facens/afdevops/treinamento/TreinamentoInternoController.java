package br.edu.facens.afdevops.treinamento;

import br.edu.facens.afdevops.treinamento.dto.AtualizacaoStatusRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Rota chamada somente pelo worker de IA (token bearer INTERNAL_API_TOKEN),
 * protegida pela cadeia de segurança de /internal/**.
 */
@RestController
class TreinamentoInternoController {

    private final TreinamentoService service;

    TreinamentoInternoController(TreinamentoService service) {
        this.service = service;
    }

    @PatchMapping("/internal/treinamentos/{id}/status")
    ResponseEntity<Void> atualizarStatus(@PathVariable Long id, @Valid @RequestBody AtualizacaoStatusRequest request) {
        service.atualizarStatus(id, request);
        return ResponseEntity.noContent().build();
    }
}
