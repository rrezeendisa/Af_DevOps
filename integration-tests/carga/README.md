# Testes de carga e de falha

Estes roteiros geraram as evidências do RNF01, RNF02 e RNF04. Eles não são necessários para executar a
aplicação. Use uma cópia do repositório sem o `.env` de desenvolvimento e um projeto Compose exclusivo, com nome iniciado por `evolia-`. Pause outras stacks completas antes de executar. Use Bash, Docker Compose e Python 3.9+ para os verificadores. O k6 é executado em container.

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

## Resultados

Com sessões, a meta foi atingida nas condições testadas ([Etapa 14.1](../../docs/evidencias-etapa14-1/incremento-d/README.md)). A medição anterior, com HTTP Basic, não a atingiu ([Etapa 14](../../docs/evidencias-etapa14/README.md)). Para reproduzir as condições, inicie o Java com `IA_GENERATIVA_HABILITADA=false`.

## Metodologia com sessão (Etapa 14.1)

O k6 usa a rede de borda e o gateway, com uma conta, um cookie e um contexto por usuário virtual. Cada usuário entra na primeira iteração, durante a subida de 30 s (`GET /api/csrf`, `POST /api/login`, `GET /api/me`), e pede um token CSRF novo antes de cada classificação. Os patamares têm 30 s de subida, 30 s de aquecimento, 120 s de medição e 20 s de drenagem. As pausas variam de 1 a 3 s. Uma medição com amostra abaixo de 300 pode ser repetida uma vez com 300 s de observação. Acima dos limites de segurança, a rodada termina com os dados parciais.

Dois indicadores são publicados separadamente:

| Indicador | Denominador | Sucesso |
|---|---|---|
| Oficial (`classificacao_no_prazo`) | POSTs iniciados na janela | Resposta válida em até 2 s |
| Complementar (`interacao_no_prazo`) | Todas as interações iniciadas na janela | Classificação válida em até 2 s, contando sessão, CSRF, POST e tempos limite |

Um usuário sem sessão na janela tenta entrar uma vez por interação, e esse tempo conta na interação. Falhas de login são contadas na execução inteira, com 429 separado. Em 300 usuários, o resultado só é válido com 300 sessões estabelecidas, 300 usuários com POST na janela e ao menos 300 amostras; “atendido” exige os dois indicadores em 95%.

O limite de login do gateway deve ficar no padrão (`10r/s`, rajada 50). O executor exige árvore Git limpa e registra revisão, imagens, configuração efetiva e custo BCrypt das contas.

Diferenças em relação à Etapa 14: sessão no lugar de HTTP Basic, login fora da janela, cabeçalho de contexto, `/api/csrf` pública, o POST é enviado mesmo que o CSRF termine após a janela e as contas saem após o provisionamento.

Publique somente resultados agregados e metadados sem segredos. O arquivo de contas fica separado da pasta de medição.
