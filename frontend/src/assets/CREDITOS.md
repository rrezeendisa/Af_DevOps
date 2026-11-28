# Créditos e origem dos recursos visuais

Todos os recursos são locais; a aplicação não carrega imagens de URLs externas.

## Imagens incorporadas

Todas foram geradas pelo **ChatGPT em 28/11/2026**, com direção artística definida pela equipe do
projeto. Termos de uso: OpenAI. Os PNG originais ficam fora do repositório, na pasta local da equipe
`Evolia_recursos_originais`.

| Arquivo | Dimensões | Peso | Original | Uso |
| --- | --- | --- | --- | --- |
| `fotos/hero-aprendizado.webp` | 1200×1200 | 173,4 kB | `Emblema Floral de Vidro Neon.png`, 1254×1254 | Hero da landing |
| `fotos/petalas-3d.webp` | 768×768 | 133,4 kB | `logo-evolia.png`, 1254×1254 | Chamada final da landing |
| `marca/simbolo-evolia.webp` | 144×144 | 12,2 kB | `logo-evolia.png` | Assinatura: cabeçalho, rodapé, entrada, barra lateral |
| `marca/favicon-16.png` | 16×16 | 0,9 kB | `logo-evolia.png` | Aba do navegador |
| `marca/favicon-32.png` | 32×32 | 3,1 kB | `logo-evolia.png` | Aba do navegador |
| `marca/favicon-48.png` | 48×48 | 6,1 kB | `logo-evolia.png` | Atalhos |
| `fotos/mascote-evolia.webp` | 640×770 | 94,5 kB | `Robô Mascote Neon Flutuante.png`, 1312×1199 | Seção de IA da landing |
| `fotos/mascote-pensativo.webp` | 480×549 | 60,5 kB | `Robô Mascote Pensativo Flutuante.png`, 1254×1254 (ChatGPT, 28/11/2026): mascote oficial pensando, com interrogação | Processamento no Orientador |
| `fotos/mascote-comemorando.webp` | 560×644 | 73,0 kB | `mascote-tablet.png` (nome do arquivo recebido; mostra o robô comemorando), 1355×1160 | Uso responsável da IA |
| `fotos/experiencia-estudo.webp` | 1586×992, opaca | 178,1 kB | `Estação de Aprendizado Criativo Pastel.png` | Experiência de aprendizagem, quadro maior |
| `fotos/capa-seguranca.webp` | 1280×720, opaca | 83,7 kB | `Segurança Digital no Escritório Moderno.png`, 1672×941 | Experiência de aprendizagem, cartão de segurança |
| `fotos/area-tecnologia.webp` | 1536×1024, opaca | 154,9 kB | `imagem-container-tecnologia.png` | Cartão Tecnologia |
| `fotos/area-comunicacao.webp` | 1672×941, opaca | 114,4 kB | `imagem-container-comunicacao.png` | Cartão Comunicação |
| `fotos/area-logica.webp` | 1672×941, opaca | 111,2 kB | `imagem-container-raciocinio.png` | Cartão Raciocínio lógico |

### Prompts resumidos

- **Estação de aprendizado** (descrição do conteúdo): mulher de blusa verde-lima navegando por um
  catálogo de cursos genérico em um notebook, em escritório com luz lilás. A tela é ilustrativa e não é
  a interface da Evolia.
- **Segurança digital** (descrição do conteúdo): mulher confirmando um acesso pelo celular diante de um
  notebook com um cadeado na tela. Os textos da tela são ilegíveis.

- **Tecnologia** (descrição do conteúdo): jovem de cabelo cacheado, óculos e fones lilás estudando com
  caderno e tablet, em ambiente com luz lilás.
- **Comunicação** (descrição do conteúdo): homem de barba, óculos e blusa roxa sorrindo e
  gesticulando diante de um notebook.
- **Raciocínio lógico** (descrição do conteúdo): mulher de cabelo preso e blusa verde-lima, caneta
  junto ao rosto, com notas adesivas ao fundo.
- **Mascote comemorando** (descrição do conteúdo): o mascote oficial sorrindo, de braços erguidos, com
  três raios lima. Na conversão, a névoa semitransparente ao redor e os pequenos brilhos foram
  removidos, porque viravam mancha no tema escuro.

- **Escultura do hero:** escultura tridimensional de quatro pétalas em vidro iridescente, iluminação
  neon rosa, violeta e lima, anel luminoso e pedestal perolado, com fundo transparente.
- **Símbolo** (descrição da equipe): quatro pétalas em vidro iridescente, vistas de frente, sem
  pedestal e sem anel, com fundo transparente.
- **Mascote** (descrição da equipe): robô tridimensional de corpo perolado, detalhes iridescentes,
  iluminação neon, expressão amigável e símbolo da Evolia no peito, com fundo transparente.

### Tratamento aplicado

Recorte da margem vazia, redimensionamento, remoção do resíduo quase invisível de transparência
(alfa menor que 8) e conversão para WebP ou PNG. No favicon, leve reforço de cor e contraste; a versão
de 16 px redesenha o respiro entre as quatro pétalas. No hero, o brilho fraco junto à linha de corte
foi esmaecido: a imagem é desenhada em duas camadas, cortadas a 74,5% da altura, para só a escultura
levitar. Uma nova versão precisa manter essa faixa livre ou ter o corte ajustado em
`features/landing/EsculturaHero.tsx`.

As fotografias são imagens geradas; não retratam pessoas reais. Nelas não há recorte nem retoque:
apenas conversão para WebP. O enquadramento e os véus são do código (`features/landing/secoes/Areas.tsx`).

Guardados e **não usados**: `Robô Evolia com Tablet Luminoso.png` e `Mascote Robô Iridescente Acenando.png` (desenho diferente do
oficial).

**Mascote:** aparece na landing, no início do colaborador, no Orientador (boas-vindas, processamento e
resposta) e no resultado da avaliação. A pose comemorando é do mesmo personagem.

## Elementos decorativos reutilizáveis

`components/arte/decorativos.ts` registra os elementos que podem flutuar em qualquer tela, e
`Decorativo` os desenha (fora da leitura, do foco e dos cliques; movimento só se permitido). Hoje:
`petalas` e `mascote`. Para acrescentar um, converta para WebP transparente,
registre a origem acima e inclua a entrada no registro.

## Imagens pendentes

Formatos aceitos em `fotos/`: `.avif` ou `.webp`, com o nome abaixo. Sem texto, logotipos ou marcas de
terceiros dentro da imagem. **Registre a origem ao incorporar e defina o texto alternativo no
componente conforme o conteúdo.**

### Outras

| Arquivo | Fundo | Exportar | Observação | Peso máx. |
| --- | --- | --- | --- | --- |
| `capa-tecnologia`, `capa-comunicacao`, `capa-logica` | opaco | 1280×720 | assunto em x 15–85, y 22–78 | 80 kB cada |
| `login-acolhimento` | opaco | 1000×1250 | o espaço será medido no incremento do login | 150 kB |

## Ilustrações

Os SVGs de `src/assets/ilustracoes/` e os componentes de `src/components/arte/` foram criados para a
Evolia neste projeto, sem material de terceiros.
