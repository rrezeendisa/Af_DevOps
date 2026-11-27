from fastapi import APIRouter, Request

from app.schemas import RecomendacaoRequest, RecomendacaoResponse

router = APIRouter(tags=["Recomendações"])


@router.post(
    "/recomendacoes",
    response_model=RecomendacaoResponse,
    summary="Recomendar cursos com base nas competências",
    description=(
        "Recupera documentos de curso com TF-IDF e similaridade de cosseno. "
        "A resposta determinística não é texto gerado por LLM."
    ),
)
def recomendar_cursos(
    perfil: RecomendacaoRequest,
    request: Request,
) -> RecomendacaoResponse:
    service = request.app.state.recommendation_service
    return service.recommend(perfil)
