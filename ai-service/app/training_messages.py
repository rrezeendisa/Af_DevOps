from pydantic import BaseModel, Field, StrictInt, StrictStr


class TrainingRequestMessage(BaseModel):
    solicitacao_id: StrictStr | StrictInt

    def normalized_id(self) -> str:
        value = str(self.solicitacao_id).strip()
        if not value or len(value) > 100:
            raise ValueError("solicitacao_id deve conter de 1 a 100 caracteres.")
        return value


class TrainingStatusPayload(BaseModel):
    status: str = Field(pattern="^(CONCLUIDO|FALHOU)$")
    versaoModelo: str | None = None
    mensagem: str = Field(min_length=1, max_length=1000)
