import { useState, useRef, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import NavigationButtons from '../components/NavigationButtons'
import { getOperadorInicial, getCsrfToken } from '../utils/auth'

const STATUS_BADGE = {
  aguardando_triagem:   { bg: 'bg-gray-500',   label: 'Aguardando Triagem' },
  exame_em_analise:     { bg: 'bg-info-500',    label: 'Exame em Análise' },
  aliquotada:           { bg: 'bg-primary-500', label: 'Aliquotada' },
  extracao:             { bg: 'bg-warning-500', label: 'Extração' },
  extraida:             { bg: 'bg-purple-500',  label: 'Extraída' },
  pcr:                  { bg: 'bg-danger-600',  label: 'PCR' },
  resultado:            { bg: 'bg-teal-500',    label: 'Resultado' },
  resultado_liberado:   { bg: 'bg-success-600', label: 'Resultado Liberado' },
  cancelada:            { bg: 'bg-danger-500',  label: 'Cancelada' },
  repeticao_solicitada: { bg: 'bg-warning-400', label: 'Repetição Solicitada' },
}

export default function Aliquotagem({ csrfToken }) {
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [confirmadas, setConfirmadas] = useState([])
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const inputRef = useRef()

  // Re-foca o input de amostra após cada ação (se operador validado)
  useEffect(() => {
    if (operador) inputRef.current?.focus()
  }, [confirmadas, feedback, operador])

  async function handleSubmit(e) {
    e.preventDefault()
    const val = codigo.trim()
    if (!val || !operador) return

    setCarregando(true)
    setFeedback(null)

    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/amostras/receber/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ codigo: val, numero_cracha: operador.numero_cracha }),
        credentials: 'same-origin',
      })

      const data = await res.json()

      if (data.sucesso) {
        setFeedback({ tipo: 'sucesso', msg: `${fmtAmostra(data.amostra)} confirmada.` })
        setConfirmadas(prev => [{ ...data.amostra, _operador: operador.nome_completo }, ...prev])
      } else if (data.aviso) {
        setFeedback({ tipo: 'aviso', msg: `${fmtAmostra(data.amostra)} — ${data.aviso}` })
      } else {
        setFeedback({ tipo: 'erro', msg: data.erro || 'Erro desconhecido.' })
      }
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: `Falha de conexão: ${err.message}` })
    } finally {
      setCodigo('')
      setCarregando(false)
    }
  }

  function limparSessao() {
    setConfirmadas([])
    setFeedback(null)
  }

  return (
    <div>
      <NavigationButtons currentStep="aliquotagem" />
      
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Aliquotagem" />
      )}

      {/* Barra do operador */}
      {operador && (
        <div className="flex items-center gap-3 bg-success-50 border border-success-200 rounded-lg px-4 py-2.5 mb-4">
          <span className="text-sm text-success-700 font-semibold">
            Operador: {operador.nome_completo}
          </span>
          <span className="text-xs bg-success-100 text-success-700 px-1.5 py-0.5 rounded-full font-medium">
            {operador.perfil}
          </span>
          <button
            onClick={() => setOperador(null)}
            className="ml-auto bg-none border border-success-200 rounded-md px-3 py-1 text-xs text-success-700 cursor-pointer font-medium hover:bg-success-100"
          >
            Trocar operador
          </button>
        </div>
      )}

      {/* Input de leitura da amostra */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder="Escanear código da amostra..."
          disabled={carregando || !operador}
          autoComplete="off"
          className="flex-1 px-4 py-3 text-lg border-2 border-info-300 rounded-lg outline-none transition-colors focus:border-primary-500 bg-white"
        />
        <button
          type="submit"
          disabled={carregando || !codigo.trim() || !operador}
          className={`px-5 py-3 rounded-md bg-primary-700 text-white font-medium text-sm cursor-pointer hover:bg-primary-800 transition-colors ${
            (carregando || !codigo.trim() || !operador) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {carregando ? 'Verificando...' : 'Confirmar'}
        </button>
      </form>

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-md mb-6 ${
          feedback.tipo === 'sucesso'
            ? 'bg-success-50 text-success-700 border border-success-200'
            : feedback.tipo === 'aviso'
            ? 'bg-warning-50 text-warning-700 border border-warning-200'
            : 'bg-danger-50 text-danger-700 border border-danger-200'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Contador + limpar */}
      {confirmadas.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="bg-success-50 text-success-700 px-4 py-1.5 rounded-md font-semibold text-sm">
            {confirmadas.length} amostra{confirmadas.length !== 1 ? 's' : ''} aliquotada{confirmadas.length !== 1 ? 's' : ''} nesta sessão
          </span>
          <button onClick={limparSessao} className="px-5 py-2 rounded-md bg-gray-500 text-white font-medium text-sm cursor-pointer hover:bg-gray-600">
            Limpar sessão
          </button>
        </div>
      )}

      {/* Lista de confirmadas */}
      {confirmadas.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Num. Interno</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Cód. Exame</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Paciente</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Município</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">Operador</th>
              </tr>
            </thead>
            <tbody>
              {confirmadas.map((a, i) => {
                const badge = STATUS_BADGE[a.status] || { bg: 'bg-gray-500', label: a.status_display }
                return (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-400 text-center">
                      {confirmadas.length - i}
                    </td>
                    <td className="px-3 py-2 text-gray-700 font-semibold">{a.codigo_interno || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{a.cod_exame_gal}</td>
                    <td className="px-3 py-2 text-gray-700">{a.nome_paciente}</td>
                    <td className="px-3 py-2 text-gray-700">{a.municipio || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`${badge.bg} text-white px-2 py-0.5 rounded text-xs font-medium`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {a._operador || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// --- Helpers ---

function fmtAmostra(a) {
  const id = a.codigo_interno || a.cod_exame_gal
  return `${id} — ${a.nome_paciente}`
}