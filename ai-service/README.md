# AI Service

Serviço Python da Plataforma Inteligente de Educação Corporativa. A entrega B1 prepara a base executável da API: aplicação FastAPI, verificação de saúde, documentação interativa, teste automatizado e instruções para configurar o ambiente local. Nesta etapa, o único endpoint implementado é `GET /health`; classificação, recomendações, agente e worker ficam para as próximas etapas.

## Tecnologias da B1

- Python 3.13
- FastAPI 0.115.12: API HTTP e documentação OpenAPI
- Uvicorn 0.34.0: servidor local da API
- pytest 8.3.5: execução dos testes
- HTTPX 0.28.1: suporte ao `TestClient` do FastAPI

As versões estão fixadas em `requirements.txt` para tornar a instalação reproduzível.

## Pré-requisitos e instalação do Python

É necessário ter Python 3.13 e suporte a ambientes virtuais (`venv`). O ambiente `.venv` deve ser criado dentro desta pasta e não é versionado.

### Windows (PowerShell)

Instale o Python 3.13 pelo gerenciador oficial do Python para Windows. Se o comando `py` estiver disponível, instale a versão com:

```powershell
py install 3.13
```

Confirme a instalação:

```powershell
py -3.13 --version
```

Alternativamente, baixe o instalador oficial em [Python.org — Python para Windows](https://www.python.org/downloads/windows/). Após a instalação, abra um novo PowerShell para atualizar os comandos disponíveis.

### Ubuntu

Primeiro, verifique se a versão está disponível nos repositórios configurados para sua versão do Ubuntu:

```bash
sudo apt update
apt-cache policy python3.13
```

Se houver um candidato de instalação, instale o interpretador e o módulo de ambientes virtuais:

```bash
sudo apt install python3.13 python3.13-venv
```

Confirme:

```bash
python3.13 --version
```

A disponibilidade do pacote varia conforme a versão e os repositórios do Ubuntu. Use uma fonte de instalação confiável para sua distribuição caso o pacote não esteja disponível.

## Configurar o ambiente do projeto

Clone/abra o repositório e entre na pasta `ai-service` antes de executar os comandos abaixo.

### Windows (PowerShell)

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Se a política do PowerShell impedir a ativação, não é necessário alterá-la: execute os comandos pelo interpretador do ambiente virtual diretamente:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Ubuntu

```bash
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Executar a aplicação

Com o terminal na pasta `ai-service` e o ambiente virtual ativo:

```bash
python -m uvicorn app.main:app --reload
```

No Windows, se não ativou o ambiente virtual, use:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

A API ficará disponível em <http://127.0.0.1:8000>.

- Health check: <http://127.0.0.1:8000/health>
- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>

A resposta esperada para `/health` é:

```json
{
  "status": "ok",
  "service": "ai-service"
}
```

## Classificar competências

`POST /classificacoes` recebe as três pontuações obrigatórias (`logica`, `comunicacao` e `tecnologia`). Cada valor deve ser um número inteiro de 1 a 5. Decimais, strings, booleanos e valores fora desse intervalo são rejeitados com HTTP 422. A documentação interativa em `/docs` apresenta o modelo de entrada e de saída.

Exemplo de requisição:

```json
{
  "logica": 4,
  "comunicacao": 3,
  "tecnologia": 5
}
```

Até a etapa B3, o modelo de Machine Learning ainda não foi treinado. Portanto, a rota valida a entrada e retorna uma resposta provisória que não simula uma classificação:

```json
{
  "nivel": null,
  "versao_modelo": "pendente"
}
```

Na B3, `nivel` será produzido pelo modelo e pertencerá a `INICIANTE`, `INTERMEDIARIO` ou `AVANCADO`.

## Executar e validar os testes

Em outro terminal, na pasta `ai-service` e com o ambiente virtual ativo:

```bash
python -m pytest
```

No Windows, sem ativar o ambiente virtual:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

O teste de saúde valida o status HTTP 200 e os campos e valores do JSON retornado. A execução deve terminar com `1 passed`. O comando `python -m pytest` garante que o projeto seja localizado pelo interpretador do ambiente virtual.

## Arquivos desta etapa

- `app/main.py`: instancia a API e define `GET /health`.
- `app/__init__.py`: identifica `app` como pacote Python.
- `tests/test_health.py`: teste automatizado do health check.
- `requirements.txt`: dependências com versões fixadas.
- `.gitignore`: exclui ambiente virtual, caches, arquivos `.env` e configurações locais de IDE.
