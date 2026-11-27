from app.model_service import ClassificationService
from app.recommendation_service import RecommendationService
from app.schemas import (
    NivelCompetencia,
    OrientacaoRequest,
    OrientacaoResponse,
    RecomendacaoRequest,
)

ALLOWED_TOOLS = frozenset(
    {"consultar_competencias", "classificar_competencias", "recomendar_cursos"}
)
MAX_TOOL_CALLS = 3


class GuidanceAgent:
    """Assistente determinístico com ferramentas de leitura limitadas."""

    def __init__(
        self,
        classifier: ClassificationService,
        recommender: RecommendationService,
    ) -> None:
        self.classifier = classifier
        self.recommender = recommender

    def execute_tool(
        self,
        name: str,
        request: OrientacaoRequest,
        level: NivelCompetencia | None = None,
    ):
        if name not in ALLOWED_TOOLS:
            raise ValueError(f"Ferramenta não permitida: {name}")
        if name == "consultar_competencias":
            return request.competencias
        if name == "classificar_competencias":
            return self.classifier.predict(
                logica=request.competencias.logica,
                comunicacao=request.competencias.comunicacao,
                tecnologia=request.competencias.tecnologia,
            )[0]
        if level is None:
            raise ValueError("A ferramenta de recomendação exige uma classificação.")
        return self.recommender.recommend(
            RecomendacaoRequest(
                **request.competencias.model_dump(),
                nivel=level.value,
            ),
            query=request.pergunta,
        )

    def run(self, request: OrientacaoRequest) -> OrientacaoResponse:
        calls = 0
        level: NivelCompetencia | None = None

        def call_tool(name: str):
            nonlocal calls
            if name not in ALLOWED_TOOLS:
                raise ValueError(f"Ferramenta não permitida: {name}")
            calls += 1
            if calls > MAX_TOOL_CALLS:
                raise RuntimeError("Limite de chamadas de ferramentas excedido.")
            return self.execute_tool(name, request, level)

        # O plano tem tamanho fixo e não é influenciado por instruções na pergunta.
        profile = call_tool("consultar_competencias")
        level = call_tool("classificar_competencias")
        recommendations = call_tool("recomendar_cursos")
        if recommendations.recomendacoes:
            course_names = ", ".join(item.nome for item in recommendations.recomendacoes)
            message = (
                f"A classificação estimada pelo modelo é {level.value}. "
                f"Os documentos consultados recomendam: {course_names}."
            )
        else:
            message = (
                f"A classificação estimada pelo modelo é {level.value}. "
                "Não foram encontrados cursos compatíveis nos documentos disponíveis."
            )
        # A referência é consumida para deixar explícito que o perfil vem do chamador autorizado.
        _ = profile
        return OrientacaoResponse(
            orientacao=message,
            cursos_recomendados=[item.curso_id for item in recommendations.recomendacoes],
            fontes=recommendations.fontes,
        )
