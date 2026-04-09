import React, { useState, useEffect, useRef } from 'react'
import CrachaModal from '../components/CrachaModal'
import NavigationButtons from '../components/NavigationButtons'
import { getOperadorInicial } from '../utils/auth'
import apiFetch from '../utils/apiFetch'

// ── Constantes ─────────────────────────────────────────────────────────────

const RESULTADO_FINAL = {
  hpv_nao_detectado: { label: 'HPV não detectável',                  bg: '#198754' },
  hpv16:             { label: 'HPV-16 detectável',                    bg: '#dc3545' },
  hpv18:             { label: 'HPV-18 detectável',                    bg: '#dc3545' },
  hpv_ar:            { label: 'HPV AR detectável',                    bg: '#dc3545' },
  hpv18_ar:          { label: 'HPV-18 e HPV AR detectáveis',          bg: '#dc3545' },
  hpv16_ar:          { label: 'HPV-16 e HPV AR detectáveis',          bg: '#dc3545' },
  hpv16_18:          { label: 'HPV-16 e HPV-18 detectáveis',          bg: '#dc3545' },
  hpv16_18_ar:       { label: 'HPV-16, HPV-18 e HPV AR detectáveis',  bg: '#dc3545' },
  invalido:          { label: 'Inválido',                             bg: '#ffc107', color: '#000' },
  inconclusivo:      { label: 'Inconclusivo',                         bg: '#fd7e14' },
  pendente:          { label: 'Pendente',                             bg: '#6c757d' },
}

// canal key no DB → { label, resultKey }
const CANAIS = [
  { canal: 'CI',     label: 'CI',     key: 'ci_resultado'    },
  { canal: 'HPV16',  label: 'HPV-16', key: 'hpv16_resultado' },
  { canal: 'HPV18',  label: 'HPV-18', key: 'hpv18_resultado' },
  { canal: 'HPV_AR', label: 'HPV AR', key: 'hpvar_resultado'  },
]

const INTERP_STYLE = {
  positivo: { bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5' },
  negativo: { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  invalido: { bg: '#fefce8', color: '#a16207', border: '#fde047' },
  pendente: { bg: '#f9fafb', color: '#6b7280', border: '#d1d5db' },
}

// ── Componente principal ───────────────────────────────────────────────────

export default function RevisarResultados({}) {
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [placas, setPlacas] = useState([])
  const [placaSelecionada, setPlacaSelecionada] = useState(null)
  const [arquivo, setArquivo] = useState(null)
  const [fase, setFase] = useState('inicial')   // 'inicial' | 'revisao'
  const [resultados, setResultados] = useState([])
  const [importFeedback, setImportFeedback] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [overrideModal, setOverrideModal] = useState(null)
  const [overrideForm, setOverrideForm] = useState({ interpretacao_manual: '', justificativa_manual: '' })
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideErro, setOverrideErro] = useState(null)
  const [actionLoading, setActionLoading] = useState({})
  const [kits, setKits] = useState([])
  const [kitId, setKitId] = useState(null)
  const fileRef = useRef()

  useEffect(() => { fetchPlacas() }, [])

  // Carregar kits de interpretacao ativos
  useEffect(() => {
    apiFetch('/api/configuracoes/kits/?ativo=true')
      .then(data => {
        const lista = data.results || data
        setKits(lista)
        if (lista.length > 0 && !kitId) setKitId(lista[0].id)
      })
      .catch(() => {})
  }, [])

  async function fetchPlacas() {
    try {
      const [r1, r2, r3] = await Promise.all([
        apiFetch('/api/placas/?status_placa=submetida', {}),
        apiFetch('/api/placas/?status_placa=resultados_importados', {}),
        apiFetch('/api/placas/?status_placa=aberta', {}),
      ])
      // Inclui placas "aberta" que já têm amostras extraídas (criadas antes da correção do status)
      const abertas = (r3.results || r3).filter(p => p.total_amostras > 0)
      setPlacas([...(r1.results || r1), ...(r2.results || r2), ...abertas])
    } catch {
      setPlacas([])
    }
  }

  function selecionarPlaca(placa) {
    setPlacaSelecionada(placa)
    setArquivo(null)
    setErro(null)
    setImportFeedback(null)
    setResultados([])
    if (placa.status_placa === 'resultados_importados') {
      setFase('revisao')
      carregarResultados(placa.id)
    } else {
      setFase('inicial')
    }
  }

  async function carregarResultados(placaId) {
    setCarregando(true)
    setErro(null)
    try {
      const data = await apiFetch(`/api/resultados/?placa_id=${placaId}`, {})
      setResultados(data.results || data)
    } catch (err) {
      setErro(err.data?.erro || 'Erro ao carregar resultados.')
    } finally {
      setCarregando(false)
    }
  }

  async function importarCSV() {
    if (!placaSelecionada || !arquivo) return
    setCarregando(true)
    setErro(null)
    setImportFeedback(null)
    try {
      const form = new FormData()
      form.append('arquivo', arquivo)
      form.append('placa_id', placaSelecionada.id)
      if (kitId) form.append('kit_id', kitId)
      if (operador?.numero_cracha) form.append('numero_cracha', operador.numero_cracha)
      const data = await apiFetch('/api/resultados/importar/', {
        method: 'POST', body: form, isMultipart: true,
      })
      setImportFeedback({ cp: data.cp, cn: data.cn, avisos: data.avisos, mensagem: data.mensagem })
      setResultados(data.resultados || [])
      setPlacaSelecionada(prev => ({ ...prev, status_placa: 'resultados_importados' }))
      setFase('revisao')
    } catch (err) {
      const d = err.data || {}
      if (err.status === 422) {
        setErro(`Corrida inválida — ${[d.cp, d.cn].filter(Boolean).join('; ')}`)
      } else {
        setErro(d.erro || d.detail || 'Erro ao importar CSV.')
      }
    } finally {
      setCarregando(false)
    }
  }

  async function confirmarResultado(id) {
    setActionLoading(p => ({ ...p, [id]: 'confirmar' }))
    try {
      const updated = await apiFetch(`/api/resultados/${id}/confirmar/`, {
        method: 'POST', body: { numero_cracha: operador?.numero_cracha },
      })
      setResultados(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
    } catch (err) {
      alert(err.data?.erro || 'Erro ao confirmar resultado.')
    } finally {
      setActionLoading(p => ({ ...p, [id]: null }))
    }
  }

  async function confirmarTodos() {
    const pendentes = resultados.filter(r => !r.imutavel)
    if (pendentes.length === 0) return
    if (!confirm(`Confirmar todos os ${pendentes.length} resultados pendentes desta placa?`)) return
    for (const r of pendentes) {
      await confirmarResultado(r.id)
    }
  }

  async function liberarResultado(id) {
    setActionLoading(p => ({ ...p, [id]: 'liberar' }))
    try {
      const updated = await apiFetch(`/api/resultados/${id}/liberar/`, {
        method: 'POST', body: { numero_cracha: operador?.numero_cracha },
      })
      setResultados(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
    } catch (err) {
      alert(err.data?.erro || 'Erro ao liberar resultado.')
    } finally {
      setActionLoading(p => ({ ...p, [id]: null }))
    }
  }

  async function solicitarRepeticao(id) {
    if (!confirm('Confirma solicitação de repetição para esta amostra?')) return
    setActionLoading(p => ({ ...p, [id]: 'repeticao' }))
    try {
      await apiFetch(`/api/resultados/${id}/solicitar-repeticao/`, {
        method: 'POST', body: { numero_cracha: operador?.numero_cracha },
      })
      await carregarResultados(placaSelecionada.id)
    } catch (err) {
      alert(err.data?.erro || 'Erro ao solicitar repetição.')
    } finally {
      setActionLoading(p => ({ ...p, [id]: null }))
    }
  }

  function abrirOverride(resultado, canalDef) {
    const canalObj = resultado.canais?.find(c => c.canal === canalDef.canal)
    if (!canalObj) return
    setOverrideModal({ resultadoId: resultado.id, canalId: canalObj.id, canalLabel: canalDef.label, canalKey: canalDef.canal })
    setOverrideForm({
      interpretacao_manual: canalObj.interpretacao_manual || '',
      justificativa_manual: canalObj.justificativa_manual || '',
    })
    setOverrideErro(null)
  }

  async function salvarOverride() {
    setOverrideLoading(true)
    setOverrideErro(null)
    try {
      await apiFetch(`/api/resultados/pocos/${overrideModal.canalId}/`, {
        method: 'PATCH',
        body: {
          interpretacao_manual: overrideForm.interpretacao_manual || null,
          justificativa_manual: overrideForm.justificativa_manual,
        },
      })
      setOverrideModal(null)
      await carregarResultados(placaSelecionada.id)
    } catch (err) {
      const d = err.data || {}
      setOverrideErro(d.justificativa_manual?.[0] || d.non_field_errors?.[0] || d.erro || 'Erro ao salvar.')
    } finally {
      setOverrideLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'inherit', maxWidth: 1200 }}>
      <NavigationButtons currentStep="resultados" />

      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Revisão de Resultados PCR" gruposRequeridos={['especialista', 'supervisor']} />
      )}

      <h2 style={{ marginBottom: '1.25rem', fontSize: '1.3rem', color: '#1a3a5c' }}>
        Revisão de Resultados PCR
      </h2>

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

      {/* Seletor de placa */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontWeight: 600, color: '#374151', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
          Selecionar Placa
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={placaSelecionada?.id || ''}
            onChange={e => {
              const p = placas.find(x => x.id === Number(e.target.value))
              if (p) selecionarPlaca(p)
            }}
            style={{ ...selectStyle, minWidth: 260, flex: 1 }}
          >
            <option value="">— Escolha uma placa —</option>
            {placas.length === 0 && <option disabled>Nenhuma placa disponível</option>}
            {placas.map(p => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {STATUS_LABEL[p.status_placa] || p.status_placa}
              </option>
            ))}
          </select>
          <button onClick={fetchPlacas} style={btnSecStyle} title="Atualizar lista">
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Upload (placa submetida) ────────────────────────── */}
      {placaSelecionada && fase === 'inicial' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem', marginBottom: '1rem' }}>
          <p style={{ color: '#374151', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Placa <strong>{placaSelecionada.codigo}</strong> aguardando importação dos resultados do termociclador.
          </p>
          {/* Kit de interpretacao */}
          {kits.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontWeight: 600, color: '#374151', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                Kit de Interpretacao
              </label>
              <select
                value={kitId || ''}
                onChange={e => setKitId(Number(e.target.value))}
                style={{ padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', minWidth: 220 }}
              >
                {kits.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.nome} (CI ≤{k.cq_amostra_ci_max} / HPV ≤{k.cq_amostra_hpv_max})
                  </option>
                ))}
              </select>
            </div>
          )}
          <label style={{ display: 'block', fontWeight: 600, color: '#374151', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
            Arquivo CSV do CFX Manager
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.CSV"
              onChange={e => setArquivo(e.target.files[0] || null)}
              style={{ fontSize: '0.875rem', flex: 1, minWidth: 200 }}
            />
            <button
              onClick={importarCSV}
              disabled={!arquivo || carregando}
              style={btnPrimStyle(!arquivo || carregando)}
            >
              {carregando ? 'Importando…' : 'Importar Resultados'}
            </button>
          </div>
          {arquivo && (
            <p style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#6b7280' }}>
              Arquivo: <strong>{arquivo.name}</strong> ({(arquivo.size / 1024).toFixed(1)} KB)
            </p>
          )}
          {erro && <AlertBox tipo="erro">{erro}</AlertBox>}
        </div>
      )}

      {/* ── Revisão (resultados carregados) ────────────────── */}
      {fase === 'revisao' && (
        <>
          {/* Feedback do import */}
          {importFeedback && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <ControleBadge ok label="CP" msg={importFeedback.cp} />
              <ControleBadge ok label="CN" msg={importFeedback.cn} />
              {importFeedback.mensagem && (
                <span style={{ fontSize: '0.82rem', color: '#374151', alignSelf: 'center' }}>
                  {importFeedback.mensagem}
                </span>
              )}
              {importFeedback.avisos?.map((a, i) => (
                <div key={i} style={{ width: '100%', ...alertStyle('aviso') }}>{a}</div>
              ))}
            </div>
          )}

          {erro && <AlertBox tipo="erro">{erro}</AlertBox>}

          {carregando ? (
            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Carregando…</p>
          ) : (
            <ResultadosTable
              resultados={resultados}
              actionLoading={actionLoading}
              onConfirmar={confirmarResultado}
              onConfirmarTodos={confirmarTodos}
              onLiberar={liberarResultado}
              onRepeticao={solicitarRepeticao}
              onOverride={abrirOverride}
            />
          )}

          <button
            onClick={() => { setFase('inicial'); setImportFeedback(null); setErro(null) }}
            style={{ ...btnSecStyle, marginTop: '1rem' }}
          >
            ← Importar outro arquivo
          </button>
        </>
      )}

      {/* ── Modal de override manual ────────────────────────── */}
      {overrideModal && (
        <Modal onClose={() => setOverrideModal(null)}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#1a3a5c' }}>
            Override manual — Canal {overrideModal.canalLabel}
          </h3>
          <label style={labelStyle}>Interpretação manual</label>
          <select
            value={overrideForm.interpretacao_manual}
            onChange={e => setOverrideForm(f => ({ ...f, interpretacao_manual: e.target.value }))}
            style={{ ...selectStyle, marginBottom: '0.75rem', width: '100%' }}
          >
            <option value="">— Limpar override (usar automático) —</option>
            <option value="positivo">Positivo</option>
            <option value="negativo">Negativo</option>
            <option value="invalido">Inválido</option>
          </select>
          <label style={labelStyle}>Justificativa {overrideForm.interpretacao_manual ? '(obrigatória)' : ''}</label>
          <textarea
            rows={3}
            value={overrideForm.justificativa_manual}
            onChange={e => setOverrideForm(f => ({ ...f, justificativa_manual: e.target.value }))}
            placeholder="Descreva o motivo da alteração…"
            style={{
              width: '100%', padding: '0.5rem', fontSize: '0.875rem',
              border: '1px solid #d1d5db', borderRadius: 6, resize: 'vertical',
              outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem',
            }}
          />
          {overrideErro && <AlertBox tipo="erro">{overrideErro}</AlertBox>}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button onClick={() => setOverrideModal(null)} style={btnSecStyle}>Cancelar</button>
            <button
              onClick={salvarOverride}
              disabled={overrideLoading}
              style={btnPrimStyle(overrideLoading)}
            >
              {overrideLoading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function ResultadosTable({ resultados, actionLoading, onConfirmar, onConfirmarTodos, onLiberar, onRepeticao, onOverride }) {
  if (resultados.length === 0) {
    return (
      <p style={{ color: '#9ca3af', fontSize: '0.9rem', padding: '1rem 0' }}>
        Nenhum resultado encontrado para esta placa.
      </p>
    )
  }

  const totalConfirmados = resultados.filter(r => r.imutavel).length
  const totalPendentes = resultados.length - totalConfirmados

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
          {resultados.length} amostra{resultados.length !== 1 ? 's' : ''} •{' '}
          {totalConfirmados} confirmada{totalConfirmados !== 1 ? 's' : ''}
          {totalPendentes > 0 && ` • ${totalPendentes} pendente${totalPendentes !== 1 ? 's' : ''}`}
        </span>
        {totalPendentes > 0 && (
          <button
            onClick={onConfirmarTodos}
            style={{ ...btnSmStyle('#0d6efd'), padding: '4px 12px', fontSize: '0.82rem' }}
          >
            Confirmar todos ({totalPendentes})
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
              <th style={thStyle}>Num. Interno</th>
              {CANAIS.map(c => <th key={c.canal} style={{ ...thStyle, textAlign: 'center' }}>{c.label}</th>)}
              <th style={thStyle}>Resultado Final</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {resultados.map(r => (
              <ResultadoRow
                key={r.id}
                resultado={r}
                actionLoading={actionLoading[r.id]}
                onConfirmar={onConfirmar}
                onLiberar={onLiberar}
                onRepeticao={onRepeticao}
                onOverride={onOverride}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ResultadoRow({ resultado, actionLoading, onConfirmar, onLiberar, onRepeticao, onOverride }) {
  const rf = RESULTADO_FINAL[resultado.resultado_final] || RESULTADO_FINAL.pendente
  const statusLabel = resultado.imutavel
    ? (resultado.amostra_status === 'resultado_liberado' ? 'Liberado' : 'Confirmado')
    : 'Pendente'
  const statusColor = resultado.imutavel
    ? (resultado.amostra_status === 'resultado_liberado' ? '#198754' : '#0d6efd')
    : '#6c757d'

  return (
    <tr style={{ borderBottom: '1px solid #f0f4f8' }}>
      <td style={{ ...tdStyle, fontWeight: 600 }}>{resultado.amostra_codigo || '—'}</td>

      {CANAIS.map(c => {
        const val = resultado[c.key]
        const s = INTERP_STYLE[val] || INTERP_STYLE.pendente
        const canalObj = resultado.canais?.find(x => x.canal === c.canal)
        const hasManual = canalObj?.interpretacao_manual != null
        return (
          <td key={c.canal} style={{ ...tdStyle, textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
              <span style={{
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                padding: '1px 7px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 500,
                whiteSpace: 'nowrap',
              }}>
                {val || '—'}
                {hasManual && <sup title="Override manual"> *</sup>}
              </span>
              {!resultado.imutavel && canalObj && (
                <button
                  onClick={() => onOverride(resultado, c)}
                  title="Editar interpretação"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '1px 2px',
                    color: '#9ca3af', fontSize: '0.75rem', lineHeight: 1,
                  }}
                >
                  ✎
                </button>
              )}
            </div>
            {canalObj?.cq != null && (
              <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 1 }}>
                Cq {canalObj.cq.toFixed(1)}
              </div>
            )}
          </td>
        )
      })}

      {/* Resultado final */}
      <td style={tdStyle}>
        <span style={{
          background: rf.bg, color: rf.color || '#fff',
          padding: '2px 8px', borderRadius: 4, fontSize: '0.76rem', fontWeight: 500,
          whiteSpace: 'nowrap', display: 'inline-block',
        }}>
          {rf.label}
        </span>
      </td>

      {/* Status */}
      <td style={tdStyle}>
        <span style={{
          background: statusColor, color: '#fff',
          padding: '2px 8px', borderRadius: 4, fontSize: '0.76rem', fontWeight: 500,
        }}>
          {statusLabel}
        </span>
      </td>

      {/* Ações */}
      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {!resultado.imutavel && (
          <>
            <button
              onClick={() => onConfirmar(resultado.id)}
              disabled={!!actionLoading}
              style={{ ...btnSmStyle('#0d6efd'), marginLeft: 4 }}
            >
              {actionLoading === 'confirmar' ? '…' : 'Confirmar'}
            </button>
            <button
              onClick={() => onRepeticao(resultado.id)}
              disabled={!!actionLoading}
              style={{ ...btnSmStyle('#fd7e14'), marginLeft: 4 }}
              title="Solicitar repetição de PCR"
            >
              {actionLoading === 'repeticao' ? '…' : 'Repetir'}
            </button>
          </>
        )}
        {resultado.imutavel && resultado.resultado_final !== 'pendente' && (
          <button
            onClick={() => onLiberar(resultado.id)}
            disabled={!!actionLoading}
            style={{ ...btnSmStyle('#198754'), marginLeft: 4 }}
          >
            {actionLoading === 'liberar' ? '…' : 'Liberar'}
          </button>
        )}
      </td>
    </tr>
  )
}

function ControleBadge({ ok, label, msg }) {
  return (
    <span style={{
      background: ok ? '#d1fae5' : '#fee2e2',
      color: ok ? '#065f46' : '#991b1b',
      border: `1px solid ${ok ? '#6ee7b7' : '#fca5a5'}`,
      padding: '2px 10px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
    }}
      title={msg}
    >
      {label}: {ok ? 'OK' : 'FALHOU'}
    </span>
  )
}

function AlertBox({ tipo, children }) {
  const styles = {
    erro:  { bg: '#fee2e2', color: '#b91c1c' },
    aviso: { bg: '#fefce8', color: '#92400e' },
    info:  { bg: '#eff6ff', color: '#1e40af' },
  }
  const s = styles[tipo] || styles.info
  return (
    <div style={{
      background: s.bg, color: s.color,
      padding: '0.55rem 0.9rem', borderRadius: 6, fontSize: '0.85rem',
      marginTop: '0.5rem', marginBottom: '0.5rem',
    }}>
      {children}
    </div>
  )
}

function Modal({ onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 10, padding: '1.5rem',
        width: 440, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Helpers de estilo ──────────────────────────────────────────────────────

const STATUS_LABEL = {
  aberta:                'Aberta',
  submetida:             'Submetida',
  resultados_importados: 'Resultados Importados',
}

const thStyle = {
  padding: '0.6rem 0.75rem', textAlign: 'left',
  fontWeight: 600, color: '#374151', whiteSpace: 'nowrap',
}

const tdStyle = { padding: '0.55rem 0.75rem', color: '#374151', verticalAlign: 'middle' }

const selectStyle = {
  padding: '0.55rem 0.6rem', fontSize: '0.875rem',
  border: '1px solid #d1d5db', borderRadius: 6, background: '#fff',
  color: '#374151', outline: 'none',
}

const labelStyle = {
  display: 'block', fontWeight: 600, color: '#374151',
  fontSize: '0.85rem', marginBottom: '0.3rem',
}

function btnPrimStyle(disabled) {
  return {
    padding: '0.5rem 1.1rem', fontSize: '0.875rem', borderRadius: 6, border: 'none',
    background: disabled ? '#93c5fd' : '#0d6efd', color: '#fff',
    cursor: disabled ? 'default' : 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
  }
}

const btnSecStyle = {
  padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: 6,
  border: '1px solid #d1d5db', background: '#fff', color: '#374151',
  cursor: 'pointer', fontWeight: 500,
}

function btnSmStyle(bg) {
  return {
    padding: '2px 8px', fontSize: '0.78rem', borderRadius: 4, border: 'none',
    background: bg, color: '#fff', cursor: 'pointer', fontWeight: 500,
  }
}

function alertStyle(tipo) {
  if (tipo === 'aviso') return { background: '#fefce8', color: '#92400e', padding: '0.4rem 0.75rem', borderRadius: 5, fontSize: '0.8rem' }
  return {}
}
