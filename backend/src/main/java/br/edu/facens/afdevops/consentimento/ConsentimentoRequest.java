package br.edu.facens.afdevops.consentimento;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

@JsonDeserialize(using = ConsentimentoRequest.Leitor.class)
record ConsentimentoRequest(boolean autorizado) {
    static class Leitor extends ValueDeserializer<ConsentimentoRequest> {
        @Override
        public ConsentimentoRequest deserialize(JsonParser parser, DeserializationContext contexto) {
            if (parser.currentToken() == JsonToken.START_OBJECT
                    && parser.nextToken() == JsonToken.PROPERTY_NAME
                    && "autorizado".equals(parser.currentName())) {
                JsonToken valor = parser.nextToken();
                if ((valor == JsonToken.VALUE_TRUE || valor == JsonToken.VALUE_FALSE)
                        && parser.nextToken() == JsonToken.END_OBJECT
                        && parser.nextToken() == null) {
                    return new ConsentimentoRequest(valor == JsonToken.VALUE_TRUE);
                }
            }
            return contexto.reportInputMismatch(ConsentimentoRequest.class, "Informe apenas autorizado como booleano.");
        }
    }
}
