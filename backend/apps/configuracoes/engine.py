"""
Motor de interpretação PCR dirigido por configuração.

Lógica genérica: sem código hardcoded para canais ou thresholds.
Toda a regra de negócio é lida dos modelos KitAlvo, RegrasLimiar e RegraInterpretacao.

Fluxo:
  1. validar_cp(canais) → (ok, msg)   — verifica poço CP
  2. validar_cn(canais) → (ok, msg)   — verifica poço CN
  3. classificar_alvo([cq], nome) → 'positivo'|'negativo'  — por amostra × alvo
  4. interpretar_amostra(resultados, cp_ok, cn_ok) → dict   — laudo final
"""
from typing import Optional


class MotorInterpretacao:
    """
    Motor genérico de interpretação PCR.
    Instanciar com um KitInterpretacao que tenha alvos e regras configurados.
    """

    def __init__(self, kit):
        self.kit = kit
        # Carrega alvos com limiares (prefetch evita N+1 em loops)
        self.alvos = list(
            kit.alvos.prefetch_related('limiares').order_by('ordem', 'id')
        )
        self.alvos_dict = {a.nome: a for a in self.alvos}
        self.regras = list(kit.regras_interpretacao.order_by('prioridade').all())

    @property
    def canais_amostra(self):
        """Alvos que entram no resultado de amostras (exclui CONTROLE_EXTERNO)."""
        return [a for a in self.alvos if a.tipo_alvo != 'CONTROLE_EXTERNO']

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _cq_min(values: list) -> Optional[float]:
        validos = [v for v in (values or []) if v is not None]
        return min(validos) if validos else None

    def _get_limiar(self, nome_alvo: str, contexto: str):
        """Retorna o RegrasLimiar para alvo × contexto, ou None."""
        alvo = self.alvos_dict.get(nome_alvo)
        if alvo is None:
            return None
        for limiar in alvo.limiares.all():
            if limiar.contexto == contexto:
                return limiar
        return None

    def _avaliar(self, cq: Optional[float], limiar) -> bool:
        """Aplica o operador do limiar ao valor de Cq."""
        if limiar is None:
            return False
        if limiar.operador == 'SEM_AMP':
            return cq is None
        if cq is None:
            return False
        if limiar.operador == 'LTE':
            return cq <= limiar.ct_limiar
        if limiar.operador == 'GTE':
            return cq >= limiar.ct_limiar
        return False

    # ── validação de controles ────────────────────────────────────────────────

    def validar_cp(self, canais: dict) -> tuple[bool, str]:
        """
        Valida o poço CP.
        canais = {'CI': [cq,...], 'HPV16': [...], ...}
        """
        falhos = []
        for alvo in self.alvos:
            limiar = self._get_limiar(alvo.nome, 'CP')
            if limiar is None:
                continue
            cq = self._cq_min(canais.get(alvo.nome, []))
            if not self._avaliar(cq, limiar):
                cq_str = f'{cq:.2f}' if cq is not None else 'sem amplificação'
                falhos.append(f'{alvo.nome} ({cq_str})')
        if falhos:
            return False, f'CP inválido — {", ".join(falhos)} fora do limiar'
        return True, 'CP válido'

    def validar_cn(self, canais: dict) -> tuple[bool, str]:
        """
        Valida o poço CN.
        canais = {'CI': [cq,...], 'HPV16': [...], ...}
        """
        for alvo in self.alvos:
            limiar = self._get_limiar(alvo.nome, 'CN')
            if limiar is None:
                continue
            cq = self._cq_min(canais.get(alvo.nome, []))
            if not self._avaliar(cq, limiar):
                cq_str = f'{cq:.2f}' if cq is not None else 'sem amplificação'
                return False, f'CN inválido — {alvo.nome}: {cq_str} não atende critério'
        return True, 'CN válido'

    # ── classificação de alvos ────────────────────────────────────────────────

    def classificar_alvo(self, cq_values: list, nome_alvo: str) -> str:
        """
        Classifica um alvo de uma amostra com base no limiar AMOSTRA_POSITIVO.
        Retorna 'positivo' ou 'negativo'.
        """
        cq = self._cq_min(cq_values)
        limiar = self._get_limiar(nome_alvo, 'AMOSTRA_POSITIVO')
        if limiar and self._avaliar(cq, limiar):
            return 'positivo'
        return 'negativo'

    # ── interpretação final ───────────────────────────────────────────────────

    def interpretar_amostra(
        self,
        resultados_alvos: dict,
        cp_valido: bool = True,
        cn_valido: bool = True,
    ) -> dict:
        """
        Aplica as regras de interpretação e retorna o laudo.

        resultados_alvos = {'HPV16': 'positivo', 'CI': 'negativo', ...}

        Retorna::

            {
              'label':    str   — texto do laudo,
              'codigo':   str   — código interno (ex: 'hpv16'),
              'tipo':     str   — TipoResultado value,
              'regra_id': int|None,
            }
        """
        estado = dict(resultados_alvos)
        estado['CP'] = 'VALIDO' if cp_valido else 'INVALIDO'
        estado['CN'] = 'VALIDO' if cn_valido else 'INVALIDO'

        for regra in self.regras:
            if self._match_regra(regra.condicoes, estado):
                return {
                    'label':    regra.resultado_label,
                    'codigo':   regra.resultado_codigo,
                    'tipo':     regra.tipo_resultado,
                    'regra_id': regra.pk,
                }

        # Nenhuma regra casou
        return {
            'label':    'Revisão manual necessária',
            'codigo':   'inconclusivo',
            'tipo':     'REVISAO_MANUAL',
            'regra_id': None,
        }

    def _match_regra(self, condicoes: dict, estado: dict) -> bool:
        """Verifica se todas as condições da regra são satisfeitas."""
        for chave, esperado in condicoes.items():
            actual = estado.get(chave)
            if esperado == 'QUALQUER':
                continue
            if actual is None:
                # Alvo ausente: falha se esperava valor específico
                if esperado in ('POSITIVO', 'VALIDO'):
                    return False
                continue
            if esperado == 'POSITIVO' and actual != 'positivo':
                return False
            if esperado == 'NEGATIVO' and actual != 'negativo':
                return False
            if esperado == 'VALIDO' and actual != 'VALIDO':
                return False
            if esperado == 'INVALIDO' and actual != 'INVALIDO':
                return False
        return True
