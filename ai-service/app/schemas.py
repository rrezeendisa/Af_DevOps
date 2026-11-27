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
    nivel: NivelCompetencia
    versao_modelo: str


class RecomendacaoRequest(CompetenciasRequest):
    nivel: NivelCompetencia


class RecomendacaoItem(BaseModel):
    curso_id: str
    nome: str
    justificativa: str


class RecomendacaoResponse(BaseModel):
    recomendacoes: list[RecomendacaoItem]
    fontes: list[str]


class OrientacaoRequest(BaseModel):
    colaborador_id: str = Field(min_length=1, max_length=100, strict=True)
    pergunta: str = Field(min_length=1, max_length=1000, strict=True)
    competencias: CompetenciasRequest


class OrientacaoResponse(BaseModel):
    orientacao: str
    cursos_recomendados: list[str]
    fontes: list[str]
