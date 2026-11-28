# Validação isolada da AF

Use uma cópia do repositório sem o `.env` de desenvolvimento e um projeto Compose exclusivo, com nome iniciado por `evolia-`. Pause outras stacks completas antes de executar. Use Bash, Docker Compose e Python 3.9+ para os verificadores. O k6 é executado em container.

1. Na cópia, rode `bash scripts/gerar-env.sh` e escolha um nome de projeto e uma porta livre para o gateway. Use `COMPOSE_PARALLEL_LIMIT=1` no Mac Intel. Com as variáveis exportadas, rode `docker compose up -d --build --wait gateway ai-worker` para preparar somente os serviços necessários. A classificação independe do Ollama.
2. No repositório onde estão os roteiros, crie uma pasta temporária com `mktemp -d`. Provisione as contas nessa pasta, fora da árvore versionável. A senha de cada conta é aleatória, o consentimento é registrado pela conta correspondente e a preparação fica fora do tempo da carga.
3. Execute o medidor e, ao terminar a carga, execute as falhas controladas no mesmo projeto. Preserve os resultados parciais caso um limite de segurança encerre a rodada. Pare o projeto com `docker compose stop` na cópia e mantenha os volumes.

Exemplo de preparação, a partir da raiz do repositório:

```bash
COPIA="$(mktemp -d)"
AREA="$(mktemp -d)"
rsync -a --exclude='.git' --exclude='.env*' --exclude='node_modules' \
  --exclude='target' --exclude='dist' --exclude='.venv' ./ "$COPIA/"
export COMPOSE_PROJECT_NAME=evolia-rnf14 GATEWAY_PORT=18088 COMPOSE_PARALLEL_LIMIT=1
(cd "$COPIA" && bash scripts/gerar-env.sh && docker compose up -d --build --wait gateway ai-worker)
```

```bash
python3 -B integration-tests/carga/preparar.py "$COPIA" "$AREA/contas.json" --porta "$GATEWAY_PORT"
python3 -B integration-tests/carga/executar.py --projeto "$COMPOSE_PROJECT_NAME" --contas "$AREA/contas.json" --saida "$AREA/medicao"
GATEWAY_PORT="$GATEWAY_PORT" python3 -B integration-tests/carga/validar_falhas.py "$COPIA" --projeto "$COMPOSE_PROJECT_NAME" --porta "$GATEWAY_PORT" --saida "$AREA/falhas.json"
python3 -B integration-tests/carga/consolidar.py "$AREA/medicao" "$AREA/relatorio"
```

O k6 usa a rede de borda e o gateway, uma conta e um cookie por usuário virtual, Basic em cada requisição e um token CSRF novo antes de cada escrita. A medição separa o POST, o GET de CSRF e o tempo do ciclo. Os patamares têm 30 s de subida, 30 s de aquecimento, 120 s de medição e 20 s de drenagem, com término das requisições em voo. As pausas entre interações variam de 1 a 3 s. Uma medição com amostra abaixo de 300 pode ser repetida uma vez com 300 s de observação. Acima dos limites de segurança, a rodada termina com os dados parciais.

Publique somente resultados agregados e metadados sem segredos. O arquivo de contas fica separado da pasta de medição, que guarda séries temporais e diagnóstico operacional. Os campos `classificacao_valida` e `classificacao_no_prazo` usam o total de POSTs como denominador. Falhas antes do POST aparecem nas métricas de CSRF. O patamar é inconclusivo quando as sessões ou a amostra não chegam ao mínimo. O JSON de cada patamar inclui o pico de POSTs simultaneamente em voo.
