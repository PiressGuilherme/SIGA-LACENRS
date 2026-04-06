"""
Geração de PDF do espelho de placa — FR-HPV-001
Mapa de Trabalho para Extração e Amplificação de Ácidos Nucleicos de HPV

Layout (página única landscape A4, 297×210 mm):
  1. Tabela de cabeçalho institucional (3 colunas)
  2. Linha "ORIGEM" + kits/ensaio
  3. Grid 8×12 com código interno por poço (cor = grupo)
  4. Seção inferior: tabelas de reagentes lado a lado + campos de assinatura
"""
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from .models import TipoConteudoPoco

# ── Constantes da placa ──────────────────────────────────────────────────────
ROWS = list('ABCDEFGH')
COLS = [str(i) for i in range(1, 13)]   # "1" … "12" (sem zero à esquerda)
COLS_PADDED = [f'{i:02d}' for i in range(1, 13)]  # para lookup no pocos_map

REAGENTES = [
    ('Tampão de Lise', 200),
    ('Oligomix', 5),
    ('Enzima', 0.5),
]

TIPO_LABELS = {
    TipoConteudoPoco.AMOSTRA: None,
    TipoConteudoPoco.CONTROLE_NEGATIVO: 'CN',
    TipoConteudoPoco.CONTROLE_POSITIVO: 'CP',
    TipoConteudoPoco.VAZIO: '',
}

CTRL_COLORS = {
    TipoConteudoPoco.CONTROLE_NEGATIVO: colors.HexColor('#fef3c7'),
    TipoConteudoPoco.CONTROLE_POSITIVO: colors.HexColor('#fce7f3'),
}

GROUP_BG_COLORS = [
    colors.HexColor('#dbeafe'),  # grupo 1 — azul
    colors.HexColor('#d1fae5'),  # grupo 2 — verde
    colors.HexColor('#fde8d8'),  # grupo 3 — laranja
    colors.HexColor('#ede9fe'),  # grupo 4 — roxo
    colors.HexColor('#fce7f3'),  # grupo 5 — rosa
]

# Dimensões da página (landscape A4)
PAGE_W, PAGE_H = landscape(A4)
MARGIN = 8 * mm
USABLE_W = PAGE_W - 2 * MARGIN   # ~275 mm
USABLE_H = PAGE_H - 2 * MARGIN   # ~178 mm


def _grupo_bg(grupo: int) -> colors.Color:
    return GROUP_BG_COLORS[(grupo - 1) % len(GROUP_BG_COLORS)]


def _no_padding():
    return [
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]


# ── Estilos de texto ─────────────────────────────────────────────────────────

def _make_styles():
    base = getSampleStyleSheet()
    s = {}

    def p(name, **kw):
        s[name] = ParagraphStyle(name, parent=base['Normal'], **kw)

    p('hdr_left',   fontSize=7,  leading=9,  alignment=TA_LEFT)
    p('hdr_center', fontSize=6,  leading=8,  alignment=TA_CENTER, fontName='Helvetica-Bold')
    p('hdr_title',  fontSize=7,  leading=9,  alignment=TA_CENTER, fontName='Helvetica-Bold')
    p('hdr_right',  fontSize=7,  leading=9,  alignment=TA_CENTER, fontName='Helvetica-Bold')
    p('origem',     fontSize=6.5, leading=8, alignment=TA_LEFT,   fontName='Helvetica-Bold')
    p('kits_label', fontSize=6,  leading=8,  alignment=TA_LEFT)
    p('kits_val',   fontSize=6,  leading=8,  alignment=TA_LEFT)
    p('ensaio_r',   fontSize=6,  leading=8,  alignment=TA_RIGHT)
    p('cell',       fontSize=5.5, leading=7, alignment=TA_CENTER)
    p('cell_hdr',   fontSize=6,  leading=7,  alignment=TA_CENTER, fontName='Helvetica-Bold')
    p('reag_hdr',   fontSize=6,  leading=7,  alignment=TA_CENTER, fontName='Helvetica-Bold')
    p('reag_cell',  fontSize=6,  leading=7,  alignment=TA_CENTER)
    p('grp_title',  fontSize=6,  leading=7,  alignment=TA_LEFT,   fontName='Helvetica-Bold')
    p('sign',       fontSize=6,  leading=8,  alignment=TA_LEFT)

    return s


# ── Bloco de cabeçalho institucional ────────────────────────────────────────

def _cabecalho_institucional(placa, s):
    """Tabela de 3 colunas com bordas pretas — cabeçalho FR-HPV-001."""

    # Coluna esquerda: espaço logo + texto CEVS
    logo_cell = Paragraph(
        '<br/><br/>centro estadual de<br/>vigilância em saúde RS',
        s['hdr_left'],
    )

    # Coluna central
    titulo_cell = Paragraph(
        'FR-HPV-001 – MAPA DE TRABALHO PARA EXTRAÇÃO E<br/>'
        'AMPLIFICAÇÃO DE ÁCIDOS NUCLEICOS DE HPV<br/>'
        '<font size="5.5">FORMULÁRIO</font><br/>'
        '<font size="5.5">LACEN/CEVS</font>',
        s['hdr_title'],
    )

    # Coluna direita
    revisao_cell = Paragraph('REVISÃO 00<br/><font size="6">Página 1 de 1</font>', s['hdr_right'])

    # Larguras: 20% | 60% | 20%
    w_left  = USABLE_W * 0.20
    w_mid   = USABLE_W * 0.60
    w_right = USABLE_W * 0.20

    hdr_table = Table(
        [[logo_cell, titulo_cell, revisao_cell]],
        colWidths=[w_left, w_mid, w_right],
        rowHeights=[16 * mm],
    )
    hdr_table.setStyle(TableStyle([
        ('BOX',      (0, 0), (-1, -1), 1.0, colors.black),
        ('INNERGRID',(0, 0), (-1, -1), 0.8, colors.black),
        ('VALIGN',   (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN',    (0, 0), (0, 0), 'LEFT'),
        ('ALIGN',    (1, 0), (1, 0), 'CENTER'),
        ('ALIGN',    (2, 0), (2, 0), 'CENTER'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING',   (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 2),
    ]))
    return hdr_table


# ── Linha origem / kits / ensaio ─────────────────────────────────────────────

def _linha_origem_kits(placa, s):
    """Duas linhas abaixo do cabeçalho: ORIGEM e Kits/Ensaio."""

    origem = Paragraph('ORIGEM: LABORATÓRIO DE HPV', s['origem'])

    kits_txt = (
        '<b>Kits:</b>  '
        'Loccus - Extracta DNA e RNA Viral Fast  |  '
        'IBMP - Biomol HPV Alto Risco'
    )
    ensaio_txt = f'<b>Ensaio:</b>  {placa.codigo}'

    kits_cell   = Paragraph(kits_txt,   s['kits_val'])
    ensaio_cell = Paragraph(ensaio_txt, s['ensaio_r'])

    info_table = Table(
        [[origem],
         [Table([[kits_cell, ensaio_cell]],
                colWidths=[USABLE_W * 0.7, USABLE_W * 0.3])]],
        colWidths=[USABLE_W],
    )
    info_table.setStyle(TableStyle([
        ('BOX',      (0, 0), (-1, -1), 0.8, colors.black),
        ('TOPPADDING',   (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 1),
        ('LEFTPADDING',  (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    return info_table


# ── Grid 8×12 ────────────────────────────────────────────────────────────────

def _grid_table(placa, s, row_h):
    pocos_map = {p.posicao: p for p in placa.pocos.select_related('amostra').all()}

    header_row = [Paragraph('', s['cell_hdr'])] + [Paragraph(c, s['cell_hdr']) for c in COLS]
    table_data = [header_row]
    cell_bg = []

    for ri, row_letter in enumerate(ROWS):
        row_data = [Paragraph(row_letter, s['cell_hdr'])]
        for ci, col_num in enumerate(COLS_PADDED):
            pos = f'{row_letter}{col_num}'
            poco = pocos_map.get(pos)
            if poco and poco.tipo_conteudo != TipoConteudoPoco.VAZIO:
                label = TIPO_LABELS.get(poco.tipo_conteudo)
                if label is None:
                    label = poco.amostra.codigo_interno if poco.amostra else '?'
                row_data.append(Paragraph(label, s['cell']))
                if poco.tipo_conteudo == TipoConteudoPoco.AMOSTRA:
                    bg = _grupo_bg(poco.grupo)
                else:
                    bg = CTRL_COLORS.get(poco.tipo_conteudo, colors.white)
                cell_bg.append((ri + 1, ci + 1, bg))
            else:
                row_data.append('')
                cell_bg.append((ri + 1, ci + 1, colors.white))
        table_data.append(row_data)

    # Largura total disponível para o grid
    hdr_col_w = 6 * mm
    col_w = (USABLE_W - hdr_col_w) / 12

    col_widths  = [hdr_col_w] + [col_w] * 12
    row_heights = [5 * mm] + [row_h] * 8

    style_cmds = [
        ('BOX',      (0, 0), (-1, -1), 1.0, colors.black),
        ('INNERGRID',(0, 0), (-1, -1), 0.6, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0),  colors.HexColor('#e8e8e8')),
        ('BACKGROUND', (0, 0), (0, -1),  colors.HexColor('#e8e8e8')),
        ('ALIGN',    (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN',   (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 1),
        ('RIGHTPADDING', (0, 0), (-1, -1), 1),
        ('TOPPADDING',   (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 1),
    ]
    for r, c, bg in cell_bg:
        if bg != colors.white:
            style_cmds.append(('BACKGROUND', (c, r), (c, r), bg))

    grid = Table(table_data, colWidths=col_widths, rowHeights=row_heights)
    grid.setStyle(TableStyle(style_cmds))
    return grid


# ── Tabela de reagentes (uma por grupo) ──────────────────────────────────────

def _reagentes_table(placa, grupos, s):
    """Retorna uma Table com todas as sub-tabelas de reagentes lado a lado."""

    sub_w_cols = [28 * mm, 18 * mm, 14 * mm, 18 * mm]   # Reagente | Vol | Reações | Total
    sub_w_total = sum(sub_w_cols)

    def make_sub(grupo):
        # Conta apenas amostras (não CN/CP) para o total de reações do grupo
        total = sum(
            1 for p in placa.pocos.all()
            if p.grupo == grupo and p.tipo_conteudo == TipoConteudoPoco.AMOSTRA
        )
        hdr = [Paragraph(h, s['reag_hdr']) for h in ['Reagente', 'Vol/reação (uL)', 'Reações', 'Vol. total (uL)']]
        data = [hdr]
        for nome, vol in REAGENTES:
            data.append([
                Paragraph(nome,                     s['reag_cell']),
                Paragraph(str(vol),                 s['reag_cell']),
                Paragraph(str(total),               s['reag_cell']),
                Paragraph(f'{vol * total:.1f}',     s['reag_cell']),
            ])
        t = Table(data, colWidths=sub_w_cols, rowHeights=4.5 * mm)
        t.setStyle(TableStyle([
            ('BOX',      (0, 0), (-1, -1), 0.6, colors.black),
            ('INNERGRID',(0, 0), (-1, -1), 0.4, colors.grey),
            ('ALIGN',    (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN',   (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING',  (0, 0), (-1, -1), 1),
            ('RIGHTPADDING', (0, 0), (-1, -1), 1),
            ('TOPPADDING',   (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
        ]))
        return t

    gap = 5 * mm
    cells = []
    widths = []

    for i, g in enumerate(grupos):
        titulo = f'Grupo {g}' if len(grupos) > 1 else 'Reagentes'
        sub_t = make_sub(g)

        # Empacota título + tabela em célula vertical
        wrapper = Table(
            [[Paragraph(titulo, s['grp_title'])], [sub_t]],
            colWidths=[sub_w_total],
        )
        wrapper.setStyle(TableStyle([
            ('VALIGN',   (0, 0), (-1, -1), 'TOP'),
            ('ALIGN',    (0, 0), (-1, -1), 'LEFT'),
        ] + _no_padding()))

        cells.append(wrapper)
        widths.append(sub_w_total)
        if i < len(grupos) - 1:
            cells.append('')
            widths.append(gap)

    outer = Table([cells], colWidths=widths)
    outer.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')] + _no_padding()))
    return outer


# ── Seção inferior: reagentes + assinaturas ──────────────────────────────────

def _secao_inferior(placa, grupos, operador_nome, s):
    """Linha horizontal: reagentes à esquerda, campos de assinatura à direita."""

    reag_block  = _reagentes_table(placa, grupos, s)

    # Largura total que os blocos de reagentes ocupam
    sub_w_total = (28 + 18 + 14 + 18) * mm
    gap = 5 * mm
    reag_w = sub_w_total * len(grupos) + gap * (len(grupos) - 1)

    # Campos de assinatura (sem bordas de tabela)
    operador_extracao_nome = operador_nome or ''
    sign_text = (
        f'<b>Operador extração:</b>  {operador_extracao_nome}<br/>'
        '<br/>'
        '<b>Operador PCR:</b>  '
    )
    sign_cell = Paragraph(sign_text, s['sign'])

    sign_w = USABLE_W - reag_w - 10 * mm  # resto da largura disponível

    outer = Table(
        [[reag_block, '', sign_cell]],
        colWidths=[reag_w, 8 * mm, sign_w],
    )
    outer.setStyle(TableStyle([
        ('VALIGN',  (0, 0), (-1, -1), 'TOP'),
        ('ALIGN',   (2, 0), (2, 0), 'LEFT'),
    ] + _no_padding()))
    return outer


# ── Função principal ─────────────────────────────────────────────────────────

def gerar_pdf_placa(placa, operador=None):
    """Gera o PDF do espelho de placa e retorna bytes.

    Args:
        placa:    instância de Placa
        operador: instância de User (opcional) — exibido em "Operador extração"
    """
    # Resolve nome do operador
    operador_nome = ''
    if operador:
        operador_nome = getattr(operador, 'nome_completo', str(operador))
    elif placa.extracao_confirmada_por:
        operador_nome = getattr(placa.extracao_confirmada_por, 'nome_completo',
                                str(placa.extracao_confirmada_por))

    # Grupos presentes na placa
    grupos = sorted(set(
        p.grupo for p in placa.pocos.all()
        if p.tipo_conteudo != TipoConteudoPoco.VAZIO
    )) or [1]

    s = _make_styles()

    # ── Cálculo automático de altura de linha do grid ────────────────────────
    # Orçamento vertical: USABLE_H menos espaços fixos
    HDR_H       = 16 * mm   # cabeçalho institucional
    INFO_H      = 8  * mm   # linha origem/kits
    GRID_HDR_H  = 5  * mm   # linha de cabeçalho do grid
    BOTTOM_H    = 22 * mm   # seção inferior (reagentes + assinatura)
    SPACING     = 1.5 * mm  # espaçadores (×3)

    available_for_rows = USABLE_H - HDR_H - INFO_H - GRID_HDR_H - BOTTOM_H - SPACING * 3
    row_h = max(7 * mm, min(available_for_rows / 8, 17 * mm))

    # ── Montagem ─────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN,  bottomMargin=MARGIN,
    )

    elements = [
        _cabecalho_institucional(placa, s),
        Spacer(1, 1 * mm),
        _linha_origem_kits(placa, s),
        Spacer(1, 1 * mm),
        _grid_table(placa, s, row_h),
        Spacer(1, 1 * mm),
        _secao_inferior(placa, grupos, operador_nome, s),
    ]

    doc.build(elements)
    return buf.getvalue()
