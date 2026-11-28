package br.edu.facens.afdevops.seguranca;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.util.matcher.RequestMatcher;

final class ErrosSeguranca {
    private final RequestMatcher actuatorBloqueado;
    private final JacksonJsonHttpMessageConverter json = new JacksonJsonHttpMessageConverter();

    ErrosSeguranca(RequestMatcher actuatorBloqueado) {
        this.actuatorBloqueado = actuatorBloqueado;
    }

    void naoAutenticado(HttpServletRequest pedido, HttpServletResponse resposta, AuthenticationException erro)
            throws IOException {
        if (responderActuatorBloqueado(pedido, resposta)) {
            return;
        }

        escrever(resposta, HttpStatus.UNAUTHORIZED, "Autenticação necessária",
                "Informe credenciais válidas para acessar este recurso.", "AUTENTICACAO_NECESSARIA");
    }

    void acessoNegado(HttpServletRequest pedido, HttpServletResponse resposta, AccessDeniedException erro)
            throws IOException {
        if (responderActuatorBloqueado(pedido, resposta)) {
            return;
        }

        if (erro instanceof CsrfException) {
            escrever(resposta, HttpStatus.FORBIDDEN, "Token CSRF inválido",
                    "Obtenha um token CSRF válido e envie-o com o cookie correspondente.", "CSRF_INVALIDO");
            return;
        }

        escrever(resposta, HttpStatus.FORBIDDEN, "Acesso negado",
                "Seu perfil não tem permissão para acessar este recurso.", "ACESSO_NEGADO");
    }

    void sessaoSubstituida(HttpServletResponse resposta) throws IOException {
        escrever(resposta, HttpStatus.UNAUTHORIZED, "Sessão alterada",
                "A sessão deste navegador mudou. Entre novamente.", "SESSAO_SUBSTITUIDA");
    }

    void loginInvalido(HttpServletResponse resposta) throws IOException {
        escrever(resposta, HttpStatus.BAD_REQUEST, "Dados inválidos",
                "Envie as credenciais somente no corpo da requisição.", "DADOS_INVALIDOS");
    }

    private boolean responderActuatorBloqueado(HttpServletRequest pedido, HttpServletResponse resposta) {
        if (!actuatorBloqueado.matches(pedido)) {
            return false;
        }

        resposta.setStatus(HttpStatus.NOT_FOUND.value());
        return true;
    }

    private void escrever(HttpServletResponse resposta, HttpStatus status, String titulo, String detalhe, String codigo)
            throws IOException {
        var problema = ProblemDetail.forStatusAndDetail(status, detalhe);
        problema.setTitle(titulo);
        problema.setProperty("codigo", codigo);
        resposta.setStatus(status.value());
        resposta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        json.write(problema, MediaType.APPLICATION_PROBLEM_JSON, new ServletServerHttpResponse(resposta));
    }
}
