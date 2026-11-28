import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { podeAcessar } from '@/app/rotas'
import { Decorativo } from '@/components/arte/Decorativo'
import { MensagemErro } from '@/components/feedback/MensagemErro'
import { MarcaEvolia } from '@/components/marca/MarcaEvolia'
import { AlternadorTema } from '@/components/tema/AlternadorTema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const CAMPO = 'h-12 rounded-xl pl-11 focus-visible:ring-offset-surface md:text-base'
const ICONE_DO_CAMPO = 'pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-muted-foreground'

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
    <div className="fundo-entrada relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-20 sm:px-8 lg:px-12 lg:py-10">
      <a
        href="#formulario-entrar"
        className="sr-only z-50 rounded-[10px] bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Ir para o formulário
      </a>

      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <AlternadorTema />
      </div>

      <div className="relative w-full max-w-[32rem] lg:max-w-[75rem]">
        {/* Profundidade atrás do cartão: desfocados e fora das bordas. */}
        <Decorativo nome="petalas" movimento="balancar" className="-top-12 -left-10 -z-10 w-28 opacity-70 blur-[3px] sm:w-36" />
        <Decorativo nome="petalas" movimento="derivar" className="-right-12 -bottom-14 -z-10 w-32 opacity-60 blur-[5px] lg:w-52" />

        <div className="grid overflow-hidden rounded-[28px] border border-border bg-surface/70 shadow-alta backdrop-blur-xl lg:min-h-[38rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <main id="formulario-entrar" tabIndex={-1} className="flex items-center justify-center bg-surface/95 px-6 py-10 outline-none sm:px-12 lg:py-7">
            <div className="w-full max-w-[23rem]">
              <div className="relative">
                <MarcaEvolia comSlogan className="pr-20 lg:pr-0" />
                {/* Composição reduzida onde o painel visual não aparece. */}
                <Decorativo nome="mascote" movimento="flutuar" className="-top-4 right-0 w-16 sm:w-20 lg:hidden" />
              </div>

              <h1 className="mt-10 lg:mt-7 text-3xl font-semibold tracking-[-0.01em] text-foreground sm:text-4xl">Que bom ter você aqui!</h1>
              <p className="mt-3 text-base text-muted-foreground">Entre para acessar sua área de aprendizagem.</p>

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
                <div className="relative">
                <UserRound aria-hidden="true" className={ICONE_DO_CAMPO} />
                <Input
                  id="nomeUsuario"
                  className={CAMPO}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={erroUsuario ? true : undefined}
                  aria-describedby={erroUsuario ? 'erro-nomeUsuario' : undefined}
                  {...register('nomeUsuario')}
                />
                </div>
                {erroUsuario && (
                  <p id="erro-nomeUsuario" className="text-sm text-destructive">
                    {erroUsuario}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <LockKeyhole aria-hidden="true" className={ICONE_DO_CAMPO} />
                  <Input
                    id="senha"
                    type={senhaVisivel ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`${CAMPO} pr-12`}
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
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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

              <Button type="submit" size="lg" className="mt-2 h-12 w-full rounded-xl bg-linear-to-r from-primary to-neon-violet text-base shadow-neon hover:brightness-105" disabled={ocupado}>
                {ocupado && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                {ocupado ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>

            <div className="grid justify-items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">Acesso restrito a administradores e colaboradores com conta cadastrada.</p>
              <Link to="/" className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar à página inicial
              </Link>
            </div>
          </div>
            </div>
          </main>

          {/* Painel visual: só quando há espaço para as duas áreas. */}
          <aside aria-label="Sobre a Evolia" className="painel-entrada relative isolate hidden overflow-hidden lg:flex lg:flex-col">
            <Decorativo nome="petalas" movimento="derivar" className="-top-14 -right-12 w-40 xl:w-44" />
            <div className="relative z-10 grid gap-4 px-12 pt-28 xl:px-14">
              <p className="max-w-[27rem] font-heading text-4xl leading-[1.1] font-bold tracking-[-0.02em] text-foreground xl:text-[2.75rem]">
                O futuro começa com o que você <em className="texto-neon font-medium">aprende.</em>
              </p>
              <p className="text-lg text-foreground">Novas competências, novas possibilidades.</p>
            </div>
            {/* Faixa própria do mascote: não passa sobre o texto. */}
            <div className="relative mt-4 min-h-72 flex-1">
              <Decorativo nome="mascote" movimento="flutuar" className="right-4 bottom-8 w-28 xl:w-36" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
