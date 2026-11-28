# Evolia: design system

*Inteligência que desenvolve pessoas.*

A interface da Evolia é corporativa e institucional, mas também moderna, amigável e com
personalidade. Ela **não** deve parecer um painel genérico gerado por IA: nada de gradientes
chamativos, cards idênticos em grade, ícones decorativos sem função ou roxo dominante. Toda a
interface fica em português brasileiro.

## 1. Paleta oficial e papéis

| Cor | Hex | Papel |
| --- | --- | --- |
| Pastel Lilac | `#EFD2FE` | **Protagonista**: superfícies suaves, item selecionado, áreas institucionais, realces de marca |
| Pink Sherbet | `#F170C3` | **Protagonista**: ações principais e destaques, **sempre com texto escuro** |
| Citrus Lime | `#E2E585` | **Protagonista complementar**: indicadores, *badges*, marcações e elementos gráficos |
| Deep Plum | `#521256` | **Somente detalhes**: ícones, contornos finos, foco (light), traço do símbolo |

Lilás, rosa e verde-lima dão a cara da Evolia e precisam aparecer em todas as telas principais.

**Deep Plum é proibido** como fundo de página, sidebar, header, card grande, botão
preenchido ou cor dominante. No dark mode, ele só aparece **sobre superfícies claras** (lilás ou
lima), porque sobre o fundo escuro o contraste é de 1,38:1.

## 2. Tokens semânticos

Os tokens ficam em `frontend/src/styles` como variáveis CSS, consumidas pelo Tailwind v4
(`@theme`) e pelo shadcn/ui. Componentes **nunca** usam hex diretamente, só tokens.

| Token | Light | Dark | Uso |
| --- | --- | --- | --- |
| `--background` | `#FAF8F5` | `#17131B` | Fundo da página |
| `--surface` | `#FFFFFF` | `#211D25` | Cards, tabelas, painéis |
| `--surface-2` | `#F8EDFE` | `#2A2630` | Superfície elevada ou alternada (light: lilás bem claro) |
| `--foreground` | `#211C26` | `#F4F1F6` | Texto principal |
| `--muted-foreground` | `#625A69` | `#B9B2BF` | Texto secundário, legendas |
| `--border` | `#E8E2EC` | `#332E39` | Divisórias **decorativas** |
| `--input-border` | `#8A8290` | `#7A7381` | Contorno de campos e controles (exige 3:1) |
| `--primary` | `#F170C3` | `#F170C3` | Botão e ação principal |
| `--primary-foreground` | `#211C26` | `#211C26` | Texto sobre o primary |
| `--accent` | `#EFD2FE` | `#EFD2FE` | Seleção, *chips*, área institucional |
| `--accent-foreground` | `#211C26` | `#211C26` | Texto sobre o accent |
| `--highlight` | `#E2E585` | `#E2E585` | Indicadores e *badges* complementares |
| `--highlight-foreground` | `#211C26` | `#211C26` | Texto sobre o highlight |
| `--brand-detail` | `#521256` | `#EFD2FE` | Ícones de marca, contornos finos |
| `--ring` | `#521256` | `#EFD2FE` | Anel de foco |
| `--simbolo-detalhe` | `#521256` | `#F4F1F6` | Quarta pétala do símbolo |
| `--selected` | `#EFD2FE` | `#342C3B` | Fundo do item ativo na navegação (dark: grafite com indicador lilás) |
| `--destructive` | `#B42318` | `#FF8A80` | Erros e ações destrutivas |
| `--destructive-foreground` | `#FFFFFF` | `#211C26` | Texto sobre o destructive |
| `--success` | `#2F6B2F` | `#8FD18F` | Texto e ícone de sucesso |
| `--warning` | `#8A5A00` | `#F2B84B` | Texto e ícone de atenção |

**Dark mode:** a base é grafite neutro (`#17131B`, `#211D25`, `#2A2630`), com texto claro e acentos
em lilás, rosa e lima. O roxo nunca predomina. O tema segue `prefers-color-scheme` por padrão, e a
escolha do usuário fica salva no `localStorage` (`evolia:tema`). Além dela, só existe o marcador de logout
não confirmado (API_CONTRACTS.md, seção 6).

## 3. Contraste verificado

Os valores foram **calculados** com a fórmula de luminância relativa da WCAG 2.x
(sRGB linearizado, `(L1 + 0,05) / (L2 + 0,05)`). Metas: texto normal 4,5:1, texto grande 3:1,
componentes de interface e foco 3:1.

### Light

| Primeiro plano | Fundo | Razão | Resultado |
| --- | --- | --- | --- |
| `#211C26` texto | `#FFFFFF` surface | 16,68 | ✅ |
| `#211C26` texto | `#FAF8F5` background | 15,74 | ✅ |
| `#211C26` texto | `#F170C3` primary | 6,23 | ✅ **botão primário** |
| `#211C26` texto | `#EFD2FE` lilac | 12,17 | ✅ |
| `#211C26` texto | `#E2E585` lime | 12,54 | ✅ |
| `#211C26` texto | `#F8EDFE` surface-2 | 14,73 | ✅ |
| `#625A69` secundário | `#FFFFFF` / `#FAF8F5` / `#EFD2FE` | 6,59 / 6,22 / 4,81 | ✅ |
| `#521256` plum | `#FFFFFF` / `#FAF8F5` | 13,29 / 12,54 | ✅ foco e ícones |
| `#521256` plum | `#EFD2FE` / `#E2E585` / `#F170C3` | 9,70 / 9,99 / 4,97 | ✅ |
| `#8A8290` input-border | `#FFFFFF` / `#FAF8F5` | 3,70 / 3,49 | ✅ (3:1) |
| `#B42318` destructive | `#FFFFFF` / `#FAF8F5` | 6,57 / 6,20 | ✅ |
| `#FFFFFF` texto | `#B42318` destructive | 6,57 | ✅ |
| `#2F6B2F` success | `#FFFFFF` / `#FAF8F5` | 6,43 / 6,07 | ✅ |
| `#8A5A00` warning | `#FFFFFF` / `#FAF8F5` | 5,93 / 5,59 | ✅ |
| `#FFFFFF` texto | `#F170C3` | 2,68 | ❌ **proibido** |
| `#F170C3` como texto ou borda | `#FFFFFF` / `#FAF8F5` | 2,68 / 2,52 | ❌ **proibido** como texto, ícone isolado ou único indicador de estado |
| `#E2E585` ou `#EFD2FE` como texto | `#FFFFFF` | 1,33 / 1,37 | ❌ **proibido** (só como fundo com texto escuro) |

### Dark

| Primeiro plano | Fundo | Razão | Resultado |
| --- | --- | --- | --- |
| `#F4F1F6` texto | `#17131B` / `#211D25` / `#2A2630` | 16,38 / 14,80 / 13,23 | ✅ |
| `#B9B2BF` secundário | `#17131B` / `#211D25` / `#2A2630` | 8,89 / 8,04 / 7,18 | ✅ |
| `#F170C3` pink | `#17131B` / `#211D25` / `#2A2630` | 6,85 / 6,19 / 5,53 | ✅ pode ser texto ou acento |
| `#EFD2FE` lilac | `#17131B` / `#211D25` / `#2A2630` | 13,38 / 12,09 / 10,80 | ✅ foco e detalhes |
| `#E2E585` lime | `#17131B` / `#211D25` / `#2A2630` | 13,78 / 12,45 / 11,13 | ✅ |
| `#F4F1F6` / `#EFD2FE` | `#342C3B` selected | 11,95 / 9,76 | ✅ |
| `#7A7381` input-border | `#17131B` / `#211D25` / `#2A2630` | 4,01 / 3,63 / 3,24 | ✅ (3:1) |
| `#FF8A80` destructive | `#17131B` / `#211D25` | 8,03 / 7,26 | ✅ |
| `#211C26` texto | `#FF8A80` | 7,31 | ✅ |
| `#8FD18F` success | `#17131B` / `#211D25` | 10,20 / 9,22 | ✅ |
| `#F2B84B` warning | `#17131B` / `#211D25` | 10,24 / 9,26 | ✅ |
| `#521256` plum | `#17131B` | 1,38 | ❌ **proibido** no fundo escuro |

Ao criar ou alterar um token, recalcule e atualize esta tabela.

## 4. Tipografia

- **Fraunces** (serifada expressiva): só no título de página (h1), no título de seção (h2), no
  logotipo e em chamadas institucionais curtas. Nunca em formulários, tabelas, botões ou navegação.
- **Inter**: todo o resto (texto, formulários, tabelas, navegação, *badges*, botões).
- As fontes são auto-hospedadas via `@fontsource-variable/fraunces` e `@fontsource-variable/inter`.
  Sem CDN externo.

| Papel | Fonte | Tamanho / altura de linha | Peso |
| --- | --- | --- | --- |
| Display (boas-vindas) | Fraunces | 36/44 | 600 |
| h1 | Fraunces | 30/38 | 600 |
| h2 | Fraunces | 22/30 | 600 |
| h3 | Inter | 18/26 | 600 |
| Corpo | Inter | 16/24 | 400 |
| Pequeno / legenda | Inter | 14/20 | 400–500 |
| Rótulo de campo | Inter | 14/20 | 500 |

Use valores numéricos tabulares (`font-variant-numeric: tabular-nums`) em tabelas e contagens.

## 5. Espaço, forma e profundidade

- Espaçamento em escala de 4 px (4, 8, 12, 16, 24, 32, 48, 64). O *padding* de card é 24 px no desktop e 16 px no mobile.
- Raios: 10 px (campos, botões e itens de navegação), 16 px (cards), 24 px (banner), 32 px (painel do login), 9999 px (*chips*, *badges* e avatar).
- Sombras discretas: `0 1px 2px rgb(33 28 38 / 0.06)` e `0 4px 12px rgb(33 28 38 / 0.08)` (elevação).
  No dark, a elevação vem da superfície mais clara, não de sombra.
- Largura de leitura de 72ch para textos longos (orientação da IA, descrições).
- Responsivo, com *breakpoints* do Tailwind: abaixo de `md`, a navegação vira menu recolhível; acima de `lg`, a sidebar fica fixa.

## 6. Marca

- **Símbolo:** quatro pétalas orgânicas ao redor de um centro comum, representando conexão,
  conhecimento, crescimento e evolução contínua. É um SVG inline (`src/assets`), com `aria-hidden`
  quando acompanhado do nome.
- **Versão colorida** (`SimboloEvolia`, também no favicon): quatro pétalas com três cantos arredondados
  e a ponta voltada para o centro, separadas por um respiro fino. Lilás no alto à esquerda, rosa no alto
  à direita, lima embaixo à direita e plum embaixo à esquerda. No escuro, a pétala plum vira off-white
  (`--simbolo-detalhe`), porque plum sobre grafite fica em 1,38:1.
- **Versão monocromática:** `currentColor`.
- **Logotipo** (`MarcaEvolia`): símbolo + “Evolia” em **Fraunces 600**, com *tracking* levemente
  fechado. O slogan, em Inter, aparece na tela de entrada e no cartão institucional do início.
- **Formas orgânicas** (`FormasOrganicas`): um círculo rosa e um círculo lima sobreposto, **sempre inteiros**, nunca recortados pelo contêiner.
  É a assinatura gráfica da marca, usada **somente** no banner do início e no painel do login, sempre com
  `aria-hidden`. No banner, somem em telas estreitas; no login, aparecem menores na faixa de marca.
- **Área de respiro** mínima igual à largura de uma pétala. Tamanho mínimo do símbolo: 24 px.

## 7. Layout e componentes

- **Shell** (`AppShell`):
  - Sidebar clara de 280 px (`--surface`), com a marca no topo, o rótulo de seção “PLATAFORMA” em
    maiúsculas pequenas e esmaecidas, os itens gerados da tabela de rotas e “Sair” no rodapé.
  - O item ativo é uma **pílula** `--selected` (lilás no claro, `#342C3B` no escuro), com
    `aria-current="page"`. Os ícones da navegação usam `--brand-detail` (plum no claro, lilás no escuro).
  - Abaixo de `lg`, a sidebar vira um painel lateral (`Sheet`) aberto pelo botão “Abrir menu”.
  - Cabeçalho: breadcrumbs “Evolia / Página”, alternador de tema e avatar circular lilás que abre o
    menu do usuário (nome, tipo de conta e Sair).
  - Nunca usar sidebar escura ou plum.
- **Início:**
  - Banner lilás (no escuro, `--surface-2` com borda lilás fina), com título em Fraunces Bold e
    subtítulo em Inter, por tipo de conta.
  - “Acesso rápido”: cartões brancos com ladrilho colorido (rosa, lima ou lilás) e ícone escuro,
    gerados da tabela de rotas. As telas pendentes levam o badge “Em desenvolvimento”.
  - Cartão institucional com o slogan.
- **Telas pendentes:** cabeçalho, badge “Em desenvolvimento” e estado vazio explicativo, sem nenhum dado simulado.
- **Cartão de curso** (`CartaoCurso`):
  - Cartão branco com *chip* de categoria em `--surface-2` e badge de nível (Básico em lilás,
    Intermediário em lima, Avançado em rosa, sempre com texto escuro).
  - Nome em Inter 600, que é um link e torna o cartão inteiro clicável, e descrição em até 3 linhas.
  - Carga horária com ícone `Clock` em `--brand-detail`.
  - **Sem imagem, progresso, matrícula ou certificado.**
- **Tabelas** (colaboradores e treinamentos):
  - Contêiner com borda e raio de 16 px, cabeçalho em `--surface-2` com rótulos em maiúsculas pequenas.
  - A primeira coluna é `<th scope="row">` com link para o detalhe.
  - Rolagem horizontal no mobile, `caption` só para leitores de tela e números em `tabular-nums`.
- **Busca e filtros** (`BarraFiltros`): cartão com busca e dois `SelectNativo`, cujas opções vêm dos
  dados reais. O contador “X de Y” usa `aria-live="polite"`. O resultado vazio oferece “Limpar filtros”.
- **Formulários** (`Campo`):
  - Rótulo visível, erro e ajuda ligados por `aria-describedby`.
  - Os cadastros abrem num `Sheet` lateral, com o título em Fraunces.
  - Erros de conflito (409) aparecem no campo correspondente, com foco nele.
- **Status de treinamento:**

  | Status | Badge | Ícone |
  | --- | --- | --- |
  | Pendente | lilás | `Clock` |
  | Concluído | lima | `CircleCheck` |
  | Falhou | contorno de erro | `CircleX` |

  Enquanto houver pendentes, um texto discreto avisa que a lista se atualiza sozinha.
- **Panorama do ADMIN:**
  - Três indicadores com o total real em Inter 600, ícone em `--brand-detail` e link para a tela.
    Cada indicador tem o próprio carregamento e o próprio erro.
  - A distribuição por status é uma barra empilhada fina (lilás, lima e o tom de erro), apenas
    decorativa. **Os números absolutos e percentuais ficam sempre em texto.**
  - Sem gráficos adicionais, tendências ou métricas que a API não fornece.
- **Funcionalidades de IA do colaborador:**
  - **Escala de notas:**
    - `fieldset` com cinco rádios nativos estilizados como pílulas de 48 px. A opção escolhida fica rosa com texto escuro.
    - Legenda “1 = pouco desenvolvida · 5 = muito desenvolvida”.
    - Nenhuma nota vem pré-selecionada.
  - **Nível estimado** (`NivelCompetencia`):
    - Texto “Intermediário (nível 2 de 3)” e três barras decorativas.
    - **Sem percentual, precisão ou confiança.**
    - Sempre acompanhado de “Estimativa do modelo… não representa avaliação de desempenho” e da
      diferença em relação aos níveis do catálogo.
  - **Bloqueio por consentimento:** cartão com ícone em ladrilho lilás e o link “Revisar consentimento”.
    O aviso de descarte deixa claro que o servidor pode ter processado solicitações já enviadas.
  - **Recomendações e orientação:**
    - Códigos do acervo em `<code>` e fontes como lista de texto.
    - Os próximos passos ficam num bloco lilás (grafite no escuro) com o selo rosa “Gerado por IA”, só quando existem.
    - O processamento mostra “pode levar até 90 segundos” e o botão “Cancelar espera”.
- **Painel do colaborador:** cartões “Uso da IA” (estado real do servidor) e “Sua classificação”
  (apenas a estimativa desta sessão).
- **Botões:**
  - Primário: `--primary` com texto `--primary-foreground`
  - Secundário: `--accent` com texto escuro
  - Fantasma: transparente com texto `--foreground`
  - Destrutivo: `--destructive`
  - Link: texto `--foreground` com sublinhado rosa. **Nunca** texto rosa sobre fundo claro (2,68:1).
  - Altura padrão de **40 px** (`sm` 36 px, `lg` 44 px, ícone 40×40) e raio de 10 px.
  O botão primário vale como “ação principal”, **no máximo um por área**.
- **Campos:** rótulo visível acima, contorno `--input-border`, ajuda e erro abaixo, ligados por
  `aria-describedby`. O erro tem ícone + texto, não depende só da cor.
- ***Badges* de status:**

  | Status | Fundo | Texto | Ícone |
  | --- | --- | --- | --- |
  | `PENDENTE` | `--accent` | escuro | `Clock` |
  | `CONCLUIDO` | `--highlight` | escuro | `CheckCircle2` |
  | `FALHOU` | contorno `--destructive` | `--destructive` | `XCircle` |

  Os níveis de curso (`BASICO`, `INTERMEDIARIO`, `AVANCADO`) e de competência (`INICIANTE`,
  `INTERMEDIARIO`, `AVANCADO`) usam rótulos legíveis (“Básico”, “Intermediário”...) e nunca o enum cru.
- **Tabelas:** cabeçalho com `scope`, zebra em `--surface-2`, rolagem horizontal no mobile e estado vazio dentro da tabela.
- **Estados:**
  - Carregando: *skeleton* discreto, sem *spinner* infinito sem texto
  - Vazio: ilustração mínima ou ícone, frase honesta e ação possível
  - Erro: mensagem pelo `codigo` (ver API_CONTRACTS.md) e “Tentar novamente” quando fizer sentido
  - Sucesso: *toast* curto com `role="status"`
- **IA:** respostas em bloco de leitura, com rótulo “Gerado por IA” nos `proximosPassos`, fontes listadas
  como texto e aviso quando os próximos passos não estiverem disponíveis (sem tratar como erro).
- **Gráficos** (Recharts, só com dados reais): cores lilás, rosa e lima, com rótulos diretos e uma
  tabela ou texto alternativo equivalente.
- **Ícones:** Lucide, 16–20 px, traço 1,75–2, com `aria-hidden` quando acompanhados de texto e `aria-label` quando sozinhos.

## 8. Acessibilidade (meta: WCAG 2.2 AA)

- **Foco visível:** anel de 2 px `--ring` com *offset* de 2 px. Nunca remover `outline` sem substituto.
  O foco não pode ficar encoberto por cabeçalho fixo (2.4.11).
- **Teclado:** todo fluxo funciona sem mouse, sem armadilhas de foco. Diálogos prendem e devolvem o foco.
- **Navegação:** *skip link* “Ir para o conteúdo”, foco movido para o h1 ao trocar de rota, e `<title>` por página.
- **Alvo mínimo** de 24×24 px (2.5.8). Em botões, prefira 40 px de altura.
- **Cor:** a cor nunca é o único indicador, e status sempre vêm com texto ou ícone.
- **Movimento:** respeitar `prefers-reduced-motion`. Sem animação decorativa.
- **Formulários:** erros anunciados (`aria-live="polite"` no resumo), sem placeholder no lugar
  do rótulo. Campos de senha com opção “mostrar senha” e `autocomplete` adequado.
- **Conteúdo dinâmico:** respostas da IA e resultados de operações anunciados com `role="status"`.
- `lang="pt-BR"` no documento.
- Testar com `eslint-plugin-jsx-a11y`, consultas por papel no Testing Library e uma
  verificação manual com teclado e leitor de tela.

## 9. Voz e microtexto

- Tom claro, cordial e direto, com tratamento por “você”. Sem jargão técnico na interface (nada de
  “HTTP 503”, mas sim “Serviço temporariamente indisponível”).
- Verbos de ação nos botões: “Cadastrar curso”, “Criar conta”, “Solicitar treinamento”, “Autorizar uso da IA”.
- Datas em pt-BR (`27/11/2026 14:30`) e números com separador brasileiro.
- Sobre a IA, ser transparente: deixar claro que as recomendações são sugestões geradas por modelo e
  que o consentimento pode ser revogado a qualquer momento.

## 10. Tema e inicialização

- A preferência fica em `localStorage['evolia:tema']` = `claro | escuro | sistema`. É a única
  preferência persistida; a outra chave é o marcador de logout (API_CONTRACTS.md, seção 6). Valor inválido ou armazenamento indisponível caem para `sistema`.
- Na primeira visita vale `sistema`, que segue `prefers-color-scheme` e acompanha mudanças do sistema
  enquanto for a preferência ativa.
- Para evitar troca brusca de tema na inicialização, um script inline no `<head>` de `index.html`
  aplica `.dark` e `color-scheme` antes do primeiro *paint*. A lógica repete `src/lib/tema.ts`:
  mantenha os dois em sincronia.
- As transições de cor ficam desativadas durante a troca (classe `sem-transicao`).
- O build da imagem calcula o hash do script de tema a partir do HTML final
  e o inclui em `script-src` no Nginx. A política autoriza estilos inline
  apenas em elementos `<style>`, usados pelo Radix para os diálogos e o menu
  mobile. Atributos de estilo inline e scripts inline sem hash ficam bloqueados.
  O frontend configura o Zod antes de carregar os esquemas para evitar a
  compilação dinâmica via `eval`. As regras de validação continuam as mesmas.
