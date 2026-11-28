#!/bin/sh
set -eu

modelo="${OLLAMA_MODEL:?Defina OLLAMA_MODEL}"

for tentativa in $(seq 1 30); do
    if timeout 5s ollama list >/dev/null 2>&1; then
        break
    fi
    if [ "$tentativa" = 30 ]; then
        echo "Ollama indisponível para preparar o modelo." >&2
        exit 1
    fi
    sleep 2
done

# Confirme a presença antes de tentar baixar. A configuração padrão também
# verifica o identificador da distribuição Q4_K_M publicada no registro.
if ! timeout 10s ollama show "$modelo" >/dev/null 2>&1; then
    echo "Baixando o modelo local do Ollama."
    if ! timeout 20m ollama pull "$modelo" >/dev/null 2>&1; then
        echo "Não foi possível baixar o modelo. A orientação base continua disponível." >&2
        exit 1
    fi
fi

if [ "$modelo" = qwen2.5:1.5b ]; then
    if ! ollama list | awk '$1 == "qwen2.5:1.5b" && $2 == "65ec06548149" { encontrado=1 } END { exit !encontrado }'; then
        echo "O modelo padrão encontrado não corresponde ao identificador validado." >&2
        exit 1
    fi
fi
echo "Modelo local do Ollama disponível."
