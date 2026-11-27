# AI Service

Serviço Python da Plataforma Inteligente de Educação Corporativa. A Frente B fornece classificação de competências, recuperação documental para recomendações, orientação determinística protegida por token interno e um worker separado para treinamento assíncrono.

## Tecnologias

- Python 3.13, FastAPI e Uvicorn
- scikit-learn: Decision Tree para classificação e TF-IDF/cosseno para recuperação
- Joblib: persistência do modelo
- Pydantic: contratos e validação
- Pika: cliente RabbitMQ
- HTTPX: comunicação HTTP com o backend e testes
- pytest: testes automatizados

As dependências com versões fixas estão em `requirements.txt`.

## Estrutura

```text
ai-service/
├── app/                    # API, modelos, classificação, RAG e orientação
├── data/                   # CSV sintético usado no treinamento
├── knowledge/courses/      # Documentos Markdown fictícios dos cursos
├── ml/                     # Geração, treinamento, avaliação e artefatos locais
├── tests/                  # Testes unitários e de contrato; sem serviços externos
└── worker/                 # Consumidor RabbitMQ e cliente de status Java
```

## Configurar Python e instalar dependências

É necessário Python 3.13 e suporte a ambientes virtuais. No Windows, use `py install 3.13` pelo gerenciador oficial do Python ou o instalador do [Python.org](https://www.python.org/downloads/windows/). No Ubuntu, verifique a disponibilidade dos pacotes para sua versão:

```bash
sudo apt update
apt-cache policy python3.13
sudo apt install python3.13 python3.13-venv
```

Entre na pasta `ai-service/` antes dos próximos comandos.

### Windows (PowerShell)

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Se não quiser ativar o ambiente, substitua `python` por `.\.venv\Scripts\python.exe` nos comandos abaixo.

### Ubuntu

```bash
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Machine Learning

### Base sintética e metodologia dos rótulos

`ml/generate_dataset.py` enumera todas as 125 combinações possíveis de `logica`, `comunicacao` e `tecnologia` (valores inteiros de 1 a 5) e grava `data/synthetic_competencies.csv`. A enumeração é determinística, então não depende de semente aleatória.

Os rótulos didáticos são atribuídos pela soma das competências, equivalente à média aproximada indicada no enunciado:

- Soma até 7 (média até aproximadamente 2,33): `INICIANTE`.
- Soma de 8 a 10: `INTERMEDIARIO`.
- Soma a partir de 11 (média a partir de aproximadamente 3,67): `AVANCADO`.

A base tem 35 registros iniciantes, 55 intermediários e 35 avançados. Esses dados e rótulos são artificiais, não representam colaboradores reais e não constituem uma avaliação científica de capacidade profissional.

```powershell
.\.venv\Scripts\python.exe -m ml.generate_dataset
```

### Treinamento e persistência

`ml/train_model.py` treina uma `DecisionTreeClassifier` com `random_state=42` e salva o estimador, a versão `1.0.0`, o algoritmo e os atributos em `ml/artifacts/classifier.joblib`. A árvore foi escolhida por ser simples de explicar para três atributos numéricos. A gravação do artefato é atômica. O artefato e o ledger do worker são locais e ignorados pelo Git.

```powershell
.\.venv\Scripts\python.exe -m ml.train_model
```

A API carrega o modelo uma vez durante o startup. Ela não treina automaticamente. Para aplicar um modelo novo treinado pelo worker, reinicie a API; até o reinício, a instância existente continua usando o artefato carregado anteriormente.

### Avaliação holdout

Execute:

```powershell
.\.venv\Scripts\python.exe -m ml.evaluate_model
```

O script faz divisão estratificada 80/20 (`random_state=42`), treina uma árvore nova somente nas 100 combinações de treino e calcula métricas nas 25 combinações reservadas. A base tem combinações únicas e o código verifica que treino e teste não se sobrepõem. Resultados detalhados, classificação por classe e matriz de confusão ficam em `ml/evaluation_results.json`.

Resultado observado nesta execução:

| Métrica | Resultado |
| --- | ---: |
| Acurácia | 0,72 |
| Precisão macro | 0,7381 |
| Recall macro | 0,7186 |
| F1 macro | 0,7264 |

Matriz de confusão, com linhas como classe real e colunas como classe prevista na ordem `INICIANTE`, `INTERMEDIARIO`, `AVANCADO`:

```text
[[5, 2, 0],
 [1, 8, 2],
 [0, 2, 5]]
```

A acurácia é a fração de acertos no holdout; as métricas macro calculam a média simples entre as três classes. O resultado descreve somente como a árvore reproduz os rótulos sintéticos desta divisão pequena. Não é evidência de desempenho com pessoas reais.

## Recomendações com recuperação documental

A base `knowledge/courses/` contém nove documentos Markdown fictícios: três competências (`logica`, `comunicacao`, `tecnologia`) em três níveis. O catálogo CRUD do backend Java existe, mas não há carga inicial de cursos nem integração de catálogo para IA. Por isso os IDs `CURSO-001` a `CURSO-009` são provisórios. O backend usa IDs numéricos e `BASICO`, enquanto o contrato de classificação usa `INICIANTE`; os responsáveis das Frentes A e B precisam alinhar um mapeamento antes da integração.

`app/knowledge_base.py` carrega os Markdown, cria vetores TF-IDF em memória e recupera conteúdo por similaridade de cosseno. `POST /recomendacoes` usa as competências com nota até 3 (ou a menor nota, se todas forem altas), filtra os documentos recuperados pelo nível recebido e devolve os cursos e nomes dos arquivos fonte. As justificativas usam descrição e pré-requisitos dos documentos.

Não há provedor de LLM configurado. A resposta de recomendações é determinística, baseada na recuperação e em campos dos documentos; não é geração por LLM nem RAG generativo completo. O modo atual não usa serviços pagos ou credenciais externas.

Exemplo de `POST /recomendacoes`:

```json
{
  "logica": 2,
  "comunicacao": 4,
  "tecnologia": 3,
  "nivel": "INTERMEDIARIO"
}
```

A resposta tem `recomendacoes` com `curso_id`, `nome` e `justificativa`, além de `fontes` contendo arquivos Markdown recuperados.

## Orientação determinística

`POST /orientacoes` recebe `colaborador_id`, `pergunta` e competências no corpo. O backend deve verificar o usuário e enviar a solicitação autenticada. A rota exige `Authorization: Bearer <INTERNAL_API_TOKEN>`; retorna HTTP 503 se o segredo não estiver configurado e HTTP 401 se o token não corresponder. Um booleano `autorizado` no JSON não concede acesso.

O assistente tem três ferramentas de leitura (`consultar_competencias`, `classificar_competencias`, `recomendar_cursos`), executa um plano fixo de no máximo três chamadas e reutiliza os serviços do classificador e das recomendações. Não altera cadastros, não consulta o banco Java e só recebe os dados de competência enviados pelo backend. Como não há LLM disponível, a orientação é montada deterministicamente a partir da classificação e dos cursos recuperados; não deve ser apresentada como agente generativo.

Exemplo de corpo:

```json
{
  "colaborador_id": "123",
  "pergunta": "Como posso melhorar minha competência em lógica?",
  "competencias": {"logica": 2, "comunicacao": 4, "tecnologia": 3}
}
```

## Contratos REST

- `GET /health`: saúde do serviço, HTTP 200.
- `POST /classificacoes`: aceita três inteiros estritos entre 1 e 5; retorna `nivel` e `versao_modelo`.
- `POST /recomendacoes`: aceita as três competências e `nivel`; retorna recomendações e fontes documentais.
- `POST /orientacoes`: exige autenticação interna; retorna orientação, IDs recomendados e fontes.
- Swagger UI: <http://127.0.0.1:8000/docs>; ReDoc: <http://127.0.0.1:8000/redoc>.

### Exemplos de classificação e recomendações

`POST /classificacoes`:

```json
{"logica": 4, "comunicacao": 3, "tecnologia": 5}
```

A execução local desta versão retorna:

```json
{"nivel": "AVANCADO", "versao_modelo": "1.0.0"}
```

`POST /recomendacoes`:

```json
{"logica": 2, "comunicacao": 4, "tecnologia": 3, "nivel": "INTERMEDIARIO"}
```

A resposta contém os cursos `CURSO-002` e `CURSO-008`, com justificativas derivadas dos documentos e fontes `logica-problemas.md` e `tecnologia-seguranca.md`.

`POST /orientacoes` usa o exemplo de corpo descrito acima e exige `Authorization: Bearer <token compartilhado>`. A resposta tem os campos `orientacao`, `cursos_recomendados` e `fontes`.
## Configuração de integrações

`.env.example` é um modelo sem credenciais reais. O código lê variáveis do ambiente, mas não carrega arquivos `.env` automaticamente. Configure os valores no ambiente de execução. No PowerShell, por exemplo:

```powershell
$env:MODEL_PATH = "ml/artifacts/classifier.joblib"
$env:INTERNAL_API_TOKEN = "token-local-de-desenvolvimento"
$env:JAVA_BACKEND_URL = "http://localhost:8080"
$env:RABBITMQ_URL = "amqp://user:password@localhost:5672/%2F"
```

No shell Linux, use `export NOME=valor`. Não versione seu `.env`, tokens ou senhas.

## Worker RabbitMQ

Execute a partir de `ai-service/`, separado da API:

```powershell
.\.venv\Scripts\python.exe -m worker.consumer
```

O worker usa Pika `BlockingConnection`, exchange direta durável `ml.training`, routing key `training.requested` e fila durável `ml.training.requests`. O formato provisório da mensagem é `{"solicitacao_id":"treinamento-123"}`. Há ACK manual; o ACK ocorre depois do artefato atômico, do registro idempotente local e da resposta HTTP 2xx do backend.

Falhas transitórias são reenviadas com contador limitado (`MAX_MESSAGE_RETRIES`, padrão 3). Mensagens inválidas e solicitações que excedem o limite são encaminhadas à fila provisória `ml.training.requests.dead-letter`. O ledger local `ml/artifacts/training-results.json` permite repetir o PATCH após falha sem treinar novamente; IDs de solicitação devem ser únicos. Configure armazenamento persistente para o diretório do artefato se a idempotência precisar sobreviver à recriação do container.

### Contrato Java ainda provisório

O código Java encontrado só expõe CRUD de colaboradores e cursos. Não há `PATCH /internal/treinamentos/{id}/status`, autenticação interna, mensagens de treinamento, infraestrutura RabbitMQ ou configuração da Frente C versionada no repositório. O worker usa provisoriamente:

- `PATCH {JAVA_BACKEND_URL}/internal/treinamentos/{solicitacao_id}/status`;
- token bearer `INTERNAL_API_TOKEN`;
- corpo de sucesso `{"status":"CONCLUIDO","versaoModelo":"1.0.0","mensagem":"..."}` e corpo de falha com `status: "FALHOU"`;
- exchange direta, fila e routing key listados acima; DLQ `ml.training.requests.dead-letter`.

A resposta HTTP é verificada e tem timeout de cinco segundos. Esses nomes, campos e estados precisam ser alinhados com A/C antes de uma integração real. Os testes atuais simulam backend e broker; não provam integração ponta a ponta. O serviço Python não altera o código Java nem cria configuração de infraestrutura.

## Testes

Os testes unitários usam dados/modelos temporários, mocks HTTP e um canal RabbitMQ falso; não exigem credenciais, RabbitMQ nem backend ativos. Em ambientes Windows onde a pasta `%TEMP%` do pytest não pode ser lida, use uma base temporária dentro do ambiente virtual ignorado pelo Git:

```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider --basetemp .venv\pytest-b4-tmp
```

A suíte cobre validação B1–B3, avaliação holdout, documentos e recuperação, recomendações, autenticação/ferramentas do agente, idempotência, callback HTTP, retries, DLQ e ACK.

## Demonstração local

1. Instale dependências, gere a base e treine o modelo.
2. Rode a avaliação para exibir as métricas holdout.
3. Em um terminal, inicie `python -m uvicorn app.main:app --reload` e demonstre `/health`, `/classificacoes` e `/recomendacoes` pelo Swagger.
4. Configure `INTERNAL_API_TOKEN` e envie-o no header bearer para demonstrar `/orientacoes`.
5. Para o worker, configure URL RabbitMQ e backend com o contrato acordado, inicie `python -m worker.consumer` e publique uma mensagem de treinamento compatível.

## Limitações e pendências de integração

- Dados e cursos são fictícios; IDs e níveis de curso precisam ser mapeados para o catálogo real.
- As métricas são de uma única divisão holdout pequena e artificial; não medem eficácia profissional.
- RAG atual significa recuperação TF-IDF e montagem determinística, sem LLM generativo.
- Autorização depende de implementação e configuração compartilhada no backend; não há autenticação Java hoje.
- O PATCH de treinamento, payloads, status, fila, exchange, DLQ e persistência do ledger requerem alinhamento com A/C.
- A API precisa reiniciar para carregar um artefato novo.
- Não foi possível testar RabbitMQ ou o backend real por falta dessas integrações no monorepo.
