from fastapi import APIRouter

from app.schemas import ClassificacaoResponse, CompetenciasRequest

router = APIRouter(tags=["Classificações"])


@router.post(
    "/classificacoes",
    response_model=ClassificacaoResponse,
    summary="Classificar competências de um colaborador",
    description=(
        "Valida as pontuações de competências. A classificação ficará indisponível "
        "até a integração do modelo de Machine Learning na etapa B3; nesse período, "
        "`nivel` será `null` e `versao_modelo` será `pendente`."
    ),
)
def classificar_competencias(
    competencias: CompetenciasRequest,
) -> ClassificacaoResponse:
    """Valida a entrada e devolve o contrato provisório até a B3."""
    return ClassificacaoResponse(nivel=None, versao_modelo="pendente")
