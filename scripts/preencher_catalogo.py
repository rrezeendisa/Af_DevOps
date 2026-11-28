#!/usr/bin/env python3
"""Preenche o catálogo de demonstração da Evolia pela API REST, sem duplicar nem apagar cursos.

Uso (com a pilha no ar):

    python3 scripts/preencher_catalogo.py            # cadastra o que faltar
    python3 scripts/preencher_catalogo.py --simular  # só mostra o que faria

Endereço em EVOLIA_URL (padrão http://127.0.0.1:8088). Credenciais do administrador em
EVOLIA_ADMIN_USUARIO e EVOLIA_ADMIN_SENHA; na falta delas, são lidas do .env da raiz
(AFDEVOPS_ADMIN_USERNAME e E2E_ADMIN_PASSWORD, gerados por scripts/gerar-env.sh).
Nenhuma credencial é exibida. Só biblioteca padrão (Python 3.9 ou superior).

A API não impõe nome único: a comparação por nome (sem diferenciar maiúsculas, acentos
e espaços) é feita aqui. Não execute duas cópias ao mesmo tempo.
"""
import argparse
import json
import os
import sys
import unicodedata
from http.client import HTTPException
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener

RAIZ = Path(__file__).resolve().parents[1]

# (nome, nível, horas, descrição)
CATALOGO = {
    "Tecnologia": [
        ("Fundamentos da tecnologia digital", "BASICO", 8,
         "Conceitos essenciais de computadores, internet e ferramentas digitais para o trabalho no dia a dia."),
        ("Segurança da informação no cotidiano", "BASICO", 12,
         "Senhas, autenticação em duas etapas, golpes comuns e cuidados com dados pessoais e corporativos."),
        ("Git e GitHub", "BASICO", 10,
         "Controle de versão na prática: commits, ramificações, revisão de código e colaboração em repositórios."),
        ("Fundamentos de desenvolvimento de software", "INTERMEDIARIO", 20,
         "Do requisito à entrega: lógica de aplicações, testes, boas práticas e trabalho em equipe."),
        ("Banco de dados e SQL", "INTERMEDIARIO", 16,
         "Modelagem relacional, consultas, junções e agregações para transformar dados em respostas."),
        ("Introdução à arquitetura de software", "AVANCADO", 24,
         "Estilos arquiteturais, modularidade, requisitos de qualidade e registro de decisões técnicas."),
    ],
    "Comunicação": [
        ("Comunicação no ambiente corporativo", "BASICO", 6,
         "Como se expressar com clareza em conversas, reuniões e canais da empresa."),
        ("Comunicação assertiva", "BASICO", 8,
         "Pedir, discordar e estabelecer limites com respeito, objetividade e escuta."),
        ("Escrita profissional", "BASICO", 10,
         "Mensagens, e-mails e documentos objetivos, bem estruturados e fáceis de agir."),
        ("Apresentações de alto impacto", "INTERMEDIARIO", 12,
         "Roteiro, narrativa, apoio visual e segurança para apresentar ideias a diferentes públicos."),
        ("Feedback e escuta ativa", "INTERMEDIARIO", 8,
         "Técnicas para ouvir com atenção e conduzir conversas de retorno construtivas."),
        ("Liderança e facilitação de equipes", "AVANCADO", 16,
         "Condução de reuniões e decisões em grupo, mediação de conflitos e desenvolvimento de pessoas."),
    ],
    "Raciocínio lógico": [
        ("Fundamentos do raciocínio lógico", "BASICO", 8,
         "Proposições, inferências, padrões e armadilhas comuns de argumentação."),
        ("Lógica de programação", "BASICO", 16,
         "Variáveis, decisões, repetições e funções para construir os primeiros algoritmos."),
        ("Pensamento computacional", "BASICO", 12,
         "Decomposição, reconhecimento de padrões, abstração e passos para resolver problemas."),
        ("Resolução estruturada de problemas", "INTERMEDIARIO", 12,
         "Definição do problema, análise de causas, alternativas e acompanhamento de resultados."),
        ("Algoritmos e estruturas de dados", "INTERMEDIARIO", 24,
         "Listas, pilhas, filas, árvores, busca e ordenação, com noções de complexidade."),
        ("Tomada de decisão baseada em dados", "AVANCADO", 20,
         "Indicadores, leitura crítica de gráficos, vieses e decisões apoiadas em evidências."),
    ],
}


class Falha(RuntimeError):
    pass


class SemRedirecionamento(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Sessao:
    """Sessão como a do navegador: cookie, CSRF antes de cada escrita e contexto do login."""

    def __init__(self, url):
        self.url = url
        self.contexto = None
        self.abrir = build_opener(HTTPCookieProcessor(CookieJar()), SemRedirecionamento()).open

    def enviar(self, metodo, rota, corpo=None, cabecalhos=None):
        cabecalhos = {"Accept": "application/json", **(cabecalhos or {})}
        if self.contexto:
            cabecalhos["X-Evolia-Contexto"] = self.contexto
        try:
            try:
                resposta = self.abrir(Request(self.url + rota, corpo, cabecalhos, method=metodo), timeout=30)
            except HTTPError as erro:
                resposta = erro
            with resposta:
                texto = resposta.read()
        except URLError as erro:
            raise Falha(f"Não foi possível acessar {self.url}: {erro.reason}") from None
        except (OSError, HTTPException):
            raise Falha(f"A conexão com {self.url} foi interrompida. Confira se a pilha terminou de subir.") from None
        try:
            dados = json.loads(texto) if texto else None
        except ValueError:
            dados = None
        return resposta.status, dados, resposta.headers

    def csrf(self):
        status, dados, _ = self.enviar("GET", "/api/csrf")
        if status != 200:
            raise Falha(f"CSRF indisponível (HTTP {status}).")
        return {dados["headerName"]: dados["token"]}

    def entrar(self, usuario, senha):
        formulario = urlencode({"username": usuario, "password": senha}).encode()
        status, _, _ = self.enviar("POST", "/api/login", formulario,
                                   {"Content-Type": "application/x-www-form-urlencoded", **self.csrf()})
        if status != 204:
            raise Falha(f"Login recusado (HTTP {status}). Confira as credenciais do administrador.")
        status, dados, cabecalhos = self.enviar("GET", "/api/me")
        if status != 200 or dados.get("perfil") != "ADMIN":
            raise Falha("A conta informada não é de administrador.")
        self.contexto = cabecalhos["X-Evolia-Contexto"]

    def sair(self):
        self.enviar("POST", "/api/logout", None, self.csrf())
        self.contexto = None

    def listar_cursos(self):
        status, dados, _ = self.enviar("GET", "/api/cursos")
        if status != 200:
            raise Falha(f"Não foi possível listar os cursos (HTTP {status}).")
        return dados

    def cadastrar(self, curso):
        status, _, _ = self.enviar("POST", "/api/cursos", json.dumps(curso).encode(),
                                   {"Content-Type": "application/json", **self.csrf()})
        if status != 201:
            raise Falha(f"Cadastro de “{curso['nome']}” recusado (HTTP {status}).")


def chave(nome):
    sem_acento = unicodedata.normalize("NFD", nome)
    return " ".join("".join(c for c in sem_acento if not unicodedata.combining(c)).casefold().split())


def credencial(variavel, no_env):
    if os.getenv(variavel):
        return os.environ[variavel]
    arquivo = RAIZ / ".env"
    if arquivo.is_file():
        for linha in arquivo.read_text(encoding="utf-8").splitlines():
            nome, separador, valor = linha.strip().partition("=")
            if separador and nome == no_env:
                return valor.strip().strip("'\"")
    raise Falha(f"Defina {variavel} (ou {no_env} no .env).")


def main():
    opcoes = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    opcoes.add_argument("--simular", action="store_true", help="não grava nada")
    argumentos = opcoes.parse_args()

    url = os.getenv("EVOLIA_URL", "http://127.0.0.1:8088").rstrip("/")
    partes = urlsplit(url)
    if partes.scheme != "https" and partes.hostname not in ("127.0.0.1", "localhost", "::1"):
        raise Falha("Fora desta máquina, use HTTPS para não expor a senha.")

    sessao = Sessao(url)
    sessao.entrar(credencial("EVOLIA_ADMIN_USUARIO", "AFDEVOPS_ADMIN_USERNAME"),
                  credencial("EVOLIA_ADMIN_SENHA", "E2E_ADMIN_PASSWORD"))
    try:
        existentes = {chave(curso["nome"]) for curso in sessao.listar_cursos()}
        criados = ignorados = 0
        for categoria, cursos in CATALOGO.items():
            for nome, nivel, horas, descricao in cursos:
                if chave(nome) in existentes:
                    ignorados += 1
                    continue
                if not argumentos.simular:
                    sessao.cadastrar({"nome": nome, "descricao": descricao, "cargaHoraria": horas,
                                      "categoria": categoria, "nivel": nivel})
                existentes.add(chave(nome))
                criados += 1
                print(f"{'Faltando' if argumentos.simular else 'Cadastrado'}: {nome}")
        total = len(sessao.listar_cursos())
        verbo = "a cadastrar" if argumentos.simular else "cadastrados"
        print(f"{criados} {verbo}, {ignorados} já existiam; {total} cursos no catálogo.")
    finally:
        sessao.sair()


if __name__ == "__main__":
    try:
        main()
    except Falha as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        sys.exit(1)
