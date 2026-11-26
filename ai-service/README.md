# AI Service

Serviço Python da Plataforma Inteligente de Educação Corporativa. A B1 preparou a API FastAPI e o health check; a B2 definiu o contrato de classificação; a B3 gera dados sintéticos, treina um modelo persistido e integra a predição ao endpoint `POST /classificacoes`.

## Tecnologias

- Python 3.13
- FastAPI 0.115.12 e Uvicorn 0.34.0
- Pydantic (validação dos contratos)
- scikit-learn 1.9.1 (árvore de decisão)
- Joblib 1.6.0 (persistência do modelo)
- pytest 8.3.5 e HTTPX 0.28.1 (testes)

As dependências estão fixadas em `requirements.txt`.

## Pré-requisitos e ambiente

É necessário ter Python 3.13 e suporte a ambientes virtuais. No Windows, instale o Python pelo gerenciador oficial (`py install 3.13`) ou pelo instalador do [Python.org](https://www.python.org/downloads/windows/). No Ubuntu, primeiro verifique se os pacotes estão disponíveis para a sua versão da distribuição:

```bash
sudo apt update
apt-cache policy python3.13
```

Se houver um candidato de instalação, instale Python e suporte a ambientes virtuais:

```bash
sudo apt install python3.13 python3.13-venv
python3.13 --version
```

Entre nesta pasta (`ai-service`) e crie o ambiente virtual.

### Windows (PowerShell)

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Se a ativação for bloqueada, use diretamente `.\.venv\Scripts\python.exe` nos comandos abaixo.

### Ubuntu

```bash
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Base de dados sintética

A base não contém dados reais de colaboradores. O script `ml/generate_dataset.py` produz, de forma determinística, as 125 combinações possíveis de `logica`, `comunicacao` e `tecnologia` (cada valor de 1 a 5) e salva os rótulos em `data/synthetic_competencies.csv`. Como todas as combinações são enumeradas, não há aleatoriedade nem necessidade de semente.

Os rótulos artificiais usam a média das três pontuações:

- Média até aproximadamente 2,33 (soma inteira até 7): `INICIANTE`.
- Média acima do limite iniciante e abaixo do avançado (somas de 8 a 10): `INTERMEDIARIO`.
- Média a partir de aproximadamente 3,67 (soma inteira a partir de 11): `AVANCADO`.

Essa regra serve somente para construir os rótulos sintéticos de treinamento. As 125 combinações resultam em 35 registros iniciantes, 55 intermediários e 35 avançados. Esses limites são uma simplificação didática, não uma avaliação científica de pessoas nem uma regra aplicada pelo endpoint.

Gere ou recrie a base a partir de `ai-service/`:

```bash
python -m ml.generate_dataset
```

No PowerShell sem ativar o ambiente:

```powershell
.\.venv\Scripts\python.exe -m ml.generate_dataset
```

## Treinamento do modelo

O script `ml/train_model.py` lê o CSV e treina uma `DecisionTreeClassifier` do scikit-learn com `random_state=42`. Uma árvore de decisão é adequada ao conjunto pequeno de atributos numéricos e permite explicar a estrutura aprendida com facilidade. O artefato contém o estimador, o algoritmo, as features e a versão `1.0.0`.

Treine a partir da pasta `ai-service/`:

```bash
python -m ml.train_model
```

O modelo é salvo em `ml/artifacts/classifier.joblib`. Esse artefato local é ignorado pelo Git e pode ser recriado executando os comandos de geração e treinamento. Treinar novamente substitui o artefato local.

## Executar a aplicação

Gere a base e treine o modelo antes de iniciar a API. A aplicação carrega o artefato uma vez durante sua inicialização; se ele estiver ausente, a inicialização falha com instruções para gerá-lo e treiná-lo.

```bash
python -m uvicorn app.main:app --reload
```

No Windows, sem ativar o ambiente virtual:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

A API ficará disponível em <http://127.0.0.1:8000>.

- Health check: <http://127.0.0.1:8000/health>
- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>

### Classificação de competências

`POST /classificacoes` recebe três inteiros obrigatórios, cada qual entre 1 e 5:

```json
{
  "logica": 4,
  "comunicacao": 3,
  "tecnologia": 5
}
```

O endpoint envia esses valores ao `model.predict()` do modelo carregado e responde com os campos definidos na B2:

```json
{
  "nivel": "AVANCADO",
  "versao_modelo": "1.0.0"
}
```

Os níveis possíveis são `INICIANTE`, `INTERMEDIARIO` e `AVANCADO`. O resultado é uma predição do modelo treinado com rótulos sintéticos, não uma avaliação validada de competências reais.

## Testes

Os testes geram base e artefato temporários, sem depender do arquivo local em `ml/artifacts/`. Cobrem os 125 registros e o equilíbrio das classes, treinamento e carregamento do modelo, predição, contrato da API, validações da B2 e health check.

Com o ambiente virtual ativo:

```bash
python -m pytest
```

No Windows, sem ativar o ambiente virtual:

```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider
```

## Limitações

Os dados são integralmente artificiais e os rótulos foram atribuídos por faixas simples de média. O modelo só aprende essa metodologia sintética. Nenhuma métrica desse treinamento deve ser tratada como evidência de desempenho em dados reais. Avaliação de desempenho, incluindo métricas e matriz de confusão, será realizada na B4.
