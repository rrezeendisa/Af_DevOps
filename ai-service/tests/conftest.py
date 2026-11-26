import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.model_service import MODEL_PATH
from ml.generate_dataset import generate_dataset
from ml.train_model import train_model


@pytest.fixture
def trained_model(tmp_path, monkeypatch):
    dataset_path = generate_dataset(tmp_path / "synthetic.csv")
    artifact_path = tmp_path / "classifier.joblib"
    train_model(dataset_path=dataset_path, model_path=artifact_path)
    monkeypatch.setattr("app.model_service.MODEL_PATH", artifact_path)
    yield artifact_path
    monkeypatch.setattr("app.model_service.MODEL_PATH", MODEL_PATH)


@pytest.fixture
def client(trained_model):
    with TestClient(app) as test_client:
        yield test_client
