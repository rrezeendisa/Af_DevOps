from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.schemas import OrientacaoRequest, OrientacaoResponse
from app.security import require_internal_authorization

router = APIRouter(tags=["Orientações"])


@router.post(
    "/orientacoes",
    response_model=OrientacaoResponse,
    summary="Orientar um colaborador sobre aprendizagem",
    description=(
        "Assistente determinístico com ferramentas limitadas. Requer bearer token "
        "interno enviado pelo backend autorizado; não usa LLM."
    ),
    dependencies=[Depends(require_internal_authorization)],
)
def orientar_colaborador(
    dados: OrientacaoRequest,
    request: Request,
) -> OrientacaoResponse:
    agent = request.app.state.guidance_agent
    return agent.run(dados)
