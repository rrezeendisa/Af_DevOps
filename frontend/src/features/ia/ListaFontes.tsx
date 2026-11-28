import { FileText } from 'lucide-react'

/** Lista de fontes em texto puro (nomes de arquivos do acervo da IA). */
export function ListaFontes({ fontes, titulo = 'Fontes consultadas' }: { fontes: readonly string[]; titulo?: string }) {
  return (
    <section aria-label={titulo} className="grid gap-3 rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-sans text-base font-semibold">{titulo}</h2>
      {fontes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma fonte informada.</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {fontes.map((fonte, indice) => (
            <li key={`${fonte}-${indice}`} className="flex items-start gap-2 break-all">
              <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-detail" />
              <span>{fonte}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
