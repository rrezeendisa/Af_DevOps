package br.edu.facens.afdevops.ia;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

final class IaDtos {
    private IaDtos() {
    }

    enum Nivel {
        INICIANTE, INTERMEDIARIO, AVANCADO
    }

    record Competencias(int logica, int comunicacao, int tecnologia) {
    }

    record PedidoRecomendacao(Competencias competencias, Nivel nivel) {
    }

    record PedidoOrientacao(String pergunta, Competencias competencias) {
    }

    record Classificacao(Nivel nivel, String versaoModelo) {
    }

    record CursoDocumental(String cursoId, String nome, String justificativa) {
    }

    record Recomendacoes(List<CursoDocumental> recomendacoes, List<String> fontes) {
        @Override
        public String toString() {
            return "Recomendacoes";
        }
    }

    record Orientacao(String orientacao, List<String> cursosRecomendados, List<String> fontes,
            @JsonInclude(JsonInclude.Include.NON_EMPTY) List<String> proximosPassos) {
        Orientacao(String orientacao, List<String> cursosRecomendados, List<String> fontes) {
            this(orientacao, cursosRecomendados, fontes, List.of());
        }

        @Override
        public String toString() {
            return "Orientacao";
        }
    }
}
