import { useState, useRef, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'

const STATUS_BADGE = {
  aguardando_triagem:   { bg: '#6c757d', label: 'Aguardando Triagem' },
  exame_em_analise:     { bg: '#0dcaf0', label: 'Exame em Análise' },
  aliquotada:           { bg: '#0d6efd', label: 'Aliquotada' },
  extracao:             { bg: '#fd7e14', label: 'Extração' },
  extraida:             { bg: '#6f42c1', label: 'Extraída' },
  pcr:                  { bg: '#e53e3e', label: 'PCR' },
  resultado:            { bg: '#20c997', label: 'Resultado' },
  resultado_liberado:   { bg: '#198754', label: 'Resultado Liberado' },
  cancelada:            { bg: '#dc3545', label: 'Cancelada' },
  repeticao_solicitada: { bg: '#ffc107', label: 'Repetição Solicitada' },
}

export default function Aliquotagem({ csrfToken }) {
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [confirmadas, setConfirmadas] = useState([])
  const [operador, setOperador] = useState(null)   // operador atual (validado por crachá)
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
          'X-CSRFToken': csrfToken,
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
    <div style={{ fontFamily: 'inherit' }}>
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Aliquotagem" />
      )}

      {/* Barra do operador */}
      {operador && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 8,
          padding: '0.6rem 1rem', marginBottom: '1rem',
        }}>
          <span style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>
            Operador: {operador.nome_completo}
          </span>
          <span style={{
            fontSize: '0.72rem', background: '#d1fae5', color: '#065f46',
            padding: '1px 6px', borderRadius: 10, fontWeight: 500,
          }}>
            {operador.perfil}
          </span>
          <button
            onClick={() => setOperador(null)}
            style={{
              marginLeft: 'auto', background: 'none', border: '1px solid #6ee7b7',
              borderRadius: 6, padding: '0.3rem 0.75rem', fontSize: '0.78rem',
              color: '#065f46', cursor: 'pointer', fontWeight: 500,
            }}
          >
            Trocar operador
          </button>
        </div>
      )}

      {/* Input de leitura da amostra */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder="Escanear código da amostra..."
          disabled={carregando || !operador}
          autoComplete="off"
          style={{
            flex: 1, padding: '0.75rem 1rem', fontSize: '1.1rem',
            border: '2px solid #93c5fd', borderRadius: 8,
            outline: 'none', transition: 'border-color 0.2s',
            background: '#fff',
          }}
          onFocus={e => e.target.style.borderColor = '#3b82f6'}
          onBlur={e => e.target.style.borderColor = '#93c5fd'}
        />
        <button
          type="submit"
          disabled={carregando || !codigo.trim() || !operador}
          style={{
            ...btnStyle('#1a3a5c'),
            opacity: (carregando || !codigo.trim() || !operador) ? 0.5 : 1,
          }}
        >
          {carregando ? 'Verificando...' : 'Confirmar'}
        </button>
      </form>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1.5rem',
          ...feedbackStyles[feedback.tipo],
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Contador + limpar */}
      {confirmadas.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1rem',
        }}>
          <span style={{
            background: '#d1fae5', color: '#065f46', padding: '0.4rem 1rem',
            borderRadius: 6, fontWeight: 600, fontSize: '0.95rem',
          }}>
            {confirmadas.length} amostra{confirmadas.length !== 1 ? 's' : ''} aliquotada{confirmadas.length !== 1 ? 's' : ''} nesta sessão
          </span>
          <button onClick={limparSessao} style={btnStyle('#6b7280')}>
            Limpar sessão
          </button>
        </div>
      )}

      {/* Lista de confirmadas */}
      {confirmadas.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb',
          overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Num. Interno</th>
                <th style={thStyle}>Cód. Exame</th>
                <th style={thStyle}>Paciente</th>
                <th style={thStyle}>Município</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Operador</th>
              </tr>
            </thead>
            <tbody>
              {confirmadas.map((a, i) => {
                const badge = STATUS_BADGE[a.status] || { bg: '#6c757d', label: a.status_display }
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ ...tdStyle, color: '#9ca3af', textAlign: 'center' }}>
                      {confirmadas.length - i}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{a.codigo_interno || '—'}</td>
                    <td style={tdStyle}>{a.cod_exame_gal}</td>
                    <td style={tdStyle}>{a.nome_paciente}</td>
                    <td style={tdStyle}>{a.municipio || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: badge.bg, color: '#fff',
                        padding: '2px 8px', borderRadius: 4,
                        fontSize: '0.78rem', fontWeight: 500,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '0.78rem', color: '#6b7280' }}>
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

const btnStyle = (bg) => ({
  background: bg, color: '#fff', border: 'none', padding: '0.6rem 1.25rem',
  borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
})

const thStyle = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600,
  color: '#374151', whiteSpace: 'nowrap',
}

const tdStyle = { padding: '0.5rem 0.75rem', color: '#374151' }

const feedbackStyles = {
  sucesso: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  aviso:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  erro:    { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
}
