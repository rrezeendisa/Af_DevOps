#!/bin/sh
# Ponto de entrada da imagem do ai-service.
#   api    -> garante um modelo treinado e inicia o FastAPI (padrão)
#   worker -> inicia o consumidor RabbitMQ de solicitações de treinamento
#   train  -> treina o modelo e encerra
set -eu

garantir_modelo() {
    if [ ! -f "$MODEL_PATH" ]; then
        echo "Modelo não encontrado em $MODEL_PATH; treinando a versão inicial..."
        python -m ml.train_model
    fi
}

case "${1:-api}" in
    api)
        garantir_modelo
        exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
        ;;
    worker)
        exec python -m worker.consumer
        ;;
    train)
        exec python -m ml.train_model
        ;;
    *)
        exec "$@"
        ;;
esac
