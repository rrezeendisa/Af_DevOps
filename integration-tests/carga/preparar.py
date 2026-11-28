"""Provisiona contas fictícias pelo gateway e reusa a sessão HTTP nos roteiros."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from http.cookiejar import CookieJar
import json
import os
from pathlib import Path
import re
import secrets
import time
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener


class SemRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Sessao:
    def __init__(self, url, usuario, senha):
        self.url = url
        self.basic = "Basic " + base64.b64encode(f"{usuario}:{senha}".encode()).decode()
        self.opener = build_opener(HTTPCookieProcessor(CookieJar()), SemRedirect())

    def chamar(self, rota, metodo="GET", dados=None):
        headers = {"Authorization": self.basic, "Accept": "application/json"}
        if metodo in ("POST", "PUT"):
            status, csrf, _ = self.chamar("/api/csrf")
            exigir(status == 200 and csrf.get("headerName") == "X-XSRF-TOKEN"
                   and bool(csrf.get("token")), "obter CSRF")
            headers["X-XSRF-TOKEN"] = csrf["token"]
        corpo = None if dados is None else json.dumps(dados).encode()
        if corpo is not None:
            headers["Content-Type"] = "application/json"
        req = Request(self.url + rota, corpo, headers, method=metodo)
        try:
            resposta = self.opener.open(req, timeout=90 if rota == "/api/ia/orientacoes" else 25)
        except HTTPError as erro:
            resposta = erro
        with resposta:
            corpo = resposta.read()
            return resposta.status, json.loads(corpo) if corpo else {}, resposta.headers


def exigir(condicao, etapa):
    if not condicao:
        raise RuntimeError(f"Falha na etapa: {etapa}")


def ler_env(arquivo):
    return {chave: valor.strip().strip("'\"")
            for linha in arquivo.read_text().splitlines()
            if re.match(r"^[A-Z][A-Z0-9_]*=", linha)
            for chave, valor in [linha.split("=", 1)]}


def criar_conta(url, env, identificador):
    admin = Sessao(url, env["AFDEVOPS_ADMIN_USERNAME"], env["E2E_ADMIN_PASSWORD"])
    status, colaborador, _ = admin.chamar("/api/colaboradores", "POST", {
        "nome": f"Pessoa fictícia {identificador}", "email": f"{identificador}@example.org",
        "cargo": "Analista", "departamento": "Teste",
    })
    exigir(status == 201, "criar colaborador fictício")
    senha = secrets.token_hex(18)
    status, _, _ = admin.chamar(f"/api/colaboradores/{colaborador['id']}/conta", "POST",
                                {"nomeUsuario": identificador, "senhaInicial": senha})
    exigir(status == 201, "criar conta fictícia")
    pessoa = Sessao(url, identificador, senha)
    status, identidade, _ = pessoa.chamar("/api/me")
    exigir(status == 200 and identidade.get("colaboradorId") == colaborador["id"], "verificar identidade")
    status, decisao, _ = pessoa.chamar("/api/me/consentimento", "PUT", {"autorizado": True})
    exigir(status == 200 and decisao.get("autorizado") is True, "confirmar consentimento fictício")
    return {"usuario": identificador, "senha": senha}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("ambiente", type=Path)
    parser.add_argument("saida", type=Path)
    parser.add_argument("--porta", type=int, required=True)
    args = parser.parse_args()
    inicio = time.monotonic()
    env = ler_env(args.ambiente / ".env")
    url = f"http://127.0.0.1:{args.porta}"
    prefixo = "carga-" + secrets.token_hex(5)
    with ThreadPoolExecutor(max_workers=4) as executor:
        contas = list(executor.map(lambda i: criar_conta(url, env, f"{prefixo}-{i:03}"), range(300)))
    descritor = os.open(args.saida, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descritor, "w") as arquivo:
        json.dump(contas, arquivo)
    print(json.dumps({"contas": len(contas), "provisionamento_s": round(time.monotonic() - inicio, 2)}))


if __name__ == "__main__":
    main()
