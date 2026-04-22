/**
 * Página principal do Dashboard.
 *
 * Seções (ordem da tela):
 *   1. Cards de resumo
 *   2. Gráfico de recebimento
 *   3. Tempos médios por etapa
 *   4. Distribuição de resultados + tendência
 *   5. QC por operador (somente supervisor)
 *
 * Política de loading: cada seção tem skeleton próprio para não bloquear a
 * página inteira enquanto os 5 endpoints carregam em paralelo.
 *
 * Política de erro: erros individuais por seção, para que um endpoint que
 * falha não esconda o resto do dashboard.
 */
import { useEffect, useMemo, useState } from 'react'
import Header from '../../components/Header'
import { getUsuarioAtual } from '../../utils/auth'
import { dashboardApi } from '../../services/dashboard'
import CardResumo from './CardResumo'
import FiltroPeriodo from './FiltroPeriodo'
import GraficoRecebimento from './GraficoRecebimento'
import GraficoResultados from './GraficoResultados'
import TabelaOperadores from './TabelaOperadores'
import TabelaTempos from './TabelaTempos'

const FILTRO_PADRAO = { periodo: '30d' }

function ehSupervisor(usuario) {
  if (!usuario) return false
  if (usuario.is_superuser || usuario.is_staff) return true
  return usuario.perfil === 'supervisor'
}

function useEndpoint(fn, filtros) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    setDados(null)
    fn(filtros)
      .then((d) => ativo && setDados(d))
      .catch((e) => {
        if (!ativo) return
        const msg =
          e.response?.data?.detail ||
          e.response?.data?.periodo ||
          e.response?.data ||
          e.message
        setErro(typeof msg === 'string' ? msg : JSON.stringify(msg))
      })
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [fn, JSON.stringify(filtros)])

  return { dados, erro, carregando }
}

function Secao({ titulo, erro, children }) {
  return (
    <section className="mb-6">
      {titulo && (
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          {titulo}
        </h2>
      )}
      {erro ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded p-3 text-sm">
          Erro: {erro}
        </div>
      ) : (
        children
      )}
    </section>
  )
}

export default function Dashboard() {
  const usuario = useMemo(() => getUsuarioAtual(), [])
  const supervisor = ehSupervisor(usuario)
  const [filtros, setFiltros] = useState(FILTRO_PADRAO)

  const resumo = useEndpoint(dashboardApi.resumo, filtros)
  const recebimento = useEndpoint(dashboardApi.recebimento, filtros)
  const tempos = useEndpoint(dashboardApi.tempos, filtros)
  const resultados = useEndpoint(dashboardApi.resultados, filtros)
  const operadores = useEndpoint(
    supervisor ? dashboardApi.operadores : () => Promise.resolve(null),
    filtros,
  )

  const algumCarregando =
    resumo.carregando ||
    recebimento.carregando ||
    tempos.carregando ||
    resultados.carregando ||
    (supervisor && operadores.carregando)

  const periodoLabel = filtros.periodo || `${filtros.data_inicio}_${filtros.data_fim}`

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#4a0010]">Dashboard</h1>
            <p className="text-sm text-gray-500">
              Indicadores operacionais e de qualidade do laboratório
            </p>
          </div>
          {algumCarregando && (
            <span className="text-xs text-gray-400">Atualizando…</span>
          )}
        </div>

        <FiltroPeriodo filtros={filtros} onChange={setFiltros} />

        <Secao erro={resumo.erro}>
          <CardResumo resumo={resumo.dados} />
        </Secao>

        <Secao titulo="Recebimento de amostras" erro={recebimento.erro}>
          <GraficoRecebimento dados={recebimento.dados} />
        </Secao>

        <Secao titulo="Tempos de processamento" erro={tempos.erro}>
          <TabelaTempos dados={tempos.dados} />
        </Secao>

        <Secao titulo="Resultados liberados" erro={resultados.erro}>
          <GraficoResultados dados={resultados.dados} />
        </Secao>

        {supervisor && (
          <Secao titulo="Controle de qualidade — operadores" erro={operadores.erro}>
            <TabelaOperadores dados={operadores.dados} periodoLabel={periodoLabel} />
          </Secao>
        )}
      </main>
    </>
  )
}
