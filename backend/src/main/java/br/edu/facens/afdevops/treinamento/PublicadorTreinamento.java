package br.edu.facens.afdevops.treinamento;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Publica a mensagem consumida pelo worker de IA:
 * {@code {"solicitacao_id":"<id>"}} na exchange {@code ml.training} com a
 * routing key {@code training.requested}, persistente e com confirmação do broker.
 */
@Component
class PublicadorTreinamento {

    private static final long TIMEOUT_CONFIRMACAO_MS = 5_000;
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final RabbitTemplate rabbit;

    PublicadorTreinamento(RabbitTemplate rabbit) {
        this.rabbit = rabbit;
    }

    void publicar(long solicitacaoId) {
        byte[] corpo = JSON.writeValueAsString(Map.of("solicitacao_id", Long.toString(solicitacaoId)))
                .getBytes(StandardCharsets.UTF_8);
        var mensagem = MessageBuilder.withBody(corpo)
                .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                .setContentEncoding(StandardCharsets.UTF_8.name())
                .setDeliveryMode(MessageDeliveryMode.PERSISTENT)
                .setMessageId("treinamento-" + solicitacaoId)
                .build();
        rabbit.invoke(operacoes -> {
            operacoes.send(TreinamentoMensageria.EXCHANGE, TreinamentoMensageria.ROUTING_KEY, mensagem);
            operacoes.waitForConfirmsOrDie(TIMEOUT_CONFIRMACAO_MS);
            return null;
        });
    }
}
