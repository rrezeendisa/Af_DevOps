package br.edu.facens.afdevops.treinamento;

public enum StatusTreinamento {
    /** Solicitação registrada e publicada na fila, aguardando o worker de IA. */
    PENDENTE,
    /** Worker treinou e salvou o modelo. */
    CONCLUIDO,
    /** Falha no treinamento, na notificação ou ao enfileirar a solicitação. */
    FALHOU;

    boolean finalizado() {
        return this != PENDENTE;
    }
}
