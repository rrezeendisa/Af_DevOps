# Pendências conhecidas do frontend

## Teste potencialmente instável

- **Teste:** `src/features/cursos/cursos.test.tsx` → “lista os cursos reais para ADMIN”.
- **Ocorrência:** falhou uma vez na suíte completa, em 28/11/2026, durante a validação do Incremento 0
  do Design 2.0 (521 de 522).
- **Depois:** passou isolado (18 de 18) e em três execuções completas seguidas (522 de 522).
- **Causa:** não comprovada. A lógica do teste não foi alterada.
- **Se voltar a ocorrer:** guardar a saída completa da execução antes de repetir.
