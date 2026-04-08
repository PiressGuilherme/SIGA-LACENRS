# Revisao do Codebase -- Plano de Refatoracao

> Gerado em 2026-04-07. Objetivo: limpar o codebase antes de retomar Fase 6 (Resultados).

---

## Fase 0 -- Fixes Criticos

Coisas que quebram funcionalidades existentes. Devem ser corrigidas antes de qualquer outra mudanca.

### C1: `update_fields` referencia campo inexistente em `ResultadoAmostra`

- **Arquivo:** `backend/apps/resultados/models.py:182`
- **Problema:** `recalcular_resultado_final()` chama `self.save(update_fields=[..., 'atualizado_em'])` mas `ResultadoAmostra` nao tem campo `atualizado_em` -- so tem `confirmado_em`. Django levanta `ValueError` ao confirmar resultado.
- **Fix:** Remover `'atualizado_em'` do `update_fields`. Depois, na R2, adicionar o campo corretamente.
- **Status:** [x] Concluído

### C2: `setShowList(false)` orfao em `criarPlaca()`

- **Arquivo:** `frontend/src/pages/MontarPlaca.jsx:228`
- **Problema:** `criarPlaca()` chama `setShowList(false)` mas o estado `showList` foi removido junto com a UI "Abrir Placa Existente". Gera `ReferenceError` ao clicar "Criar Nova Placa".
- **Fix:** Remover a chamada `setShowList(false)`.
- **Status:** [x] Concluído

### C3: `_resolver_operador` engole erro silenciosamente

- **Arquivo:** `backend/apps/resultados/views.py:26-39`
- **Problema:** Quando um cracha nao e encontrado, a versao em `resultados/views.py` retorna `request.user` silenciosamente (atribuindo a acao ao usuario logado, nao ao operador). A versao em `placas/views.py:36` corretamente retorna `None, None, 'Cracha nao reconhecido...'`.
- **Fix:** Alinhar com a versao de `placas/views.py`. Sera consolidado na R1.
- **Status:** [x] Concluído

---

## Fase 1 -- Backend Cleanups

### R1: Extrair `_noop_ctx` e `_resolver_operador` para modulo compartilhado

- **Esforco:** Pequeno
- **Arquivos afetados:**
  - `backend/apps/placas/views.py:23-41` (definicao original)
  - `backend/apps/resultados/views.py:22-39` (copia com bug C3)
  - `backend/apps/placas/models.py:9` (terceira copia de `_noop_ctx`)
- **Plano:** Criar `backend/apps/utils/auditoria.py` com versoes canonicas. Importar nos 3 arquivos.
- **Status:** [x] Concluído

### R2: Adicionar campo `atualizado_em` em `ResultadoAmostra`

- **Esforco:** Pequeno (1 migracao)
- **Arquivo:** `backend/apps/resultados/models.py`
- **Plano:** Adicionar `atualizado_em = models.DateTimeField(auto_now=True)`. Gerar migracao. Restaurar `'atualizado_em'` no `update_fields` de `recalcular_resultado_final()`. Necessario para Fase 7 (auditoria).
- **Status:** [x] Concluído

### R3: Substituir loops `.save()` por `bulk_update` em `salvar_pocos`

- **Esforco:** Pequeno
- **Arquivo:** `backend/apps/placas/views.py:322` e `perform_destroy:112-118`
- **Problema:** Loop `.save()` por amostra = N+1 writes para placa cheia (ate 94 amostras).
- **Plano:** Substituir por `Amostra.objects.filter(pk__in=ids).update(status=..., atualizado_em=now())`.
- **Status:** [x] Concluído

### R4: Substituir 3 queries OR sequenciais por `Q()` unico

- **Esforco:** Pequeno
- **Arquivo:** `backend/apps/placas/views.py` (`buscar_amostra`, linhas 146-197)
- **Problema:** Ate 3 queries sequenciais por busca: `codigo_interno`, `cod_amostra_gal`, `cod_exame_gal`.
- **Plano:** Unificar com `Q(codigo_interno=c) | Q(cod_amostra_gal=c) | Q(cod_exame_gal=c)`.
- **Status:** [x] Concluído

---

## Fase 2 -- Frontend Cleanups

### R5: Centralizar funcao `api()` em `utils/apiFetch.js`

- **Esforco:** Pequeno
- **Problema:** 7 arquivos definem a mesma funcao `api()`/`apiFetch()` localmente:
  - `MontarPlaca.jsx:97`
  - `MontarPCR.jsx:75`
  - `ConfirmarExtracao.jsx:15`
  - `ConsultarPCR.jsx:21`
  - `ConsultarPlacas.jsx:23`
  - `ImportCSV.jsx:11`
  - `RevisarResultados.jsx:39`
- **Plano:** Criar `frontend/src/utils/apiFetch.js` com versao canonica (inclui suporte a `isMultipart`). Substituir todas as copias locais por import. Remover parametro `csrfToken` morto (D2).
- **Status:** [x] Concluído

### R7: Adicionar `ErrorBoundary` nos entry points React

- **Esforco:** Pequeno
- **Arquivos:** `frontend/src/entries/*.jsx` (8 entry points)
- **Problema:** Qualquer erro JS mata o div inteiro sem feedback para o usuario.
- **Plano:** Criar `frontend/src/components/ErrorBoundary.jsx`. Envolver o componente raiz em cada entry point.
- **Status:** [x] Concluído

---

## Fase 3 -- Refatoracao Grande (pre-Fase 6)

### R6: Extrair hook `usePlacaEditor` e componente `WellGrid`

- **Esforco:** Grande (meio dia)
- **Arquivos:** `MontarPlaca.jsx` (1043 linhas) e `MontarPCR.jsx` (993 linhas)
- **Problema:** ~65% do codigo e duplicado:
  - Constantes: `ROWS`, `COLS`, `ALL_POSITIONS`, `FILL_ORDER`, `FILL_POS`, `TIPO`
  - Funcoes: `emptyGrid`, `gridFromPocos`, `nextEmpty`, `firstEmpty`, `placeControl`, `clearWell`, `clearSelected`, `salvarPlaca`, `salvarComoNova`, `excluirPlaca`, `resetar`
  - UI: grid 8x12, drag-and-drop, multi-select, barra de operador, feedback, scanner
- **Plano:**
  1. Criar `frontend/src/hooks/usePlacaEditor.js` com estado e callbacks compartilhados
  2. Criar `frontend/src/components/plates/WellGrid.jsx` com renderizacao do grid
  3. Criar `frontend/src/components/plates/PlateConstants.js` com constantes compartilhadas
  4. `MontarPlaca.jsx` mantem: logica de grupos, reagentes por grupo, controles automaticos
  5. `MontarPCR.jsx` mantem: rascunho de extracao, submissao ao termociclador, replicata, `tem_resultado`
- **Status:** [x] Concluído

---

## Itens Deferidos (pos-Fase 6)

| Item | Descricao |
|------|-----------|
| R5-N+1 | Otimizar N+1 queries em `_processar_import` (282 queries para placa cheia) |
| Zustand | Pacote instalado mas nao usado; adotar na Fase 8 (Dashboard) para estado global |
| Tab generico | `PlateEditor.jsx` e `PlacaPCREditor.jsx` sao quase identicos; extrair `TabbedEditor` |

---

## Sequencia de Execucao

```
Fase 0: C1 -> C2 -> C3                    (30 min)
Fase 1: R1 -> R2 -> R3 -> R4              (1-2 horas)
Fase 2: R5 -> R7                           (1-2 horas)
Fase 3: R6                                 (meio dia)
                                     Total: ~1 dia
```
