# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && node nginx/gerar-config.mjs

FROM nginxinc/nginx-unprivileged:1.28-alpine@sha256:7377697a821c131a924a7105fafbe7414db4e9fcc77a6f08f776f33f141ec3f8
COPY --from=build /app/dist/ /usr/share/nginx/evolia/
COPY --from=build /app/evolia-headers.inc /etc/nginx/conf.d/evolia-headers.inc
COPY nginx/evolia.conf /etc/nginx/conf.d/default.conf
COPY nginx/proxy-java.inc /etc/nginx/conf.d/proxy-java.inc
COPY nginx/templates/ /etc/nginx/templates/
# Limite do login, ajustável sem reconstruir a imagem. Valores inválidos impedem a inicialização.
ENV LOGIN_RATE=10r/s LOGIN_BURST=50
# Gera os arquivos com os valores padrão para validar a configuração no build.
RUN /docker-entrypoint.d/20-envsubst-on-templates.sh && nginx -t
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
