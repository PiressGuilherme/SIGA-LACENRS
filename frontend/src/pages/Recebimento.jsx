import React, { useState, useRef, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial, getCsrfToken } from '../utils/auth'

const STATUS_BADGE = {
  aguardando_triagem:   { bg: 'bg-gray-500',   label: 'Aguardando Triagem' },
  exame_em_analise:     { bg: 'bg-info-500',    label: 'Exame em Análise' },
  aliquotada:           { bg: 'bg-primary-500', label: 'Aliquotada' },
  extracao:             { bg: 'bg-warning-500', label: 'Extração' },
  extraida:             { bg: 'bg-purple-500',  label: 'Extraída' },
  resultado:            { bg: 'bg-teal-500',    label: 'Resultado' },
  resultado_liberado:   { bg: 'bg-success-600', label: 'Resultado Liberado' },
  cancelada:            { bg: 'bg-danger-500',  label: 'Cancelada' },
  repeticao_solicitada: { bg: 'bg-warning-400', label: 'Repetição Solicitada' },
}

export default function Recebimento({ csrfToken }) {
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [feedback, setFeedback] = useState(null) // { tipo: 'sucesso'|'aviso'|'erro', msg }
  const [confirmadas, setConfirmadas] = useState([])
  const inputRef = useRef()

  // Foco automático no input ao montar e após cada ação
  useEffect(() => { inputRef.current?.focus() }, [confirmadas, feedback])

  async function handleSubmit(e) {
    e.preventDefault()
    const val = codigo.trim()
    if (!val) return

    setCarregando(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/amostras/receber/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ codigo: val }),
        credentials: 'same-origin',
      })

      const data = await res.json()

      if (data.sucesso) {
        setFeedback({ tipo: 'sucesso', msg: `${fmtAmostra(data.amostra)} confirmada.` })
        setConfirmadas(prev => [data.amostra, ...prev])
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
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Recebimento de Amostras" />
      )}

      <h2 className="mb-2 text-xl font-bold text-primary-700">
        Recebimento de Amostras
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Escaneie ou digite o código da amostra para confirmar a aliquotagem.
      </p>

      {/* Input de leitura */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder="Escanear código de barras..."
          disabled={carregando}
          autoComplete="off"
          className="flex-1 px-4 py-3 text-lg border-2 border-info-300 rounded-lg outline-none transition-colors focus:border-primary-500"
        />
        <button
          type="submit"
          disabled={carregando || !codigo.trim()}
          className={`px-5 py-3 rounded-md bg-primary-700 text-white font-medium text-sm cursor-pointer hover:bg-primary-800 transition-colors ${
            (carregando || !codigo.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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
            {confirmadas.length} amostra{confirmadas.length !== 1 ? 's' : ''} confirmada{confirmadas.length !== 1 ? 's' : ''} nesta sessão
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