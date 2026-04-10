# Tratamento de Controles Inválidos — Importação de Resultados PCR

## Visão Geral

O sistema agora permite que operadores importem resultados PCR mesmo quando os controles de qualidade (CP e CN) falham na validação. Isso é útil em cenários onde:

- A corrida teve pequenas falhas nos controles, mas as amostras são viáveis para análise
- É necessário revisar os resultados com sinalização clara de que os controles falharam
- A análise pode prosseguir sob responsabilidade do operador (auditável)

## Fluxo de Importação

### Fase 1: Validação e Detalhes Granulares

Quando o arquivo CSV é enviado:

```
Cliente (React)
  ↓ POST /api/resultados/importar/
  ├─ arquivo
  ├─ placa_id
  ├─ kit_id (opcional)
  └─ forcar_import (false por padrão)
  
Backend (views.py → importar)
  ├─ Parse CSV
  ├─ Carregar kit e criar motor de interpretação
  ├─ motor.validar_cp() → (ok, msg, detalhes_cp)
  ├─ motor.validar_cn() → (ok, msg, detalhes_cn)
  │
  └─ IF (cp_ok=False OR cn_ok=False) AND forcar_import=False:
       RETURN 422 com:
       {
         "erro": "Corrida inválida: ...",
         "cp": "CP inválido — CI (27.00) fora do limiar",
         "cn": "CN válido",
         "cp_detalhes": {
           "CI": {
             "cq": 27.0,
             "cq_str": "27.00",
             "limiar": 25.0,
             "limiar_str": "25.00",
             "operador": "LTE",
             "status": "falha"  ← ❌
           },
           "HPV16": {
             "cq": None,
             "cq_str": "sem amplificação",
             "limiar": 25.0,
             "operador": "LTE",
             "status": "falha"  ← ❌
           }
         },
         "cn_detalhes": { ... },
         "pode_forcar": true
       }
```

### Fase 2: Modal de Confirmação (Frontend)

Quando recebe status 422, o React mostra um modal com:

```
⚠ Controles de Qualidade Inválidos

Detalhes do CP (fundo vermelho):
  • CI: Cq = 27.00 (limiar LTE 25.00) ❌ FALHOU
  • HPV16: sem amplificação (limiar LTE 25.00) ❌ FALHOU

Detalhes do CN (verde se OK):
  • CI: Cq = 15.00 (limiar LTE 25.00) ✓ OK
  • HPV_AR: sem amplificação (limiar SEM_AMP) ✓ OK

[Cancelar] [Ignorar e Importar]
```

### Fase 3: Import Forçado

Se usuário clica "Ignorar e Importar", frontend re-envia com `forcar_import=true`:

```
Backend (views.py → importar com forcar=True)
  ├─ Validações já passaram/falharam (não reverte)
  ├─ _processar_import(cp_ok, cn_ok, ...)
  │  └─ Para cada ResultadoAmostra:
  │     ├─ cp_valido = cp_ok
  │     ├─ cn_valido = cn_ok
  │     └─ motivo_controle_invalido = "CP inválido: ... CN inválido: ..."
  └─ RETURN 201 com resultados processados
      + avisos: ["⚠ IMPORT FORÇADO COM CONTROLES INVÁLIDOS: ..."]
```

## Modelos de Dados

### ResultadoAmostra (novo)

```python
class ResultadoAmostra(models.Model):
    # Campos existentes...
    
    # Novos campos para rastreamento de controles inválidos
    cp_valido = BooleanField(default=True)
      # False se CP falhou na validação mas import foi forçado
    
    cn_valido = BooleanField(default=True)
      # False se CN falhou na validação mas import foi forçado
    
    motivo_controle_invalido = TextField(blank=True)
      # Detalhamento: "CP inválido: CI (27.00) fora do limiar. CN válido."
```

### Serializers (atualizado)

```python
class ResultadoAmostraSerializer(serializers.ModelSerializer):
    fields = (..., 'cp_valido', 'cn_valido', 'motivo_controle_invalido')
    read_only_fields = (..., 'cp_valido', 'cn_valido', 'motivo_controle_invalido')
```

### Engine (atualizado)

```python
def validar_cp(canais: dict) -> tuple[bool, str, dict]:
    # Retorna (ok, msg, detalhes)
    # detalhes = {
    #   'CI': {'cq': 27.0, 'limiar': 25.0, 'operador': 'LTE', 'status': 'falha'},
    #   'HPV16': {...}
    # }

def validar_cn(canais: dict) -> tuple[bool, str, dict]:
    # Mesmo padrão
```

## Tratamentos de Edge Cases e Bugs

### 1. **Imutabilidade com Controles Inválidos**

**Cenário:** Usuário confirma um resultado com controles inválidos, depois tenta importar novamente.

**Tratamento:**
```python
# Em _processar_import, linha 284-286:
if ra.imutavel:
    avisos.append(f'Amostra "{sample_id}": resultado já confirmado — mantido.')
    continue
```

✅ Resultado imutável não é sobrescrito, mesmo se forçado. Avisos informam que foi mantido.

---

### 2. **Classificação com Controles Inválidos**

**Cenário:** CP falhou, mas resultado final é calculado como "hpv_nao_detectado".

**Risco:** Laudos podem estar tecnicamente incorretos.

**Tratamento:**
- Motor de interpretação recebe `cp_valido=False` em `interpretar_amostra()`
- Regras com condição `CP: 'VALIDO'` falham
- Resultado cai para regra padrão ou `REVISAO_MANUAL`
- Resultado final é `'inconclusivo'` ou similar, não um laudo "verde"
- Operador é informado de que precisa revisar manualmente

```python
# Em engine.py, interpretar_amostra:
estado = {
    'CI': 'positivo', 'HPV16': 'negativo', ...,
    'CP': 'INVALIDO' if not cp_valido else 'VALIDO',  # ← Flag
    'CN': 'INVALIDO' if not cn_valido else 'VALIDO',
}
# Regras com {'CP': 'VALIDO'} não casam
```

---

### 3. **Auditoria e Rastreamento**

**Campos de rastreamento:**
- `cp_valido`: False indica que CP foi ignorado
- `cn_valido`: False indica que CN foi ignorado
- `motivo_controle_invalido`: Texto com detalhes
- `atualizado_em`: Timestamp da import forçada
- Django-auditlog registra mudança com flag `forcar_import=true` no request

```python
# Backend captura operador:
operador, actor_ctx, _ = _resolver_operador(request)
with transaction.atomic(), actor_ctx:
    # Auditlog registra quem forçou
    resultado.save()  # Auditado com operador
```

---

### 4. **Controles Inválidos Parciais (CP OK, CN inválido)**

**Cenário:**
```python
cp_ok = True   # CI Cq=20, OK
cn_ok = False  # HPV_AR detectado, deveria ser SEM_AMP
```

**Tratamento:**
- Apenas campos False ficam marcados
- `resultado.cp_valido = True, cn_valido = False`
- Motor recebe estado misto na interpretação
- Regras podem ser configuradas para `CN: 'QUALQUER'` (ignorar CN inválido)

```python
motivo_controle_invalido = "CN inválido: HPV_AR: 5.50 não atende critério"
# CP não é mencionado (está OK)
```

---

### 5. **Re-importação sobre Import Forçado Anterior**

**Cenário:**
1. Import 1: CP falha, forçado com `cp_valido=False`
2. Import 2: Mesmo CSV, sem forçar

**Tratamento:**
```python
# No _processar_import, linha 281-286:
try:
    ra = ResultadoAmostra.objects.get(poco=poco_principal)
    if ra.imutavel:
        avisos.append(...)
        continue
    # ↓ Update sobre resultado anterior
    ra.cp_valido = cp_ok  # Atualiza de False → True
    ra.cn_valido = cn_ok
    ra.motivo_controle_invalido = motivo_controle_invalido
    ra.save()
```

✅ Re-importação limpa os flags de controle inválido se a nova corrida passar na validação.

---

### 6. **Possíveis Bugs Potenciais**

#### **Bug 1: JSON malformado em condicoes de regra**

**Risco:** Regra com JSON inválido causa crash em `interpretar_amostra()`.

**Mitigação (necessária):**
```python
def _match_regra(self, condicoes: dict, estado: dict) -> bool:
    if not isinstance(condicoes, dict):
        logging.error(f"Regra {self.pk}: condicoes não é dict")
        return False
    # ... resto
```

**Implementar:** Validação JSON em `RegraInterpretacao.clean()` ou migration com vaidação retroativa.

---

#### **Bug 2: Limiares CT_LIMIAR = None em RegrasLimiar**

**Risco:** `_avaliar(cq=27.0, limiar.ct_limiar=None)` → operador SEM_AMP comparando float.

**Mitigação (implementada):**
```python
def _avaliar(self, cq, limiar):
    if limiar.operador == 'SEM_AMP':
        return cq is None  # Ignora limiar.ct_limiar
    if cq is None:
        return False
    if limiar.operador == 'LTE':
        return cq <= limiar.ct_limiar  # Safe: cq != None
```

✅ Operador SEM_AMP ignora limiar, outros operadores exigem cq != None.

---

#### **Bug 3: Alvos mapeados errado em frontend**

**Risco:** Kit tem alvo "HPV_NOVO" que não existe em `ALVO_PARA_CAMPO`.

**Mitigação:**
```javascript
// RevisarResultados.jsx
const ALVO_PARA_CAMPO = {
  CI:     'ci_resultado',
  HPV16:  'hpv16_resultado',
  HPV18:  'hpv18_resultado',
  HPV_AR: 'hpvar_resultado',
}

// Ao renderizar célula:
const val = c.key ? resultado[c.key] : null
if (c.key === null) {
  // Coluna sem mapeamento — mostra "—"
}
```

**Melhor:** Adicionar campos dinâmicos a `ResultadoAmostra` ou mudar para `JSONField` com alvos livres.

---

#### **Bug 4: Import forçado sem operador**

**Risco:** `_resolver_operador(request)` retorna None.

**Mitigação (implementada):**
```python
operador, actor_ctx, _err = _resolver_operador(request)
if actor_ctx is None:
    actor_ctx = _noop_ctx()  # Fallback seguro
```

✅ Auditlog é optional; import continua sem ele.

---

#### **Bug 5: Exceção em `_processar_import` com forçado**

**Risco:** Import forçado dispara erro em `poco_map.get()` → transação inteira falha.

**Mitigação (já no código):**
```python
with transaction.atomic(), actor_ctx:
    return self._processar_import(...)  # Dentro de transaction
    # Se erro: rollback tudo, 500 retornado
```

⚠️ **Problema:** HTTP 500 devolve mensagem genérica. Usuário vê "erro ao importar" sem saber por quê.

**Melhor:** Adicionar try/except em `_processar_import`:
```python
try:
    # ... processar
except Poco.DoesNotExist as e:
    return Response({'erro': f'Poço não encontrado: {e}'}, status=400)
```

---

## Verificação End-to-End

### Teste 1: Validação com detalhes

```bash
curl -X POST http://localhost:8000/api/resultados/importar/ \
  -F "arquivo=@cfx_invalid_cp.csv" \
  -F "placa_id=1" \
  -F "kit_id=1"

# Esperado: 422
{
  "erro": "Corrida inválida: ...",
  "cp": "CP inválido — CI (27.00) ...",
  "cp_detalhes": {"CI": {"status": "falha", ...}, ...},
  "pode_forcar": true
}
```

### Teste 2: Forçar import

```bash
curl -X POST http://localhost:8000/api/resultados/importar/ \
  -F "arquivo=@cfx_invalid_cp.csv" \
  -F "placa_id=1" \
  -F "kit_id=1" \
  -F "forcar_import=true"

# Esperado: 201
{
  "mensagem": "N amostras processadas.",
  "avisos": ["⚠ IMPORT FORÇADO COM CONTROLES INVÁLIDOS: ..."],
  "resultados": [
    {
      "id": 1,
      "cp_valido": false,
      "cn_valido": true,
      "motivo_controle_invalido": "CP inválido: CI (27.00) ...",
      "resultado_final": "inconclusivo",  # Não "hpv_nao_detectado"
      ...
    }
  ]
}
```

### Teste 3: Visualização em React

- Modal mostra lista de alvos com Cq vs limiar
- Botão "Ignorar e Importar" envia `forcar_import=true`
- Resultados marcados com ⚠ amarelo
- Tooltip mostra motivo ao passar mouse

---

## Configurações Recomendadas

### No Kit de Interpretação

```
Nome: "IBMP Biomol HPV — Validação Rigorosa"
Alvos:
  - CI (CONTROLE_INTERNO)
    - CP: LTE 25.0
    - CN: LTE 25.0
    - AMOSTRA_POSITIVO: LTE 33.0
  - HPV16 (PATOGENO)
    - CP: LTE 25.0
    - CN: SEM_AMP
    - AMOSTRA_POSITIVO: LTE 40.0

Regras:
  Prioridade 1: CP='INVALIDO' → "Revisão manual (CP inválido)"
  Prioridade 2: CN='INVALIDO' → "Revisão manual (CN inválido)"
  Prioridade 10: CI='positivo' + HPV16='positivo' + CP='VALIDO' → "HPV-16 detectável"
  ...
```

Se configurado assim, um resultado com CP inválido sempre retorna "Revisão manual", mesmo que amostras sejam positivas.

---

## Resumo de Segurança

| Cenário | Proteção |
|---------|----------|
| Resultado imutável é sobrescrito | Validação bloqueia se `imutavel=True` |
| Laudos incorretos com CP inválido | Regras forçam revisão manual quando CP='INVALIDO' |
| Auditoria de quem forçou | django-auditlog registra com operador e `atualizado_em` |
| Re-importação limpa estado | Flags `cp_valido/cn_valido` são atualizados na reimportação |
| Frontend mostra informação errada | Dados vêm do serializer, frontend apenas renderiza |

