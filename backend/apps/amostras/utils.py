"""
Utilitários para importação do CSV exportado pelo sistema GAL.

Formatos suportados (detectados automaticamente):

  Formato A — "Consulta de Exames" (antigo):
    Colunas-chave: Cód. Exame, Num.Interno, Nome Social
    cod_exame_gal ← Cód. Exame
    codigo_interno ← Num.Interno

  Formato B — "Consulta de Exames BMH" (novo, a partir de 2026):
    Colunas-chave: Requisição, Cód. Amostra (sem Cód. Exame e sem Num.Interno)
    cod_exame_gal ← Requisição  (é o identificador único do exame nesse relatório)
    codigo_interno ← None       (não disponível neste relatório)

  Comum a ambos:
    - Separador : ponto-e-vírgula (;), detectado automaticamente
    - Encoding  : tenta utf-8-sig → utf-8 → latin-1
    - Datas     : DD/MM/YYYY HH:MM:SS  ou  DD/MM/YYYY

Regras:
  - Linhas com 'Status Exame' = 'Exame Cancelado' são ignoradas.
  - O campo 'Status Exame' do GAL não é armazenado — é usado só para filtro/status inicial.
"""
import csv
import io
import zipfile
from datetime import datetime

# ---------------------------------------------------------------------------
# Mapeamentos por formato
# ---------------------------------------------------------------------------

# Formato A: relatório clássico (tem 'Cód. Exame')
COLUMN_MAP_A = {
    'Cód. Exame':        'cod_exame_gal',
    'Num.Interno':       'codigo_interno',
    'Requisição':        'numero_gal',
    'Paciente':          'nome_paciente',
    'Nome Social':       'nome_social',
    'CNS':               'cns',
    'CPF':               'cpf',
    'Mun. Residência':   'municipio',
    'UF Residência':     'uf',
    'Requisitante':      'unidade_solicitante',
    'Mun. Requisitante': 'municipio_solicitante',
    'Material':          'material',
    'Cód. Amostra':      'cod_amostra_gal',
    'Dt. Cadastro':      'data_coleta',
    'Dt. Recebimento':   'data_recebimento',
}

# Formato B: relatório BMH (sem 'Cód. Exame', usa 'Requisição' como ID único)
COLUMN_MAP_B = {
    'Requisição':        'cod_exame_gal',   # chave única do exame neste formato
    'Num.Interno':       'codigo_interno',
    'Paciente':          'nome_paciente',
    'CNS':               'cns',
    'CPF':               'cpf',
    'Mun. Residência':   'municipio',
    'UF Residência':     'uf',
    'Requisitante':      'unidade_solicitante',
    'Mun. Requisitante': 'municipio_solicitante',
    'Material':          'material',
    'Cód. Amostra':      'cod_amostra_gal',
    'Dt. Cadastro':      'data_coleta',
    'Dt. Recebimento':   'data_recebimento',
}
# No Formato B, numero_gal e nome_social não têm coluna direta;
# numero_gal será preenchido com o mesmo valor de cod_exame_gal (= Requisição).

DATE_FIELDS = {'data_coleta', 'data_recebimento'}
DATE_FORMATS = ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y')

# Valores de 'Status Exame' no GAL que devem ser ignorados na importação
STATUSES_IGNORADOS = {'Exame Cancelado'}

# Mapeamento de 'Status Exame' do GAL → status interno SIGA
GAL_STATUS_MAP = {
    'Aguardando Triagem': 'aguardando_triagem',
    'Exame em Análise':   'exame_em_analise',
    'Resultado Liberado': 'resultado_liberado',
    # 'Exame Cancelado' é tratado em STATUSES_IGNORADOS (não entra no banco).
}


def _parse_date(value: str):
    if not value or not value.strip():
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    return None


def _decode_csv(file_content: bytes) -> str:
    """
    Decodifica bytes de CSV tentando múltiplos encodings.
    Ordem: utf-8-sig (lida com BOM) → utf-8 → latin-1 (fallback universal).
    """
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
        try:
            return file_content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return file_content.decode('latin-1', errors='replace')


def _detect_format(colunas: list[str]) -> str:
    """
    Retorna 'A' se o CSV tem a coluna 'Cód. Exame' (formato clássico),
    ou 'B' se usa apenas 'Requisição' como identificador (formato BMH).
    Levanta ValueError se nem um nem outro padrão for detectado.
    """
    if 'Cód. Exame' in colunas:
        return 'A'
    if 'Requisição' in colunas and 'Status Exame' in colunas:
        return 'B'
    raise ValueError(
        f'Formato de CSV do GAL não reconhecido. '
        f'Colunas presentes: {", ".join(colunas[:15])}.'
    )


def parse_gal_csv(file_content) -> tuple[list[dict], int, list[str]]:
    """
    Recebe o conteúdo bruto (bytes ou str) de um CSV exportado pelo GAL e
    retorna (rows, canceladas, colunas_encontradas).

    Detecta automaticamente o formato A (clássico) ou B (BMH/novo).
    """
    if isinstance(file_content, bytes):
        content = _decode_csv(file_content)
    else:
        content = file_content

    # Detectar separador automaticamente a partir da primeira linha
    first_line = content.split('\n')[0] if '\n' in content else content[:500]
    delimiter = ';' if first_line.count(';') >= first_line.count(',') else ','

    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)

    rows = []
    canceladas = 0
    colunas_encontradas = []
    formato = None
    column_map = None

    for row in reader:
        # Na primeira linha, normalizar colunas e detectar formato
        if not colunas_encontradas:
            colunas_encontradas = [
                k.strip().strip('\ufeff') for k in (reader.fieldnames or []) if k
            ]
            formato = _detect_format(colunas_encontradas)
            column_map = COLUMN_MAP_A if formato == 'A' else COLUMN_MAP_B

        # Normalizar nomes de coluna e valores
        cleaned = {k.strip().strip('\ufeff'): (v or '').strip() for k, v in row.items()}

        # Determinar identificador único da linha conforme o formato
        if formato == 'A':
            cod_exame = cleaned.get('Cód. Exame', '')
        else:
            cod_exame = cleaned.get('Requisição', '')

        if not cod_exame:
            continue

        # Ignorar exames cancelados no GAL
        status_gal = cleaned.get('Status Exame', '')
        if status_gal in STATUSES_IGNORADOS:
            canceladas += 1
            continue

        # Mapear colunas → campos do model
        record = {}
        for csv_col, field in column_map.items():
            raw = cleaned.get(csv_col, '')
            if field in DATE_FIELDS:
                record[field] = _parse_date(raw)
            elif field == 'codigo_interno':
                record[field] = raw or None
            else:
                record[field] = raw

        # Formato B: numero_gal = Requisição; nome_social ausente neste relatório
        if formato == 'B':
            record['numero_gal'] = cod_exame
            record['nome_social'] = ''

        record['status'] = GAL_STATUS_MAP.get(status_gal, 'aguardando_triagem')
        record['_status_exame_gal'] = status_gal

        rows.append(record)

    return rows, canceladas, colunas_encontradas


def parse_gal_file(file_content: bytes, filename: str) -> tuple[list[dict], int, list[str]]:
    """
    Aceita um CSV ou um ZIP contendo um ou mais CSVs do GAL.
    Retorna (rows, canceladas, colunas_encontradas).
    """
    if filename.lower().endswith('.zip'):
        all_rows = []
        total_canceladas = 0
        all_cols: list[str] = []
        with zipfile.ZipFile(io.BytesIO(file_content)) as zf:
            csv_names = [n for n in zf.namelist() if n.lower().endswith('.csv')]
            if not csv_names:
                raise ValueError('O arquivo ZIP não contém nenhum CSV.')
            for name in csv_names:
                rows, canceladas, cols = parse_gal_csv(zf.read(name))
                all_rows.extend(rows)
                total_canceladas += canceladas
                if not all_cols:
                    all_cols = cols
        return all_rows, total_canceladas, all_cols

    return parse_gal_csv(file_content)
