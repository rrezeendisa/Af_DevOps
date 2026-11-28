"""Exporta resultados agregados, sem copiar credenciais ou rastros HTTP."""
import argparse
import csv
import json
from pathlib import Path


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
        patamares.append(resultado)
    patamares.sort(key=lambda item: (item["usuarios"], item.get("segundos", 0)))
    args.destino.mkdir(parents=True, exist_ok=True)
    (args.destino / "rnf01.json").write_text(json.dumps({"metadados": metadados, "patamares": patamares}, indent=2) + "\n")
    with (args.destino / "rnf01.csv").open("w", newline="") as arquivo:
        saida = csv.writer(arquivo, lineterminator="\n")
        saida.writerow(["usuarios", "janela_s", "situacao", "tentativas", "posts_por_s", "p50_ms", "p90_ms",
                        "p95_ms", "p99_ms", "validas_pct", "no_prazo_pct", "falhas_csrf", "pico_voo", "ram_pico_mib"])
        for item in patamares:
            m = item.get("metricas", {})
            tempos = m.get("classificacao_ms", {})
            valores = [m.get(nome, {}).get("rate") for nome in ("classificacao_valida", "classificacao_no_prazo")]
            porcentagens = [None if valor is None else round(valor * 100, 2) for valor in valores]
            saida.writerow([item["usuarios"], item.get("segundos"), item["situacao"],
                            m.get("classificacoes", {}).get("count", 0) if m else None, item.get("post_por_s"),
                            *[tempos.get(percentil) for percentil in ("med", "p(90)", "p(95)", "p(99)")],
                            *porcentagens, m.get("csrf_falhas", {}).get("count", 0),
                            item.get("pico_posts_em_voo"), item["ram_pico_mib"]])


if __name__ == "__main__":
    main()
