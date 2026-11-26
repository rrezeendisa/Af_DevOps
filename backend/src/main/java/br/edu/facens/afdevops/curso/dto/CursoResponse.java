package br.edu.facens.afdevops.curso.dto;

import java.time.Instant;

import br.edu.facens.afdevops.curso.NivelCurso;

public record CursoResponse(Long id, String nome, String descricao, Integer cargaHoraria,
        String categoria, NivelCurso nivel, Instant criadoEm) {
}
