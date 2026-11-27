import hmac
import os

from fastapi import Header, HTTPException, status


def require_internal_authorization(
    authorization: str | None = Header(default=None),
) -> None:
    """Exige bearer token interno; não aceita flags de autorização no JSON."""
    expected_token = os.getenv("INTERNAL_API_TOKEN", "").strip()
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A autenticação interna ainda não foi configurada.",
        )
    expected_header = f"Bearer {expected_token}"
    if not authorization or not hmac.compare_digest(authorization, expected_header):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autorização interna inválida ou ausente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
