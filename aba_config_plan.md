# Plano: Aba Configurações (Reações + Kits + GAL WS)

## Contexto

Atualmente, reagentes PCR (Master Mix 15 uL, Primer Mix 5 uL) e limiares de interpretacao
(Cq CP ≤25, CI ≤33, HPV ≤40 — kit IBMP) sao **hardcoded**. O campo `Poco.grupo` existe no
backend mas nao e exposto no frontend (tudo fica grupo=1).

A aba "GAL WS" (`/gal-ws/`) so e acessivel a superusers e contem 3 sub-abas (Configuracao,
Testar Conexao, Buscar Exames).

**Objetivo:** Substituir a aba "GAL WS" por "Configuracoes" no nav, contendo:
1. **Reacoes** — protocolos de reagentes (nome + volume por reacao), selecionaveis por grupo na placa PCR
2. **Kits de Interpretacao** — limiares de Cq configuraveis, selecionaveis na importacao de resultados
3. **GAL WebService** — sub-abas existentes (sem alteracao funcional)

---

## Fase 1 — Backend: App `configuracoes` + Modelos + API

### 1.1 Criar app `configuracoes`

```
backend/apps/configuracoes/
  __init__.py
  apps.py        → ConfiguracoesConfig
  models.py      → ReacaoProtocolo, ReacaoReagente, KitInterpretacao
  serializers.py
  views.py
  urls.py
  admin.py
  migrations/
```

Registrar `'apps.configuracoes'` em `LOCAL_APPS` (`config/settings/base.py`).

### 1.2 Modelos

```python
class ReacaoProtocolo(models.Model):
    nome        = CharField(max_length=100, unique=True)  # ex: "IBMP HPV Padrao"
    descricao   = TextField(blank=True)
    ativo       = BooleanField(default=True)
    criado_em   = DateTimeField(auto_now_add=True)
    atualizado_em = DateTimeField(auto_now=True)

class ReacaoReagente(models.Model):
    protocolo     = ForeignKey(ReacaoProtocolo, CASCADE, related_name='reagentes')
    nome          = CharField(max_length=100)     # ex: "Master Mix"
    volume_por_reacao = DecimalField(max_digits=7, decimal_places=2)  # uL
    ordem         = PositiveSmallIntegerField(default=0)
    
    class Meta:
        ordering = ['ordem', 'id']
        unique_together = [('protocolo', 'nome')]

class KitInterpretacao(models.Model):
    nome           = CharField(max_length=100, unique=True)  # ex: "IBMP Biomol HPV"
    descricao      = TextField(blank=True)
    ativo          = BooleanField(default=True)
    cq_controle_max    = FloatField(default=25.0)  # CP e CI do CN
    cq_amostra_ci_max  = FloatField(default=33.0)  # CI amostra
    cq_amostra_hpv_max = FloatField(default=40.0)  # HPV amostra
    criado_em      = DateTimeField(auto_now_add=True)
    atualizado_em  = DateTimeField(auto_now=True)
```

### 1.3 Migracao seed

Data migration criando registros padrao:
- `ReacaoProtocolo("IBMP HPV Padrao")` com reagentes: Master Mix 15 uL, Primer Mix 5 uL
- `KitInterpretacao("IBMP Biomol HPV")` com thresholds atuais (25/33/40)

### 1.4 Alteracoes no modelo Placa

Adicionar FK opcional para kit:

```python
# placas/models.py — Placa
kit_interpretacao = ForeignKey(
    'configuracoes.KitInterpretacao', SET_NULL, null=True, blank=True,
    help_text='Kit usado para interpretacao dos resultados desta placa.'
)
```

Novo modelo para associar protocolo por grupo na placa PCR:

```python
# configuracoes/models.py
class PlacaGrupoReacao(models.Model):
    placa      = ForeignKey('placas.Placa', CASCADE, related_name='grupo_reacoes')
    grupo      = PositiveSmallIntegerField()
    protocolo  = ForeignKey(ReacaoProtocolo, PROTECT)
    
    class Meta:
        unique_together = [('placa', 'grupo')]
```

### 1.5 API Endpoints

| Metodo | URL | Descricao |
|--------|-----|-----------|
| GET/POST | `/api/configuracoes/reacoes/` | Listar / criar protocolos |
| GET/PUT/DELETE | `/api/configuracoes/reacoes/{id}/` | Detalhe / editar / excluir protocolo |
| GET/POST | `/api/configuracoes/kits/` | Listar / criar kits |
| GET/PUT/DELETE | `/api/configuracoes/kits/{id}/` | Detalhe / editar / excluir kit |

Reagentes sao nested no serializer do protocolo (create/update em cascata).
Permissoes: `IsAdminUser` (supervisores).

### 1.6 Adaptar parser.py para receber kit

Refatorar funcoes de classificacao para aceitar limiares como parametro:

```python
# Manter constantes como fallback, mas as funcoes recebem kwargs:
def validar_cp(cp_canais, cq_max=CQ_CONTROLE_MAX): ...
def validar_cn(cn_canais, cq_max=CQ_CONTROLE_MAX): ...
def classificar_canal(cq_values, canal, cq_ci_max=CQ_AMOSTRA_CI_MAX, cq_hpv_max=CQ_AMOSTRA_HPV_MAX): ...
```

Na view `importar()`, carregar o kit da placa e passar os limiares.

---

## Fase 2 — Frontend: Pagina Configuracoes

### 2.1 Novo entry point

```
frontend/src/entries/configuracoes.jsx  → monta <Configuracoes /> em #configuracoes-app
frontend/src/pages/Configuracoes.jsx    → pagina com 3 abas
```

### 2.2 Abas

| Aba | Conteudo |
|-----|----------|
| Reacoes | CRUD de protocolos: nome, descricao, tabela de reagentes inline (nome + volume). Botao "+ Reagente" |
| Kits de Interpretacao | CRUD de kits: nome, descricao, 3 campos de Cq threshold |
| GAL WebService | Importar componentes existentes de `GalWs.jsx` (TabConfiguracao, TabTestarConexao, TabBuscarExames) |

### 2.3 Template Django

Novo template `backend/templates/configuracoes/index.html` (copia padrao do gal_ws).

### 2.4 URL

- Pagina: `/configuracoes/` → `ConfiguracoesPageView` (requires `is_staff`)
- Redirecionar `/gal-ws/` para `/configuracoes/` (ou manter ambas)

### 2.5 Navegacao

- `base.html`: trocar link "GAL WS" por "Configuracoes" (apontar para `/configuracoes/`)
- `home.html`: trocar card "GAL WebService" por "Configuracoes" no bloco Administracao

---

## Fase 3 — Integracao PCR (MontarPCR.jsx)

### 3.1 Carregar protocolos

No mount, `GET /api/configuracoes/reacoes/?ativo=true` para listar protocolos disponiveis.

### 3.2 Seletor de protocolo por grupo

- Acima do grid, dropdown "Protocolo do Grupo 1: [IBMP HPV Padrao v]"
- Se houver mais de 1 grupo, mostrar dropdowns adicionais
- A feature de grupo ja tem o campo `Poco.grupo` — mas o frontend nao expoe (tudo = grupo 1). Para a primeira versao, manter grupo unico e seletor simples de protocolo.

### 3.3 Calculo de reagentes dinamico

Substituir `REAGENTES` hardcoded por dados do protocolo selecionado:

```js
// Antes (hardcoded):
const REAGENTES = [{ nome: 'Master Mix', vol: 15 }, { nome: 'Primer Mix', vol: 5 }]

// Depois (do protocolo selecionado):
const reagentes = protocoloSelecionado?.reagentes || []
```

### 3.4 Salvar associacao no backend

Ao salvar a placa PCR, enviar `protocolo_id` por grupo. API `salvar-pocos` ou endpoint separado `PlacaGrupoReacao`.

---

## Fase 4 — Integracao Resultados (RevisarResultados.jsx)

### 4.1 Seletor de kit na importacao

Antes de importar o CSV, mostrar dropdown "Kit de Interpretacao: [IBMP Biomol HPV v]".
Se a placa ja tem `kit_interpretacao`, pre-selecionar.

### 4.2 Enviar kit_id no import

```js
form.append('kit_id', kitSelecionado.id)
```

### 4.3 Backend usa kit

Na view `importar()`:
1. Receber `kit_id` do request
2. Carregar `KitInterpretacao` ou usar defaults
3. Passar limiares para `validar_cp()`, `validar_cn()`, `classificar_canal()`
4. Salvar `placa.kit_interpretacao = kit`

---

## Arquivos Criticos

| Arquivo | Acao |
|---------|------|
| `backend/apps/configuracoes/` (NOVO) | App inteiro: models, views, serializers, urls, admin |
| `backend/apps/configuracoes/migrations/0001_initial.py` | Modelos + seed |
| `backend/apps/placas/models.py` | Adicionar FK `kit_interpretacao` em Placa |
| `backend/apps/placas/migrations/` | Nova migracao |
| `backend/apps/resultados/parser.py` | Parametrizar limiares nas funcoes |
| `backend/apps/resultados/views.py` | Receber kit_id, carregar limiares, passar ao parser |
| `backend/config/settings/base.py` | Registrar app em LOCAL_APPS |
| `backend/config/urls.py` | Registrar URLs da nova app |
| `frontend/src/entries/configuracoes.jsx` (NOVO) | Entry point React |
| `frontend/src/pages/Configuracoes.jsx` (NOVO) | Pagina com abas |
| `frontend/src/pages/GalWs.jsx` | Exportar sub-componentes para reuso |
| `frontend/src/pages/MontarPCR.jsx` | Carregar protocolos, seletor, reagentes dinamicos |
| `frontend/src/pages/RevisarResultados.jsx` | Seletor de kit na importacao |
| `backend/templates/configuracoes/index.html` (NOVO) | Template Django |
| `backend/templates/base.html` | Nav: GAL WS → Configuracoes |
| `backend/templates/home.html` | Card: GAL WS → Configuracoes |

---

## Sequencia de Execucao

```
Fase 1: models → migrations → seed → serializers → views → urls → admin    (backend)
Fase 2: entry + page + template → nav updates                               (frontend + templates)
Fase 3: MontarPCR protocolo selector + reagentes dinamicos                   (frontend + API)
Fase 4: RevisarResultados kit selector + parser parametrizado                (frontend + backend)
```

## Verificacao

1. `python manage.py makemigrations configuracoes` + `migrate` — sem erros
2. `python manage.py test` — 36 testes existentes passam
3. Acessar `/configuracoes/` como superuser — 3 abas funcionam
4. Aba Reacoes: criar/editar/excluir protocolo com reagentes
5. Aba Kits: criar/editar kit com limiares
6. Aba GAL WS: mesma funcionalidade que antes
7. MontarPCR: selecionar protocolo → reagentes atualizam dinamicamente
8. RevisarResultados: selecionar kit → importar CSV → classificacao usa limiares do kit
