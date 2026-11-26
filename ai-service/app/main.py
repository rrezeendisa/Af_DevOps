from fastapi import FastAPI

from app.classificacoes import router as classificacoes_router

app = FastAPI(
    title="AI Service",
    description="Serviço de inteligência artificial da Plataforma de Educação Corporativa.",
    version="0.1.0",
)

app.include_router(classificacoes_router)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Informa se o serviço está disponível."""
    return {"status": "ok", "service": "ai-service"}
