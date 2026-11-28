"""Executa os patamares aprovados e guarda apenas métricas e metadados."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import time

IMAGEM = "grafana/k6:1.8.2@sha256:00fdcebafbc86cb0137d429529b1caa401a02e09025f02fc74866fa6e2b004d8"
SERVICOS = {"gateway", "backend", "ai-service", "ai-worker", "postgres", "rabbitmq"}
GIB = 1024 ** 3


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, timeout=25).strip()


def json_linhas(texto):
    return [json.loads(linha) for linha in texto.splitlines() if linha.strip()]


def bytes_memoria(valor):
    numero, unidade = re.fullmatch(r"([\d.]+)\s*(B|[KMGTP]i?B)", valor.strip()).groups()
    return float(numero) * (1024 if "i" in unidade else 1000) ** "BKMGTP".index(unidade[0])


def disco_e_memoria(saida):
    if shutil.disk_usage(saida).free < 20 * GIB:
        return "menos de 20 GiB livres"
    if shutil.which("memory_pressure"):
        leitura = subprocess.run(["memory_pressure", "-Q"], text=True, capture_output=True, timeout=5)
        livre = re.search(r"System-wide memory free percentage:\s*(\d+)%", leitura.stdout)
        if livre and int(livre[1]) <= 5:
            return "pressão crítica de memória no host (indicador livre ≤ 5%)"
    return None


def patamar(args, imagem, ids, reinicios, memoria_vm, nivel, segundos):
    pasta = args.saida / f"{nivel}-{segundos}"
    pasta.mkdir()
    nome = args.projeto + "-k6"
    caminho = Path(__file__).with_name("classificacoes.js")
    comando = [
        "docker", "run", "--rm", "--name", nome, "--network", args.projeto + "_borda",
        "--user", f"{os.getuid()}:{os.getgid()}",
        "-v", f"{args.contas.resolve()}:/contas.json:ro",
        "-v", f"{caminho.resolve()}:/classificacoes.js:ro",
        "-v", f"{pasta.resolve()}:/saida",
        "-e", f"USUARIOS={nivel}", "-e", f"MEDICAO={segundos}",
        imagem, "run", "--quiet", "--out", "json=/saida/series.jsonl", "/classificacoes.js",
    ]
    motivo = disco_e_memoria(args.saida)
    if motivo:
        resultado = {"usuarios": nivel, "segundos": segundos, "situacao": "inconclusivo",
                     "motivo": motivo, "interrompido": True}
        (pasta / "resumo.json").write_text(json.dumps(resultado, indent=2) + "\n")
        return resultado
    altos_desde = None
    degradado_desde = None
    inicio_patamar = time.time()
    cpu_anterior = {}
    with (pasta / "k6.log").open("w") as log, (pasta / "recursos.jsonl").open("w") as recursos:
        processo = subprocess.Popen(comando, stdout=log, stderr=subprocess.STDOUT)
        try:
            while processo.poll() is None:
                inicio = time.monotonic()
                linhas = json_linhas(docker("stats", "--no-stream", "--format", "{{json .}}", *ids.values()))
                memoria = sum(bytes_memoria(linha["MemUsage"].split("/")[0]) for linha in linhas)
                estado = json.loads(docker("inspect", *ids.values()))
                cobertura = len(estado) == len(ids)
                degradado = not cobertura or any(
                    not item["State"]["Running"] or item["State"].get("Health", {}).get("Status", "healthy") != "healthy"
                    for item in estado)
                if any(item["State"]["OOMKilled"] or item["RestartCount"] != reinicios[item["Id"]]
                       for item in estado):
                    motivo = "OOM ou reinício inesperado"
                for linha in linhas:
                    linha.pop("ID", None)
                    linha.pop("Container", None)
                cpu_cgroup = {}
                for servico in ("backend", "ai-service", "gateway", "postgres"):
                    try:
                        cgroup = docker("exec", ids[servico], "cat", "/sys/fs/cgroup/cpu.stat")
                        uso = int(re.search(r"usage_usec\s+(\d+)", cgroup)[1])
                        instante = time.monotonic()
                        if servico in cpu_anterior:
                            anterior, tempo = cpu_anterior[servico]
                            cpu_cgroup[servico] = round((uso - anterior) / (instante - tempo) / 1e6, 3)
                        cpu_anterior[servico] = (uso, instante)
                    except (subprocess.SubprocessError, TypeError):
                        pass
                gerador = None
                if processo.poll() is None:
                    try:
                        gerador = json.loads(docker("stats", "--no-stream", "--format", "{{json .}}", nome))
                        memoria += bytes_memoria(gerador["MemUsage"].split("/")[0])
                        gerador.pop("ID", None)
                        gerador.pop("Container", None)
                    except (subprocess.SubprocessError, ValueError):
                        pass
                recursos.write(json.dumps({"epoch_s": time.time(), "servicos": linhas, "gerador": gerador,
                                           "memoria_bytes": memoria, "cpu_cgroup_nucleos": cpu_cgroup}) + "\n")
                recursos.flush()
                altos_desde = (altos_desde or inicio) if memoria > memoria_vm * 0.85 else None
                degradado_desde = (degradado_desde or inicio) if degradado else None
                if altos_desde is not None and inicio - altos_desde >= 30:
                    motivo = "RAM do projeto e gerador acima de 85% da VM por 30 s"
                if degradado_desde is not None and inicio - degradado_desde >= 30:
                    motivo = "serviço sem saúde por 30 s"
                motivo = motivo or disco_e_memoria(args.saida)
                if motivo:
                    break
                time.sleep(5)
        except (subprocess.SubprocessError, OSError, ValueError) as erro:
            motivo = "falha no monitoramento: " + type(erro).__name__
        finally:
            if processo.poll() is None:
                subprocess.run(["docker", "stop", "-t", "5", nome], capture_output=True, timeout=15)
                processo.wait(timeout=20)
    resumo = pasta / "k6.json"
    resultado = json.loads(resumo.read_text()) if resumo.exists() else {"usuarios": nivel, "segundos": segundos}
    metricas = resultado.get("metricas", {})
    contagem = metricas.get("classificacoes", {}).get("count", 0)
    sessoes = metricas.get("sessoes_medidas", {}).get("count", 0)
    resultado["post_por_s"] = round(contagem / segundos, 2)
    eventos = []
    series = pasta / "series.jsonl"
    if series.exists():
        with series.open() as arquivo:
            for linha in arquivo:
                try:
                    ponto = json.loads(linha)
                except json.JSONDecodeError:
                    continue
                nome_metrica = ponto.get("metric")
                if ponto.get("type") == "Point" and nome_metrica in ("post_inicio", "post_fim"):
                    eventos.append((ponto["data"]["time"], 1 if nome_metrica == "post_inicio" else -1))
        voo = pico = 0
        for _, delta in sorted(eventos):
            voo += delta
            pico = max(pico, voo)
        resultado["pico_posts_em_voo"] = pico
    taxa = metricas.get("classificacao_no_prazo", {}).get("rate", 0)
    inicializados = metricas.get("vus_max", {}).get("value", 0)
    estabelecidas = metricas.get("sessoes_estabelecidas", {}).get("count", 0)
    por_interacao = metricas.get("interacao_no_prazo", {}).get("rate", 0)
    if (motivo or processo.returncode not in (0, 99) or inicializados != nivel or sessoes != nivel
            or estabelecidas != nivel or contagem < 300):
        resultado["situacao"] = "inconclusivo"
        resultado["motivo"] = motivo or "carga, sessões ou amostra incompleta"
    elif nivel == 300:
        resultado["indicador_oficial"] = "atendido" if taxa >= 0.95 else "reprovado"
        resultado["indicador_complementar"] = "atendido" if por_interacao >= 0.95 else "reprovado"
        resultado["situacao"] = "atendido" if min(taxa, por_interacao) >= 0.95 else "reprovado"
    else:
        resultado["situacao"] = "medido"
    resultado["interrompido"] = bool(motivo)
    resultado["inicio_epoch_s"] = inicio_patamar
    final = json.loads(docker("inspect", *ids.values()))
    resultado["saude_final"] = {
        item["Config"]["Labels"]["com.docker.compose.service"]: {
            "estado": item["State"]["Status"],
            "saude": item["State"].get("Health", {}).get("Status", "sem healthcheck"),
            "reinicios": item["RestartCount"] - reinicios[item["Id"]],
            "oom": item["State"]["OOMKilled"],
        } for item in final}
    (pasta / "resumo.json").write_text(json.dumps(resultado, indent=2) + "\n")
    return resultado


def configuracao_efetiva(ids):
    """Somente valores sem segredo, lidos dos containers em execução."""
    def ambiente(servico, nomes):
        linhas = json.loads(docker("inspect", "-f", "{{json .Config.Env}}", ids[servico]))
        valores = dict(linha.split("=", 1) for linha in linhas)
        return {nome: valores.get(nome) for nome in nomes}

    custos = docker("exec", ids["postgres"], "sh", "-c",
                    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc '
                    '"SELECT DISTINCT substr(senha_hash, 5, 2) FROM contas_colaborador"').split()
    return {
        **ambiente("gateway", ["LOGIN_RATE", "LOGIN_BURST"]),
        **ambiente("backend", ["IA_GENERATIVA_HABILITADA", "SESSION_TIMEOUT", "SESSION_COOKIE_SECURE"]),
        "bcrypt_custo_das_contas": custos,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--projeto", required=True)
    parser.add_argument("--contas", type=Path, required=True)
    parser.add_argument("--saida", type=Path, required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"evolia-[a-z0-9-]+", args.projeto):
        parser.error("use um projeto isolado evolia-...")
    args.saida.mkdir()
    dados = docker("ps", "--filter", f"label=com.docker.compose.project={args.projeto}",
                   "--format", '{{.ID}} {{.Label "com.docker.compose.service"}}')
    ids = {servico: id_ for id_, servico in map(str.split, dados.splitlines()) if servico in SERVICOS}
    if set(ids) != SERVICOS:
        parser.error("o projeto descartável precisa estar saudável antes da carga")
    detalhes = json.loads(docker("inspect", *ids.values()))
    reinicios = {item["Id"]: item["RestartCount"] for item in detalhes}
    info = json.loads(docker("info", "--format", "{{json .}}"))
    revisao = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    if subprocess.check_output(["git", "status", "--porcelain"], text=True).strip():
        parser.error("a medição exige uma árvore Git limpa")
    configuracao = configuracao_efetiva(ids)
    script_hash = hashlib.sha256(Path(__file__).with_name("classificacoes.js").read_bytes()).hexdigest()
    metadata = {"projeto": args.projeto, "revisao_git": revisao, "script_k6_sha256": script_hash,
                "host": platform.platform(), "imagem_k6": IMAGEM, "vm_ram_bytes": info["MemTotal"],
                "vm_cpus": info["NCPU"], "inicio_epoch_s": time.time(), "arvore_git_limpa": True,
                "configuracao": configuracao, "carga_do_host_no_inicio": os.getloadavg(),
                "containers_em_execucao_fora_do_projeto": [
                    nome for nome in docker("ps", "--format", "{{.Names}}").splitlines()
                    if not nome.startswith(args.projeto)],
                "imagens": {item["Config"]["Labels"]["com.docker.compose.service"]: item["Image"]
                            for item in detalhes}}
    (args.saida / "metadados.json").write_text(json.dumps(metadata, indent=2) + "\n")
    for nivel in (10, 50, 100, 200, 300):
        resultado = patamar(args, IMAGEM, ids, reinicios, info["MemTotal"], nivel, 120)
        imprimir(resultado)
        amostra = resultado.get("metricas", {}).get("classificacoes", {}).get("count", 0)
        if resultado.get("situacao") == "inconclusivo" and amostra < 300 and not resultado.get("interrompido"):
            resultado = patamar(args, IMAGEM, ids, reinicios, info["MemTotal"], nivel, 300)
            imprimir(resultado)
        if resultado.get("situacao") == "inconclusivo":
            return 2
    return int(resultado["situacao"] != "atendido")


def imprimir(resultado):
    metricas = resultado.get("metricas", {})
    print(json.dumps({"usuarios": resultado["usuarios"], "situacao": resultado["situacao"],
                      "motivo": resultado.get("motivo"), "post_por_s": resultado.get("post_por_s"),
                      "p95_ms": metricas.get("classificacao_ms", {}).get("p(95)"),
                      "no_prazo": metricas.get("classificacao_no_prazo", {}).get("rate"),
                      "interacao_no_prazo": metricas.get("interacao_no_prazo", {}).get("rate"),
                      "sessoes": metricas.get("sessoes_estabelecidas", {}).get("count", 0),
                      "login_falhas": metricas.get("login_falhas", {}).get("count", 0),
                      "amostras": metricas.get("classificacoes", {}).get("count")}), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
