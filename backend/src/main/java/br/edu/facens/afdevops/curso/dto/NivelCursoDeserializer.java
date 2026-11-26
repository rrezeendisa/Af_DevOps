package br.edu.facens.afdevops.curso.dto;

import br.edu.facens.afdevops.curso.NivelCurso;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

public class NivelCursoDeserializer extends ValueDeserializer<NivelCurso> {

    @Override
    public NivelCurso deserialize(JsonParser parser, DeserializationContext context) {
        if (parser.currentToken() != JsonToken.VALUE_STRING) {
            return (NivelCurso) context.handleUnexpectedToken(NivelCurso.class, parser);
        }
        String valor = parser.getText();
        try {
            return NivelCurso.valueOf(valor);
        }
        catch (IllegalArgumentException exception) {
            return (NivelCurso) context.handleWeirdStringValue(NivelCurso.class, valor, "Nível de curso inválido");
        }
    }
}
