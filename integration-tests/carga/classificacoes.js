import http from 'k6/http'
import encoding from 'k6/encoding'
import exec from 'k6/execution'
import { sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const contas = JSON.parse(open('/contas.json'))
const usuarios = Number(__ENV.USUARIOS)
const segundos = Number(__ENV.MEDICAO)
const incluir = ['http_200', 'http_400', 'http_401', 'http_403', 'http_429', 'http_500', 'http_502', 'http_503', 'http_504', 'http_outro', 'sem_resposta']
const post = new Trend('classificacao_ms', true)
const csrf = new Trend('csrf_ms', true)
const ciclo = new Trend('ciclo_ms', true)
const sucesso = new Rate('classificacao_valida')
const prazo = new Rate('classificacao_no_prazo')
const tentativas = new Counter('classificacoes')
const ciclos = new Counter('ciclos')
const csrfFalhas = new Counter('csrf_falhas')
const sessoes = new Counter('sessoes_medidas')
const postInicio = new Counter('post_inicio')
const postFim = new Counter('post_fim')
const erros = Object.fromEntries(incluir.map((nome) => [nome, new Counter(nome)]))
const limiares = usuarios === 300 ? { classificacao_no_prazo: ['rate>=0.95'] } : {}
let mediu = false

export const options = {
  noCookiesReset: true,
  noConnectionReuse: false,
  maxRedirects: 0,
  systemTags: ['name', 'status', 'scenario', 'error_code'],
  summaryTrendStats: ['count', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: limiares,
  scenarios: {
    classificacao: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: usuarios },
        { duration: (segundos + 30) + 's', target: usuarios },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '40s',
      gracefulStop: '40s',
    },
  },
}

export default function () {
  const inicio = Date.now()
  const decorrido = inicio - exec.scenario.startTime
  if (decorrido >= (60 + segundos) * 1000) {
    sleep(1)
    return
  }
  const conta = contas[exec.vu.idInTest - 1]
  const headers = { Authorization: 'Basic ' + encoding.b64encode(conta.usuario + ':' + conta.senha) }
  const obtido = http.get('http://gateway:8080/api/csrf', { headers, timeout: '15s', tags: { name: 'csrf' } })
  let token
  if (obtido.status === 200) {
    try {
      const dados = obtido.json()
      if (dados.headerName === 'X-XSRF-TOKEN' && typeof dados.token === 'string') token = dados.token
    } catch {
      // Uma resposta inválida de preparação conta como falha, sem repetir a operação.
    }
  }
  const iniciouPost = Date.now()
  const medirCiclo = decorrido >= 60_000
  const medirPost = iniciouPost - exec.scenario.startTime >= 60_000
    && iniciouPost - exec.scenario.startTime < (60 + segundos) * 1000
  if (medirCiclo) ciclos.add(1)
  if (medirPost) csrf.add(iniciouPost - inicio)
  if (!token) {
    if (medirCiclo) csrfFalhas.add(1)
  } else if (iniciouPost - exec.scenario.startTime < (60 + segundos) * 1000) {
    const numero = exec.vu.idInTest + exec.vu.iterationInScenario
    const notas = { logica: 1 + numero % 5, comunicacao: 1 + (numero * 3) % 5, tecnologia: 1 + (numero * 7 + 1) % 5 }
    if (medirPost) postInicio.add(1)
    const resposta = http.post('http://gateway:8080/api/ia/classificacoes', JSON.stringify(notas), {
      headers: { ...headers, 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token },
      timeout: '20s',
      tags: { name: 'classificacao' },
    })
    if (medirPost) {
      postFim.add(1)
      const latencia = Date.now() - iniciouPost
      let valida = false
      if (resposta.status === 200) {
        try {
          const dados = resposta.json()
          valida = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'].includes(dados.nivel)
            && typeof dados.versaoModelo === 'string' && dados.versaoModelo.length > 0
        } catch {
          // Corpo inválido não atende ao requisito.
        }
      }
      const etiqueta = resposta.status === 0 ? 'sem_resposta' : 'http_' + resposta.status
      const contador = erros[etiqueta] || erros.http_outro
      contador.add(1)
      if (!mediu) sessoes.add(1)
      mediu = true
      tentativas.add(1)
      post.add(latencia)
      ciclo.add(Date.now() - inicio)
      sucesso.add(valida)
      prazo.add(valida && latencia <= 2000)
    }
  }
  sleep(1 + (exec.vu.idInTest * 17 + exec.vu.iterationInScenario * 13) % 201 / 100)
}

export function handleSummary(data) {
  const nomes = [
    'classificacao_ms', 'csrf_ms', 'ciclo_ms', 'classificacao_valida', 'classificacao_no_prazo',
    'classificacoes', 'ciclos', 'csrf_falhas', 'sessoes_medidas', 'vus', 'vus_max', ...incluir,
  ]
  const metricas = Object.fromEntries(nomes.filter((nome) => data.metrics[nome]).map((nome) => [nome, data.metrics[nome].values]))
  return { '/saida/k6.json': JSON.stringify({ usuarios, segundos, metricas }, null, 2) + '\n' }
}
