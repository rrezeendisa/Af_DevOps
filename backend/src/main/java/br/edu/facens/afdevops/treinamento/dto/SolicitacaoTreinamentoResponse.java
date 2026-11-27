package br.edu.facens.afdevops.treinamento.dto;

import java.time.Instant;

import br.edu.facens.afdevops.treinamento.StatusTreinamento;

public record SolicitacaoTreinamentoResponse(Long id, StatusTreinamento status, String solicitadoPor,
        String versaoModelo, String mensagem, Instant criadoEm, Instant atualizadoEm) {
}
