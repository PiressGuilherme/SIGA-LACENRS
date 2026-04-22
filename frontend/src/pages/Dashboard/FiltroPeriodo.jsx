/**
 * Seletor de período compartilhado entre todos os componentes do dashboard.
 * Oferece atalhos (7/30/90/365 dias) e intervalo customizado.
 */
const OPCOES = [
  { valor: '7d', label: '7 dias' },
  { valor: '30d', label: '30 dias' },
  { valor: '90d', label: '90 dias' },
  { valor: '365d', label: '1 ano' },
]

export default function FiltroPeriodo({ filtros, onChange }) {
  const periodoAtivo = filtros.periodo
  const modoCustom = Boolean(filtros.data_inicio && filtros.data_fim)

  function selecionarAtalho(valor) {
    onChange({ periodo: valor })
  }

  function atualizarCustom(campo, valor) {
    const novo = { ...filtros, [campo]: valor }
    delete novo.periodo
    onChange(novo)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg p-3 mb-6">
      <span className="text-xs font-semibold uppercase text-gray-500 mr-2">
        Período
      </span>
      {OPCOES.map((o) => {
        const ativo = !modoCustom && periodoAtivo === o.valor
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => selecionarAtalho(o.valor)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              ativo
                ? 'bg-[#1a3a5c] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {o.label}
          </button>
        )
      })}
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <label className="text-xs text-gray-600 flex items-center gap-1">
        De
        <input
          type="date"
          value={filtros.data_inicio || ''}
          onChange={(e) => atualizarCustom('data_inicio', e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="text-xs text-gray-600 flex items-center gap-1">
        até
        <input
          type="date"
          value={filtros.data_fim || ''}
          onChange={(e) => atualizarCustom('data_fim', e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
    </div>
  )
}
