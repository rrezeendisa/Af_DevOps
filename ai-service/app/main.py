from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.classificacoes import router as classificacoes_router
from app.model_service import ClassificationService


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.classification_service = ClassificationService.load()
    except FileNotFoundError as error:
        raise RuntimeError(str(error)) from error
    yield


app = FastAPI(
    title="AI Service",
    description="Serviço de inteligência artificial da Plataforma de Educação Corporativa.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(classificacoes_router)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Informa se o serviço está disponível."""
    return {"status": "ok", "service": "ai-service"}
