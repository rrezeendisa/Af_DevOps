from enum import Enum

from pydantic import BaseModel, Field


class NivelCompetencia(str, Enum):
    INICIANTE = "INICIANTE"
    INTERMEDIARIO = "INTERMEDIARIO"
    AVANCADO = "AVANCADO"


class CompetenciasRequest(BaseModel):
    logica: int = Field(ge=1, le=5, strict=True)
    comunicacao: int = Field(ge=1, le=5, strict=True)
    tecnologia: int = Field(ge=1, le=5, strict=True)


class ClassificacaoResponse(BaseModel):
    # Será preenchido pelo modelo treinado implementado na B3.
    nivel: NivelCompetencia | None
    versao_modelo: str
