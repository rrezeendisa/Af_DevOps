import pytest

from app.model_service import ClassificationService
from ml.constants import ALLOWED_LEVELS, MODEL_VERSION
from ml.generate_dataset import generate_dataset
from ml.train_model import train_model


def test_saved_model_loads_and_predicts_a_valid_level(tmp_path) -> None:
    dataset_path = generate_dataset(tmp_path / "synthetic.csv")
    artifact_path = tmp_path / "classifier.joblib"
    train_model(dataset_path=dataset_path, model_path=artifact_path)

    service = ClassificationService.load(artifact_path)
    level, version = service.predict(logica=4, comunicacao=3, tecnologia=5)

    assert level.value in ALLOWED_LEVELS
    assert isinstance(level.value, str)
    assert version == MODEL_VERSION


def test_missing_model_error_explains_training_commands(tmp_path) -> None:
    with pytest.raises(FileNotFoundError, match="python -m ml.generate_dataset"):
        ClassificationService.load(tmp_path / "missing.joblib")
