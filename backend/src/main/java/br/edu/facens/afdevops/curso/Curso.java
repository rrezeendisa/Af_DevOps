package br.edu.facens.afdevops.curso;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "cursos")
public class Curso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String nome;

    @Column(nullable = false, length = 2000)
    private String descricao;

    @Column(name = "carga_horaria", nullable = false)
    private Integer cargaHoraria;

    @Column(nullable = false, length = 100)
    private String categoria;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private NivelCurso nivel;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected Curso() {
    }

    Curso(String nome, String descricao, Integer cargaHoraria, String categoria, NivelCurso nivel, Instant criadoEm) {
        this.nome = nome;
        this.descricao = descricao;
        this.cargaHoraria = cargaHoraria;
        this.categoria = categoria;
        this.nivel = nivel;
        this.criadoEm = criadoEm;
    }

    Long getId() {
        return id;
    }

    String getNome() {
        return nome;
    }

    String getDescricao() {
        return descricao;
    }

    Integer getCargaHoraria() {
        return cargaHoraria;
    }

    String getCategoria() {
        return categoria;
    }

    NivelCurso getNivel() {
        return nivel;
    }

    Instant getCriadoEm() {
        return criadoEm;
    }
}
