import { z } from 'zod'

/**
 * Texto obrigatório no formato dos DTOs do backend (`@NotBlank @Size(max) @Pattern("[^\\x00]*")`).
 * O valor é enviado aparado, então o limite vale para o texto sem espaços nas pontas.
 * Os limites contam unidades UTF-16, como `String.length` no Java.
 */
export function textoObrigatorio(campo: string, maximo: number) {
  return z.string().superRefine((valor, contexto) => {
    const aparado = valor.trim()
    if (aparado.length === 0) {
      contexto.addIssue({ code: 'custom', message: `Informe ${campo}.` })
    } else if (valor.includes('\u0000')) {
      contexto.addIssue({ code: 'custom', message: 'Remova caracteres inválidos.' })
    } else if (aparado.length > maximo) {
      contexto.addIssue({ code: 'custom', message: `Use no máximo ${maximo} caracteres.` })
    }
  })
}

/** Inteiro positivo representável em `Integer` do Java (1 a 2.147.483.647), digitado como texto. */
export function inteiroPositivo(campo: string, maximo = 2_147_483_647) {
  return z.string().superRefine((valor, contexto) => {
    const limpo = valor.trim()
    if (limpo === '') {
      contexto.addIssue({ code: 'custom', message: `Informe ${campo}.` })
    } else if (!/^[1-9][0-9]*$/.test(limpo) || Number(limpo) > maximo) {
      contexto.addIssue({ code: 'custom', message: `Use um número inteiro entre 1 e ${maximo.toLocaleString('pt-BR')}.` })
    }
  })
}

/** Data e hora ISO 8601 como o backend serializa `Instant` (com até microssegundos e `Z`). */
export const dataIso = z.iso.datetime({ offset: true })

/** Identificador de entidade: inteiro positivo seguro em JavaScript. */
export const idEntidade = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
