"""Contratos do gateway no build servido pelo Compose, sem Vite."""

import base64
import hashlib
import http.client
import re

import pytest

from conftest import Ambiente, config


def porta() -> int:
    return int(config("GATEWAY_PORT", "8088"))


def endereco() -> str:
    return f"http://127.0.0.1:{porta()}"


def test_build_spa_e_csp(http):
    assert http.get(f"{endereco()}/healthz").status_code == 200
    pagina = http.get(f"{endereco()}/admin/treinamentos/1")
    assert pagina.status_code == 200
    assert pagina.headers["cache-control"] == "no-cache"
    assert pagina.headers["x-content-type-options"] == "nosniff"
    script = re.search(rb"<script>(.*?)</script>", pagina.content, re.S)
    assert script is not None
    hash_tema = base64.b64encode(hashlib.sha256(script.group(1)).digest()).decode("ascii")
    csp = pagina.headers["content-security-policy"]
    assert f"script-src 'self' 'sha256-{hash_tema}'" in csp.split("; ")
    arquivo = re.search(rb'src="(/assets/[^"]+\.js)"', pagina.content)
    assert arquivo is not None
    asset = http.get(f"{endereco()}{arquivo.group(1).decode('ascii')}")
    assert asset.status_code == 200
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"


@pytest.mark.parametrize("caminho", [
    "/api",
    "/api/desconhecida",
    "/api//me",
    "/api/a/./me",
    "/api/a/../me",
    r"/api\me",
    "/api/%6de",
    "/api%2Fme",
    "/api%5Cme",
    "/api/%252fme",
    "/api/../entrar",
    "/internal/treinamentos/1/status",
    "/actuator/health",
    "/docs",
    "/assets/ausente-12345678.js",
])
def test_nao_serve_spa_em_rotas_bloqueadas(caminho):
    # A URL precisa chegar ao Nginx sem normalização pelo cliente.
    conexao = http.client.HTTPConnection("127.0.0.1", porta(), timeout=10)
    try:
        conexao.request("GET", caminho)
        resposta = conexao.getresponse()
        assert resposta.status == 404
        assert resposta.getheader("Content-Type", "").startswith("application/problem+json")
        assert resposta.getheader("X-Content-Type-Options") == "nosniff"
        assert "<html" not in resposta.read().decode("utf-8").lower()
    finally:
        conexao.close()


def test_rota_interna_do_worker_nao_passa_pelo_gateway(http):
    resposta = http.patch(f"{endereco()}/internal/treinamentos/1/status")
    assert resposta.status_code == 404
    assert resposta.headers["content-type"].startswith("application/problem+json")
    assert "content-security-policy" in resposta.headers


def test_basic_e_csrf_passam_pelo_gateway(http, ambiente: Ambiente):
    url = endereco()
    falha = http.get(f"{url}/api/me", auth=(ambiente.admin[0], "senha-incorreta-de-teste"))
    assert falha.status_code == 401
    assert "www-authenticate" not in falha.headers
    assert falha.headers["content-type"].startswith("application/problem+json")
    assert "content-security-policy" in falha.headers

    identidade = http.get(f"{url}/api/me?exemplo=%2F", auth=ambiente.admin)
    assert identidade.status_code == 200
    assert identidade.json()["perfil"] == "ADMIN"
    id_invalido = http.get(f"{url}/api/cursos/abc", auth=ambiente.colaborador)
    assert id_invalido.status_code == 400
    assert id_invalido.json()["codigo"] == "DADOS_INVALIDOS"
    curso = {"nome": "Curso fictício do gateway", "descricao": "Teste integrado",
             "cargaHoraria": 2, "categoria": "Teste", "nivel": "BASICO"}
    negado = http.post(f"{url}/api/cursos", auth=ambiente.admin, json=curso)
    assert negado.status_code == 403
    assert negado.json()["codigo"] == "CSRF_INVALIDO"

    http.cookies.clear()
    csrf = http.get(f"{url}/api/csrf", auth=ambiente.admin)
    assert csrf.status_code == 200
    cookie = csrf.headers["set-cookie"].lower()
    assert all(atributo in cookie for atributo in ("xsrf-token=", "httponly", "samesite=strict"))
    corpo = csrf.json()
    criado = http.post(f"{url}/api/cursos", auth=ambiente.admin, json=curso,
                       headers={corpo["headerName"]: corpo["token"]})
    assert criado.status_code == 201
    assert criado.headers["location"] == f"/api/cursos/{criado.json()['id']}"
    consulta = http.get(f"{url}{criado.headers['location']}", auth=ambiente.colaborador)
    assert consulta.status_code == 200
    assert consulta.json()["nome"] == curso["nome"]
