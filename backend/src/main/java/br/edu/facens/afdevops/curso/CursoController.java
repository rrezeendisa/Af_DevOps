package br.edu.facens.afdevops.curso;

import java.net.URI;
import java.util.List;

import br.edu.facens.afdevops.curso.dto.CursoRequest;
import br.edu.facens.afdevops.curso.dto.CursoResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(CursoController.ROTA)
class CursoController {

    static final String ROTA = "/api/cursos";

    private final CursoService service;

    CursoController(CursoService service) {
        this.service = service;
    }

    @PostMapping
    ResponseEntity<CursoResponse> cadastrar(@Valid @RequestBody CursoRequest request) {
        var response = service.cadastrar(request);
        return ResponseEntity.created(URI.create(ROTA + "/" + response.id())).body(response);
    }

    @GetMapping
    List<CursoResponse> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    CursoResponse consultar(@PathVariable Long id) {
        return service.consultar(id);
    }
}
