"""
Gerador da planilha Sample Info (.xlsx) para o Amplio® 96.

Utiliza o template ``96_sample_info_template.xlsx`` (cópia do arquivo original
fornecido pelo fabricante) para garantir que toda a formatação, estilos, merged
cells e number_format='@' sejam preservados — o software do Amplio® rejeita
arquivos que não seguem exatamente esse padrão.

O template já contém a estrutura completa:
  - Merged cells (A1:M1, A12:M12, A23:O30)
  - Fontes azuis bold nos cabeçalhos e letras de linha
  - number_format='@' em todas as 96 células de dados (B3:M10 e B14:M21)
  - Notas na linha 23

O gerador apenas limpa os valores das células de dados e preenche com os
dados da placa, preservando toda a formatação original.
"""
import io
from pathlib import Path

import openpyxl

from .models import TipoConteudoPoco

_ROWS = list('ABCDEFGH')
_TEMPLATE = Path(__file__).resolve().parent / '96_sample_info_template.xlsx'


def _construir_grade(placa) -> list[list]:
    """
    Retorna matriz 8×12 com o valor (str) de cada poço, ou None se vazio.
    grade[r][c]: r=0..7 (A–H), c=0..11 (cols 1–12, 0-indexado).
    """
    grade = [[None] * 12 for _ in range(8)]

    for poco in placa.pocos.select_related('amostra').all():
        pos = poco.posicao
        if not pos or len(pos) < 2:
            continue
        letra = pos[0].upper()
        if letra not in _ROWS:
            continue
        try:
            col_num = int(pos[1:])
        except ValueError:
            continue
        if not (1 <= col_num <= 12):
            continue

        r = _ROWS.index(letra)
        c = col_num - 1

        if poco.tipo_conteudo == TipoConteudoPoco.AMOSTRA:
            grade[r][c] = poco.amostra.codigo_interno if poco.amostra else None
        elif poco.tipo_conteudo == TipoConteudoPoco.CONTROLE_POSITIVO:
            grade[r][c] = 'CP'
        elif poco.tipo_conteudo == TipoConteudoPoco.CONTROLE_NEGATIVO:
            grade[r][c] = 'CN'

    return grade


def _preencher_bloco(ws, grade, row_dados_inicio):
    """
    Preenche um bloco de dados (8 linhas × 12 colunas) na worksheet.
    Limpa todos os valores existentes e escreve os novos, preservando a
    formatação original do template.

    row_dados_inicio: primeira linha de dados (3 para Sample ID, 14 para Sample Name)
    """
    for r in range(8):
        for c in range(12):
            cell = ws.cell(row=row_dados_inicio + r, column=c + 2)
            valor = grade[r][c]
            cell.value = valor  # None limpa a célula, preservando formatação


def gerar_sample_info_amplio(placa) -> bytes:
    """
    Gera o arquivo .xlsx no formato esperado pelo Amplio® 96.

    Carrega o template original e substitui apenas os valores das células de
    dados, preservando toda a formatação, merged cells e estilos.

    Parâmetro:
        placa: instância de ``apps.placas.models.Placa``

    Retorna os bytes do arquivo XLSX.
    """
    grade = _construir_grade(placa)

    wb = openpyxl.load_workbook(_TEMPLATE)
    ws = wb.active

    # Preencher bloco Sample ID (linhas 3–10, colunas B–M)
    _preencher_bloco(ws, grade, row_dados_inicio=3)

    # Preencher bloco Sample Name (linhas 14–21, colunas B–M)
    _preencher_bloco(ws, grade, row_dados_inicio=14)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
