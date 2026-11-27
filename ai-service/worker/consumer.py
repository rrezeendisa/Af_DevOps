import json
import logging
import os
from typing import Any

import pika
from pydantic import ValidationError

from app.training_messages import TrainingRequestMessage
from worker.backend_client import BackendStatusClient
from worker.processor import RESULT_PATH, TrainingProcessor, TrainingResultStore

logger = logging.getLogger(__name__)
EXCHANGE = "ml.training"
ROUTING_KEY = "training.requested"
QUEUE = "ml.training.requests"
DEAD_LETTER_QUEUE = "ml.training.requests.dead-letter"
MAX_RETRIES = int(os.getenv("MAX_MESSAGE_RETRIES", "3"))


def _publish_to_dead_letter(channel, body: bytes, properties: Any, reason: str) -> None:
    headers = dict(getattr(properties, "headers", None) or {})
    headers["x-ai-failure"] = reason[:500]
    channel.basic_publish(
        exchange="",
        routing_key=DEAD_LETTER_QUEUE,
        body=body,
        properties=pika.BasicProperties(
            content_type="application/json", delivery_mode=2, headers=headers
        ),
    )


def handle_delivery(channel, method, properties, body: bytes, processor: TrainingProcessor) -> None:
    delivery_tag = method.delivery_tag
    try:
        request = TrainingRequestMessage.model_validate_json(body)
        request_id = request.normalized_id()
    except (ValidationError, ValueError, json.JSONDecodeError) as error:
        logger.warning("Mensagem de treinamento inválida; encaminhando à DLQ: %s", error)
        _publish_to_dead_letter(channel, body, properties, f"mensagem inválida: {error}")
        channel.basic_ack(delivery_tag=delivery_tag)
        return

    try:
        processor.process(request_id)
    except Exception as error:  # falhas externas e de treinamento seguem retry limitado
        headers = dict(getattr(properties, "headers", None) or {})
        retries = int(headers.get("x-ai-retry-count", 0))
        if retries < MAX_RETRIES:
            headers["x-ai-retry-count"] = retries + 1
            channel.basic_publish(
                exchange=EXCHANGE,
                routing_key=ROUTING_KEY,
                body=body,
                properties=pika.BasicProperties(
                    content_type="application/json", delivery_mode=2, headers=headers
                ),
            )
            channel.basic_ack(delivery_tag=delivery_tag)
            logger.warning(
                "Falha transitória na solicitação %s; agendada tentativa %s/%s.",
                request_id,
                retries + 1,
                MAX_RETRIES,
            )
            return

        try:
            saved_result = None
            result_store = getattr(processor, "result_store", None)
            if result_store is not None:
                saved_result = result_store.get(request_id)
            if saved_result and saved_result.get("status") == "CONCLUIDO":
                error = RuntimeError(
                    "O treinamento foi salvo, mas o backend não confirmou a atualização; "
                    "o resultado idempotente permanece no ledger local."
                )
            else:
                processor.report_failure(request_id, str(error))
        except Exception as status_error:
            error = RuntimeError(
                f"Falha após {MAX_RETRIES} tentativas; atualização do backend também falhou: "
                f"{status_error}"
            )
        _publish_to_dead_letter(channel, body, properties, str(error))
        channel.basic_ack(delivery_tag=delivery_tag)
        logger.error("Solicitação %s encaminhada à DLQ: %s", request_id, error)
        return

    channel.basic_ack(delivery_tag=delivery_tag)


def build_processor() -> TrainingProcessor:
    backend_url = os.getenv("JAVA_BACKEND_URL", "")
    token = os.getenv("INTERNAL_API_TOKEN", "")
    backend_client = BackendStatusClient(base_url=backend_url, token=token)
    return TrainingProcessor(
        backend_client=backend_client,
        result_store=TrainingResultStore(RESULT_PATH),
    )


def run_worker() -> None:
    rabbitmq_url = os.getenv("RABBITMQ_URL", "").strip()
    if not rabbitmq_url:
        raise RuntimeError("RABBITMQ_URL não foi configurada.")
    processor = build_processor()
    parameters = pika.URLParameters(rabbitmq_url)
    parameters.heartbeat = 60
    parameters.blocked_connection_timeout = 30
    connection = pika.BlockingConnection(parameters)
    try:
        channel = connection.channel()
        channel.exchange_declare(exchange=EXCHANGE, exchange_type="direct", durable=True)
        channel.queue_declare(queue=QUEUE, durable=True)
        channel.queue_bind(exchange=EXCHANGE, queue=QUEUE, routing_key=ROUTING_KEY)
        channel.queue_declare(queue=DEAD_LETTER_QUEUE, durable=True)
        channel.confirm_delivery()
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(
            queue=QUEUE,
            on_message_callback=lambda ch, method, props, body: handle_delivery(
                ch, method, props, body, processor
            ),
            auto_ack=False,
        )
        logger.info("Consumindo %s (%s:%s).", QUEUE, EXCHANGE, ROUTING_KEY)
        channel.start_consuming()
    finally:
        if connection.is_open:
            connection.close()


if __name__ == "__main__":
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    run_worker()
