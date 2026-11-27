#!/usr/bin/env bash
# Gera o arquivo .env local do ambiente integrado com segredos aleatórios.
#
#   ./scripts/gerar-env.sh            # cria .env (não sobrescreve um existente)
#   ./scripts/gerar-env.sh --force    # recria .env
#
# Requisitos: bash, openssl e Docker (o hash BCrypt é gerado com o htpasswd
# da imagem httpd, sem instalar nada na máquina). No Windows, execute no Git Bash.
#
# As senhas em texto das contas de demonstração ficam em E2E_* no próprio .env
# (ignorado pelo Git) porque os testes integrados precisam autenticar. São
# contas fictícias, apenas para o ambiente local/CI.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARQUIVO="$RAIZ/.env"
IMAGEM_HTPASSWD="httpd:2.4-alpine"

if [[ -f "$ARQUIVO" && "${1:-}" != "--force" ]]; then
    echo ".env já existe em $ARQUIVO. Use --force para recriá-lo." >&2
    exit 1
fi

segredo() { openssl rand -hex "${1:-24}"; }

hash_bcrypt() {
    local usuario="$1" senha="$2" linha hash
    linha="$(MSYS_NO_PATHCONV=1 docker run --rm "$IMAGEM_HTPASSWD" htpasswd -nbBC 12 "$usuario" "$senha")"
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

echo "Gerando hashes BCrypt (custo 12) com $IMAGEM_HTPASSWD..."
admin_hash="$(hash_bcrypt "$admin_usuario" "$admin_senha")"
colaborador_hash="$(hash_bcrypt "$colaborador_usuario" "$colaborador_senha")"

umask 077
cat > "$ARQUIVO" <<EOF
# Gerado por scripts/gerar-env.sh em $(date -u +%Y-%m-%dT%H:%M:%SZ). Não versione.
DB_NAME=afdevops
DB_USERNAME=afdevops
DB_PASSWORD=$(segredo)

RABBITMQ_USER=afdevops
RABBITMQ_PASSWORD=$(segredo)

INTERNAL_API_TOKEN=$(segredo 32)

AFDEVOPS_ADMIN_USERNAME=$admin_usuario
AFDEVOPS_ADMIN_PASSWORD_HASH='$admin_hash'
AFDEVOPS_COLABORADOR_USERNAME=$colaborador_usuario
AFDEVOPS_COLABORADOR_PASSWORD_HASH='$colaborador_hash'

MAX_MESSAGE_RETRIES=3

# Senhas em texto das contas fictícias, usadas pelos testes integrados.
E2E_ADMIN_PASSWORD=$admin_senha
E2E_COLABORADOR_PASSWORD=$colaborador_senha
EOF

echo ".env criado em $ARQUIVO (contas: $admin_usuario / $colaborador_usuario)."
