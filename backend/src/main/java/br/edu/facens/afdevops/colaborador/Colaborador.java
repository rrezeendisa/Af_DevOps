package br.edu.facens.afdevops.colaborador;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "colaboradores")
public class Colaborador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String nome;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(nullable = false, length = 100)
    private String cargo;

    @Column(nullable = false, length = 100)
    private String departamento;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected Colaborador() {
    }

    Colaborador(String nome, String email, String cargo, String departamento, Instant criadoEm) {
        this.nome = nome;
        this.email = email;
        this.cargo = cargo;
        this.departamento = departamento;
        this.criadoEm = criadoEm;
    }

    Long getId() {
        return id;
    }

    String getNome() {
        return nome;
    }

    String getEmail() {
        return email;
    }

    String getCargo() {
        return cargo;
    }

    String getDepartamento() {
        return departamento;
    }

    Instant getCriadoEm() {
        return criadoEm;
    }
}
