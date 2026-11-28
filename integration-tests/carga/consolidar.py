"""Exporta resultados agregados, sem copiar credenciais ou rastros HTTP."""
import argparse
import csv
import json
from pathlib import Path
import re


def mib(texto):
    numero, unidade = re.fullmatch(r"([\d.]+)\s*([KMG]?i?B)", texto.split("/")[0].strip()).groups()
    return float(numero) * {"B": 1 / 1024**2, "KiB": 1 / 1024, "MiB": 1, "GiB": 1024}[unidade]


def resumo_da_janela(amostras, resultado):
    """CPU (% de um núcleo, docker stats) e memória por serviço entre 60 s e o fim da janela."""
    inicio = resultado.get("inicio_epoch_s")
    if inicio is None:
        return None
    janela = [a for a in amostras if inicio + 60 <= a["epoch_s"] <= inicio + 60 + resultado["segundos"]]
    servicos = {}
    for amostra in janela:
        linhas = list(amostra["servicos"]) + ([amostra["gerador"]] if amostra.get("gerador") else [])
        for linha in linhas:
            nome = re.sub(r"^.*?-(?=(ai-service|ai-worker|backend|gateway|postgres|rabbitmq)-\d)|-\d+$", "", linha["Name"])
            nome = "k6" if linha["Name"].endswith("-k6") else nome
            dados = servicos.setdefault(nome, {"cpu": [], "mib": []})
            dados["cpu"].append(float(linha["CPUPerc"].rstrip("%")))
            dados["mib"].append(mib(linha["MemUsage"]))
    return {"amostras": len(janela), "servicos": {
        nome: {"cpu_media_pct": round(sum(d["cpu"]) / len(d["cpu"]), 1), "cpu_pico_pct": round(max(d["cpu"]), 1),
               "ram_pico_mib": round(max(d["mib"]), 1)} for nome, d in sorted(servicos.items())}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("medicao", type=Path)
    parser.add_argument("destino", type=Path)
    args = parser.parse_args()
    metadados = json.loads((args.medicao / "metadados.json").read_text())
    patamares = []
    for arquivo in sorted(args.medicao.glob("*/resumo.json")):
        resultado = json.loads(arquivo.read_text())
        recursos = arquivo.parent / "recursos.jsonl"
        amostras = [json.loads(linha) for linha in recursos.read_text().splitlines()] if recursos.exists() else []
        resultado["ram_pico_mib"] = round(max((a["memoria_bytes"] for a in amostras), default=0) / 1024**2, 1)
        cpu = {}
        for amostra in amostras:
            for servico, valor in amostra["cpu_cgroup_nucleos"].items():
                cpu[servico] = max(cpu.get(servico, 0), valor)
        resultado["cpu_pico_nucleos_por_intervalo"] = cpu
        resultado["janela_medida"] = resumo_da_janela(amostras, resultado)
        patamares.append(resultado)
    patamares.sort(key=lambda item: (item["usuarios"], item.get("segundos", 0)))
    args.destino.mkdir(parents=True, exist_ok=True)
    (args.destino / "rnf01.json").write_text(json.dumps({"metadados": metadados, "patamares": patamares}, indent=2) + "\n")
    with (args.destino / "rnf01.csv").open("w", newline="") as arquivo:
        saida = csv.writer(arquivo, lineterminator="\n")
        saida.writerow(["usuarios", "janela_s", "situacao", "sessoes", "interacoes", "interacoes_validas",
                        "interacao_no_prazo_pct", "interacao_p50_ms", "interacao_p90_ms", "interacao_p95_ms",
                        "interacao_p99_ms", "posts", "posts_por_s", "post_p50_ms", "post_p90_ms", "post_p95_ms",
                        "post_p99_ms", "post_validos_pct", "post_no_prazo_pct", "falhas_sessao", "falhas_csrf",
                        "login_falhas", "login_429", "post_sem_resposta", "pico_voo", "ram_pico_mib"])
        for item in patamares:
            m = item.get("metricas", {})

            def contagem(nome):
                return m.get(nome, {}).get("count", 0)

            def percentis(nome):
                return [m.get(nome, {}).get(p) for p in ("med", "p(90)", "p(95)", "p(99)")]

            def porcentagem(nome):
                taxa = m.get(nome, {}).get("rate")
                return None if taxa is None or not m.get(nome, {}).get("passes", 0) + m[nome].get("fails", 0) else round(taxa * 100, 2)

            saida.writerow([item["usuarios"], item.get("segundos"), item["situacao"],
                            contagem("sessoes_estabelecidas"), contagem("interacoes"), contagem("interacoes_validas"),
                            porcentagem("interacao_no_prazo"), *percentis("interacao_ms"),
                            contagem("classificacoes"), item.get("post_por_s"), *percentis("classificacao_ms"),
                            porcentagem("classificacao_valida"), porcentagem("classificacao_no_prazo"),
                            contagem("sessao_falhas"), contagem("csrf_falhas"), contagem("login_falhas"),
                            contagem("login_429"), contagem("sem_resposta"),
                            item.get("pico_posts_em_voo"), item["ram_pico_mib"]])


if __name__ == "__main__":
    main()
