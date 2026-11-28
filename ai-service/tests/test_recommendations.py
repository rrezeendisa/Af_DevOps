from pathlib import Path

import pytest

from app.knowledge_base import CourseKnowledgeBase, KNOWLEDGE_PATH


def test_knowledge_base_loads_courses_and_retrieves_relevant_source() -> None:
    knowledge_base = CourseKnowledgeBase()

    results = knowledge_base.search("fundamentos tecnologia digital", top_k=1)

    assert len(knowledge_base.documents) == 12
    assert results
    document, score = results[0]
    assert document.competency == "tecnologia"
    assert "tecnologia" in document.searchable_text
    assert score > 0
    assert (KNOWLEDGE_PATH / document.source).is_file()


def test_recommendations_return_real_course_ids_and_cited_sources(client) -> None:
    response = client.post(
        "/recomendacoes",
        json={
            "logica": 2,
            "comunicacao": 4,
            "tecnologia": 3,
            "nivel": "INTERMEDIARIO",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recomendacoes"]
    assert {item["curso_id"] for item in body["recomendacoes"]} == {
        "CURSO-002",
        "CURSO-008",
    }
    assert set(body["fontes"]) == {
        "logica-problemas.md",
        "tecnologia-seguranca.md",
    }
    assert all(item["justificativa"] for item in body["recomendacoes"])
    assert all((KNOWLEDGE_PATH / source).is_file() for source in body["fontes"])


@pytest.mark.parametrize(
    "payload",
    [
        {"logica": 0, "comunicacao": 4, "tecnologia": 3, "nivel": "INTERMEDIARIO"},
        {"logica": 2, "comunicacao": 4, "tecnologia": 3, "nivel": "BASICO"},
        {"logica": 2, "comunicacao": 4, "tecnologia": 3},
    ],
)
def test_invalid_recommendation_request_returns_422(client, payload: dict[str, object]) -> None:
    assert client.post("/recomendacoes", json=payload).status_code == 422


def test_markdown_course_document_names_are_unique() -> None:
    files = list(Path(KNOWLEDGE_PATH).glob("*.md"))
    assert 8 <= len(files) <= 12
    assert len({path.name for path in files}) == len(files)
