package br.edu.facens.afdevops.treinamento;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topologia RabbitMQ das solicitações de treinamento, idêntica à declarada
 * pelo worker Python (ai-service/worker/consumer.py) e por
 * infra/rabbitmq/definitions.json.
 *
 * <p>O backend também declara a topologia para que nenhuma mensagem seja
 * descartada caso publique antes de o worker conectar. As filas não usam
 * x-arguments: o dead-letter é aplicado por política no broker, evitando
 * erros PRECONDITION_FAILED entre declarações diferentes.
 */
@Configuration(proxyBeanMethods = false)
class TreinamentoMensageria {

    static final String EXCHANGE = "ml.training";
    static final String ROUTING_KEY = "training.requested";
    static final String FILA = "ml.training.requests";
    static final String FILA_DEAD_LETTER = "ml.training.requests.dead-letter";

    @Bean
    DirectExchange exchangeTreinamento() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    Queue filaTreinamento() {
        return new Queue(FILA, true, false, false);
    }

    @Bean
    Queue filaTreinamentoDeadLetter() {
        return new Queue(FILA_DEAD_LETTER, true, false, false);
    }

    @Bean
    Binding bindingTreinamento(Queue filaTreinamento, DirectExchange exchangeTreinamento) {
        return BindingBuilder.bind(filaTreinamento).to(exchangeTreinamento).with(ROUTING_KEY);
    }
}
