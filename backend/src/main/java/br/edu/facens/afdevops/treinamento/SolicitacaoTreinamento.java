package br.edu.facens.afdevops.treinamento;

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
@Table(name = "solicitacoes_treinamento")
public class SolicitacaoTreinamento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private StatusTreinamento status;

    @Column(name = "solicitado_por", nullable = false, length = 64, updatable = false)
    private String solicitadoPor;

    @Column(name = "versao_modelo", length = 50)
    private String versaoModelo;

    @Column(length = 1000)
    private String mensagem;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected SolicitacaoTreinamento() {
    }

    SolicitacaoTreinamento(String solicitadoPor, Instant agora) {
        this.status = StatusTreinamento.PENDENTE;
        this.solicitadoPor = solicitadoPor;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    /**
     * Aplica o status informado pelo worker. Repetir o mesmo status final é
     * aceito sem alterações (o worker pode reenviar após uma falha de rede);
     * trocar um status final por outro diferente é um conflito.
     *
     * @return {@code true} se houve alteração
     */
    boolean atualizar(StatusTreinamento novoStatus, String novaVersao, String novaMensagem, Instant agora) {
        if (novoStatus == StatusTreinamento.PENDENTE) {
            throw new TransicaoInvalidaException();
        }
        if (status.finalizado()) {
            if (status != novoStatus) {
                throw new TransicaoInvalidaException();
            }
            return false;
        }
        status = novoStatus;
        versaoModelo = novaVersao;
        mensagem = novaMensagem;
        atualizadoEm = agora;
        return true;
    }

    Long getId() {
        return id;
    }

    StatusTreinamento getStatus() {
        return status;
    }

    String getSolicitadoPor() {
        return solicitadoPor;
    }

    String getVersaoModelo() {
        return versaoModelo;
    }

    String getMensagem() {
        return mensagem;
    }

    Instant getCriadoEm() {
        return criadoEm;
    }

    Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    static class TransicaoInvalidaException extends RuntimeException {
    }
}
