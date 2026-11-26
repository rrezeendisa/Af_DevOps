import pytest

URL = "/classificacoes"


@pytest.mark.parametrize(
    "payload",
    [
        {"logica": 1, "comunicacao": 1, "tecnologia": 1},
        {"logica": 5, "comunicacao": 5, "tecnologia": 5},
        {"logica": 4, "comunicacao": 3, "tecnologia": 2},
    ],
)
def test_classificacoes_validas_retornam_predicao_do_modelo(
    client, payload: dict[str, int]
) -> None:
    response = client.post(URL, json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["nivel"] in {"INICIANTE", "INTERMEDIARIO", "AVANCADO"}
    assert body["versao_modelo"] == "1.0.0"


def test_openapi_documenta_campos_de_entrada_e_niveis_de_saida(client) -> None:
    schema = client.get("/openapi.json").json()
    post_operation = schema["paths"][URL]["post"]
    request_schema = post_operation["requestBody"]["content"]["application/json"]["schema"]
    response_schema = post_operation["responses"]["200"]["content"]["application/json"]["schema"]

    assert set(schema["components"]["schemas"]["CompetenciasRequest"]["required"]) == {
        "logica",
        "comunicacao",
        "tecnologia",
    }
    assert request_schema["$ref"].endswith("/CompetenciasRequest")
    assert response_schema["$ref"].endswith("/ClassificacaoResponse")
    assert set(schema["components"]["schemas"]["NivelCompetencia"]["enum"]) == {
        "INICIANTE",
        "INTERMEDIARIO",
        "AVANCADO",
    }


@pytest.mark.parametrize(
    "payload",
    [
        {"logica": 0, "comunicacao": 3, "tecnologia": 3},
        {"logica": 6, "comunicacao": 3, "tecnologia": 3},
        {"logica": 2.5, "comunicacao": 3, "tecnologia": 3},
        {"logica": "3", "comunicacao": 3, "tecnologia": 3},
        {"logica": True, "comunicacao": 3, "tecnologia": 3},
        {"logica": 3, "comunicacao": 3},
        {},
    ],
)
def test_classificacoes_invalidas_retornam_422(client, payload: dict[str, object]) -> None:
    response = client.post(URL, json=payload)

    assert response.status_code == 422
