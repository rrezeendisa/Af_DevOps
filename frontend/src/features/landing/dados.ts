/** Conteúdo institucional da landing. Só afirma o que a plataforma realmente faz. */

export const REPOSITORIO = 'https://github.com/rrezeendisa/Af_DevOps'

export const SECOES = [
  { id: 'areas', rotulo: 'Áreas' },
  { id: 'como-funciona', rotulo: 'Como funciona' },
  { id: 'aprendizagem', rotulo: 'Aprendizagem' },
  { id: 'inteligencia', rotulo: 'IA' },
  { id: 'uso-responsavel', rotulo: 'Uso responsável' },
] as const

export const PASSOS = [
  { titulo: 'Acesse a plataforma', texto: 'Entre com a conta individual fornecida pela sua organização.' },
  { titulo: 'Autorize o uso da IA', texto: 'A decisão é sua, é explícita e pode ser revogada quando quiser.' },
  { titulo: 'Avalie suas competências', texto: 'Dê notas de 1 a 5 para lógica, comunicação e tecnologia.' },
  { titulo: 'Receba recomendações', texto: 'Cursos do acervo, com justificativas e as fontes consultadas.' },
  { titulo: 'Peça orientação', texto: 'Faça uma pergunta sobre o seu desenvolvimento profissional.' },
] as const

export const RECURSOS = [
  {
    titulo: 'Classificação de competências',
    texto: 'Um modelo de Machine Learning estima o nível a partir das notas que você informa. É uma estimativa, não uma avaliação de desempenho.',
  },
  {
    titulo: 'Recomendações com fontes',
    texto: 'Os cursos sugeridos vêm de um acervo de documentos, sempre acompanhados da justificativa e da fonte.',
  },
  {
    titulo: 'Orientação profissional',
    texto: 'Sua pergunta e suas notas orientam a busca dos cursos. Cada pergunta é independente.',
  },
  {
    titulo: 'Próximos passos',
    texto: 'Quando disponíveis, um modelo de linguagem sugere próximos passos conforme o nível estimado.',
  },
] as const

export const COMPROMISSOS = [
  { titulo: 'Autorização explícita', texto: 'Nada é enviado à IA sem a sua autorização, que nunca vem pré-marcada.' },
  { titulo: 'Conferida a cada uso', texto: 'O servidor verifica a autorização antes de cada operação de inteligência artificial.' },
  { titulo: 'Revogável', texto: 'Ao revogar, os resultados são descartados nesta tela. O que já foi enviado pode ter sido processado.' },
  { titulo: 'Sem guardar resultados no navegador', texto: 'Notas, respostas e fontes existem apenas durante a sessão aberta.' },
] as const
