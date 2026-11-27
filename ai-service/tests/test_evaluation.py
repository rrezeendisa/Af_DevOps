import json

from ml.evaluate_model import evaluate_model
from ml.generate_dataset import generate_dataset


def test_evaluation_uses_disjoint_holdout_and_writes_metrics(tmp_path) -> None:
    dataset_path = generate_dataset(tmp_path / "synthetic.csv")
    results_path = tmp_path / "evaluation.json"

    result = evaluate_model(dataset_path=dataset_path, output_path=results_path)

    assert result["dataset_records"] == 125
    assert result["train_records"] + result["test_records"] == 125
    assert result["train_test_combination_overlap"] == 0
    assert 0 <= result["accuracy"] <= 1
    assert 0 <= result["precision_macro"] <= 1
    assert 0 <= result["recall_macro"] <= 1
    assert 0 <= result["f1_macro"] <= 1
    assert len(result["confusion_matrix"]) == 3
    assert all(len(row) == 3 for row in result["confusion_matrix"])
    assert json.loads(results_path.read_text(encoding="utf-8")) == result
