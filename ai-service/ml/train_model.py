import csv
from pathlib import Path

import joblib
from sklearn.tree import DecisionTreeClassifier

from ml.constants import FEATURES, MODEL_VERSION
from ml.generate_dataset import DATASET_PATH

MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "classifier.joblib"


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
    joblib.dump(
        {
            "model": estimator,
            "version": MODEL_VERSION,
            "algorithm": "DecisionTreeClassifier",
            "features": FEATURES,
        },
        model_path,
    )
    return model_path


if __name__ == "__main__":
    artifact_path = train_model()
    print(
        f"Modelo DecisionTreeClassifier v{MODEL_VERSION} treinado "
        f"e salvo em {artifact_path}."
    )
