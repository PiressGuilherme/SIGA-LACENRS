"""
Geração de PDF do espelho de placa (FR-HPV-001).

Layout:
  - Cabeçalho com código da placa, data, responsável
  - Grid 8×12 com código interno por poço
  - Tabela de reagentes com volumes calculados
"""
import io
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from .models import TipoConteudoPoco

ROWS = list('ABCDEFGH')
COLS = [f'{i:02d}' for i in range(1, 13)]

# Volumes de reagentes por reação (uL)
REAGENTES = [
    ('Tampão de Lise', 200),
    ('Oligomix', 5),
    ('Enzima', 0.5),
]

TIPO_LABELS = {
    TipoConteudoPoco.AMOSTRA: None,  # mostra código
    TipoConteudoPoco.CONTROLE_NEGATIVO: 'CN',
    TipoConteudoPoco.CONTROLE_POSITIVO: 'CP',
    TipoConteudoPoco.VAZIO: '',
}

CELL_COLORS = {
    TipoConteudoPoco.AMOSTRA: colors.HexColor('#dbeafe'),
    TipoConteudoPoco.CONTROLE_NEGATIVO: colors.HexColor('#fef3c7'),
    TipoConteudoPoco.CONTROLE_POSITIVO: colors.HexColor('#fce7f3'),
    TipoConteudoPoco.VAZIO: colors.white,
}


def gerar_pdf_placa(placa):
    """Gera o PDF do espelho de placa e retorna bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=1 * cm, rightMargin=1 * cm,
        topMargin=1 * cm, bottomMargin=1 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'PlacaTitle', parent=styles['Title'],
        fontSize=14, spaceAfter=2 * mm,
    )
    subtitle_style = ParagraphStyle(
        'PlacaSub', parent=styles['Normal'],
        fontSize=9, textColor=colors.grey, spaceAfter=4 * mm,
    )
    cell_style = ParagraphStyle(
        'Cell', parent=styles['Normal'],
        fontSize=7, alignment=1, leading=9,
    )

    elements = []

    # ---- Cabeçalho ----
    elements.append(Paragraph(f'Placa {placa.codigo}', title_style))

    responsavel = ''
    if placa.responsavel:
        responsavel = getattr(placa.responsavel, 'nome_completo', str(placa.responsavel))
    data_str = placa.data_criacao.strftime('%d/%m/%Y %H:%M') if placa.data_criacao else ''
    elements.append(Paragraph(
        f'Responsável: {responsavel} &nbsp;&nbsp;|&nbsp;&nbsp; '
        f'Data: {data_str} &nbsp;&nbsp;|&nbsp;&nbsp; '
        f'Status: {placa.get_status_placa_display()}',
        subtitle_style,
    ))

    # ---- Montar mapa de poços ----
    pocos_map = {}
    for poco in placa.pocos.select_related('amostra').all():
        pocos_map[poco.posicao] = poco

    # ---- Grid 8×12 ----
    col_width = 20 * mm
    row_height = 12 * mm
    header_row = [''] + COLS
    table_data = [header_row]
    cell_bg = []  # list of (row, col, color)

    for ri, row_letter in enumerate(ROWS):
        row_data = [row_letter]
        for ci, col_num in enumerate(COLS):
            pos = f'{row_letter}{col_num}'
            poco = pocos_map.get(pos)
            if poco and poco.tipo_conteudo != TipoConteudoPoco.VAZIO:
                label = TIPO_LABELS.get(poco.tipo_conteudo)
                if label is None:
                    # Amostra — mostra código interno
                    label = poco.amostra.codigo_interno if poco.amostra else '?'
                row_data.append(Paragraph(label, cell_style))
                cell_bg.append((ri + 1, ci + 1, CELL_COLORS.get(poco.tipo_conteudo, colors.white)))
            else:
                row_data.append('')
                cell_bg.append((ri + 1, ci + 1, colors.white))
        table_data.append(row_data)

    col_widths = [8 * mm] + [col_width] * 12
    row_heights = [8 * mm] + [row_height] * 8

    grid_table = Table(table_data, colWidths=col_widths, rowHeights=row_heights)
    style_cmds = [
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f0f0')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 0), (0, -1), 9),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
    ]
    for r, c, bg in cell_bg:
        if bg != colors.white:
            style_cmds.append(('BACKGROUND', (c, r), (c, r), bg))

    grid_table.setStyle(TableStyle(style_cmds))
    elements.append(grid_table)
    elements.append(Spacer(1, 6 * mm))

    # ---- Tabelas de reagentes (uma por grupo) ----
    reag_title_style = ParagraphStyle(
        'ReagTitle', parent=styles['Heading3'], fontSize=10, spaceAfter=2 * mm,
    )
    grupos = sorted(set(poco.grupo for poco in placa.pocos.all() if poco.tipo_conteudo != TipoConteudoPoco.VAZIO))
    if not grupos:
        grupos = [1]

    for grupo in grupos:
        total_reacoes_grupo = sum(
            1 for poco in placa.pocos.all()
            if poco.grupo == grupo and poco.tipo_conteudo != TipoConteudoPoco.VAZIO
        )
        titulo = 'Cálculo de Reagentes' if len(grupos) == 1 else f'Cálculo de Reagentes — Grupo {grupo}'
        elements.append(Paragraph(titulo, reag_title_style))

        reagentes_header = ['Reagente', 'Vol/reação (uL)', 'Reações', 'Vol. total (uL)']
        reagentes_data = [reagentes_header]
        for nome, vol in REAGENTES:
            reagentes_data.append([nome, f'{vol}', str(total_reacoes_grupo), f'{vol * total_reacoes_grupo:.1f}'])

        reagentes_table = Table(reagentes_data, colWidths=[60 * mm, 35 * mm, 25 * mm, 35 * mm])
        reagentes_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8f0fe')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(reagentes_table)
        elements.append(Spacer(1, 4 * mm))

    doc.build(elements)
    return buf.getvalue()
