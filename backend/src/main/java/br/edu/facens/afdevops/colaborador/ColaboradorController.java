package br.edu.facens.afdevops.colaborador;

import java.net.URI;
import java.util.List;

import br.edu.facens.afdevops.colaborador.dto.ColaboradorRequest;
import br.edu.facens.afdevops.colaborador.dto.ColaboradorResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ColaboradorController.ROTA)
class ColaboradorController {

    static final String ROTA = "/api/colaboradores";

    private final ColaboradorService service;

    ColaboradorController(ColaboradorService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<ColaboradorResponse> cadastrar(@Valid @RequestBody ColaboradorRequest request) {
        var response = service.cadastrar(request);
        return ResponseEntity.created(URI.create(ROTA + "/" + response.id())).body(response);
    }

    @GetMapping
    List<ColaboradorResponse> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    ColaboradorResponse consultar(@PathVariable Long id) {
        return service.consultar(id);
    }
}
