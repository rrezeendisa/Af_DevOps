package br.edu.facens.afdevops.curso.dto;

import br.edu.facens.afdevops.curso.NivelCurso;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.annotation.JsonDeserialize;

public record CursoRequest(
        @NotBlank @Size(max = 150) String nome,
        @NotBlank @Size(max = 2000) String descricao,
        @NotNull @Positive @JsonDeserialize(using = InteiroEstritoDeserializer.class) Integer cargaHoraria,
        @NotBlank @Size(max = 100) String categoria,
        @NotNull @JsonDeserialize(using = NivelCursoDeserializer.class) NivelCurso nivel) {
}
