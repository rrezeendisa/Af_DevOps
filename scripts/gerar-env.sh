#!/usr/bin/env bash
# Gera o arquivo .env local do ambiente integrado com segredos aleatórios.
#
#   ./scripts/gerar-env.sh            # cria .env (não sobrescreve um existente)
# Requisitos: Bash e Docker (o hash BCrypt é gerado com o htpasswd
# da imagem httpd, sem instalar nada na máquina). No Windows, execute no Git Bash.
#
# As senhas em texto das contas de demonstração ficam em E2E_* no próprio .env
# (ignorado pelo Git) porque os testes integrados precisam autenticar. São
# contas fictícias, apenas para o ambiente local/CI.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARQUIVO="$RAIZ/.env"
IMAGEM_HTPASSWD="httpd:2.4-alpine@sha256:32bd0639bcc4917ef1fd9363a1d9dd2dd9c498565118b062a10d51e43a5c3a24"

if [[ "$#" -ne 0 ]]; then
    echo "Uso: bash scripts/gerar-env.sh" >&2
    exit 2
fi

if [[ -e "$ARQUIVO" || -L "$ARQUIVO" ]]; then
    echo ".env já existe. O arquivo foi preservado."
    exit 0
fi

segredo() { LC_ALL=C od -An -v -tx1 -N "${1:-24}" /dev/urandom | tr -d '[:space:]'; }

hash_bcrypt() {
    local usuario="$1" senha="$2" linha hash
    linha="$(printf '%s\n' "$senha" | MSYS_NO_PATHCONV=1 docker run --rm -i "$IMAGEM_HTPASSWD" htpasswd -niBC 12 "$usuario")"
    hash="${linha#*:}"
    hash="$(printf '%s' "$hash" | tr -d '\r\n')"
    if ! [[ "$hash" =~ ^\$2[aby]\$12\$[./A-Za-z0-9]{53}$ ]]; then
        echo "Hash BCrypt inválido gerado para $usuario." >&2
        exit 1
    fi
    printf '%s' "$hash"
}

admin_usuario="admin.demo"
admin_senha="$(segredo 16)"
colaborador_usuario="colaborador.demo"
colaborador_senha="$(segredo 16)"
db_senha="$(segredo)"
rabbitmq_senha="$(segredo)"
token_interno="$(segredo 32)"

echo "Gerando hashes BCrypt (custo 12) com $IMAGEM_HTPASSWD..."
admin_hash="$(hash_bcrypt "$admin_usuario" "$admin_senha")"
colaborador_hash="$(hash_bcrypt "$colaborador_usuario" "$colaborador_senha")"

umask 077
temporario="$(mktemp "$RAIZ/.env.XXXXXX")"
trap 'rm -f "$temporario"' EXIT
cat > "$temporario" <<EOF
# Gerado por scripts/gerar-env.sh em $(date -u +%Y-%m-%dT%H:%M:%SZ). Não versione.
DB_NAME=afdevops
DB_USERNAME=afdevops
DB_PASSWORD=$db_senha

RABBITMQ_USER=afdevops
RABBITMQ_PASSWORD=$rabbitmq_senha

INTERNAL_API_TOKEN=$token_interno

AFDEVOPS_ADMIN_USERNAME=$admin_usuario
AFDEVOPS_ADMIN_PASSWORD_HASH='$admin_hash'
AFDEVOPS_COLABORADOR_USERNAME=$colaborador_usuario
AFDEVOPS_COLABORADOR_PASSWORD_HASH='$colaborador_hash'

MAX_MESSAGE_RETRIES=3

# Senhas em texto das contas fictícias, usadas pelos testes integrados.
E2E_ADMIN_PASSWORD=$admin_senha
E2E_COLABORADOR_PASSWORD=$colaborador_senha
EOF

if ln "$temporario" "$ARQUIVO" 2>/dev/null; then
    echo ".env criado com permissões restritas. Consulte-o localmente para usar as contas fictícias."
elif [[ -e "$ARQUIVO" || -L "$ARQUIVO" ]]; then
    echo ".env já existe. O arquivo foi preservado."
else
    echo "Não foi possível criar .env." >&2
    exit 1
fi
