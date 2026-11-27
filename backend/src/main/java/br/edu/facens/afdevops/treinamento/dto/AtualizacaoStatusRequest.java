package br.edu.facens.afdevops.treinamento.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Corpo enviado pelo worker de IA em
 * {@code PATCH /internal/treinamentos/{id}/status}, conforme
 * ai-service/app/training_messages.py (TrainingStatusPayload).
 */
public record AtualizacaoStatusRequest(
        @NotNull @Pattern(regexp = "CONCLUIDO|FALHOU") String status,
        @Size(max = 50) @Pattern(regexp = "[^\\x00]*") String versaoModelo,
        @NotBlank @Size(max = 1000) @Pattern(regexp = "[^\\x00]*") String mensagem) {
}
