package br.edu.facens.afdevops.ia;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class OllamaConfiguracaoTests {
    private static final String AGREGADOR = "org.springframework.ai.chat.model.MessageAggregator";
    private final LoggingSystem logging = LoggingSystem.get(getClass().getClassLoader());
    private final LogLevel nivelAnterior = logging.getLoggerConfiguration(AGREGADOR) == null ? null
            : logging.getLoggerConfiguration(AGREGADOR).getConfiguredLevel();
    private final ApplicationContextRunner contexto = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withInitializer(app -> app.getBeanFactory()
                    .setConversionService(ApplicationConversionService.getSharedInstance()))
            .withInitializer(app -> logging.setLogLevel(AGREGADOR, LogLevel.valueOf(
                    app.getEnvironment().getRequiredProperty("logging.level." + AGREGADOR))))
            .withUserConfiguration(Configuracao.class);

    @AfterEach
    void restauraNivelDeLog() {
        logging.setLogLevel(AGREGADOR, nivelAnterior);
    }

    @Test
    void iniciaSemOllamaComGeracaoDesabilitada() {
        contexto.withPropertyValues("afdevops.ia.generativa.habilitada=false",
                "spring.ai.ollama.base-url=http://127.0.0.1:1")
                .run(app -> assertThat(app).hasNotFailed().doesNotHaveBean(ProximosPassosPort.class));
    }

    @Test
    void iniciaSemOllamaMesmoComGeracaoHabilitada(CapturedOutput saida) {
        contexto.withPropertyValues("afdevops.ia.generativa.habilitada=true",
                "spring.ai.ollama.base-url=http://127.0.0.1:1", "afdevops.ia.generativa.timeout=PT2S")
                .run(app -> {
                    assertThat(app).hasNotFailed().hasSingleBean(ProximosPassosPort.class);
                    assertThat(app.getBean(ProximosPassosPort.class).gerar(IaDtos.Nivel.INICIANTE)).isEmpty();
                    assertThat(saida.getAll()).contains("resultado=fallback_indisponivel")
                            .doesNotContain("Aggregation Error", "WebClientRequestException");
                });
    }

    @Test
    void chatClientChamaOllamaSemFerramentasComAsOpcoesConfiguradas() throws Exception {
        var chamadas = new AtomicInteger();
        var ultima = new AtomicReference<String>();
        var servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/api/chat", troca -> {
            try (troca) {
                chamadas.incrementAndGet();
                ultima.set(new String(troca.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                byte[] resposta = """
                        {"model":"qwen2.5:1.5b","message":{"role":"assistant","content":"{\\"proximosPassos\\":[\\"Pratique um exercício.\\"]}"},"done":false}
                        {"model":"qwen2.5:1.5b","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop"}
                        """.getBytes(StandardCharsets.UTF_8);
                troca.getResponseHeaders().set("Content-Type", "application/x-ndjson");
                troca.sendResponseHeaders(200, resposta.length);
                troca.getResponseBody().write(resposta);
            }
        });
        servidor.start();
        try {
            contexto.withPropertyValues("afdevops.ia.generativa.habilitada=true",
                    "spring.ai.ollama.base-url=http://127.0.0.1:" + servidor.getAddress().getPort(),
                    "spring.ai.ollama.chat.model=qwen2.5:1.5b",
                    "spring.ai.ollama.chat.temperature=0.2", "spring.ai.ollama.chat.num-predict=128",
                    "spring.ai.ollama.chat.num-ctx=1024", "afdevops.ia.generativa.timeout=PT5S")
                    .run(app -> {
                        assertThat(app).hasNotFailed();
                        assertThat(chamadas.get()).isZero();
                        assertThat(app.getBean(ProximosPassosPort.class).gerar(IaDtos.Nivel.INICIANTE))
                                .containsExactly("Pratique um exercício.");
                        assertThat(chamadas.get()).isEqualTo(1);
                        var json = JsonMapper.builder().build().readTree(ultima.get());
                        assertThat(json.get("model").asString()).isEqualTo("qwen2.5:1.5b");
                        assertThat(json.get("stream").asBoolean()).isTrue();
                        assertThat(json.get("format").asString()).isEqualTo("json");
                        assertThat(json.get("options").get("num_predict").asInt()).isEqualTo(128);
                        assertThat(json.get("options").get("num_ctx").asInt()).isEqualTo(1024);
                        assertThat(json.get("options").get("temperature").asDouble()).isEqualTo(0.2);
                        assertThat(json.get("messages").size()).isEqualTo(2);
                        assertThat(json.get("messages").get(1).get("content").asString())
                                .isEqualTo("Nível de aprendizagem: INICIANTE");
                        assertThat(json.path("tools").isEmpty()).isTrue();
                    });
        } finally {
            servidor.stop(0);
        }
    }

    @Test
    void indisponibilidadeFazUmaTentativaERegistraSoFallback(CapturedOutput saida) throws Exception {
        var chamadas = new AtomicInteger();
        var servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/api/chat", troca -> {
            try (troca) {
                chamadas.incrementAndGet();
                byte[] corpo = "detalhe-bruto-nao-publico".getBytes(StandardCharsets.UTF_8);
                troca.sendResponseHeaders(503, corpo.length);
                troca.getResponseBody().write(corpo);
            }
        });
        servidor.start();
        try {
            contexto.withPropertyValues("afdevops.ia.generativa.habilitada=true",
                    "spring.ai.ollama.base-url=http://127.0.0.1:" + servidor.getAddress().getPort(),
                    "afdevops.ia.generativa.timeout=PT5S")
                    .run(app -> {
                        assertThat(app).hasNotFailed();
                        assertThat(app.getBean(ProximosPassosPort.class).gerar(IaDtos.Nivel.INICIANTE)).isEmpty();
                        assertThat(chamadas.get()).isEqualTo(1);
                        assertThat(saida.getAll()).contains("resultado=fallback_indisponivel")
                                .doesNotContain("Aggregation Error", "WebClientResponseException", "detalhe-bruto-nao-publico");
                    });
        } finally {
            servidor.stop(0);
        }
    }

    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration(exclude = DataSourceAutoConfiguration.class)
    @Import({OllamaProximosPassosAdapter.class, OllamaHttpConfig.class})
    static class Configuracao {
    }
}
