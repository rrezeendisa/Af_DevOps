package br.edu.facens.afdevops.identidade;

import com.fasterxml.jackson.annotation.JsonProperty;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

@JsonDeserialize(using = CriarContaRequest.Leitor.class)
record CriarContaRequest(String nomeUsuario, @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String senhaInicial) {
    @Override
    public String toString() {
        return "CriarContaRequest";
    }

    static class Leitor extends ValueDeserializer<CriarContaRequest> {
        @Override
        public CriarContaRequest deserialize(JsonParser parser, DeserializationContext contexto) {
            if (parser.currentToken() != JsonToken.START_OBJECT) {
                return invalido(contexto);
            }

            String nome = null;
            String senha = null;
            while (parser.nextToken() == JsonToken.PROPERTY_NAME) {
                String campo = parser.currentName();
                if (parser.nextToken() != JsonToken.VALUE_STRING) {
                    return invalido(contexto);
                }
                if ("nomeUsuario".equals(campo) && nome == null) {
                    nome = parser.getString();
                } else if ("senhaInicial".equals(campo) && senha == null) {
                    senha = parser.getString();
                } else {
                    return invalido(contexto);
                }
            }

            if (parser.currentToken() != JsonToken.END_OBJECT || nome == null || senha == null) {
                return invalido(contexto);
            }
            return new CriarContaRequest(nome, senha);
        }

        private CriarContaRequest invalido(DeserializationContext contexto) {
            return contexto.reportInputMismatch(CriarContaRequest.class, "Informe os dados da conta.");
        }
    }
}
