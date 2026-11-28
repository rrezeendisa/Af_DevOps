"""Configuração dos testes integrados ponta a ponta.

Os testes rodam contra o ambiente do docker-compose.yml já em execução.
As credenciais vêm de variáveis de ambiente ou, na falta delas, do arquivo
.env da raiz do repositório (gerado por scripts/gerar-env.sh).
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import httpx
import pytest

RAIZ = Path(__file__).resolve().parents[1]


def _ler_env(caminho: Path) -> dict[str, str]:
    valores: dict[str, str] = {}
    if not caminho.is_file():
        return valores
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        valor = valor.strip()
        if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in "'\"":
            valor = valor[1:-1]
        valores[chave.strip()] = valor
    return valores


_ARQUIVO_ENV = _ler_env(RAIZ / ".env")


def config(nome: str, padrao: str | None = None) -> str:
    valor = os.getenv(nome) or _ARQUIVO_ENV.get(nome) or padrao
    if valor is None:
        pytest.fail(f"Variável {nome} não definida (ambiente ou .env).", pytrace=False)
    return valor


@dataclass(frozen=True)
class Ambiente:
    backend: str
    ai_service: str
    rabbitmq_api: str
    rabbitmq_auth: tuple[str, str]
    admin: tuple[str, str]
    colaborador: tuple[str, str]
    token_interno: str


@pytest.fixture(scope="session")
def ambiente() -> Ambiente:
    return Ambiente(
        backend=config("BACKEND_URL", f"http://127.0.0.1:{config('BACKEND_PORT', '8080')}"),
        ai_service=config("AI_SERVICE_URL", f"http://127.0.0.1:{config('AI_SERVICE_PORT', '8000')}"),
        rabbitmq_api=config(
            "RABBITMQ_API_URL", f"http://127.0.0.1:{config('RABBITMQ_MANAGEMENT_PORT', '15672')}/api"
        ),
        rabbitmq_auth=(config("RABBITMQ_USER", "afdevops"), config("RABBITMQ_PASSWORD")),
        admin=(config("AFDEVOPS_ADMIN_USERNAME"), config("E2E_ADMIN_PASSWORD")),
        colaborador=(config("AFDEVOPS_COLABORADOR_USERNAME"), config("E2E_COLABORADOR_PASSWORD")),
        token_interno=config("INTERNAL_API_TOKEN"),
    )


@pytest.fixture(scope="session")
def http() -> httpx.Client:
    with httpx.Client(timeout=15.0) as cliente:
        yield cliente


@pytest.fixture(scope="session")
def rabbit(ambiente: Ambiente) -> httpx.Client:
    with httpx.Client(base_url=ambiente.rabbitmq_api, auth=ambiente.rabbitmq_auth, timeout=15.0) as cliente:
        yield cliente


CONTEXTO = "X-Evolia-Contexto"
COOKIE_SESSAO = "EVOLIA_SESSAO"


class SessaoApi:
    """Um usuário com cookies próprios, como um navegador independente."""

    def __init__(self, base: str, usuario: str, senha: str) -> None:
        self.cliente = httpx.Client(base_url=base, timeout=15.0)
        self.usuario = usuario
        self.senha = senha
        self.contexto: str | None = None

    def cabecalhos(self) -> dict[str, str]:
        return {} if self.contexto is None else {CONTEXTO: self.contexto}

    def csrf(self) -> dict[str, str]:
        resposta = self.cliente.get("/api/csrf", headers=self.cabecalhos())
        assert resposta.status_code == 200, resposta.status_code
        corpo = resposta.json()
        return {corpo["headerName"]: corpo["token"]}

    def login(self, senha: str | None = None) -> httpx.Response:
        return self.cliente.post(
            "/api/login",
            data={"username": self.usuario, "password": senha or self.senha},
            headers=self.csrf(),
        )

    def entrar(self) -> SessaoApi:
        """Falha imediatamente se o login ou a identidade não funcionarem."""
        self.contexto = None
        resposta = self.login()
        assert resposta.status_code == 204, resposta.status_code
        identidade = self.cliente.get("/api/me")
        assert identidade.status_code == 200, identidade.status_code
        self.contexto = identidade.headers[CONTEXTO]
        return self

    def get(self, rota: str, **opcoes) -> httpx.Response:
        return self.cliente.get(rota, headers=self.cabecalhos(), **opcoes)

    def escrever(self, metodo: str, rota: str, **opcoes) -> httpx.Response:
        return self.cliente.request(metodo, rota, headers={**self.cabecalhos(), **self.csrf()}, **opcoes)

    def post(self, rota: str, **opcoes) -> httpx.Response:
        return self.escrever("POST", rota, **opcoes)

    def sair(self) -> httpx.Response:
        return self.post("/api/logout")


@pytest.fixture
def abrir_sessao():
    """Cria sessões independentes e fecha os clientes ao final do teste."""
    criadas: list[SessaoApi] = []

    def abrir(base: str, credenciais: tuple[str, str], entrar: bool = True) -> SessaoApi:
        sessao = SessaoApi(base, *credenciais)
        criadas.append(sessao)
        return sessao.entrar() if entrar else sessao

    yield abrir
    for sessao in criadas:
        sessao.cliente.close()


@pytest.fixture
def admin(abrir_sessao, ambiente: Ambiente) -> SessaoApi:
    return abrir_sessao(ambiente.backend, ambiente.admin)


@pytest.fixture
def colaborador(abrir_sessao, ambiente: Ambiente) -> SessaoApi:
    return abrir_sessao(ambiente.backend, ambiente.colaborador)


def aguardar(condicao: Callable[[], object], timeout: float = 60.0, intervalo: float = 1.0):
    """Repete a condição até retornar valor verdadeiro ou estourar o tempo."""
    limite = time.monotonic() + timeout
    ultimo = None
    while time.monotonic() < limite:
        ultimo = condicao()
        if ultimo:
            return ultimo
        time.sleep(intervalo)
    raise AssertionError(f"Condição não atendida em {timeout}s (último valor: {ultimo!r})")
