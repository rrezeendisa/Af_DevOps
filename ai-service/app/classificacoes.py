from fastapi import APIRouter, Request

from app.schemas import ClassificacaoResponse, CompetenciasRequest

router = APIRouter(tags=["Classificações"])


@router.post(
    "/classificacoes",
    response_model=ClassificacaoResponse,
    summary="Classificar competências de um colaborador",
    description="Classifica as competências usando o modelo treinado carregado pela aplicação.",
)
def classificar_competencias(
    competencias: CompetenciasRequest,
    request: Request,
) -> ClassificacaoResponse:
    """Valida a entrada e delega a predição ao modelo carregado."""
    classifier = request.app.state.classification_service
    nivel, versao_modelo = classifier.predict(
        logica=competencias.logica,
        comunicacao=competencias.comunicacao,
        tecnologia=competencias.tecnologia,
    )
    return ClassificacaoResponse(nivel=nivel, versao_modelo=versao_modelo)
