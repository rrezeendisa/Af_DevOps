const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const INTEIRO = new Intl.NumberFormat('pt-BR')
const PERCENTUAL = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

/** Datas ISO 8601 da API (o backend grava com microssegundos) no formato pt-BR. */
export function formatarDataHora(iso: string): string {
  return DATA_HORA.format(new Date(iso))
}

export function formatarData(iso: string): string {
  return DATA.format(new Date(iso))
}

export function formatarNumero(valor: number): string {
  return INTEIRO.format(valor)
}

export function formatarPercentual(fracao: number): string {
  return PERCENTUAL.format(fracao)
}

export function formatarHoras(horas: number): string {
  return `${formatarNumero(horas)} ${horas === 1 ? 'hora' : 'horas'}`
}

/** Normaliza texto para busca local: sem acentos, minúsculo e sem espaços nas pontas. */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()
}

/** Valores distintos, em ordem alfabética pt-BR, para filtros derivados dos dados reais. */
export function valoresDistintos(valores: readonly string[]): string[] {
  return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
