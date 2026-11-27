import json
import os
import tempfile
from pathlib import Path
from typing import Callable

from app.training_messages import TrainingStatusPayload
from ml.generate_dataset import DATASET_PATH, generate_dataset
from ml.train_model import MODEL_PATH, train_model
from ml.constants import MODEL_VERSION

DEFAULT_RESULT_PATH = MODEL_PATH.with_name("training-results.json")
RESULT_PATH = Path(os.getenv("TRAINING_RESULT_PATH", str(DEFAULT_RESULT_PATH))).expanduser()


class TrainingResultStore:
    """Pequeno registro atômico para idempotência local das solicitações."""

    def __init__(self, path: Path = RESULT_PATH) -> None:
        self.path = path

    def read(self) -> dict[str, dict[str, object]]:
        if not self.path.exists():
            return {}
        contents = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(contents, dict):
            raise ValueError(f"Registro de treinamento inválido em {self.path}.")
        return contents

    def get(self, request_id: str) -> dict[str, object] | None:
        return self.read().get(request_id)

    def save(self, request_id: str, result: dict[str, object]) -> None:
        entries = self.read()
        entries[request_id] = result
        self._write(entries)

    def _write(self, entries: dict[str, dict[str, object]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                prefix=f"{self.path.stem}-",
                suffix=".tmp",
                dir=self.path.parent,
                delete=False,
            ) as temporary_file:
                temporary_path = Path(temporary_file.name)
                json.dump(entries, temporary_file, ensure_ascii=False, indent=2)
                temporary_file.write("\n")
                temporary_file.flush()
                os.fsync(temporary_file.fileno())
            os.replace(temporary_path, self.path)
        finally:
            if temporary_path is not None and temporary_path.exists():
                temporary_path.unlink()


class TrainingProcessor:
    def __init__(
        self,
        backend_client,
        result_store: TrainingResultStore,
        dataset_path: Path = DATASET_PATH,
        model_path: Path = MODEL_PATH,
        train_function: Callable[[Path, Path], Path] | None = None,
    ) -> None:
        self.backend_client = backend_client
        self.result_store = result_store
        self.dataset_path = dataset_path
        self.model_path = model_path
        self.train_function = train_function or (
            lambda dataset, model: train_model(dataset_path=dataset, model_path=model)
        )

    def process(self, request_id: str) -> dict[str, object]:
        result = self.result_store.get(request_id)
        if result is None:
            if not self.dataset_path.is_file():
                generate_dataset(self.dataset_path)
            self.train_function(self.dataset_path, self.model_path)
            result = {
                "status": "CONCLUIDO",
                "versao_modelo": MODEL_VERSION,
                "artefato": str(self.model_path),
                "backend_notificado": False,
            }
            self.result_store.save(request_id, result)

        if not result.get("backend_notificado", False):
            self.backend_client.update_status(
                request_id,
                TrainingStatusPayload(
                    status="CONCLUIDO",
                    versaoModelo=str(result["versao_modelo"]),
                    mensagem=(
                        "Modelo treinado e salvo atomicamente. Reinicie a API de IA "
                        "para carregar a nova versão."
                    ),
                ),
            )
            result["backend_notificado"] = True
            self.result_store.save(request_id, result)
        return result

    def report_failure(self, request_id: str, message: str) -> None:
        safe_message = f"Falha no processamento de treinamento: {message}"[:1000]
        self.backend_client.update_status(
            request_id,
            TrainingStatusPayload(status="FALHOU", mensagem=safe_message),
        )
        self.result_store.save(
            request_id,
            {"status": "FALHOU", "backend_notificado": True, "mensagem": safe_message},
        )
