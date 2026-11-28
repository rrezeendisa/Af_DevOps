"""Contratos do gateway no build servido pelo Compose, sem Vite."""

import base64
import hashlib
import http.client
import re
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest

from conftest import CONTEXTO, COOKIE_SESSAO, Ambiente, config


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


def test_sessao_e_csrf_passam_pelo_gateway(http, ambiente: Ambiente, abrir_sessao):
    url = endereco()
    admin = abrir_sessao(url, ambiente.admin, entrar=False)
    falha = admin.login("senha-incorreta-de-teste")
    assert falha.status_code == 401
    assert "www-authenticate" not in falha.headers
    assert falha.headers["content-type"].startswith("application/problem+json")
    assert "content-security-policy" in falha.headers
    assert COOKIE_SESSAO not in admin.cliente.cookies

    entrada = admin.login()
    assert entrada.status_code == 204
    cookie_sessao = next(c.lower() for c in entrada.headers.get_list("set-cookie") if c.startswith(COOKIE_SESSAO))
    assert all(atributo in cookie_sessao for atributo in ("httponly", "samesite=strict", "path=/"))
    admin.contexto = admin.cliente.get("/api/me").headers[CONTEXTO]
    colaborador = abrir_sessao(url, ambiente.colaborador)

    identidade = admin.get("/api/me?exemplo=%2F")
    assert identidade.status_code == 200
    assert identidade.json()["perfil"] == "ADMIN"
    id_invalido = colaborador.get("/api/cursos/abc")
    assert id_invalido.status_code == 400
    assert id_invalido.json()["codigo"] == "DADOS_INVALIDOS"
    curso = {"nome": "Curso fictício do gateway", "descricao": "Teste integrado",
             "cargaHoraria": 2, "categoria": "Teste", "nivel": "BASICO"}
    negado = admin.cliente.post("/api/cursos", json=curso, headers=admin.cabecalhos())
    assert negado.status_code == 403
    assert negado.json()["codigo"] == "CSRF_INVALIDO"

    admin.cliente.cookies.delete("XSRF-TOKEN")
    csrf = admin.get("/api/csrf")
    assert csrf.status_code == 200
    cookie = csrf.headers["set-cookie"].lower()
    assert all(atributo in cookie for atributo in ("xsrf-token=", "httponly", "samesite=strict"))
    corpo = csrf.json()
    criado = admin.cliente.post("/api/cursos", json=curso,
                                headers={**admin.cabecalhos(), corpo["headerName"]: corpo["token"]})
    assert criado.status_code == 201
    assert criado.headers["location"] == f"/api/cursos/{criado.json()['id']}"
    consulta = colaborador.get(criado.headers["location"])
    assert consulta.status_code == 200
    assert consulta.json()["nome"] == curso["nome"]


def test_basic_nao_autentica_pelo_gateway(http, ambiente: Ambiente):
    resposta = http.get(f"{endereco()}/api/me", auth=ambiente.admin)
    assert resposta.status_code == 401
    assert resposta.json()["codigo"] == "AUTENTICACAO_NECESSARIA"
    assert "www-authenticate" not in resposta.headers


@pytest.mark.parametrize("metodo,rota", [("GET", "/api/login"), ("PUT", "/api/login"),
                                         ("GET", "/api/logout"), ("POST", "/api/login/outro")])
def test_login_e_logout_aceitam_somente_post(http, metodo, rota):
    resposta = http.request(metodo, f"{endereco()}{rota}")
    assert resposta.status_code == 404
    assert resposta.headers["content-type"].startswith("application/problem+json")


def test_contexto_logout_e_reuso_de_cookie(ambiente: Ambiente, abrir_sessao):
    url = endereco()
    sessao = abrir_sessao(url, ambiente.admin)
    cookie = sessao.cliente.cookies[COOKIE_SESSAO]
    contexto = sessao.contexto

    sem_contexto = sessao.cliente.get("/api/cursos")
    assert sem_contexto.status_code == 401
    assert sem_contexto.json()["codigo"] == "SESSAO_SUBSTITUIDA"

    # Novo login no mesmo "navegador": troca o ID e o contexto antigo deixa de valer.
    outra = abrir_sessao(url, ambiente.colaborador, entrar=False)
    outra.cliente.cookies = sessao.cliente.cookies
    outra.entrar()
    assert outra.cliente.cookies[COOKIE_SESSAO] != cookie
    sessao.cliente.cookies = outra.cliente.cookies
    antigo = sessao.get("/api/cursos")
    assert antigo.status_code == 401 and antigo.json()["codigo"] == "SESSAO_SUBSTITUIDA"
    logout_antigo = sessao.sair()
    assert logout_antigo.status_code == 401 and logout_antigo.json()["codigo"] == "SESSAO_SUBSTITUIDA"
    assert outra.get("/api/cursos").status_code == 200
    assert outra.contexto != contexto

    encerrado = outra.cliente.cookies[COOKIE_SESSAO]
    assert outra.sair().status_code == 204
    reuso = httpx.get(f"{url}/api/cursos", headers={"Cookie": f"{COOKIE_SESSAO}={encerrado}", CONTEXTO: outra.contexto})
    assert reuso.status_code == 401
    assert reuso.json()["codigo"] == "AUTENTICACAO_NECESSARIA"


def test_rota_interna_continua_bloqueada_com_sessao(ambiente: Ambiente, abrir_sessao):
    admin = abrir_sessao(endereco(), ambiente.admin)
    resposta = admin.escrever("PATCH", "/internal/treinamentos/1/status", json={"status": "CONCLUIDO"})
    assert resposta.status_code == 404


def test_zz_login_limitado_por_taxa_sem_afetar_outras_rotas(http, ambiente: Ambiente, abrir_sessao):
    """Sem CSRF o Java recusa cedo (403, sem BCrypt); o excesso é barrado antes, pelo Nginx."""
    sessao = abrir_sessao(endereco(), ambiente.admin)
    time.sleep(6)
    with ThreadPoolExecutor(max_workers=20) as executor:
        respostas = list(executor.map(lambda _: http.post(f"{endereco()}/api/login"), range(120)))
    codigos = [resposta.status_code for resposta in respostas]
    assert set(codigos) == {403, 429}
    assert codigos.count(403) >= 50
    recusada = next(resposta for resposta in respostas if resposta.status_code == 429)
    assert recusada.headers["retry-after"] == "1"
    assert recusada.headers["content-type"].startswith("application/problem+json")
    assert sessao.get("/api/cursos").status_code == 200
    time.sleep(6)
