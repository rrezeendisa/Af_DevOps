from urllib.parse import quote

import httpx

from app.training_messages import TrainingStatusPayload


class BackendStatusClient:
    """Cliente HTTP para o contrato provisório de status da Frente A."""

    def __init__(
        self,
        base_url: str,
        token: str,
        timeout_seconds: float = 5.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not base_url.strip():
            raise ValueError("JAVA_BACKEND_URL não foi configurada.")
        if not token.strip():
            raise ValueError("INTERNAL_API_TOKEN não foi configurado.")
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    def update_status(self, request_id: str, payload: TrainingStatusPayload) -> None:
        url = (
            f"{self.base_url}/internal/treinamentos/"
            f"{quote(request_id, safe='')}/status"
        )
        with httpx.Client(timeout=self.timeout_seconds, transport=self.transport) as client:
            response = client.patch(
                url,
                json=payload.model_dump(exclude_none=True, by_alias=True),
                headers={"Authorization": f"Bearer {self.token}"},
            )
            response.raise_for_status()
