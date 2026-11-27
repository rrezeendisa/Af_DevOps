# syntax=docker/dockerfile:1
# Uma única imagem atende à API (FastAPI) e ao worker RabbitMQ;
# o comando passado ao container escolhe o processo (api | worker | train).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN groupadd --system app \
    && useradd --system --gid app --no-create-home app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY ml ./ml
COPY worker ./worker
COPY data ./data
COPY knowledge ./knowledge
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Artefatos do modelo e ledger do worker ficam em /data/artifacts,
# diretório pensado para ser montado como volume compartilhado entre API e worker.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data/artifacts \
    && chown -R app:app /data

ENV MODEL_PATH=/data/artifacts/classifier.joblib \
    TRAINING_RESULT_PATH=/data/artifacts/training-results.json

USER app
EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["api"]
