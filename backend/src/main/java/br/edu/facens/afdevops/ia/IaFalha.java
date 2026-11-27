package br.edu.facens.afdevops.ia;

import org.springframework.http.HttpStatus;

enum IaFalha {
    DADOS_INVALIDOS(HttpStatus.BAD_REQUEST, "Informe um corpo JSON válido para esta operação."),
    CONSENTIMENTO_IA_NECESSARIO(HttpStatus.FORBIDDEN, "Autorize o uso dos seus dados para acessar esta funcionalidade."),
    IA_RESPOSTA_INVALIDA(HttpStatus.BAD_GATEWAY, "O serviço de IA retornou uma resposta incompatível."),
    IA_INDISPONIVEL(HttpStatus.SERVICE_UNAVAILABLE, "O serviço de IA está indisponível."),
    IA_TEMPO_LIMITE(HttpStatus.GATEWAY_TIMEOUT, "O serviço de IA excedeu o tempo limite.");

    final HttpStatus status;
    final String detalhe;

    IaFalha(HttpStatus status, String detalhe) {
        this.status = status;
        this.detalhe = detalhe;
    }

    Erro erro() {
        return new Erro(this);
    }

    static final class Erro extends RuntimeException {
        final IaFalha falha;

        private Erro(IaFalha falha) {
            super(falha.detalhe);
            this.falha = falha;
        }
    }
}
