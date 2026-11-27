package br.edu.facens.afdevops.identidade;

import java.io.IOException;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

@RestController
class IdentidadeController {
    private final ContasIndividuais contas;
    private final ObjectReader leitorConta;

    IdentidadeController(ContasIndividuais contas, JsonMapper json) {
        this.contas = contas;
        this.leitorConta = json.readerFor(CriarContaRequest.class)
                .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @PostMapping(path = "/api/colaboradores/{id}/conta", consumes = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<ContasIndividuais.ContaCriada> criar(@PathVariable long id, HttpServletRequest requisicao) {
        CriarContaRequest pedido = lerConta(requisicao);
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
                .body(contas.criar(id, pedido.nomeUsuario(), pedido.senhaInicial()));
    }

    private CriarContaRequest lerConta(HttpServletRequest requisicao) {
        try {
            CriarContaRequest pedido = leitorConta.readValue(requisicao.getInputStream());
            if (pedido != null) {
                return pedido;
            }
        } catch (IOException | JacksonException erro) {
            // Não propagar exceções do parser que possam conter o corpo da requisição.
        }
        throw new ContasIndividuais.Falha(HttpStatus.BAD_REQUEST, "DADOS_INVALIDOS",
                "Informe dados válidos para a conta.");
    }

    @GetMapping("/api/me")
    ResponseEntity<IdentidadeResponse> identificar(Authentication autenticacao) {
        String perfil = autenticacao.getAuthorities().stream()
                .anyMatch(papel -> "ROLE_ADMIN".equals(papel.getAuthority())) ? "ADMIN" : "COLABORADOR";
        Long colaboradorId = autenticacao.getPrincipal() instanceof ContaAutenticada conta
                ? conta.colaboradorId() : null;
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new IdentidadeResponse(autenticacao.getName(), perfil, colaboradorId));
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record IdentidadeResponse(String nomeUsuario, String perfil, Long colaboradorId) {
    }
}
