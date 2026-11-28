#!/usr/bin/env python3
"""Define senhas das contas locais da Evolia, sem exibi-las nem versioná-las.

    python3 scripts/definir_credenciais.py admin          # conta de administrador (.env)
    python3 scripts/definir_credenciais.py demo           # conta de demonstração (.env)
    python3 scripts/definir_credenciais.py colaborador    # conta individual (banco local)

A senha é digitada duas vezes, sem aparecer na tela. O hash é BCrypt de custo 12, gerado como em
scripts/gerar-env.sh. Para admin e demo, só as linhas necessárias do .env mudam; para a conta
individual, só o hash da linha daquele usuário, em transação, com cópia anterior em
~/Evolia_backups. Em todos os casos o backend é recriado, o que encerra as sessões abertas.
Uso exclusivo no ambiente local do Docker Compose. Requer Docker e Python 3.9 ou superior.
"""
import argparse
import getpass
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ENV = RAIZ / ".env"
CONTAS_ENV = {
    "admin": ("AFDEVOPS_ADMIN_PASSWORD_HASH", "E2E_ADMIN_PASSWORD", "AFDEVOPS_ADMIN_USERNAME"),
    "demo": ("AFDEVOPS_COLABORADOR_PASSWORD_HASH", "E2E_COLABORADOR_PASSWORD", "AFDEVOPS_COLABORADOR_USERNAME"),
}
HASH = re.compile(r"\$2[aby]\$12\$[./A-Za-z0-9]{53}")
USUARIO = re.compile(r"[a-z0-9_.-]{1,64}")


class Falha(RuntimeError):
    pass


def executar(comando, entrada=None):
    resultado = subprocess.run(comando, input=entrada, capture_output=True, text=True, cwd=RAIZ)
    if resultado.returncode != 0:
        # A saída de erro não contém a senha: ela só entra pela entrada padrão.
        raise Falha(f"Comando falhou ({comando[0]} {comando[1]}): {resultado.stderr.strip()[-400:]}")
    return resultado.stdout


def pedir_senha():
    if sys.stdin.isatty():
        senha = getpass.getpass("Nova senha (não aparece na tela): ")
        if getpass.getpass("Repita a nova senha: ") != senha:
            raise Falha("As senhas não conferem. Nada foi alterado.")
    else:
        senha = sys.stdin.readline().rstrip("\n")
    if not senha.strip() or len(senha) < 12 or len(senha.encode()) > 72 or "\x00" in senha:
        raise Falha("A senha precisa de ao menos 12 caracteres e no máximo 72 bytes. Nada foi alterado.")
    return senha


def gerar_hash(senha):
    imagem = re.search(r'^IMAGEM_HTPASSWD="([^"]+)"', (RAIZ / "scripts/gerar-env.sh").read_text(), re.M)[1]
    saida = executar(["docker", "run", "--rm", "-i", imagem, "htpasswd", "-niBC", "12", "evolia"], senha + "\n")
    valor = saida.strip().partition(":")[2]
    if not HASH.fullmatch(valor):
        raise Falha("O hash BCrypt gerado é inválido. Nada foi alterado.")
    return valor


def atualizar_env(mudancas):
    if not ENV.is_file():
        raise Falha("Não há .env. Gere-o com: bash scripts/gerar-env.sh")
    linhas = ENV.read_text(encoding="utf-8").split("\n")
    for chave, linha_nova in mudancas.items():
        posicoes = [i for i, linha in enumerate(linhas) if linha.startswith(chave + "=")]
        if len(posicoes) != 1:
            raise Falha(f"Esperada exatamente uma linha {chave} no .env. Nada foi alterado.")
        linhas[posicoes[0]] = linha_nova
    descritor, temporario = tempfile.mkstemp(dir=RAIZ, prefix=".env.")
    try:
        if hasattr(os, "fchmod"):  # ausente no Windows antes do Python 3.13
            os.fchmod(descritor, 0o600)
        with os.fdopen(descritor, "w", encoding="utf-8") as arquivo:
            arquivo.write("\n".join(linhas))
        os.replace(temporario, ENV)
    finally:
        if os.path.exists(temporario):
            os.unlink(temporario)


def psql(sql):
    return executar(["docker", "compose", "exec", "-T", "postgres", "sh", "-c",
                     'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1'], sql)


def recriar_backend():
    """Recria o backend (as sessões ficam em memória) e só volta quando ele estiver saudável."""
    executar(["docker", "compose", "up", "-d", "--no-deps", "--force-recreate", "--wait", "backend"])


def trocar_individual(usuario):
    if not USUARIO.fullmatch(usuario):
        raise Falha("Nome de usuário inválido.")
    if psql(f"SELECT count(*) FROM contas_colaborador WHERE nome_usuario = '{usuario}';").strip() != "1":
        raise Falha(f"Não há exatamente uma conta individual “{usuario}”. Nada foi alterado.")
    valor = gerar_hash(pedir_senha())
    pasta = Path.home() / "Evolia_backups"
    pasta.mkdir(mode=0o700, exist_ok=True)
    copia = pasta / f"conta-{usuario}-{time.strftime('%Y%m%d-%H%M%S')}.csv"
    anterior = psql(f"COPY (SELECT * FROM contas_colaborador WHERE nome_usuario = '{usuario}') TO STDOUT WITH CSV HEADER;")
    with os.fdopen(os.open(copia, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as arquivo:
        arquivo.write(anterior)
    psql(f"""BEGIN;
DO $bloco$
DECLARE afetados int;
BEGIN
  UPDATE contas_colaborador SET senha_hash = '{valor}' WHERE nome_usuario = '{usuario}';
  GET DIAGNOSTICS afetados = ROW_COUNT;
  IF afetados <> 1 THEN RAISE EXCEPTION 'esperado 1, afetados %', afetados; END IF;
END $bloco$;
COMMIT;""")
    print(f"Senha de “{usuario}” alterada (1 registro). Cópia anterior: {copia}")


def main():
    opcoes = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    opcoes.add_argument("conta", choices=["admin", "demo", "colaborador"])
    opcoes.add_argument("--usuario", default="colaborador", help="conta individual (padrão: colaborador)")
    opcoes.add_argument("--guardar-no-env", action="store_true",
                        help="grava a senha em texto em E2E_*, para os scripts de preenchimento e de testes")
    argumentos = opcoes.parse_args()

    if argumentos.conta == "colaborador":
        trocar_individual(argumentos.usuario)
        recriar_backend()
    else:
        chave_hash, chave_texto, chave_usuario = CONTAS_ENV[argumentos.conta]
        senha = pedir_senha()
        if argumentos.guardar_no_env and not re.fullmatch(r"[A-Za-z0-9!@%+=:,._-]+", senha):
            raise Falha("Para guardar no .env, use apenas letras, números e !@%+=:,._- . Nada foi alterado.")
        atualizar_env({chave_hash: f"{chave_hash}='{gerar_hash(senha)}'",
                       chave_texto: f"{chave_texto}={senha if argumentos.guardar_no_env else ''}"})
        print(f"Hash atualizado no .env ({chave_hash}); usuário definido em {chave_usuario}.")
        if not argumentos.guardar_no_env:
            print(f"A senha em texto não foi guardada ({chave_texto} ficou vazio).")
        recriar_backend()
    print("Backend recriado: as sessões anteriores foram encerradas.")


if __name__ == "__main__":
    try:
        main()
    except (Falha, KeyboardInterrupt) as erro:
        print(f"Erro: {erro or 'interrompido'}", file=sys.stderr)
        sys.exit(1)
