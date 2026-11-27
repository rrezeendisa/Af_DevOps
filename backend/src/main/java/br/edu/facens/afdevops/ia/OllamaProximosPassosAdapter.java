package br.edu.facens.afdevops.ia;

import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

@Component
@ConditionalOnProperty(name = "afdevops.ia.generativa.habilitada", havingValue = "true")
class OllamaProximosPassosAdapter implements ProximosPassosPort {
    private static final Logger LOG = LoggerFactory.getLogger(OllamaProximosPassosAdapter.class);
    private static final int LIMITE_RESPOSTA = 4096;
    private static final String INSTRUCOES = "Você é um orientador de educação corporativa. "
            + "Sugira três atividades práticas para desenvolver lógica, comunicação profissional e tecnologia. "
            + "Considere o nível de aprendizagem informado. Escreva em português brasileiro, "
            + "com frases de até 80 caracteres. Retorne somente um JSON com a chave proximosPassos "
            + "contendo três strings distintas.";

    private final ChatClient cliente;
    private final ObjectReader leitor;
    private final Duration timeout;

    OllamaProximosPassosAdapter(ChatClient.Builder builder, JsonMapper json,
            @Value("${afdevops.ia.generativa.timeout}") Duration timeout) {
        if (timeout.isZero() || timeout.isNegative()) {
            throw new IllegalArgumentException("O tempo limite do Ollama deve ser positivo.");
        }
        this.cliente = builder.build();
        this.leitor = json.reader().with(DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY)
                .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
        this.timeout = timeout;
    }

    @Override
    public List<String> gerar(IaDtos.Nivel nivel) {
        long inicio = System.nanoTime();
        try {
            var texto = cliente.prompt().system(INSTRUCOES).user("Nível de aprendizagem: " + nivel.name())
                    .stream().content()
                    .collect(StringBuilder::new, (acumulado, trecho) -> {
                        if (trecho.length() > LIMITE_RESPOSTA - acumulado.length()) {
                            throw new SaidaInvalida();
                        }
                        acumulado.append(trecho);
                    })
                    .timeout(timeout)
                    .block();
            var passos = validar(texto == null ? "" : texto.toString());
            registrar(inicio, passos.isEmpty() ? "fallback_saida_invalida" : "sucesso");
            return passos;
        } catch (RuntimeException erro) {
            String resultado = "fallback_indisponivel";
            for (Throwable causa = erro; causa != null; causa = causa.getCause()) {
                if (causa instanceof TimeoutException) {
                    resultado = "fallback_timeout";
                    break;
                }
                if (causa instanceof SaidaInvalida || causa instanceof tools.jackson.core.JacksonException) {
                    resultado = "fallback_saida_invalida";
                    break;
                }
            }
            registrar(inicio, resultado);
            return List.of();
        }
    }

    private List<String> validar(String texto) {
        var objeto = leitor.readTree(texto);
        if (objeto == null || !objeto.isObject() || objeto.size() != 1) {
            return List.of();
        }
        var itens = objeto.get("proximosPassos");
        if (itens == null || !itens.isArray() || itens.isEmpty() || itens.size() > 3) {
            return List.of();
        }
        var passos = new LinkedHashSet<String>();
        for (var item : itens) {
            if (!item.isString()) {
                return List.of();
            }
            String passo = item.asString().strip();
            if (passo.isEmpty() || passo.codePointCount(0, passo.length()) > 120
                    || passo.codePoints().anyMatch(Character::isISOControl) || !passos.add(passo)) {
                return List.of();
            }
        }
        return List.copyOf(passos);
    }

    private static void registrar(long inicio, String resultado) {
        LOG.info("geracao_proximos_passos resultado={} duracao_ms={}", resultado,
                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - inicio));
    }

    private static final class SaidaInvalida extends RuntimeException {
    }
}
