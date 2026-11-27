from app.knowledge_base import CourseKnowledgeBase, CourseDocument, normalize_text
from app.schemas import RecomendacaoItem, RecomendacaoRequest, RecomendacaoResponse
from ml.constants import ALLOWED_LEVELS, FEATURES


class RecommendationService:
    """Recupera cursos do catálogo documental e monta justificativas com suas fontes."""

    def __init__(self, knowledge_base: CourseKnowledgeBase | None = None) -> None:
        self.knowledge_base = knowledge_base or CourseKnowledgeBase()

    def recommend(
        self,
        request: RecomendacaoRequest,
        query: str = "",
    ) -> RecomendacaoResponse:
        scores = {name: getattr(request, name) for name in FEATURES}
        normalized_query = normalize_text(query)
        explicitly_requested = [
            name
            for name, label in (
                ("logica", "logica"),
                ("comunicacao", "comunicacao"),
                ("tecnologia", "tecnologia"),
            )
            if label in normalized_query
        ]
        needs_development = sorted(
            (name for name, score in scores.items() if score <= 3),
            key=lambda name: (scores[name], FEATURES.index(name)),
        )
        target_competencies = explicitly_requested or needs_development
        if not target_competencies:
            target_competencies = [min(scores, key=lambda name: (scores[name], FEATURES.index(name)))]

        level = request.nivel.value
        if level not in ALLOWED_LEVELS:
            return RecomendacaoResponse(recomendacoes=[], fontes=[])

        terms = [query, level, *(self._skill_term(skill) for skill in target_competencies)]
        retrieved = self.knowledge_base.search(" ".join(terms), top_k=len(self.knowledge_base.documents))
        selected: list[CourseDocument] = []
        for document, _score in retrieved:
            if document.level != level or document.competency not in target_competencies:
                continue
            if document not in selected:
                selected.append(document)
        selected = selected[:3]

        recommendations = [
            RecomendacaoItem(
                curso_id=document.course_id,
                nome=document.name,
                justificativa=(
                    f"{document.description} Requisitos declarados: "
                    f"{document.prerequisites}."
                ),
            )
            for document in selected
        ]
        return RecomendacaoResponse(
            recomendacoes=recommendations,
            fontes=[document.source for document in selected],
        )

    @staticmethod
    def _skill_term(skill: str) -> str:
        return {
            "logica": "lógica algoritmos",
            "comunicacao": "comunicação colaboração",
            "tecnologia": "tecnologia digital",
        }[skill]
