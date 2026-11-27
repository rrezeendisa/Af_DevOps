"""Saúde dos serviços e topologia RabbitMQ combinada entre as frentes."""
from conftest import Ambiente, aguardar

EXCHANGE = "ml.training"
ROUTING_KEY = "training.requested"
FILA = "ml.training.requests"
DLQ = "ml.training.requests.dead-letter"


def test_backend_saudavel_incluindo_rabbitmq(http, ambiente: Ambiente):
    resposta = http.get(f"{ambiente.backend}/actuator/health")
    assert resposta.status_code == 200
    assert resposta.json()["status"] == "UP"


def test_ai_service_saudavel(http, ambiente: Ambiente):
    resposta = http.get(f"{ambiente.ai_service}/health")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok", "service": "ai-service"}


def test_exchange_direta_duravel(rabbit):
    exchange = rabbit.get(f"/exchanges/%2F/{EXCHANGE}").json()
    assert exchange["type"] == "direct"
    assert exchange["durable"] is True


def test_filas_duraveis_com_politicas(rabbit):
    fila = rabbit.get(f"/queues/%2F/{FILA}").json()
    dlq = rabbit.get(f"/queues/%2F/{DLQ}").json()
    assert fila["durable"] is True and dlq["durable"] is True
    assert fila["policy"] == "ml-training-requests-dlx"
    assert fila["effective_policy_definition"]["dead-letter-routing-key"] == DLQ
    assert dlq["policy"] == "ml-training-dead-letter-retencao"


def test_binding_da_routing_key(rabbit):
    bindings = rabbit.get(f"/exchanges/%2F/{EXCHANGE}/bindings/source").json()
    assert any(b["destination"] == FILA and b["routing_key"] == ROUTING_KEY for b in bindings)


def test_worker_consumindo_a_fila(rabbit):
    consumidores = aguardar(lambda: rabbit.get(f"/queues/%2F/{FILA}").json()["consumers"])
    assert consumidores >= 1, "O worker do ai-service não está consumindo a fila."
