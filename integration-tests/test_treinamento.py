"""Fluxo ponta a ponta: backend Java -> RabbitMQ -> worker Python -> backend Java."""
import json
import uuid

from conftest import Ambiente, aguardar

FILA = "ml.training.requests"
DLQ = "ml.training.requests.dead-letter"


def _solicitar(http, ambiente: Ambiente, csrf) -> dict:
    resposta = http.post(f"{ambiente.backend}/api/treinamentos", auth=ambiente.admin, headers=csrf())
    assert resposta.status_code == 202, resposta.text
    return resposta.json()


def _consultar(http, ambiente: Ambiente, solicitacao_id: int) -> dict:
    resposta = http.get(f"{ambiente.backend}/api/treinamentos/{solicitacao_id}", auth=ambiente.admin)
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def test_solicitacao_de_treinamento_e_concluida_pelo_worker(http, ambiente: Ambiente, csrf):
    criada = _solicitar(http, ambiente, csrf)
    assert criada["status"] == "PENDENTE"
    assert criada["solicitadoPor"] == ambiente.admin[0]

    final = aguardar(
        lambda: (s := _consultar(http, ambiente, criada["id"]))["status"] != "PENDENTE" and s,
        timeout=90,
    )

    assert final["status"] == "CONCLUIDO", final
    assert final["versaoModelo"] == "1.0.0"
    assert final["atualizadoEm"] >= final["criadoEm"]


def test_varias_solicitacoes_sao_processadas_em_sequencia(http, ambiente: Ambiente, csrf):
    ids = [_solicitar(http, ambiente, csrf)["id"] for _ in range(3)]

    def todas_finalizadas():
        status = [_consultar(http, ambiente, i)["status"] for i in ids]
        return "PENDENTE" not in status and status

    assert aguardar(todas_finalizadas, timeout=120) == ["CONCLUIDO"] * 3
    listadas = http.get(f"{ambiente.backend}/api/treinamentos", auth=ambiente.admin).json()
    assert set(ids) <= {s["id"] for s in listadas}


def test_colaborador_nao_solicita_nem_acompanha(http, ambiente: Ambiente, csrf):
    tentativa = http.post(f"{ambiente.backend}/api/treinamentos", auth=ambiente.colaborador, headers=csrf())
    assert tentativa.status_code == 403
    assert tentativa.json()["codigo"] == "ACESSO_NEGADO"
    consulta = http.get(f"{ambiente.backend}/api/treinamentos", auth=ambiente.colaborador)
    assert consulta.status_code == 403


def test_rota_interna_exige_token_compartilhado(http, ambiente: Ambiente, csrf):
    criada = _solicitar(http, ambiente, csrf)
    url = f"{ambiente.backend}/internal/treinamentos/{criada['id']}/status"
    corpo = {"status": "FALHOU", "mensagem": "tentativa sem token"}

    assert http.patch(url, json=corpo).status_code == 401
    assert http.patch(url, json=corpo, headers={"Authorization": f"Bearer {uuid.uuid4()}"}).status_code == 401
    assert http.patch(url, json=corpo, auth=ambiente.admin).status_code == 401

    inexistente = http.patch(
        f"{ambiente.backend}/internal/treinamentos/999999999/status",
        json={"status": "CONCLUIDO", "mensagem": "ok"},
        headers={"Authorization": f"Bearer {ambiente.token_interno}"},
    )
    assert inexistente.status_code == 404


def test_mensagem_invalida_vai_para_dead_letter(rabbit):
    marcador = f"e2e-{uuid.uuid4()}"
    publicada = rabbit.post(
        "/exchanges/%2F/ml.training/publish",
        json={
            "routing_key": "training.requested",
            "payload": json.dumps({"campo_errado": marcador}),
            "payload_encoding": "string",
            "properties": {"content_type": "application/json", "delivery_mode": 2},
        },
    )
    assert publicada.status_code == 200 and publicada.json()["routed"] is True

    def mensagem_na_dlq():
        resposta = rabbit.post(
            f"/queues/%2F/{DLQ}/get",
            json={"count": 50, "ackmode": "ack_requeue_true", "encoding": "auto"},
        )
        return next((m for m in resposta.json() if marcador in m["payload"]), None)

    mensagem = aguardar(mensagem_na_dlq, timeout=30)
    assert "mensagem inválida" in mensagem["properties"]["headers"]["x-ai-failure"]


def test_ai_service_responde_pela_rede_do_compose(http, ambiente: Ambiente):
    classificacao = http.post(
        f"{ambiente.ai_service}/classificacoes", json={"logica": 4, "comunicacao": 3, "tecnologia": 5}
    )
    assert classificacao.status_code == 200
    assert classificacao.json()["nivel"] in {"INICIANTE", "INTERMEDIARIO", "AVANCADO"}

    corpo = {
        "colaborador_id": "e2e",
        "pergunta": "Como melhorar em lógica?",
        "competencias": {"logica": 2, "comunicacao": 4, "tecnologia": 3},
    }
    assert http.post(f"{ambiente.ai_service}/orientacoes", json=corpo).status_code == 401
    autorizada = http.post(
        f"{ambiente.ai_service}/orientacoes",
        json=corpo,
        headers={"Authorization": f"Bearer {ambiente.token_interno}"},
    )
    assert autorizada.status_code == 200
    assert autorizada.json()["cursos_recomendados"]
