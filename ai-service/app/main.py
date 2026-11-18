from fastapi import FastAPI

app = FastAPI(
    title="AI Service",
    description="Serviço de inteligência artificial da Plataforma de Educação Corporativa.",
    version="0.1.0",
)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Informa se o serviço está disponível."""
    return {"status": "ok", "service": "ai-service"}
