import csv
import json
from pathlib import Path
from typing import Any

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

from ml.constants import ALLOWED_LEVELS, FEATURES
from ml.generate_dataset import DATASET_PATH

RESULTS_PATH = Path(__file__).resolve().parent / "evaluation_results.json"
RANDOM_STATE = 42
TEST_SIZE = 0.2


def evaluate_model(
    dataset_path: Path = DATASET_PATH,
    output_path: Path = RESULTS_PATH,
) -> dict[str, Any]:
    """Treina em uma partição e avalia apenas combinações reservadas."""
    if not dataset_path.is_file():
        raise FileNotFoundError(
            f"Base sintética não encontrada em {dataset_path}. "
            "Gere-a primeiro com: python -m ml.generate_dataset"
        )

    with dataset_path.open(newline="", encoding="utf-8") as csv_file:
        rows = list(csv.DictReader(csv_file))

    x = [[int(row[name]) for name in FEATURES] for row in rows]
    y = [row["nivel"] for row in rows]
    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )
    train_combinations = {tuple(values) for values in x_train}
    test_combinations = {tuple(values) for values in x_test}
    overlap = train_combinations.intersection(test_combinations)
    if overlap:
        raise ValueError("Há combinações de competências duplicadas entre treino e teste.")

    estimator = DecisionTreeClassifier(random_state=RANDOM_STATE)
    estimator.fit(x_train, y_train)
    predictions = estimator.predict(x_test)
    results: dict[str, Any] = {
        "algorithm": "DecisionTreeClassifier",
        "random_state": RANDOM_STATE,
        "test_size": TEST_SIZE,
        "dataset_records": len(rows),
        "train_records": len(x_train),
        "test_records": len(x_test),
        "train_test_combination_overlap": len(overlap),
        "labels": list(ALLOWED_LEVELS),
        "accuracy": accuracy_score(y_test, predictions),
        "precision_macro": precision_score(
            y_test, predictions, labels=ALLOWED_LEVELS, average="macro", zero_division=0
        ),
        "recall_macro": recall_score(
            y_test, predictions, labels=ALLOWED_LEVELS, average="macro", zero_division=0
        ),
        "f1_macro": f1_score(
            y_test, predictions, labels=ALLOWED_LEVELS, average="macro", zero_division=0
        ),
        "classification_report": classification_report(
            y_test,
            predictions,
            labels=ALLOWED_LEVELS,
            output_dict=True,
            zero_division=0,
        ),
        "confusion_matrix": confusion_matrix(
            y_test, predictions, labels=ALLOWED_LEVELS
        ).tolist(),
        "data_limitations": (
            "Resultados medem somente a reprodução dos rótulos artificiais; "
            "não demonstram desempenho em colaboradores reais."
        ),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return results


if __name__ == "__main__":
    result = evaluate_model()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"Resultados salvos em {RESULTS_PATH}")
