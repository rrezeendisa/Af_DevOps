import pytest

from app.schemas import OrientacaoRequest
from app.guidance_agent import ALLOWED_TOOLS, MAX_TOOL_CALLS

PAYLOAD = {
    "colaborador_id": "123",
    "pergunta": "Como posso melhorar minha competência em lógica?",
    "competencias": {"logica": 2, "comunicacao": 4, "tecnologia": 3},
}


def test_guidance_requires_backend_token_and_ignores_authorization_boolean(
    client, monkeypatch
) -> None:
    monkeypatch.delenv("INTERNAL_API_TOKEN", raising=False)

    response = client.post("/orientacoes", json={**PAYLOAD, "autorizado": True})

    assert response.status_code == 503


def test_guidance_rejects_invalid_internal_token(client, monkeypatch) -> None:
    monkeypatch.setenv("INTERNAL_API_TOKEN", "expected-token")

    response = client.post(
        "/orientacoes", json=PAYLOAD, headers={"Authorization": "Bearer wrong-token"}
    )

    assert response.status_code == 401


def test_guidance_uses_model_and_recommendation_tools(client, monkeypatch) -> None:
    monkeypatch.setenv("INTERNAL_API_TOKEN", "test-token")

    response = client.post(
        "/orientacoes",
        json=PAYLOAD,
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "INTERMEDIARIO" in body["orientacao"]
    assert body["cursos_recomendados"]
    assert body["fontes"]
    assert ALLOWED_TOOLS == {
        "consultar_competencias",
        "classificar_competencias",
        "recomendar_cursos",
    }
    assert MAX_TOOL_CALLS == 3


def test_guidance_rejects_unknown_tool(client) -> None:
    agent = client.app.state.guidance_agent
    request = OrientacaoRequest.model_validate(PAYLOAD)

    with pytest.raises(ValueError, match="Ferramenta não permitida"):
        agent.execute_tool("alterar_cadastro", request)


@pytest.mark.parametrize(
    "payload",
    [
        {**PAYLOAD, "colaborador_id": ""},
        {**PAYLOAD, "pergunta": ""},
        {**PAYLOAD, "competencias": {"logica": 6, "comunicacao": 4, "tecnologia": 3}},
    ],
)
def test_invalid_guidance_request_returns_422(client, monkeypatch, payload) -> None:
    monkeypatch.setenv("INTERNAL_API_TOKEN", "test-token")

    response = client.post(
        "/orientacoes", json=payload, headers={"Authorization": "Bearer test-token"}
    )

    assert response.status_code == 422
