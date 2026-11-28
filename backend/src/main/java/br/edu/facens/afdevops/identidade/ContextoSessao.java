package br.edu.facens.afdevops.identidade;

import java.io.Serializable;
import java.util.UUID;

/**
 * Identifica um login. É gravado nos detalhes da autenticação, portanto muda junto com a identidade da
 * sessão. O cliente o devolve em cada requisição para que uma aba antiga não aja como outro usuário.
 * Não é credencial: sem o cookie de sessão, não autentica.
 */
public record ContextoSessao(String id) implements Serializable {
    public static final String CABECALHO = "X-Evolia-Contexto";

    public static ContextoSessao novo() {
        return new ContextoSessao(UUID.randomUUID().toString());
    }
}
