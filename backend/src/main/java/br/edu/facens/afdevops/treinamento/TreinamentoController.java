package br.edu.facens.afdevops.treinamento;

import java.net.URI;
import java.security.Principal;
import java.util.List;

import br.edu.facens.afdevops.treinamento.dto.SolicitacaoTreinamentoResponse;
import org.springframework.amqp.AmqpException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Acompanhamento das solicitações de treinamento do modelo de IA.
 *
 * <p>A solicitação é gravada (PENDENTE) antes da publicação na fila, assim o
 * registro já existe quando o worker enviar o status. Se o broker não
 * confirmar a mensagem, a solicitação fica FALHOU e a API responde 503.
 */
@RestController
@RequestMapping(TreinamentoController.ROTA)
class TreinamentoController {

    static final String ROTA = "/api/treinamentos";

    private final TreinamentoService service;
    private final PublicadorTreinamento publicador;

    TreinamentoController(TreinamentoService service, PublicadorTreinamento publicador) {
        this.service = service;
        this.publicador = publicador;
    }

    @PostMapping
    ResponseEntity<SolicitacaoTreinamentoResponse> solicitar(Principal usuario) {
        var criada = service.criar(usuario.getName());
        try {
            publicador.publicar(criada.id());
        } catch (AmqpException erro) {
            service.registrarFalhaEnfileiramento(criada.id());
            throw new FilaIndisponivelException(erro);
        }
        return ResponseEntity.accepted().location(URI.create(ROTA + "/" + criada.id())).body(criada);
    }

    @GetMapping
    List<SolicitacaoTreinamentoResponse> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    SolicitacaoTreinamentoResponse consultar(@PathVariable Long id) {
        return service.consultar(id);
    }

    static class FilaIndisponivelException extends RuntimeException {
        FilaIndisponivelException(Throwable causa) {
            super(causa);
        }
    }
}
