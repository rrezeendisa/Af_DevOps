"""Fluxo ponta a ponta: backend Java -> RabbitMQ -> worker Python -> backend Java."""
import json
import uuid

from conftest import Ambiente, aguardar

FILA = "ml.training.requests"
DLQ = "ml.training.requests.dead-letter"


def _solicitar(admin) -> dict:
    resposta = admin.post("/api/treinamentos")
    assert resposta.status_code == 202, resposta.text
    return resposta.json()


def _consultar(admin, solicitacao_id: int) -> dict:
    resposta = admin.get(f"/api/treinamentos/{solicitacao_id}")
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def test_solicitacao_de_treinamento_e_concluida_pelo_worker(ambiente: Ambiente, admin):
    criada = _solicitar(admin)
    assert criada["status"] == "PENDENTE"
    assert criada["solicitadoPor"] == ambiente.admin[0]

    final = aguardar(
        lambda: (s := _consultar(admin, criada["id"]))["status"] != "PENDENTE" and s,
        timeout=90,
    )

    assert final["status"] == "CONCLUIDO", final
    assert final["versaoModelo"] == "1.0.0"
    assert final["atualizadoEm"] >= final["criadoEm"]


def test_varias_solicitacoes_sao_processadas_em_sequencia(admin):
    ids = [_solicitar(admin)["id"] for _ in range(3)]

    def todas_finalizadas():
        status = [_consultar(admin, i)["status"] for i in ids]
        return "PENDENTE" not in status and status

    assert aguardar(todas_finalizadas, timeout=120) == ["CONCLUIDO"] * 3
    listadas = admin.get("/api/treinamentos").json()
    assert set(ids) <= {s["id"] for s in listadas}


def test_colaborador_nao_solicita_nem_acompanha(colaborador):
    tentativa = colaborador.post("/api/treinamentos")
    assert tentativa.status_code == 403
    assert tentativa.json()["codigo"] == "ACESSO_NEGADO"
    consulta = colaborador.get("/api/treinamentos")
    assert consulta.status_code == 403


def test_rota_interna_exige_token_compartilhado(http, ambiente: Ambiente, admin):
    criada = _solicitar(admin)
    url = f"{ambiente.backend}/internal/treinamentos/{criada['id']}/status"
    corpo = {"status": "FALHOU", "mensagem": "tentativa sem token"}

    assert http.patch(url, json=corpo).status_code == 401
    assert http.patch(url, json=corpo, headers={"Authorization": f"Bearer {uuid.uuid4()}"}).status_code == 401
    assert http.patch(url, json=corpo, auth=ambiente.admin).status_code == 401
    # A sessão autenticada do ADMIN também não concede acesso à rota interna.
    assert admin.escrever("PATCH", url.removeprefix(ambiente.backend), json=corpo).status_code == 401
    # E o token interno não dá acesso à API pública.
    publica = http.get(f"{ambiente.backend}/api/cursos", headers={"Authorization": f"Bearer {ambiente.token_interno}"})
    assert publica.status_code == 401

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
