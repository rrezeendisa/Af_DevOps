#!/usr/bin/env bash
# Sobe o ambiente integrado e executa os testes ponta a ponta.
#
#   ./scripts/testes-integrados.sh            # sobe, testa e mantém o ambiente
#   ./scripts/testes-integrados.sh --down     # derruba tudo (inclusive volumes) ao final
#
# Requer .env (./scripts/gerar-env.sh), Docker e Python 3.12+.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

if [[ ! -f .env ]]; then
    echo "Arquivo .env não encontrado. Execute ./scripts/gerar-env.sh primeiro." >&2
    exit 1
fi

derrubar=false
[[ "${1:-}" == "--down" ]] && derrubar=true

finalizar() {
    local codigo=$?
    if [[ $codigo -ne 0 ]]; then
        echo "Falha nos testes integrados; últimas linhas dos logs:" >&2
        docker compose logs --tail 60 >&2 || true
    fi
    if $derrubar; then
        docker compose down -v --remove-orphans || true
    fi
    exit $codigo
}
trap finalizar EXIT

docker compose up -d --build --wait --wait-timeout 300

PYTHON="${PYTHON:-python3}"
command -v "$PYTHON" >/dev/null 2>&1 || PYTHON=python
VENV="$RAIZ/integration-tests/.venv"
if [[ ! -d "$VENV" ]]; then
    "$PYTHON" -m venv "$VENV"
fi
if [[ -x "$VENV/bin/python" ]]; then PY="$VENV/bin/python"; else PY="$VENV/Scripts/python.exe"; fi
"$PY" -m pip install -q -r integration-tests/requirements.txt

"$PY" -m pytest integration-tests -v -p no:cacheprovider
