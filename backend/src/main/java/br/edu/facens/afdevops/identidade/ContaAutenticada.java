package br.edu.facens.afdevops.identidade;

import java.util.List;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

public final class ContaAutenticada extends User {
    private final Long colaboradorId;

    ContaAutenticada(ContaColaborador conta) {
        super(conta.getNomeUsuario(), conta.getSenhaHash(), List.of(new SimpleGrantedAuthority("ROLE_COLABORADOR")));
        this.colaboradorId = conta.getColaboradorId();
    }

    public Long colaboradorId() {
        return colaboradorId;
    }
}
