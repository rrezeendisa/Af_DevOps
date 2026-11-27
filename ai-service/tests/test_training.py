import csv
from collections import Counter

import pytest

from ml.constants import ALLOWED_LEVELS, FEATURES
from ml.generate_dataset import generate_dataset
from ml.train_model import train_model


def test_generate_dataset_writes_all_competencies_and_balanced_levels(tmp_path) -> None:
    dataset_path = generate_dataset(tmp_path / "synthetic.csv")

    with dataset_path.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        rows = list(reader)

    assert reader.fieldnames == [*FEATURES, "nivel"]
    assert len(rows) == 125
    assert len({tuple(row[name] for name in FEATURES) for row in rows}) == 125
    assert all(1 <= int(row[name]) <= 5 for row in rows for name in FEATURES)
    assert {row["nivel"] for row in rows} == set(ALLOWED_LEVELS)
    assert Counter(row["nivel"] for row in rows) == {
        "INICIANTE": 35,
        "INTERMEDIARIO": 55,
        "AVANCADO": 35,
    }
    repeated_path = generate_dataset(tmp_path / "synthetic-repeat.csv")
    assert repeated_path.read_bytes() == dataset_path.read_bytes()


def test_train_model_saves_artifact(tmp_path) -> None:
    dataset_path = generate_dataset(tmp_path / "synthetic.csv")
    artifact_path = tmp_path / "artifacts" / "classifier.joblib"

    result = train_model(dataset_path=dataset_path, model_path=artifact_path)

    assert result == artifact_path
    assert artifact_path.is_file()


def test_failed_training_does_not_replace_existing_model(tmp_path, monkeypatch) -> None:
    dataset_path = generate_dataset(tmp_path / "synthetic.csv")
    artifact_path = tmp_path / "artifacts" / "classifier.joblib"
    artifact_path.parent.mkdir(parents=True)
    artifact_path.write_bytes(b"previous-valid-artifact")

    def fail_dump(_artifact, _path):
        raise OSError("simulated persistence failure")

    monkeypatch.setattr("ml.train_model.joblib.dump", fail_dump)
    with pytest.raises(OSError, match="simulated persistence failure"):
        train_model(dataset_path=dataset_path, model_path=artifact_path)

    assert artifact_path.read_bytes() == b"previous-valid-artifact"
    assert not list(artifact_path.parent.glob("*.tmp"))
