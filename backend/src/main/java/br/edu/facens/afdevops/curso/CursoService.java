package br.edu.facens.afdevops.curso;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import br.edu.facens.afdevops.curso.dto.CursoRequest;
import br.edu.facens.afdevops.curso.dto.CursoResponse;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class CursoService {

    private final CursoRepository repository;

    CursoService(CursoRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public CursoResponse cadastrar(CursoRequest request) {
        var curso = new Curso(request.nome(), request.descricao(), request.cargaHoraria(),
                request.categoria(), request.nivel(), Instant.now().truncatedTo(ChronoUnit.MICROS));
        return resposta(repository.save(curso));
    }

    @Transactional(readOnly = true)
    public List<CursoResponse> listar() {
        return repository.findAll(Sort.by("id")).stream().map(CursoService::resposta).toList();
    }

    @Transactional(readOnly = true)
    public CursoResponse consultar(Long id) {
        return repository.findById(id).map(CursoService::resposta)
                .orElseThrow(CursoNaoEncontradoException::new);
    }

    private static CursoResponse resposta(Curso curso) {
        return new CursoResponse(curso.getId(), curso.getNome(), curso.getDescricao(), curso.getCargaHoraria(),
                curso.getCategoria(), curso.getNivel(), curso.getCriadoEm());
    }

    static class CursoNaoEncontradoException extends RuntimeException {
    }
}
