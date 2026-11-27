package br.edu.facens.afdevops.identidade;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "contas_colaborador")
class ContaColaborador {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String nomeUsuario;

    @Column(nullable = false, length = 60)
    private String senhaHash;

    @Column(nullable = false, unique = true)
    private Long colaboradorId;

    @Column(nullable = false)
    private Instant criadoEm;

    protected ContaColaborador() {
    }

    ContaColaborador(String nomeUsuario, String senhaHash, Long colaboradorId, Instant criadoEm) {
        this.nomeUsuario = nomeUsuario;
        this.senhaHash = senhaHash;
        this.colaboradorId = colaboradorId;
        this.criadoEm = criadoEm;
    }

    Long getId() { return id; }
    String getNomeUsuario() { return nomeUsuario; }
    String getSenhaHash() { return senhaHash; }
    Long getColaboradorId() { return colaboradorId; }
    Instant getCriadoEm() { return criadoEm; }
}
