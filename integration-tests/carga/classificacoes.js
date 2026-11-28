// Carga de classificação com sessão autenticada (um usuário virtual = uma conta, um cookie e um contexto).
import http from 'k6/http'
import exec from 'k6/execution'
import { sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const contas = JSON.parse(open('/contas.json'))
const usuarios = Number(__ENV.USUARIOS)
const segundos = Number(__ENV.MEDICAO)
// 30 s de subida e 30 s de aquecimento antes da janela medida.
const INICIO_MS = Number(__ENV.INICIO_MS || 60000)
const BASE = 'http://gateway:8080'

const incluir = ['http_200', 'http_400', 'http_401', 'http_403', 'http_429', 'http_500', 'http_502', 'http_503', 'http_504', 'http_outro', 'sem_resposta']
const etapas = ['login', 'csrf']
const tendencia = (nome) => new Trend(nome, true)
const contador = (nome) => new Counter(nome)

// POST de classificação iniciado na janela (mesma definição da Etapa 14).
const post = tendencia('classificacao_ms')
const sucesso = new Rate('classificacao_valida')
const prazo = new Rate('classificacao_no_prazo')
const tentativas = contador('classificacoes')
const postInicio = contador('post_inicio')
const postFim = contador('post_fim')
const erros = Object.fromEntries(incluir.map((nome) => [nome, contador(nome)]))
// Toda interação iniciada na janela, com ou sem POST.
const interacao = tendencia('interacao_ms')
const interacaoPrazo = new Rate('interacao_no_prazo')
const interacoes = contador('interacoes')
const interacoesValidas = contador('interacoes_validas')
const falhasSessao = contador('sessao_falhas')
const sessoesPerdidas = contador('sessao_perdida')
const csrf = tendencia('csrf_ms')
const csrfFalhas = contador('csrf_falhas')
const sessoesMedidas = contador('sessoes_medidas')
// Autenticação, contada na execução inteira.
const loginMs = tendencia('login_ms')
const loginFalhas = contador('login_falhas')
const sessoes = contador('sessoes_estabelecidas')
const errosEtapa = Object.fromEntries(
  etapas.flatMap((etapa) => ['429', '4xx', '5xx', 'sem_resposta'].map((tipo) => [`${etapa}_${tipo}`, contador(`${etapa}_${tipo}`)])),
)

let contexto = null
let estabeleceu = false
let mediu = false

export const options = {
  noCookiesReset: true,
  noConnectionReuse: false,
  maxRedirects: 0,
  systemTags: ['name', 'status', 'scenario', 'error_code'],
  summaryTrendStats: ['count', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: usuarios === 300 ? { classificacao_no_prazo: ['rate>=0.95'], interacao_no_prazo: ['rate>=0.95'] } : {},
  scenarios: {
    classificacao: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: usuarios },
        { duration: (INICIO_MS / 1000 - 30 + segundos) + 's', target: usuarios },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '40s',
      gracefulStop: '40s',
    },
  },
}

function registrarErro(etapa, status) {
  const tipo = status === 0 ? 'sem_resposta' : status === 429 ? '429' : status >= 500 ? '5xx' : '4xx'
  errosEtapa[`${etapa}_${tipo}`].add(1)
}

function lerJson(resposta) {
  try {
    return resposta.json()
  } catch {
    return null
  }
}

// O token é pedido antes de cada escrita, inclusive do login.
function obterToken(prazoMs) {
  const resposta = http.get(`${BASE}/api/csrf`, {
    headers: contexto ? { 'X-Evolia-Contexto': contexto } : {},
    timeout: prazoMs,
    tags: { name: 'csrf' },
  })
  const dados = resposta.status === 200 ? lerJson(resposta) : null
  const valido = dados && dados.headerName === 'X-XSRF-TOKEN' && typeof dados.token === 'string'
  return { status: resposta.status, token: valido ? dados.token : null }
}

// Uma tentativa por interação, sem repetição imediata.
function autenticar(conta) {
  const inicio = Date.now()
  contexto = null
  let status = 0
  const preparo = obterToken('20s')
  status = preparo.status
  if (preparo.token) {
    const entrada = http.post(`${BASE}/api/login`, { username: conta.usuario, password: conta.senha }, {
      headers: { 'X-XSRF-TOKEN': preparo.token },
      timeout: '20s',
      tags: { name: 'login' },
    })
    status = entrada.status
    if (entrada.status === 204) {
      const identidade = http.get(`${BASE}/api/me`, { timeout: '20s', tags: { name: 'me' } })
      status = identidade.status
      if (identidade.status === 200) contexto = identidade.headers['X-Evolia-Contexto'] || null
    }
  }
  if (contexto) {
    loginMs.add(Date.now() - inicio)
    if (!estabeleceu) sessoes.add(1)
    estabeleceu = true
  } else {
    loginFalhas.add(1)
    registrarErro('login', status)
  }
}

export default function () {
  const inicio = Date.now()
  const decorrido = inicio - exec.scenario.startTime
  const fim = INICIO_MS + segundos * 1000
  if (decorrido >= fim) {
    sleep(1)
    return
  }
  const medir = decorrido >= INICIO_MS
  if (medir) interacoes.add(1)
  let valida = false

  // Login separado: ocorre na primeira iteração, durante a subida. Se faltar sessão já na janela,
  // o tempo gasto entra na interação.
  if (!contexto) autenticar(contas[exec.vu.idInTest - 1])

  if (!contexto) {
    if (medir) falhasSessao.add(1)
  } else {
    const antesCsrf = Date.now()
    const preparo = obterToken('15s')
    if (medir) csrf.add(Date.now() - antesCsrf)
    if (!preparo.token) {
      if (medir) {
        csrfFalhas.add(1)
        registrarErro('csrf', preparo.status)
      }
    } else {
      const numero = exec.vu.idInTest + exec.vu.iterationInScenario
      const notas = { logica: 1 + numero % 5, comunicacao: 1 + (numero * 3) % 5, tecnologia: 1 + (numero * 7 + 1) % 5 }
      const iniciouPost = Date.now()
      const medirPost = iniciouPost - exec.scenario.startTime >= INICIO_MS && iniciouPost - exec.scenario.startTime < fim
      if (medirPost) postInicio.add(1)
      const resposta = http.post(`${BASE}/api/ia/classificacoes`, JSON.stringify(notas), {
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': preparo.token, 'X-Evolia-Contexto': contexto },
        timeout: '20s',
        tags: { name: 'classificacao' },
      })
      const latencia = Date.now() - iniciouPost
      if (resposta.status === 200) {
        const dados = lerJson(resposta)
        valida = !!dados && ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'].includes(dados.nivel)
          && typeof dados.versaoModelo === 'string' && dados.versaoModelo.length > 0
      }
      if (resposta.status === 401) {
        sessoesPerdidas.add(1)
        contexto = null
      }
      if (medirPost) {
        postFim.add(1)
        const etiqueta = resposta.status === 0 ? 'sem_resposta' : 'http_' + resposta.status
        ;(erros[etiqueta] || erros.http_outro).add(1)
        if (!mediu) sessoesMedidas.add(1)
        mediu = true
        tentativas.add(1)
        post.add(latencia)
        sucesso.add(valida)
        prazo.add(valida && latencia <= 2000)
      }
    }
  }
  if (medir) {
    const total = Date.now() - inicio
    interacao.add(total)
    interacaoPrazo.add(valida && total <= 2000)
    if (valida) interacoesValidas.add(1)
  }
  sleep(1 + (exec.vu.idInTest * 17 + exec.vu.iterationInScenario * 13) % 201 / 100)
}

export function handleSummary(data) {
  const nomes = [
    'classificacao_ms', 'classificacao_valida', 'classificacao_no_prazo', 'classificacoes', 'interacao_ms',
    'interacao_no_prazo', 'interacoes', 'interacoes_validas', 'sessao_falhas', 'sessao_perdida', 'csrf_ms',
    'csrf_falhas', 'sessoes_medidas', 'login_ms', 'login_falhas', 'sessoes_estabelecidas', 'vus', 'vus_max',
    ...incluir, ...Object.keys(errosEtapa),
  ]
  const metricas = Object.fromEntries(nomes.filter((nome) => data.metrics[nome]).map((nome) => [nome, data.metrics[nome].values]))
  return { '/saida/k6.json': JSON.stringify({ usuarios, segundos, metricas }, null, 2) + '\n' }
}
