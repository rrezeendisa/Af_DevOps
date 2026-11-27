import json
from types import SimpleNamespace

import httpx
import pika
import pytest

from app.training_messages import TrainingStatusPayload
from worker.backend_client import BackendStatusClient
from worker.consumer import (
    DEAD_LETTER_QUEUE,
    EXCHANGE,
    MAX_RETRIES,
    QUEUE,
    ROUTING_KEY,
    handle_delivery,
)
from worker.processor import TrainingProcessor, TrainingResultStore


class FakeBackend:
    def __init__(self, failures: int = 0) -> None:
        self.failures = failures
        self.calls: list[tuple[str, TrainingStatusPayload]] = []

    def update_status(self, request_id: str, payload: TrainingStatusPayload) -> None:
        self.calls.append((request_id, payload))
        if self.failures:
            self.failures -= 1
            raise httpx.ConnectError("backend indisponível")


class FakeChannel:
    def __init__(self) -> None:
        self.acks: list[int] = []
        self.nacks: list[tuple[int, bool]] = []
        self.published: list[dict[str, object]] = []

    def basic_ack(self, delivery_tag: int) -> None:
        self.acks.append(delivery_tag)

    def basic_nack(self, delivery_tag: int, requeue: bool) -> None:
        self.nacks.append((delivery_tag, requeue))

    def basic_publish(self, **kwargs) -> bool:
        self.published.append(kwargs)
        return True


def make_processor(tmp_path, backend=None, train_function=None):
    dataset_path = tmp_path / "synthetic.csv"
    model_path = tmp_path / "classifier.joblib"
    return TrainingProcessor(
        backend_client=backend or FakeBackend(),
        result_store=TrainingResultStore(tmp_path / "results.json"),
        dataset_path=dataset_path,
        model_path=model_path,
        train_function=train_function,
    )


def delivery(properties=None, body=None):
    return (
        SimpleNamespace(delivery_tag=41),
        properties or pika.BasicProperties(headers={}),
        body or json.dumps({"solicitacao_id": "req-123"}).encode(),
    )


def test_processor_trains_once_and_records_backend_notification(tmp_path) -> None:
    backend = FakeBackend()
    training_calls: list[str] = []

    def train(dataset_path, model_path):
        training_calls.append(str(dataset_path))
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model_path.write_bytes(b"model")
        return model_path

    processor = make_processor(tmp_path, backend=backend, train_function=train)

    processor.process("req-123")
    processor.process("req-123")

    assert len(training_calls) == 1
    assert len(backend.calls) == 1
    assert backend.calls[0][1].status == "CONCLUIDO"
    assert processor.result_store.get("req-123")["backend_notificado"] is True


def test_backend_failure_retry_does_not_repeat_training(tmp_path) -> None:
    backend = FakeBackend(failures=1)
    training_calls: list[str] = []

    def train(dataset_path, model_path):
        training_calls.append(str(dataset_path))
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model_path.write_bytes(b"model")
        return model_path

    processor = make_processor(tmp_path, backend=backend, train_function=train)

    with pytest.raises(httpx.ConnectError):
        processor.process("req-456")
    result = processor.process("req-456")

    assert len(training_calls) == 1
    assert result["backend_notificado"] is True
    assert len(backend.calls) == 2


def test_valid_delivery_is_acked_after_processing(tmp_path) -> None:
    channel = FakeChannel()
    processor = make_processor(tmp_path)
    method, properties, body = delivery()

    handle_delivery(channel, method, properties, body, processor)

    assert channel.acks == [41]
    assert not channel.published


def test_invalid_message_is_sent_to_dead_letter_queue(tmp_path) -> None:
    channel = FakeChannel()
    method, properties, body = delivery(body=b"not-json")

    handle_delivery(channel, method, properties, body, make_processor(tmp_path))

    assert channel.published[0]["routing_key"] == DEAD_LETTER_QUEUE
    assert channel.published[0]["exchange"] == ""
    assert channel.acks == [41]


def test_transient_failure_is_republished_with_retry_count(tmp_path) -> None:
    class FailingProcessor:
        def process(self, _request_id):
            raise httpx.ConnectError("temporário")

    channel = FakeChannel()
    method, properties, body = delivery(
        properties=pika.BasicProperties(headers={"x-ai-retry-count": 1})
    )

    handle_delivery(channel, method, properties, body, FailingProcessor())

    retry = channel.published[0]
    assert retry["exchange"] == EXCHANGE
    assert retry["routing_key"] == ROUTING_KEY
    assert retry["properties"].headers["x-ai-retry-count"] == 2
    assert channel.acks == [41]


def test_retries_are_limited_and_failed_request_is_dead_lettered(tmp_path) -> None:
    class FailingProcessor:
        def process(self, _request_id):
            raise httpx.ConnectError("persistente")

        def report_failure(self, request_id, message):
            assert request_id == "req-123"
            assert "persistente" in message

    channel = FakeChannel()
    method, properties, body = delivery(
        properties=pika.BasicProperties(headers={"x-ai-retry-count": MAX_RETRIES})
    )

    handle_delivery(channel, method, properties, body, FailingProcessor())

    assert channel.published[0]["routing_key"] == DEAD_LETTER_QUEUE
    assert channel.acks == [41]


def test_backend_failure_after_training_does_not_report_false_training_failure(tmp_path) -> None:
    backend = FakeBackend(failures=MAX_RETRIES + 1)

    def train(dataset_path, model_path):
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model_path.write_bytes(b"valid-model")
        return model_path

    processor = make_processor(tmp_path, backend=backend, train_function=train)
    channel = FakeChannel()
    method, properties, body = delivery(
        properties=pika.BasicProperties(headers={"x-ai-retry-count": MAX_RETRIES})
    )

    handle_delivery(channel, method, properties, body, processor)

    saved_result = processor.result_store.get("req-123")
    assert saved_result["status"] == "CONCLUIDO"
    assert saved_result["backend_notificado"] is False
    assert all(payload.status == "CONCLUIDO" for _, payload in backend.calls)
    assert channel.published[0]["routing_key"] == DEAD_LETTER_QUEUE
    assert channel.acks == [41]


def test_backend_status_client_uses_token_timeout_and_checks_http_status() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(204)

    client = BackendStatusClient(
        "http://java.local",
        "private-token",
        timeout_seconds=2,
        transport=httpx.MockTransport(handler),
    )
    payload = TrainingStatusPayload(
        status="CONCLUIDO", versaoModelo="1.0.0", mensagem="Treinamento concluído."
    )

    client.update_status("abc/123", payload)

    assert seen[0].method == "PATCH"
    assert seen[0].url.raw_path == b"/internal/treinamentos/abc%2F123/status"
    assert seen[0].headers["Authorization"] == "Bearer private-token"
    assert json.loads(seen[0].content)["versaoModelo"] == "1.0.0"


def test_backend_non_success_response_is_not_treated_as_completed() -> None:
    client = BackendStatusClient(
        "http://java.local",
        "token",
        transport=httpx.MockTransport(lambda _request: httpx.Response(500)),
    )

    with pytest.raises(httpx.HTTPStatusError):
        client.update_status(
            "123", TrainingStatusPayload(status="CONCLUIDO", mensagem="done")
        )
