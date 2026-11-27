import csv
import os
from pathlib import Path
import tempfile

import joblib
from sklearn.tree import DecisionTreeClassifier

from ml.constants import FEATURES, MODEL_VERSION
from ml.generate_dataset import DATASET_PATH

DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "classifier.joblib"
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser()


def train_model(
    dataset_path: Path = DATASET_PATH,
    model_path: Path = MODEL_PATH,
) -> Path:
    """Treina uma árvore de decisão e salva o estimador com seus metadados."""
    if not dataset_path.is_file():
        raise FileNotFoundError(
            f"Base sintética não encontrada em {dataset_path}. "
            "Gere-a primeiro com: python -m ml.generate_dataset"
        )

    with dataset_path.open(newline="", encoding="utf-8") as csv_file:
        rows = list(csv.DictReader(csv_file))
    if not rows:
        raise ValueError(f"A base sintética está vazia: {dataset_path}")

    features = [[int(row[name]) for name in FEATURES] for row in rows]
    labels = [row["nivel"] for row in rows]
    estimator = DecisionTreeClassifier(random_state=42)
    estimator.fit(features, labels)

    model_path.parent.mkdir(parents=True, exist_ok=True)
    artifact = {
        "model": estimator,
        "version": MODEL_VERSION,
        "algorithm": "DecisionTreeClassifier",
        "features": FEATURES,
    }
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f"{model_path.stem}-",
            suffix=".tmp",
            dir=model_path.parent,
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
        joblib.dump(artifact, temporary_path)
        os.replace(temporary_path, model_path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
    return model_path


if __name__ == "__main__":
    artifact_path = train_model()
    print(
        f"Modelo DecisionTreeClassifier v{MODEL_VERSION} treinado "
        f"e salvo em {artifact_path}."
    )
