package br.edu.facens.afdevops.ia;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import reactor.core.publisher.Flux;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OllamaProximosPassosAdapterTests {
    private final ChatModel modelo = mock(ChatModel.class);

    @BeforeEach
    void configuraOpcoesDoModelo() {
        when(modelo.getOptions()).thenReturn(OllamaChatOptions.builder().model("qwen2.5:1.5b").build());
    }

    @Test
    void validaSaidaDoChatClientEEnviaSomenteNivel() {
        when(modelo.stream(any(Prompt.class))).thenReturn(Flux.just(
                trecho("{\"proximosPassos\":[\"Pratique lógica.\","),
                trecho("\"Revise o exercício.\"]}")));

        assertThat(adapter(Duration.ofSeconds(5)).gerar(IaDtos.Nivel.AVANCADO))
                .containsExactly("Pratique lógica.", "Revise o exercício.");
        var argumento = org.mockito.ArgumentCaptor.forClass(Prompt.class);
        verify(modelo).stream(argumento.capture());
        assertThat(argumento.getValue().getUserMessage().getText()).isEqualTo("Nível de aprendizagem: AVANCADO");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "Sem JSON", "{\"proximosPassos\":[]}", "{\"proximosPassos\":[1]}",
            "{\"proximosPassos\":[\"A\",\"A\"]}", "{\"proximosPassos\":[\"A\",\"B\",\"C\",\"D\"]}",
            "{\"proximosPassos\":[\"  \"]}", "{\"proximosPassos\":[\"A\"],\"acao\":\"ignorada\"}"})
    void usaFallbackParaSaidaInvalida(String saida) {
        when(modelo.stream(any(Prompt.class))).thenReturn(Flux.just(trecho(saida)));
        assertThat(adapter(Duration.ofSeconds(5)).gerar(IaDtos.Nivel.INICIANTE)).isEmpty();
        verify(modelo).stream(any(Prompt.class));
    }

    @Test
    void indisponibilidadeUsaFallbackSemRetentar() {
        when(modelo.stream(any(Prompt.class))).thenReturn(Flux.error(new IllegalStateException("erro simulado")));
        assertThat(adapter(Duration.ofSeconds(5)).gerar(IaDtos.Nivel.INTERMEDIARIO)).isEmpty();
        verify(modelo, times(1)).stream(any(Prompt.class));
    }

    @Test
    void cancelaStreamingMesmoComFragmentosContinuos() {
        var fragmentos = new java.util.concurrent.atomic.AtomicInteger();
        var cancelou = new AtomicBoolean();
        var fluxo = Flux.interval(Duration.ofMillis(10))
                .map(i -> {
                    fragmentos.incrementAndGet();
                    return trecho("a");
                })
                .doOnCancel(() -> cancelou.set(true));
        when(modelo.stream(any(Prompt.class))).thenReturn(fluxo);

        assertThat(adapter(Duration.ofMillis(300)).gerar(IaDtos.Nivel.INICIANTE)).isEmpty();
        assertThat(fragmentos.get()).isPositive();
        assertThat(cancelou.get()).isTrue();
        verify(modelo, times(1)).stream(any(Prompt.class));
    }

    @Test
    void cancelaSeNenhumFragmentoChegar() {
        var cancelou = new AtomicBoolean();
        when(modelo.stream(any(Prompt.class))).thenReturn(
                Flux.<ChatResponse>never().doOnCancel(() -> cancelou.set(true)));
        assertThat(adapter(Duration.ofMillis(100)).gerar(IaDtos.Nivel.INICIANTE)).isEmpty();
        assertThat(cancelou.get()).isTrue();
        verify(modelo, times(1)).stream(any(Prompt.class));
    }

    private OllamaProximosPassosAdapter adapter(Duration timeout) {
        return new OllamaProximosPassosAdapter(ChatClient.builder(modelo), JsonMapper.builder().build(), timeout);
    }

    private static ChatResponse trecho(String texto) {
        return new ChatResponse(java.util.List.of(new Generation(new AssistantMessage(texto))));
    }
}
