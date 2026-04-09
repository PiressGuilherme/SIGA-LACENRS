"""
Parser do CSV de resultados do CFX Manager (Bio-Rad) e lógica de classificação IBMP.

Formato do CSV (CFX Manager 3.x):
  - Cabeçalho com metadados (key,value) até a linha de dados
  - Linha de cabeçalho dos dados: Well,Fluor,Target,Content,Sample,Cq,...
  - Múltiplas linhas por amostra (replicatas técnicas × canais)

Mapeamento de canais:
  - Cy5  / CI      → CI
  - FAM  / HPV 16  → HPV16
  - ROX  / HPV AR  → HPV_AR
  - VIC  / HPV-18  → HPV18

Content types:
  - Unkn      → amostra (Sample = codigo_interno, ex: 1/26)
  - Neg Ctrl  → cn
  - Pos Ctrl  → cp

Critérios IBMP Biomol:
  - CP: todos os 4 canais devem ter Cq ≤ 25
  - CN: CI deve ter Cq ≤ 25; nenhum HPV deve amplificar
  - Amostra HPV: positivo se Cq ≤ 40 em qualquer replicata
  - Amostra CI: positivo (CI válido) se Cq ≤ 33 em qualquer replicata
  - Resultado final: HPV detectado / não detectado / inválido (CI falhou e nenhum HPV)
"""
import csv
import io
from typing import Optional

# ── Normalização de canais ────────────────────────────────────────────────────
TARGET_CANAL_MAP: dict[str, str] = {
    'CI':      'CI',
    'HPV 16':  'HPV16',
    'HPV-16':  'HPV16',
    'HPV16':   'HPV16',
    'HPV 18':  'HPV18',
    'HPV-18':  'HPV18',
    'HPV18':   'HPV18',
    'HPV AR':  'HPV_AR',
    'HPV-AR':  'HPV_AR',
    'HPV_AR':  'HPV_AR',
}

CONTENT_TYPE_MAP: dict[str, str] = {
    'Unkn':     'amostra',
    'Neg Ctrl': 'cn',
    'Pos Ctrl': 'cp',
}

_CANAIS = ('CI', 'HPV16', 'HPV18', 'HPV_AR')

# ── Limiares IBMP ─────────────────────────────────────────────────────────────
CQ_CONTROLE_MAX    = 25.0   # CP e CI do CN: Cq ≤ 25
CQ_AMOSTRA_CI_MAX  = 33.0   # Amostra CI: Cq ≤ 33 valida negatividade
CQ_AMOSTRA_HPV_MAX = 40.0   # Amostra HPV: Cq ≤ 40 → positivo


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_cq(val: str) -> Optional[float]:
    """Converte string de Cq para float; retorna None se NaN ou inválido."""
    if not val or val.strip().upper() == 'NAN':
        return None
    try:
        return float(val.strip())
    except ValueError:
        return None


def _cq_min(values: list) -> Optional[float]:
    """Menor Cq válido entre as replicatas; None se todas forem None."""
    validos = [v for v in (values or []) if v is not None]
    return min(validos) if validos else None


# ── Parser principal ──────────────────────────────────────────────────────────

def parse_cfx_csv(content: bytes, filename: str = '') -> dict:
    """
    Parseia o CSV do CFX Manager.

    Retorna::

        {
          'metadados': {'arquivo': str, 'iniciado': str, 'finalizado': str},
          'amostras': {
              '1/26': {'CI': [cq|None, ...], 'HPV16': [...], 'HPV18': [...], 'HPV_AR': [...]},
              ...
          },
          'controles': {
              'cn': {'CI': [...], 'HPV16': [...], 'HPV18': [...], 'HPV_AR': [...]},
              'cp': {'CI': [...], 'HPV16': [...], 'HPV18': [...], 'HPV_AR': [...]},
          },
        }

    Lança ``ValueError`` se o formato não for reconhecido.
    """
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        text = content.decode('latin-1')

    reader = csv.reader(io.StringIO(text))
    metadados: dict = {}
    col_idx: dict = {}
    dados: list = []
    header_found = False

    for row in reader:
        if not row:
            continue

        if not header_found:
            # Captura metadados do cabeçalho
            if row[0] == 'File Name' and len(row) > 1:
                metadados['arquivo'] = row[1].strip()
            elif row[0] == 'Run Started' and len(row) > 1:
                metadados['iniciado'] = row[1].strip()
            elif row[0] == 'Run Ended' and len(row) > 1:
                metadados['finalizado'] = row[1].strip()

            # Detecta linha de cabeçalho dos dados
            if row[0].strip() == 'Well' and 'Fluor' in row and 'Sample' in row:
                col_idx = {h.strip(): i for i, h in enumerate(row)}
                header_found = True
            continue

        dados.append(row)

    if not header_found:
        raise ValueError(
            'Formato de CSV não reconhecido. '
            'Esperado cabeçalho com colunas "Well, Fluor, Target, Content, Sample, Cq".'
        )

    amostras: dict = {}
    controles: dict = {
        'cn': {c: [] for c in _CANAIS},
        'cp': {c: [] for c in _CANAIS},
    }
    por_poco: dict = {}  # {posicao: {'CI': cq|None, ..., '_tipo': str, '_sample': str}}

    for row in dados:
        if len(row) <= max(col_idx.values()):
            continue

        posicao = row[col_idx['Well']].strip()
        target  = row[col_idx['Target']].strip()
        content = row[col_idx['Content']].strip()
        sample  = row[col_idx['Sample']].strip()
        cq_raw  = row[col_idx['Cq']].strip()

        canal = TARGET_CANAL_MAP.get(target)
        if canal is None:
            continue  # canal não reconhecido — ignora

        cq   = _safe_cq(cq_raw)
        tipo = CONTENT_TYPE_MAP.get(content)

        if tipo == 'amostra':
            if sample not in amostras:
                amostras[sample] = {c: [] for c in _CANAIS}
            amostras[sample][canal].append(cq)
        elif tipo in ('cn', 'cp'):
            controles[tipo][canal].append(cq)

        if tipo in ('amostra', 'cn', 'cp'):
            if posicao not in por_poco:
                por_poco[posicao] = {c: None for c in _CANAIS}
                por_poco[posicao]['_tipo'] = tipo
                por_poco[posicao]['_sample'] = sample
            por_poco[posicao][canal] = cq

    return {
        'metadados': metadados,
        'amostras':  amostras,
        'controles': controles,
        'por_poco':  por_poco,
    }


# ── Validação de controles IBMP ───────────────────────────────────────────────

def validar_cp(cp_canais: dict, cq_max: float = CQ_CONTROLE_MAX) -> tuple[bool, str]:
    """
    CP: todos os 4 canais devem ter pelo menos uma replicata com Cq ≤ cq_max.
    Retorna ``(is_valid, mensagem)``.
    """
    falhos = []
    for canal in _CANAIS:
        cq = _cq_min(cp_canais.get(canal, []))
        if cq is None or cq > cq_max:
            cq_str = f'{cq:.2f}' if cq is not None else 'sem amplificação'
            falhos.append(f'{canal} ({cq_str})')
    if falhos:
        return False, f'CP inválido — {", ".join(falhos)} não atendem Cq ≤ {cq_max}'
    return True, 'CP válido'


def validar_cn(cn_canais: dict, cq_max: float = CQ_CONTROLE_MAX) -> tuple[bool, str]:
    """
    CN: CI deve amplificar (Cq ≤ cq_max); nenhum HPV deve amplificar.
    Retorna ``(is_valid, mensagem)``.
    """
    ci_cq = _cq_min(cn_canais.get('CI', []))
    if ci_cq is None or ci_cq > cq_max:
        cq_str = f'{ci_cq:.2f}' if ci_cq is not None else 'sem amplificação'
        return False, f'CN inválido — CI não atende Cq ≤ {cq_max} ({cq_str})'
    for canal in ('HPV16', 'HPV18', 'HPV_AR'):
        cq = _cq_min(cn_canais.get(canal, []))
        if cq is not None:
            return False, f'CN inválido — amplificação detectada em {canal} (Cq={cq:.2f})'
    return True, 'CN válido'


# ── Classificação de amostras IBMP ────────────────────────────────────────────

def classificar_canal(
    cq_values: list,
    canal: str,
    cq_ci_max: float = CQ_AMOSTRA_CI_MAX,
    cq_hpv_max: float = CQ_AMOSTRA_HPV_MAX,
) -> str:
    """
    Classifica um canal de uma amostra.

    - CI:  positivo se qualquer replicata tiver Cq ≤ cq_ci_max
    - HPV: positivo se qualquer replicata tiver Cq ≤ cq_hpv_max

    Retorna ``'positivo'`` | ``'negativo'``.
    """
    cq = _cq_min(cq_values)
    threshold = cq_ci_max if canal == 'CI' else cq_hpv_max
    return 'positivo' if (cq is not None and cq <= threshold) else 'negativo'


def calcular_resultado_final(ci: str, hpv16: str, hpv18: str, hpvar: str) -> str:
    """
    Resultado final segundo a matriz IBMP (8 laudos possíveis):

    - Qualquer HPV positivo → laudo específico de genotipagem (válido mesmo com CI negativo)
    - Nenhum HPV + CI positivo → ``hpv_nao_detectado``
    - Nenhum HPV + CI negativo → ``invalido``
    """
    pos16 = hpv16 == 'positivo'
    pos18 = hpv18 == 'positivo'
    posar = hpvar == 'positivo'

    if pos16 or pos18 or posar:
        if pos16 and pos18 and posar:
            return 'hpv16_18_ar'
        if pos16 and pos18:
            return 'hpv16_18'
        if pos16 and posar:
            return 'hpv16_ar'
        if pos18 and posar:
            return 'hpv18_ar'
        if pos16:
            return 'hpv16'
        if pos18:
            return 'hpv18'
        return 'hpv_ar'

    return 'hpv_nao_detectado' if ci == 'positivo' else 'invalido'
