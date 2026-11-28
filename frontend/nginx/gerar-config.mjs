import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8').replace(/\r\n?/g, '\n')
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
const inline = scripts.filter(([, atributos]) => !/(?:^|\s)src\s*=/i.test(atributos))
if (inline.length !== 1 || !inline[0][2].includes('evolia:tema')) {
  throw new Error('O build deve conter somente o script inline de inicialização do tema.')
}
const hash = createHash('sha256').update(inline[0][2]).digest('base64')
const template = readFileSync('nginx/evolia-headers.inc', 'utf8')
if (template.split('__HASH_TEMA__').length !== 2) {
  throw new Error('O modelo da configuração Nginx deve conter um único marcador para o hash.')
}
writeFileSync('evolia-headers.inc', template.replace('__HASH_TEMA__', hash))
