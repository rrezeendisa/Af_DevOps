"""Verifica RNF02/RNF04 em um projeto descartável já saudável."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time

from preparar import Sessao, criar_conta, exigir, ler_env


def aguardar(verificar, prazo):
    fim = time.monotonic() + prazo
    while time.monotonic() < fim:
        resultado = verificar()
        if resultado:
            return resultado
        time.sleep(1)
    raise RuntimeError("Prazo da validação excedido")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("ambiente", type=Path)
    parser.add_argument("--projeto", required=True)
    parser.add_argument("--porta", required=True, type=int)
    parser.add_argument("--saida", required=True, type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r"evolia-[a-z0-9-]+", args.projeto):
        parser.error("use um projeto descartável evolia-...")
    env = ler_env(args.ambiente / ".env")
    url = f"http://127.0.0.1:{args.porta}"
    admin = Sessao(url, env["AFDEVOPS_ADMIN_USERNAME"], env["E2E_ADMIN_PASSWORD"])
    evidencia = {}
    interrompido = None
    compose_env = {**os.environ, "GATEWAY_PORT": str(args.porta)}

    def compose(*opcoes):
        return subprocess.check_output(["docker", "compose", "-p", args.projeto, *opcoes],
                                       cwd=args.ambiente, env=compose_env, text=True, timeout=120).strip()

    def identidade(servico):
        id_ = compose("ps", "-q", servico)
        return subprocess.check_output(["docker", "inspect", "-f", "{{.Id}} {{.RestartCount}}", id_],
                                       text=True, timeout=10).split()

    def broker():
        # Credenciais pela entrada padrão e nenhuma publicação da interface de gerenciamento.
        usuario = env["RABBITMQ_USER"]
        senha = env["RABBITMQ_PASSWORD"]
        exigir(re.fullmatch(r"[A-Za-z0-9_.-]+", usuario) and re.fullmatch(r"[0-9a-f]+", senha),
               "usar credenciais geradas para o ambiente descartável")
        resposta = subprocess.check_output([
            "docker", "run", "--rm", "-i", "--network", args.projeto + "_treinamento",
            "curlimages/curl:8.11.1", "-fsS", "--max-time", "10", "--config", "-",
            "http://rabbitmq:15672/api/exchanges/%2F/ml.training",
        ], input=f'user = "{usuario}:{senha}"\n', text=True, timeout=15)
        return json.loads(resposta).get("message_stats", {}).get("publish_in", 0)

    def saude_java():
        resultado = subprocess.run(["docker", "compose", "-p", args.projeto, "exec", "-T", "backend",
                                    "curl", "-sS", "http://127.0.0.1:8080/actuator/health"],
                                   cwd=args.ambiente, env=compose_env, text=True, capture_output=True, timeout=15)
        return json.loads(resultado.stdout)["status"]

    def corpo_positivo(rota, dados):
        status, _, _ = admin.chamar(rota)
        criado, item, cabecalho = admin.chamar(rota, "POST", dados)
        consulta, lido, _ = admin.chamar(cabecalho["Location"])
        exigir((status, criado, consulta) == (200, 201, 200) and lido["id"] == item["id"], rota)
        return [status, criado, consulta]

    try:
        prefixo = "falha-" + secrets.token_hex(5)
        conta = criar_conta(url, env, prefixo)
        pessoa = Sessao(url, conta["usuario"], conta["senha"])
        notas = {"logica": 3, "comunicacao": 4, "tecnologia": 2}
        rotas = {
            "classificacoes": notas,
            "recomendacoes": {**notas, "nivel": "INTERMEDIARIO"},
            "orientacoes": {"pergunta": "Como praticar comunicação?", "competencias": notas},
        }
        java_antes = identidade("backend")
        fastapi_antes = identidade("ai-service")
        anterior = broker()
        compose("stop", "ai-service")
        interrompido = "ai-service"
        exigir(saude_java() == "UP", "saúde do Java durante parada de ML")
        recebido, treino, cabecalho = admin.chamar("/api/treinamentos", "POST")
        exigir(recebido == 202 and treino.get("status") == "PENDENTE", "aceitação durante parada de ML")
        location = cabecalho["Location"]
        leitura, _, _ = admin.chamar(location)
        exigir(leitura == 200, "consultar treinamento durante parada de ML")
        publicados = aguardar(lambda: (valor if (valor := broker()) > anterior else None), 45)

        def treinamento_final():
            status, dados, _ = admin.chamar(location)
            return dados["status"] if status == 200 and dados["status"] != "PENDENTE" else None

        final = aguardar(treinamento_final, 90)
        evidencia["rnf02_ml"] = {"java": "UP", "post": recebido, "consulta": leitura,
                                 "publicacoes_delta": publicados - anterior, "worker": final}
        evidencia["rnf04"] = {
            "colaboradores": corpo_positivo("/api/colaboradores", {
                "nome": "Pessoa fictícia durante falha", "email": prefixo + "-novo@example.org",
                "cargo": "Teste", "departamento": "Teste",
            }),
            "cursos": corpo_positivo("/api/cursos", {
                "nome": "Curso fictício durante falha", "descricao": "Teste isolado",
                "cargaHoraria": 2, "categoria": "Teste", "nivel": "BASICO",
            }),
            "durante_falha": {},
        }
        for rota, dados in rotas.items():
            status, corpo, _ = pessoa.chamar("/api/ia/" + rota, "POST", dados)
            codigo = corpo.get("codigo")
            exigir((status, codigo) in {(503, "IA_INDISPONIVEL"), (504, "IA_TEMPO_LIMITE")},
                   "erro controlado da IA")
            evidencia["rnf04"]["durante_falha"][rota] = [status, codigo]
        compose("up", "-d", "--no-deps", "--force-recreate", "--wait", "--wait-timeout", "90", "ai-service")
        interrompido = None
        inicio_retorno = time.monotonic()
        aguardar(lambda: pessoa.chamar("/api/ia/classificacoes", "POST", notas)[0] == 200, 60)
        evidencia["rnf04"]["espera_recuperacao_s"] = round(time.monotonic() - inicio_retorno, 2)
        evidencia["rnf04"]["recuperacao"] = {
            rota: pessoa.chamar("/api/ia/" + rota, "POST", dados)[0] for rota, dados in rotas.items()
        }
        exigir(set(evidencia["rnf04"]["recuperacao"].values()) == {200}, "recuperação da IA")
        evidencia["rnf04"]["fastapi_recriado"] = identidade("ai-service")[0] != fastapi_antes[0]
        evidencia["rnf04"]["java_preservado"] = identidade("backend") == java_antes
        exigir(evidencia["rnf04"]["fastapi_recriado"] and evidencia["rnf04"]["java_preservado"],
               "identidade dos containers")
        _, anteriores, _ = admin.chamar("/api/treinamentos")
        ids = {item["id"] for item in anteriores}
        compose("stop", "rabbitmq")
        interrompido = "rabbitmq"
        falha, corpo, _ = admin.chamar("/api/treinamentos", "POST")
        exigir(falha == 503 and corpo.get("codigo") == "FILA_INDISPONIVEL", "rejeição com RabbitMQ parado")
        consulta, depois, _ = admin.chamar("/api/treinamentos")
        novos = [item for item in depois if item["id"] not in ids]
        exigir(consulta == 200 and len(novos) == 1 and novos[0]["status"] == "FALHOU",
               "persistência da solicitação que não entrou na fila")
        saude_broker = aguardar(lambda: (status if (status := saude_java()) == "DOWN" else None), 30)
        evidencia["rnf02_rabbitmq"] = {"post": falha, "codigo": corpo["codigo"],
                                       "consulta": consulta, "pedido": novos[0]["status"],
                                       "saude_java": saude_broker}
    finally:
        try:
            if interrompido:
                compose("start", interrompido)
        finally:
            args.saida.write_text(json.dumps(evidencia, indent=2) + "\n")
    print(json.dumps(evidencia))


if __name__ == "__main__":
    main()
