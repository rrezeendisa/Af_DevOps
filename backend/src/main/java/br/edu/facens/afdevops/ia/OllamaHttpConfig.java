package br.edu.facens.afdevops.ia;

import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "afdevops.ia.generativa.habilitada", havingValue = "true")
class OllamaHttpConfig {
    @Bean
    OllamaApi ollamaApi(@Value("${spring.ai.ollama.base-url}") String baseUrl) {
        var transporte = new ReactorClientHttpConnector(HttpClient.create().disableRetry(true));
        return OllamaApi.builder().baseUrl(baseUrl)
                .webClientBuilder(WebClient.builder().clientConnector(transporte))
                .build();
    }
}
