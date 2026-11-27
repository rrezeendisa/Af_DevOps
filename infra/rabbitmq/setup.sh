#!/bin/sh
# Aplica a topologia de treinamento (definitions.json) pela API de gerenciamento.
#
# Por que não carregar as definições no boot do broker?
# Quando o RabbitMQ importa definições na inicialização ele deixa de criar o
# usuário padrão (RABBITMQ_DEFAULT_USER/PASS). Para não versionar usuários ou
# hashes de senha, o broker sobe normalmente e este script importa apenas
# exchange, filas, binding e políticas. A importação é idempotente.
#
# Variáveis: RABBITMQ_USER, RABBITMQ_PASSWORD (obrigatórias),
#            RABBITMQ_MANAGEMENT_URL (padrão http://rabbitmq:15672),
#            DEFINITIONS_FILE (padrão /definitions/definitions.json).
set -eu

: "${RABBITMQ_USER:?RABBITMQ_USER não definida}"
: "${RABBITMQ_PASSWORD:?RABBITMQ_PASSWORD não definida}"
URL="${RABBITMQ_MANAGEMENT_URL:-http://rabbitmq:15672}"
DEFINITIONS="${DEFINITIONS_FILE:-/definitions/definitions.json}"
AUTH="$RABBITMQ_USER:$RABBITMQ_PASSWORD"

tentativa=1
until curl -fs -o /dev/null -u "$AUTH" "$URL/api/overview"; do
    if [ "$tentativa" -ge 30 ]; then
        echo "API de gerenciamento do RabbitMQ indisponível em $URL." >&2
        exit 1
    fi
    tentativa=$((tentativa + 1))
    sleep 2
done

curl -fsS -o /dev/null -u "$AUTH" -X POST \
    -H "Content-Type: application/json" \
    --data-binary "@$DEFINITIONS" \
    "$URL/api/definitions"

for fila in ml.training.requests ml.training.requests.dead-letter; do
    curl -fsS -o /dev/null -u "$AUTH" "$URL/api/queues/%2F/$fila"
done
curl -fsS -o /dev/null -u "$AUTH" "$URL/api/exchanges/%2F/ml.training"

echo "Topologia ml.training aplicada: exchange ml.training, fila ml.training.requests (training.requested) e DLQ ml.training.requests.dead-letter."
