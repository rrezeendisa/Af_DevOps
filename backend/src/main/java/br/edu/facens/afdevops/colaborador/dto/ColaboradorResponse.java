package br.edu.facens.afdevops.colaborador.dto;

import java.time.Instant;

public record ColaboradorResponse(
        Long id,
        String nome,
        String email,
        String cargo,
        String departamento,
        Instant criadoEm) {
}
