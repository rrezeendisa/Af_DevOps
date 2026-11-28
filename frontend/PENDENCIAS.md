# Pendências conhecidas do frontend

## Teste potencialmente instável

- **Teste:** `src/features/cursos/cursos.test.tsx` → “lista os cursos reais para ADMIN”.
- **Ocorrência:** falhou uma vez na suíte completa, em 28/11/2026, durante a validação do Incremento 0
  do Design 2.0 (521 de 522).
- **Depois:** passou isolado (18 de 18) e em três execuções completas seguidas (522 de 522).
- **Causa:** não comprovada. A lógica do teste não foi alterada.
- **Se voltar a ocorrer:** guardar a saída completa da execução antes de repetir.

### Nova ocorrência (Incremento 2, 28/11/2026)

Na primeira execução completa falharam, por elemento não encontrado a tempo (cerca de 1,1 s):

- `cursos.test.tsx` → “lista os cursos reais para ADMIN” (o mesmo de antes);
- `contas.test.tsx` → “envia exatamente o contrato com CSRF, limpa a senha durante o envio e mostra o resultado sem senha”.

Os dois passaram isolados (43 de 43) e em três execuções completas seguidas (542 de 542). A causa
continua não comprovada; os testes não foram alterados.

### Instabilidade mais ampla observada no fim do Incremento 2

Em execuções completas da suíte, testes diferentes falharam de forma intermitente:

- “lista os cursos reais para ADMIN” (de novo; a saída dessa vez não foi guardada);
- “mostra os totais reais das três listas” (`painel.test.tsx`);
- “tem um único h1, as seções na ordem planejada e âncoras válidas” (`secoes.test.tsx`, criado no
  Incremento 2).

As durações das falhas ficaram entre 1,1 e 1,6 s, e o prazo padrão de espera do Testing Library é
1 s. Isso sugere espera curta sob carga com páginas carregadas sob demanda, mas **não está provado**.
Nenhum teste nem a configuração foram alterados.

### Investigação e ajuste (28/11/2026)

**Evidências**, com a suíte de 542 testes em máquina de 8 núcleos já carregada por outros programas:

| Processos paralelos | Falhas | Testes acima de 1 s | Teste mais lento |
| --- | --- | --- | --- |
| 2 (`--maxWorkers=2`) | 0 | 2 | 1,75 s |
| 7 (padrão) | 5 | 38 | 3,19 s |

As cinco falhas foram “elemento não encontrado” entre 1,4 e 1,7 s, na primeira renderização de
páginas carregadas sob demanda. Conclusão: contenção de CPU torna o prazo padrão de 1 s curto.
Animações não explicam (o jsdom não as executa nem tem `IntersectionObserver`), e não houve sinal de
vazamento entre testes.

**Ajuste:** `asyncUtilTimeout: 3000` em `src/test/setup.ts`. Nenhum teste, asserção, paralelismo ou
prazo de produção mudou. `vi.waitFor` e o limite por teste (5 s) seguem no padrão.

**Depois:** cinco execuções completas seguidas, 542 de 542, entre 25 e 28 s. Sob carga muito maior
que a dessas execuções, o problema ainda pode reaparecer.
