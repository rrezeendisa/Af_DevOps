from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.classificacoes import router as classificacoes_router
from app.guidance_agent import GuidanceAgent
from app.model_service import ClassificationService
from app.recomendacoes import router as recomendacoes_router
from app.recommendation_service import RecommendationService
from app.orientacoes import router as orientacoes_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.classification_service = ClassificationService.load()
    except FileNotFoundError as error:
        raise RuntimeError(str(error)) from error
    app.state.recommendation_service = RecommendationService()
    app.state.guidance_agent = GuidanceAgent(
        classifier=app.state.classification_service,
        recommender=app.state.recommendation_service,
    )
    yield


app = FastAPI(
    title="AI Service",
    description="Serviço de inteligência artificial da Plataforma de Educação Corporativa.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(classificacoes_router)
app.include_router(recomendacoes_router)
app.include_router(orientacoes_router)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Informa se o serviço está disponível."""
    return {"status": "ok", "service": "ai-service"}
