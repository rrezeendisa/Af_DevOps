package br.edu.facens.afdevops.curso;

import java.util.stream.Stream;

import br.edu.facens.afdevops.curso.dto.CursoRequest;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CursoUnitTests {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @ParameterizedTest
    @MethodSource("dadosInvalidos")
    void validaCampos(CursoRequest request, String campo) {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(request))
                    .anySatisfy(violacao -> assertThat(violacao.getPropertyPath().toString()).isEqualTo(campo));
        }
    }

    static Stream<Arguments> dadosInvalidos() {
        return Stream.of(
                Arguments.of(new CursoRequest("Cur\0so", "Descrição", 1, "Categoria", NivelCurso.BASICO), "nome"),
                Arguments.of(new CursoRequest("Curso", "Descri\0ção", 1, "Categoria", NivelCurso.BASICO), "descricao"),
                Arguments.of(new CursoRequest("Curso", "Descrição", 1, "Cate\0goria", NivelCurso.BASICO), "categoria"),
                Arguments.of(new CursoRequest(null, "Descrição", 1, "Categoria", NivelCurso.BASICO), "nome"),
                Arguments.of(new CursoRequest(" ", "Descrição", 1, "Categoria", NivelCurso.BASICO), "nome"),
                Arguments.of(new CursoRequest("n".repeat(151), "Descrição", 1, "Categoria", NivelCurso.BASICO), "nome"),
                Arguments.of(new CursoRequest("Curso", null, 1, "Categoria", NivelCurso.BASICO), "descricao"),
                Arguments.of(new CursoRequest("Curso", " ", 1, "Categoria", NivelCurso.BASICO), "descricao"),
                Arguments.of(new CursoRequest("Curso", "d".repeat(2001), 1, "Categoria", NivelCurso.BASICO), "descricao"),
                Arguments.of(new CursoRequest("Curso", "Descrição", null, "Categoria", NivelCurso.BASICO), "cargaHoraria"),
                Arguments.of(new CursoRequest("Curso", "Descrição", 0, "Categoria", NivelCurso.BASICO), "cargaHoraria"),
                Arguments.of(new CursoRequest("Curso", "Descrição", -1, "Categoria", NivelCurso.BASICO), "cargaHoraria"),
                Arguments.of(new CursoRequest("Curso", "Descrição", 1, null, NivelCurso.BASICO), "categoria"),
                Arguments.of(new CursoRequest("Curso", "Descrição", 1, " ", NivelCurso.BASICO), "categoria"),
                Arguments.of(new CursoRequest("Curso", "Descrição", 1, "c".repeat(101), NivelCurso.BASICO), "categoria"),
                Arguments.of(new CursoRequest("Curso", "Descrição", 1, "Categoria", null), "nivel"));
    }

    @Test
    void aceitaLimitesValidos() {
        var request = new CursoRequest("n".repeat(150), "d".repeat(2000), 1, "c".repeat(100), NivelCurso.AVANCADO);
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(request)).isEmpty();
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "1", "2", "\"0\"", "\"basico\"", "\"INVALIDO\"", "true", "[]", "{}"})
    void rejeitaNivelComTipoOuValorInvalido(String nivel) {
        assertThatThrownBy(() -> JSON.readValue(json("1", nivel), CursoRequest.class))
                .isInstanceOf(tools.jackson.core.JacksonException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.5", "1.0", "\"2\"", "true", "2147483648"})
    void rejeitaCargaHorariaComTipoOuIntervaloInvalido(String carga) {
        assertThatThrownBy(() -> JSON.readValue(json(carga, "\"BASICO\""), CursoRequest.class))
                .isInstanceOf(tools.jackson.core.JacksonException.class);
    }

    @Test
    void desserializaValoresValidos() {
        var request = JSON.readValue(json("8", "\"INTERMEDIARIO\""), CursoRequest.class);
        assertThat(request.cargaHoraria()).isEqualTo(8);
        assertThat(request.nivel()).isEqualTo(NivelCurso.INTERMEDIARIO);
    }

    private static String json(String carga, String nivel) {
        return """
                {"nome":"Curso fictício","descricao":"Descrição fictícia","cargaHoraria":%s,"categoria":"Educação","nivel":%s}
                """.formatted(carga, nivel);
    }
}
