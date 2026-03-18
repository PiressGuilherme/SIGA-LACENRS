"""
Utilitários para importação do CSV exportado pelo sistema GAL.

Formato esperado:
  - Separador : ponto-e-vírgula (;)
  - Encoding  : Latin-1 / Windows-1252 (padrão dos sistemas governamentais brasileiros)
  - Datas     : DD/MM/YYYY HH:MM:SS  ou  DD/MM/YYYY

Regras de importação:
  - Linhas com 'Status Exame' = 'Exame Cancelado' são ignoradas.
  - Linhas com 'Cód. Exame' vazio são ignoradas.
  - O campo 'Status Exame' do GAL não é armazenado no banco — é apenas usado para filtro.
  - O campo 'codigo_interno' ('Num.Interno') é atribuído pelo GAL quando a amostra é
    bipada na triagem; amostras recém-chegadas terão esse campo vazio no CSV.
"""
import csv
import io
from datetime import datetime

# Mapeamento coluna CSV → campo do model Amostra
# Colunas do GAL não mapeadas aqui são usadas apenas para filtro ou descartadas.
COLUMN_MAP = {
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

DATE_FIELDS = {'data_coleta', 'data_recebimento'}
DATE_FORMATS = ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y')

# Valores de 'Status Exame' no GAL que devem ser ignorados na importação
STATUSES_IGNORADOS = {'Exame Cancelado'}


def _parse_date(value: str):
    if not value or not value.strip():
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value.strip(), fmt)
        except ValueError:
            continue
    return None


def parse_gal_csv(file_content) -> list[dict]:
    """
    Recebe o conteúdo bruto (bytes ou str) de um CSV exportado do GAL e
    retorna uma lista de dicts com os campos mapeados para o model Amostra.

    Cada dict também inclui a chave '_status_exame_gal' com o valor original
    da coluna 'Status Exame' do GAL — usado apenas para referência/preview,
    não é armazenado no banco.

    Linhas filtradas (Exame Cancelado, Cód. Exame vazio) não aparecem na lista.
    """
    if isinstance(file_content, bytes):
        content = file_content.decode('latin-1')
    else:
        content = file_content

    reader = csv.DictReader(io.StringIO(content), delimiter=';')

    rows = []
    canceladas = 0

    for row in reader:
        # Normalizar espaços nos nomes das colunas e valores
        cleaned = {k.strip(): (v or '').strip() for k, v in row.items()}

        # Ignorar linhas com Cód. Exame vazio
        cod_exame = cleaned.get('Cód. Exame', '')
        if not cod_exame:
            continue

        # Ignorar exames cancelados no GAL
        status_gal = cleaned.get('Status Exame', '')
        if status_gal in STATUSES_IGNORADOS:
            canceladas += 1
            continue

        record = {}
        for csv_col, field in COLUMN_MAP.items():
            raw = cleaned.get(csv_col, '')
            if field in DATE_FIELDS:
                record[field] = _parse_date(raw)
            elif field == 'codigo_interno':
                record[field] = raw or None  # None quando coluna vazia
            else:
                record[field] = raw

        # Inclui o status GAL original apenas para exibição no preview
        record['_status_exame_gal'] = status_gal

        rows.append(record)

    return rows, canceladas
