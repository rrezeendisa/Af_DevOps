package br.edu.facens.afdevops.colaborador;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import br.edu.facens.afdevops.colaborador.dto.ColaboradorRequest;
import br.edu.facens.afdevops.colaborador.dto.ColaboradorResponse;
import org.postgresql.util.PSQLException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ColaboradorService {

    private final ColaboradorRepository repository;

    ColaboradorService(ColaboradorRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ColaboradorResponse cadastrar(ColaboradorRequest request) {
        var colaborador = new Colaborador(request.nome(), request.email(), request.cargo(),
                request.departamento(), Instant.now().truncatedTo(ChronoUnit.MICROS));
        try {
            return resposta(repository.saveAndFlush(colaborador));
        }
        catch (DataIntegrityViolationException exception) {
            for (Throwable causa = exception.getCause(); causa != null; causa = causa.getCause()) {
                if (causa instanceof PSQLException postgres
                        && "23505".equals(postgres.getSQLState())
                        && postgres.getServerErrorMessage() != null
                        && "ux_colaboradores_email_lower".equals(postgres.getServerErrorMessage().getConstraint())) {
                    throw new EmailDuplicadoException(exception);
                }
            }
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public List<ColaboradorResponse> listar() {
        return repository.findAll(Sort.by("id")).stream().map(ColaboradorService::resposta).toList();
    }

    @Transactional(readOnly = true)
    public ColaboradorResponse consultar(Long id) {
        return repository.findById(id).map(ColaboradorService::resposta)
                .orElseThrow(ColaboradorNaoEncontradoException::new);
    }

    private static ColaboradorResponse resposta(Colaborador colaborador) {
        return new ColaboradorResponse(colaborador.getId(), colaborador.getNome(), colaborador.getEmail(),
                colaborador.getCargo(), colaborador.getDepartamento(), colaborador.getCriadoEm());
    }

    static class EmailDuplicadoException extends RuntimeException {
        EmailDuplicadoException(Throwable cause) {
            super(cause);
        }
    }

    static class ColaboradorNaoEncontradoException extends RuntimeException {
    }
}
