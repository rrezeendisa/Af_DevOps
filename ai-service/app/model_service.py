from pathlib import Path
from typing import Any

import joblib

from app.schemas import NivelCompetencia
from ml.constants import MODEL_VERSION

MODEL_PATH = Path(__file__).resolve().parents[1] / "ml" / "artifacts" / "classifier.joblib"


class ClassificationService:
    """Carrega uma única vez o artefato e fornece predições do estimador."""

    def __init__(self, model: Any, version: str) -> None:
        self._model = model
        self.version = version

    @classmethod
    def load(cls, model_path: Path | None = None) -> "ClassificationService":
        if model_path is None:
            model_path = MODEL_PATH
        if not model_path.is_file():
            raise FileNotFoundError(
                f"Artefato do modelo não encontrado em {model_path}. "
                "Gere a base e treine o modelo antes de iniciar a API: "
                "python -m ml.generate_dataset && python -m ml.train_model"
            )

        artifact = joblib.load(model_path)
        if not isinstance(artifact, dict) or not {"model", "version"}.issubset(artifact):
            raise ValueError(f"Artefato de modelo inválido: {model_path}")
        if artifact["version"] != MODEL_VERSION:
            raise ValueError(
                f"Versão do artefato incompatível: esperada {MODEL_VERSION}, "
                f"recebida {artifact['version']}"
            )
        return cls(model=artifact["model"], version=artifact["version"])

    def predict(
        self,
        *,
        logica: int,
        comunicacao: int,
        tecnologia: int,
    ) -> tuple[NivelCompetencia, str]:
        prediction = self._model.predict([[logica, comunicacao, tecnologia]])[0]
        return NivelCompetencia(str(prediction)), self.version
