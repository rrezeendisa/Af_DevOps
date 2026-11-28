import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { podeAcessar } from '@/app/rotas'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { FormasOrganicas } from '@/components/marca/FormasOrganicas'
import { MarcaEvolia, SLOGAN } from '@/components/marca/MarcaEvolia'
import { AlternadorTema } from '@/components/tema/AlternadorTema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuth, type MotivoFalhaLogin } from './contexto'
import { destinoAposLogin } from './destino'

const esquema = z.object({
  nomeUsuario: z
    .string()
    .min(1, 'Informe o nome de usuário.')
    .regex(/^[A-Za-z0-9_.-]{1,64}$/, 'Use até 64 letras sem acento, números, pontos, hífens ou sublinhados.'),
  senha: z.string().min(1, 'Informe a senha.'),
})

type Campos = z.infer<typeof esquema>

type Falha = Exclude<MotivoFalhaLogin, 'cancelado'>

const MENSAGENS: Record<Falha, { titulo: string; texto: string }> = {
  'credenciais-invalidas': { titulo: 'Não foi possível entrar', texto: 'Usuário ou senha incorretos.' },
  'muitas-tentativas': {
    titulo: 'Muitas tentativas',
    texto: 'Aguarde um momento antes de tentar entrar novamente.',
  },
  'servico-indisponivel': {
    titulo: 'Serviço indisponível',
    texto: 'Não foi possível conectar à Evolia agora. Tente novamente em instantes.',
  },
  'resposta-invalida': { titulo: 'Algo não saiu como esperado', texto: 'Não foi possível concluir a entrada. Tente novamente.' },
}

const AVISOS = {
  logout: { titulo: 'Até logo', texto: 'Você saiu da Evolia.' },
  'sessao-expirada': { titulo: 'Sessão encerrada', texto: 'Sua sessão foi encerrada. Entre novamente.' },
  'sessao-substituida': { titulo: 'Sessão alterada', texto: 'A sessão deste navegador mudou. Entre novamente.' },
} as const

const PILARES = [
  { rotulo: 'Conexão', cor: 'bg-white dark:bg-secondary' },
  { rotulo: 'Conhecimento', cor: 'bg-primary' },
  { rotulo: 'Crescimento', cor: 'bg-highlight' },
  { rotulo: 'Evolução', cor: 'bg-simbolo-detalhe' },
] as const

/** Tela de entrada. Credenciais seguem direto para `entrar()` e o campo de senha é limpo em seguida. */
export function PaginaEntrar() {
  const { estado, entrar, sair, continuar } = useAuth()
  const location = useLocation()
  const [falha, setFalha] = useState<Falha | null>(null)
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const enviandoRef = useRef(false)
  const mensagemRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Campos>({ resolver: zodResolver(esquema), defaultValues: { nomeUsuario: '', senha: '' } })

  useEffect(() => {
    document.title = 'Entrar · Evolia'
  }, [])

  useEffect(() => {
    if (falha === 'credenciais-invalidas') {
      setFocus('senha')
    } else if (falha !== null) {
      mensagemRef.current?.focus()
    }
  }, [falha, setFocus])

  if (estado.status === 'autenticado') {
    const de: unknown = (location.state as { de?: unknown } | null)?.de
    return <Navigate to={destinoAposLogin(de, estado.tipoConta, podeAcessar)} replace />
  }

  const aoEnviar = async ({ nomeUsuario, senha }: Campos) => {
    if (enviandoRef.current) {
      return
    }
    enviandoRef.current = true
    setFalha(null)
    try {
      // `entrar` já recebeu as credenciais; o campo é limpo sem esperar a resposta.
      const pendente = entrar({ nomeUsuario, senha })
      setValue('senha', '')
      const resultado = await pendente
      if (!resultado.ok && resultado.motivo !== 'cancelado') {
        setFalha(resultado.motivo)
      }
    } finally {
      enviandoRef.current = false
    }
  }

  const aviso =
    falha === null && estado.status === 'anonimo' && estado.motivo !== 'inicial' ? AVISOS[estado.motivo] : null

  const erroUsuario = errors.nomeUsuario?.message
  const erroSenha = errors.senha?.message
  const ocupado = isSubmitting || estado.status === 'autenticando' || estado.status === 'saindo'

  return (
    <div className="relative min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <a
        href="#formulario-entrar"
        className="sr-only z-50 rounded-[10px] bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Ir para o formulário
      </a>

      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <AlternadorTema />
      </div>

      {/* Painel institucional: visível a partir de lg. */}
      <aside
        aria-label="Sobre a Evolia"
        className="relative isolate m-4 hidden overflow-hidden rounded-[2rem] bg-accent p-12 lg:sticky lg:top-4 lg:flex lg:h-[calc(100svh-2rem)] lg:flex-col xl:p-16 dark:border dark:border-accent/30 dark:bg-surface-2"
      >
        <MarcaEvolia tamanho="lg" sobreLilas />
        <div className="mt-16 max-w-[30rem] xl:mt-20">
          <p className="font-heading text-5xl leading-[1.04] font-bold tracking-[-0.02em] text-accent-foreground xl:text-6xl dark:text-foreground">
            {SLOGAN}
          </p>
          <p className="mt-6 max-w-[26rem] text-lg text-accent-foreground/85 dark:text-muted-foreground">
            Uma plataforma de educação corporativa que conecta colaboradores, conhecimento e inteligência artificial.
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2" aria-label="Pilares da Evolia">
            {PILARES.map((pilar) => (
              <li key={pilar.rotulo} className="flex items-center gap-2 text-sm font-medium text-accent-foreground dark:text-foreground">
                <span aria-hidden="true" className={cn('size-2.5 rounded-full', pilar.cor)} />
                {pilar.rotulo}
              </li>
            ))}
          </ul>
        </div>
        {/* Ocupa só o espaço que sobra: as formas encolhem inteiras, sem corte, em janelas baixas. */}
        <div className="mt-auto flex min-h-0 flex-1 items-end justify-end pt-8">
          <FormasOrganicas className="h-full max-h-[14rem] w-auto max-w-full" />
        </div>
      </aside>

      <main id="formulario-entrar" tabIndex={-1} className="flex min-h-svh items-center justify-center px-5 py-16 outline-none sm:px-10">
        <div className="w-full max-w-[25rem]">
          {/* Faixa de marca compacta abaixo de lg, no lugar do painel institucional. */}
          <div className="relative isolate mb-10 overflow-hidden rounded-3xl bg-accent px-6 pt-6 pb-7 lg:hidden dark:border dark:border-accent/30 dark:bg-surface-2">
            <MarcaEvolia sobreLilas />
            <p className="mt-6 max-w-[64%] font-heading text-[1.375rem] leading-[1.12] font-bold tracking-[-0.01em] text-accent-foreground sm:max-w-[18rem] sm:text-3xl dark:text-foreground">
              {SLOGAN}
            </p>
            <FormasOrganicas className="absolute right-5 bottom-5 -z-10 w-[26%] sm:w-[30%]" />
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.01em] text-foreground">Entrar</h1>
          <p className="mt-3 text-base text-muted-foreground">Use as credenciais fornecidas pela sua organização.</p>

          <div className="mt-8 grid gap-6">
            {falha !== null && (
              <MensagemErro ref={mensagemRef} titulo={MENSAGENS[falha].titulo}>
                {MENSAGENS[falha].texto}
              </MensagemErro>
            )}
            {estado.status === 'saida-pendente' && (
              <MensagemErro tom="aviso" titulo="Saída não confirmada">
                <p>O servidor não confirmou o encerramento. A sessão pode continuar ativa neste navegador.</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={sair}>
                  Tentar sair novamente
                </Button>
              </MensagemErro>
            )}
            {estado.status === 'confirmar' && (
              <MensagemErro tom="aviso" titulo="Há uma sessão ativa">
                <p>
                  Este navegador não permite confirmar se a última saída foi concluída. Continuar como{' '}
                  <strong>{estado.identidade.nomeUsuario}</strong>?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={continuar}>
                    Continuar
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={sair}>
                    Sair
                  </Button>
                </div>
              </MensagemErro>
            )}
            {aviso !== null && (
              <MensagemErro tom="aviso" titulo={aviso.titulo}>
                {aviso.texto}
              </MensagemErro>
            )}

            <form noValidate onSubmit={(evento) => void handleSubmit(aoEnviar)(evento)} aria-busy={ocupado} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="nomeUsuario">Nome de usuário</Label>
                <Input
                  id="nomeUsuario"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={erroUsuario ? true : undefined}
                  aria-describedby={erroUsuario ? 'erro-nomeUsuario' : undefined}
                  {...register('nomeUsuario')}
                />
                {erroUsuario && (
                  <p id="erro-nomeUsuario" className="text-sm text-destructive">
                    {erroUsuario}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={senhaVisivel ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-12"
                    aria-invalid={erroSenha ? true : undefined}
                    aria-describedby={erroSenha ? 'erro-senha' : undefined}
                    {...register('senha')}
                  />
                  <button
                    type="button"
                    aria-label="Mostrar senha"
                    aria-pressed={senhaVisivel}
                    aria-controls="senha"
                    onClick={() => setSenhaVisivel((visivel) => !visivel)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[10px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {senhaVisivel ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                  </button>
                </div>
                {erroSenha && (
                  <p id="erro-senha" className="text-sm text-destructive">
                    {erroSenha}
                  </p>
                )}
              </div>

              <Button type="submit" size="lg" className="mt-2 w-full" disabled={ocupado}>
                {ocupado && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                {ocupado ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground">
              Acesso restrito a administradores e colaboradores com conta cadastrada.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
