import { useState, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial } from '../utils/auth'
import apiFetch from '../utils/apiFetch'
import { TabConfiguracao, TabTestarConexao, TabBuscarExames } from './GalWs'

// ── Estilos ──────────────────────────────────────────────────────────────────
const card = {
  background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
  padding: '1.5rem', marginBottom: '1.5rem',
}
const label = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }
const inputStyle = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: '0.9rem', marginBottom: '0.75rem',
  boxSizing: 'border-box',
}
const selectStyle = {
  padding: '0.35rem 0.5rem', borderRadius: 5, border: '1px solid #d1d5db',
  fontSize: '0.82rem', background: '#fff',
}
const btn = (color = '#1a3a5c') => ({
  padding: '0.5rem 1.25rem', borderRadius: 6, border: 'none',
  background: color, color: '#fff', fontWeight: 600, cursor: 'pointer',
  fontSize: '0.875rem',
})
const btnSmall = (color = '#1a3a5c') => ({
  padding: '0.3rem 0.75rem', borderRadius: 4, border: 'none',
  background: color, color: '#fff', fontWeight: 500, cursor: 'pointer',
  fontSize: '0.78rem',
})
const feedbackStyle = (tipo) => ({
  padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.875rem',
  background: tipo === 'ok' ? '#d1fae5' : '#fee2e2',
  color: tipo === 'ok' ? '#065f46' : '#991b1b',
})
const thStyle = {
  padding: '6px 8px', background: '#f8fafc', fontSize: '0.75rem',
  fontWeight: 600, color: '#374151', textAlign: 'left', whiteSpace: 'nowrap',
}
const tdStyle = { padding: '4px 8px', fontSize: '0.82rem', color: '#374151', verticalAlign: 'middle' }

// ── Tab: Reacoes ─────────────────────────────────────────────────────────────
function TabReacoes() {
  const [protocolos, setProtocolos] = useState([])
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { carregarProtocolos() }, [])

  async function carregarProtocolos() {
    try {
      const data = await apiFetch('/api/configuracoes/reacoes/')
      setProtocolos(data.results || data)
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao carregar protocolos.' }) }
  }

  function novoProtocolo() {
    setEditando({
      id: null, nome: '', descricao: '', ativo: true, margem_percentual: 10,
      reagentes: [{ nome: '', volume_por_reacao: '', ordem: 1 }],
    })
    setMsg(null)
  }

  function editarProtocolo(p) {
    setEditando({
      ...p,
      reagentes: p.reagentes.length > 0
        ? p.reagentes.map(r => ({ ...r, volume_por_reacao: String(r.volume_por_reacao) }))
        : [{ nome: '', volume_por_reacao: '', ordem: 1 }],
    })
    setMsg(null)
  }

  function setField(campo, valor) { setEditando(prev => ({ ...prev, [campo]: valor })) }

  function setReagente(idx, campo, valor) {
    setEditando(prev => {
      const reagentes = [...prev.reagentes]
      reagentes[idx] = { ...reagentes[idx], [campo]: valor }
      return { ...prev, reagentes }
    })
  }

  function adicionarReagente() {
    setEditando(prev => ({
      ...prev,
      reagentes: [...prev.reagentes, { nome: '', volume_por_reacao: '', ordem: prev.reagentes.length + 1 }],
    }))
  }

  function removerReagente(idx) {
    setEditando(prev => ({ ...prev, reagentes: prev.reagentes.filter((_, i) => i !== idx) }))
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        nome: editando.nome, descricao: editando.descricao, ativo: editando.ativo,
        margem_percentual: parseFloat(editando.margem_percentual) || 10,
        reagentes: editando.reagentes.filter(r => r.nome.trim()).map((r, i) => ({
          ...(r.id ? { id: r.id } : {}),
          nome: r.nome.trim(), volume_por_reacao: parseFloat(r.volume_por_reacao) || 0, ordem: i + 1,
        })),
      }
      if (editando.id) {
        await apiFetch(`/api/configuracoes/reacoes/${editando.id}/`, { method: 'PUT', body: payload })
      } else {
        await apiFetch('/api/configuracoes/reacoes/', { method: 'POST', body: payload })
      }
      setMsg({ tipo: 'ok', texto: 'Protocolo salvo com sucesso.' })
      setEditando(null)
      carregarProtocolos()
    } catch (err) {
      const d = err.data || {}
      setMsg({ tipo: 'erro', texto: d.nome?.[0] || d.detail || JSON.stringify(d) || 'Erro ao salvar.' })
    } finally { setSalvando(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir este protocolo?')) return
    try {
      await apiFetch(`/api/configuracoes/reacoes/${id}/`, { method: 'DELETE' })
      carregarProtocolos()
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.data?.detail || 'Erro ao excluir. O protocolo pode estar em uso.' })
    }
  }

  if (editando) {
    return (
      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '1rem' }}>
          {editando.id ? 'Editar Protocolo' : 'Novo Protocolo de Reação'}
        </h3>
        {msg && <div style={feedbackStyle(msg.tipo)}>{msg.texto}</div>}
        <form onSubmit={salvar}>
          <label style={label}>Nome</label>
          <input style={inputStyle} value={editando.nome} onChange={e => setField('nome', e.target.value)} required />
          <label style={label}>Descrição</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={editando.descricao} onChange={e => setField('descricao', e.target.value)} />
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
              <input type="checkbox" checked={editando.ativo} onChange={e => setField('ativo', e.target.checked)} /> Ativo
            </label>
            <div style={{ flex: 1 }}>
              <label style={label}>Margem Extra (%)</label>
              <input style={{ ...inputStyle, width: 100, marginBottom: 0 }} type="number" step="0.1" min="0"
                value={editando.margem_percentual} onChange={e => setField('margem_percentual', e.target.value)} />
            </div>
          </div>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151', marginTop: '1rem', marginBottom: '0.5rem' }}>Reagentes</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
            <thead>
              <tr style={{ fontSize: '0.78rem', color: '#6b7280', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px' }}>Reagente</th>
                <th style={{ padding: '4px 8px', width: 120 }}>Volume (uL)</th>
                <th style={{ padding: '4px 8px', width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {editando.reagentes.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '2px 8px' }}>
                    <input style={{ ...inputStyle, marginBottom: 0 }} value={r.nome}
                      onChange={e => setReagente(idx, 'nome', e.target.value)} placeholder="Ex: Master Mix" />
                  </td>
                  <td style={{ padding: '2px 8px' }}>
                    <input style={{ ...inputStyle, marginBottom: 0 }} type="number" step="0.01" min="0"
                      value={r.volume_por_reacao} onChange={e => setReagente(idx, 'volume_por_reacao', e.target.value)} />
                  </td>
                  <td style={{ padding: '2px 8px', textAlign: 'center' }}>
                    {editando.reagentes.length > 1 && (
                      <button type="button" onClick={() => removerReagente(idx)}
                        style={{ ...btnSmall('#ef4444'), padding: '2px 6px' }}>x</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={adicionarReagente} style={btnSmall('#6b7280')}>+ Reagente</button>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="submit" style={btn()} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Protocolo'}</button>
            <button type="button" onClick={() => { setEditando(null); setMsg(null) }} style={btn('#6b7280')}>Cancelar</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div>
      {msg && <div style={feedbackStyle(msg.tipo)}>{msg.texto}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c' }}>Protocolos de Reação</h3>
        <button onClick={novoProtocolo} style={btn()}>+ Novo Protocolo</button>
      </div>
      {protocolos.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Nenhum protocolo cadastrado.</p>}
      {protocolos.map(p => (
        <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1a3a5c', marginBottom: 4 }}>
              {p.nome}{!p.ativo && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#9ca3af' }}>(inativo)</span>}
            </div>
            {p.descricao && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 6 }}>{p.descricao}</div>}
            <div style={{ fontSize: '0.82rem', color: '#374151' }}>
              {p.reagentes.map(r => `${r.nome}: ${r.volume_por_reacao} uL`).join(' | ')}
              {p.margem_percentual > 0 && <span style={{ color: '#6b7280' }}> (+{p.margem_percentual}% Margem)</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={() => editarProtocolo(p)} style={btnSmall()}>Editar</button>
            <button onClick={() => excluir(p.id)} style={btnSmall('#ef4444')}>Excluir</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Kits de Interpretacao ───────────────────────────────────────────────

const TIPOS_ALVO = [
  { value: 'PATOGENO', label: 'Patógeno' },
  { value: 'CONTROLE_INTERNO', label: 'Controle Interno' },
  { value: 'CONTROLE_EXTERNO', label: 'Controle Externo' },
]
const OPERADORES = [
  { value: 'LTE', label: 'Ct ≤' },
  { value: 'GTE', label: 'Ct ≥' },
  { value: 'SEM_AMP', label: 'Sem amplificação' },
]
const CONTEXTOS = ['CP', 'CN', 'AMOSTRA_POSITIVO']
const CONTEXTO_LABEL = { CP: 'Ctrl +', CN: 'Ctrl –', AMOSTRA_POSITIVO: 'Amostra' }
const TIPOS_RESULTADO = [
  { value: 'DETECTADO', label: 'Detectado' },
  { value: 'NAO_DETECTADO', label: 'Não detectado' },
  { value: 'INVALIDO_ENSAIO', label: 'Ensaio inválido' },
  { value: 'INVALIDO_AMOSTRA', label: 'Amostra inválida' },
  { value: 'REVISAO_MANUAL', label: 'Revisão manual' },
]
const COND_ALVO_OPTS = ['QUALQUER', 'POSITIVO', 'NEGATIVO']
const COND_CTRL_OPTS = ['QUALQUER', 'VALIDO', 'INVALIDO']

function novoAlvo(ordem) {
  return {
    _key: Math.random(), nome: '', tipo_alvo: 'PATOGENO', canal: '', ordem,
    limiares: CONTEXTOS.map(c => ({ contexto: c, operador: 'LTE', ct_limiar: '' })),
  }
}
function novaRegra(prioridade, alvoNomes) {
  const condicoes = {}
  alvoNomes.forEach(n => { condicoes[n] = 'QUALQUER' })
  condicoes['CP'] = 'VALIDO'
  condicoes['CN'] = 'VALIDO'
  return { _key: Math.random(), prioridade, resultado_label: '', resultado_codigo: '', tipo_resultado: 'DETECTADO', condicoes }
}

function TabKits() {
  const [kits, setKits] = useState([])
  const [editando, setEditando] = useState(null)
  const [abaKit, setAbaKit] = useState('basico') // 'basico' | 'alvos' | 'regras'
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [expandirLimiares, setExpandirLimiares] = useState(false)

  useEffect(() => { carregarKits() }, [])

  async function carregarKits() {
    try {
      const data = await apiFetch('/api/configuracoes/kits/')
      setKits(data.results || data)
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao carregar kits.' }) }
  }

  function novoKit() {
    setEditando({
      id: null, nome: '', descricao: '', ativo: true,
      cq_controle_max: 25.0, cq_amostra_ci_max: 33.0, cq_amostra_hpv_max: 40.0,
      alvos: [],
      regras_interpretacao: [],
    })
    setAbaKit('basico')
    setMsg(null)
  }

  function editarKit(k) {
    // Normaliza alvos: garante limiares para todos os contextos
    const alvos = (k.alvos || []).map(a => ({
      ...a,
      _key: a.id || Math.random(),
      limiares: CONTEXTOS.map(ctx => {
        const l = (a.limiares || []).find(x => x.contexto === ctx)
        return l ? { ...l, ct_limiar: l.ct_limiar ?? '' } : { contexto: ctx, operador: 'LTE', ct_limiar: '' }
      }),
    }))
    const regras = (k.regras_interpretacao || []).map(r => ({ ...r, _key: r.id || Math.random() }))
    setEditando({ ...k, alvos, regras_interpretacao: regras })
    setAbaKit('basico')
    setExpandirLimiares(false)
    setMsg(null)
  }

  function setField(campo, valor) { setEditando(prev => ({ ...prev, [campo]: valor })) }

  // ── Alvos ──
  function addAlvo() {
    setEditando(prev => ({ ...prev, alvos: [...prev.alvos, novoAlvo(prev.alvos.length + 1)] }))
  }
  function removeAlvo(idx) {
    setEditando(prev => ({ ...prev, alvos: prev.alvos.filter((_, i) => i !== idx) }))
  }
  function setAlvo(idx, campo, valor) {
    setEditando(prev => {
      const alvos = [...prev.alvos]
      alvos[idx] = { ...alvos[idx], [campo]: valor }
      return { ...prev, alvos }
    })
  }
  function setLimiar(alvoIdx, ctxIdx, campo, valor) {
    setEditando(prev => {
      const alvos = [...prev.alvos]
      const limiares = [...alvos[alvoIdx].limiares]
      limiares[ctxIdx] = { ...limiares[ctxIdx], [campo]: valor }
      alvos[alvoIdx] = { ...alvos[alvoIdx], limiares }
      return { ...prev, alvos }
    })
  }

  // ── Regras ──
  function addRegra() {
    const alvoNomes = (editando?.alvos || []).map(a => a.nome).filter(Boolean)
    const maxPrio = Math.max(0, ...(editando?.regras_interpretacao || []).map(r => r.prioridade))
    setEditando(prev => ({
      ...prev,
      regras_interpretacao: [...prev.regras_interpretacao, novaRegra(maxPrio + 10, alvoNomes)],
    }))
  }
  function removeRegra(idx) {
    setEditando(prev => ({ ...prev, regras_interpretacao: prev.regras_interpretacao.filter((_, i) => i !== idx) }))
  }
  function setRegra(idx, campo, valor) {
    setEditando(prev => {
      const regras = [...prev.regras_interpretacao]
      regras[idx] = { ...regras[idx], [campo]: valor }
      return { ...prev, regras_interpretacao: regras }
    })
  }
  function setCondicao(idx, chave, valor) {
    setEditando(prev => {
      const regras = [...prev.regras_interpretacao]
      regras[idx] = { ...regras[idx], condicoes: { ...regras[idx].condicoes, [chave]: valor } }
      return { ...prev, regras_interpretacao: regras }
    })
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        nome: editando.nome, descricao: editando.descricao, ativo: editando.ativo,
        cq_controle_max: parseFloat(editando.cq_controle_max) || 25,
        cq_amostra_ci_max: parseFloat(editando.cq_amostra_ci_max) || 33,
        cq_amostra_hpv_max: parseFloat(editando.cq_amostra_hpv_max) || 40,
        alvos: editando.alvos.filter(a => a.nome.trim()).map((a, i) => ({
          nome: a.nome.trim(), tipo_alvo: a.tipo_alvo, canal: a.canal || '', ordem: i,
          limiares: a.limiares
            .filter(l => l.operador === 'SEM_AMP' || (l.ct_limiar !== '' && l.ct_limiar != null))
            .map(l => ({
              contexto: l.contexto,
              operador: l.operador,
              ct_limiar: l.operador === 'SEM_AMP' ? null : (parseFloat(l.ct_limiar) || null),
            })),
        })),
        regras_interpretacao: editando.regras_interpretacao.map(r => ({
          prioridade: parseInt(r.prioridade) || 10,
          resultado_label: r.resultado_label,
          resultado_codigo: r.resultado_codigo || '',
          tipo_resultado: r.tipo_resultado,
          condicoes: r.condicoes,
        })),
      }
      if (editando.id) {
        await apiFetch(`/api/configuracoes/kits/${editando.id}/`, { method: 'PUT', body: payload })
      } else {
        await apiFetch('/api/configuracoes/kits/', { method: 'POST', body: payload })
      }
      setMsg({ tipo: 'ok', texto: 'Kit salvo com sucesso.' })
      setEditando(null)
      carregarKits()
    } catch (err) {
      const d = err.data || {}
      setMsg({ tipo: 'erro', texto: d.nome?.[0] || d.detail || JSON.stringify(d) || 'Erro ao salvar.' })
    } finally { setSalvando(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir este kit?')) return
    try {
      await apiFetch(`/api/configuracoes/kits/${id}/`, { method: 'DELETE' })
      carregarKits()
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.data?.detail || 'Erro ao excluir.' })
    }
  }

  // ── Form ──
  if (editando) {
    const alvoNomes = editando.alvos.map(a => a.nome).filter(Boolean)
    const subAbas = [
      { id: 'basico', label: 'Informações' },
      { id: 'alvos', label: `Alvos (${editando.alvos.length})` },
      { id: 'regras', label: `Regras (${editando.regras_interpretacao.length})` },
    ]
    return (
      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '0.75rem' }}>
          {editando.id ? 'Editar Kit' : 'Novo Kit de Interpretação'}
        </h3>
        {msg && <div style={feedbackStyle(msg.tipo)}>{msg.texto}</div>}

        {/* Sub-abas do form */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0' }}>
          {subAbas.map(t => (
            <button key={t.id} type="button" onClick={() => setAbaKit(t.id)} style={{
              padding: '0.4rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.84rem', fontWeight: 600,
              color: abaKit === t.id ? '#1a3a5c' : '#6b7280',
              borderBottom: abaKit === t.id ? '2px solid #1a3a5c' : '2px solid transparent', marginBottom: -2,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={salvar}>
          {/* ── Aba: Informações Básicas ── */}
          {abaKit === 'basico' && (
            <>
              <label style={label}>Nome</label>
              <input style={inputStyle} value={editando.nome} onChange={e => setField('nome', e.target.value)} required />
              <label style={label}>Descrição</label>
              <textarea style={{ ...inputStyle, minHeight: 60 }} value={editando.descricao} onChange={e => setField('descricao', e.target.value)} />
              <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1rem' }}>
                <input type="checkbox" checked={editando.ativo} onChange={e => setField('ativo', e.target.checked)} /> Ativo
              </label>

              {/* Seção de limiares padrão com expansão */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <button type="button" onClick={() => setExpandirLimiares(!expandirLimiares)} style={{
                  width: '100%', padding: '0.75rem', background: '#f8fafc', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.875rem', fontWeight: 600, color: '#374151',
                }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>{expandirLimiares ? '▼' : '▶'}</span>
                  Limiares Padrão (fallback quando alvos não configurados)
                </button>
                {expandirLimiares && (
                  <div style={{ padding: '1rem', background: '#fff', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      <div>
                        <label style={label}>Controles CP/CN CI</label>
                        <input style={inputStyle} type="number" step="0.1" min="0"
                          value={editando.cq_controle_max} onChange={e => setField('cq_controle_max', e.target.value)} />
                      </div>
                      <div>
                        <label style={label}>Amostra CI</label>
                        <input style={inputStyle} type="number" step="0.1" min="0"
                          value={editando.cq_amostra_ci_max} onChange={e => setField('cq_amostra_ci_max', e.target.value)} />
                      </div>
                      <div>
                        <label style={label}>Amostra HPV</label>
                        <input style={inputStyle} type="number" step="0.1" min="0"
                          value={editando.cq_amostra_hpv_max} onChange={e => setField('cq_amostra_hpv_max', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Aba: Alvos + Limiares ── */}
          {abaKit === 'alvos' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                Defina os alvos do kit (canais PCR) e os limiares de Cq para cada contexto.
              </p>
              {editando.alvos.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginBottom: '0.75rem' }}>Nenhum alvo definido.</p>
              )}
              {editando.alvos.map((alvo, ai) => (
                <div key={alvo._key || ai} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 120px' }}>
                      <label style={label}>Nome (código)</label>
                      <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="Ex: HPV16"
                        value={alvo.nome} onChange={e => setAlvo(ai, 'nome', e.target.value)} />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={label}>Tipo</label>
                      <select style={{ ...selectStyle, width: '100%' }}
                        value={alvo.tipo_alvo} onChange={e => setAlvo(ai, 'tipo_alvo', e.target.value)}>
                        {TIPOS_ALVO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: '1 1 100px' }}>
                      <label style={label}>Canal/Fluoróforo</label>
                      <input style={{ ...inputStyle, marginBottom: 0 }} placeholder="FAM, VIC, ROX..."
                        value={alvo.canal} onChange={e => setAlvo(ai, 'canal', e.target.value)} />
                    </div>
                    <div style={{ flex: '0 0 50px' }}>
                      <label style={label}>Ordem</label>
                      <input style={{ ...inputStyle, marginBottom: 0, width: 50 }} type="number" min="0"
                        value={alvo.ordem} onChange={e => setAlvo(ai, 'ordem', e.target.value)} />
                    </div>
                    <button type="button" onClick={() => removeAlvo(ai)} style={{ ...btnSmall('#ef4444'), alignSelf: 'flex-end' }}>Remover</button>
                  </div>
                  {/* Limiares por contexto */}
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Limiares de Cq</div>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Contexto</th>
                          <th style={thStyle}>Operador</th>
                          <th style={thStyle}>Ct limiar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alvo.limiares.map((l, li) => (
                          <tr key={l.contexto}>
                            <td style={tdStyle}>{CONTEXTO_LABEL[l.contexto] || l.contexto}</td>
                            <td style={tdStyle}>
                              <select style={selectStyle} value={l.operador}
                                onChange={e => setLimiar(ai, li, 'operador', e.target.value)}>
                                {OPERADORES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td style={tdStyle}>
                              {l.operador !== 'SEM_AMP' ? (
                                <input type="number" step="0.1" min="0"
                                  style={{ width: 70, padding: '2px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                                  value={l.ct_limiar} onChange={e => setLimiar(ai, li, 'ct_limiar', e.target.value)} />
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addAlvo} style={btnSmall('#6b7280')}>+ Alvo</button>
            </div>
          )}

          {/* ── Aba: Regras de Interpretação ── */}
          {abaKit === 'regras' && (
            <div>
              <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                Regras avaliadas em ordem crescente de prioridade. A primeira que casar define o resultado.
              </p>
              {editando.regras_interpretacao.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginBottom: '0.75rem' }}>Nenhuma regra definida.</p>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ ...thStyle, width: 55 }}>Prio.</th>
                      {alvoNomes.map(n => <th key={n} style={thStyle}>{n}</th>)}
                      <th style={thStyle}>CP</th>
                      <th style={thStyle}>CN</th>
                      <th style={{ ...thStyle, minWidth: 140 }}>Laudo</th>
                      <th style={{ ...thStyle, minWidth: 100 }}>Código</th>
                      <th style={{ ...thStyle, minWidth: 110 }}>Tipo</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editando.regras_interpretacao.map((r, ri) => (
                      <tr key={r._key || ri} style={{ borderBottom: '1px solid #f0f4f8' }}>
                        <td style={tdStyle}>
                          <input type="number" min="1" style={{ width: 50, padding: '2px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                            value={r.prioridade} onChange={e => setRegra(ri, 'prioridade', e.target.value)} />
                        </td>
                        {alvoNomes.map(n => (
                          <td key={n} style={tdStyle}>
                            <select style={selectStyle} value={r.condicoes[n] || 'QUALQUER'}
                              onChange={e => setCondicao(ri, n, e.target.value)}>
                              {COND_ALVO_OPTS.map(v => <option key={v} value={v}>{v === 'QUALQUER' ? '—' : v.toLowerCase()}</option>)}
                            </select>
                          </td>
                        ))}
                        {['CP', 'CN'].map(k => (
                          <td key={k} style={tdStyle}>
                            <select style={selectStyle} value={r.condicoes[k] || 'QUALQUER'}
                              onChange={e => setCondicao(ri, k, e.target.value)}>
                              {COND_CTRL_OPTS.map(v => <option key={v} value={v}>{v === 'QUALQUER' ? '—' : v.toLowerCase()}</option>)}
                            </select>
                          </td>
                        ))}
                        <td style={tdStyle}>
                          <input style={{ width: 140, padding: '2px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                            placeholder="Laudo exibido" value={r.resultado_label}
                            onChange={e => setRegra(ri, 'resultado_label', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <input style={{ width: 100, padding: '2px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                            placeholder="hpv16..." value={r.resultado_codigo}
                            onChange={e => setRegra(ri, 'resultado_codigo', e.target.value)} />
                        </td>
                        <td style={tdStyle}>
                          <select style={selectStyle} value={r.tipo_resultado}
                            onChange={e => setRegra(ri, 'tipo_resultado', e.target.value)}>
                            {TIPOS_RESULTADO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <button type="button" onClick={() => removeRegra(ri)}
                            style={{ ...btnSmall('#ef4444'), padding: '2px 6px' }}>x</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={addRegra} style={{ ...btnSmall('#6b7280'), marginTop: '0.5rem' }}>+ Regra</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="submit" style={btn()} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Kit'}</button>
            <button type="button" onClick={() => { setEditando(null); setMsg(null) }} style={btn('#6b7280')}>Cancelar</button>
          </div>
        </form>
      </div>
    )
  }

  // ── Lista ──
  return (
    <div>
      {msg && <div style={feedbackStyle(msg.tipo)}>{msg.texto}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c' }}>Kits de Interpretação</h3>
        <button onClick={novoKit} style={btn()}>+ Novo Kit</button>
      </div>
      {kits.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Nenhum kit cadastrado.</p>}
      {kits.map(k => (
        <div key={k.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1a3a5c', marginBottom: 4 }}>
              {k.nome}{!k.ativo && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#9ca3af' }}>(inativo)</span>}
            </div>
            {k.descricao && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 4 }}>{k.descricao}</div>}
            {k.alvos?.length > 0
              ? <div style={{ fontSize: '0.82rem', color: '#374151' }}>
                  {k.alvos.map(a => a.nome).join(', ')} — {k.regras_interpretacao?.length || 0} regras
                </div>
              : <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                  Limiares padrão: CI ≤{k.cq_amostra_ci_max} / HPV ≤{k.cq_amostra_hpv_max}
                </div>
            }
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={() => editarKit(k)} style={btnSmall()}>Editar</button>
            <button onClick={() => excluir(k.id)} style={btnSmall('#ef4444')}>Excluir</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: GAL WebService ───────────────────────────────────────────────────────
function TabGalWs({ csrf }) {
  const [subAba, setSubAba] = useState('config')
  const subTabs = [
    { id: 'config', label: 'Configuracao' },
    { id: 'testar', label: 'Testar Conexao' },
    { id: 'exames', label: 'Buscar Exames' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubAba(t.id)} style={{
            padding: '0.35rem 0.9rem', border: '1px solid #d1d5db', borderRadius: 4,
            background: subAba === t.id ? '#1a3a5c' : '#fff',
            color: subAba === t.id ? '#fff' : '#374151',
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
          }}>
            {t.label}
          </button>
        ))}
      </div>
      {subAba === 'config' && <TabConfiguracao csrf={csrf} />}
      {subAba === 'testar' && <TabTestarConexao csrf={csrf} />}
      {subAba === 'exames' && <TabBuscarExames csrf={csrf} />}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
const TABS = [
  { id: 'reacoes', label: 'Reações' },
  { id: 'kits',    label: 'Kits de Interpretação' },
  { id: 'gal-ws',  label: 'GAL WebService' },
]

export default function Configuracoes({ csrfToken }) {
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [aba, setAba] = useState('reacoes')

  return (
    <div style={{ maxWidth: 960 }}>
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Configuracoes" />
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#1a3a5c', marginBottom: '0.25rem' }}>Configurações</h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Gerencie protocolos de reação, kits de interpretação e integração GAL.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)} style={{
            padding: '0.5rem 1.25rem', border: 'none', background: 'none',
            cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
            color: aba === t.id ? '#1a3a5c' : '#6b7280',
            borderBottom: aba === t.id ? '2px solid #1a3a5c' : '2px solid transparent', marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'reacoes' && <TabReacoes />}
      {aba === 'kits' && <TabKits />}
      {aba === 'gal-ws' && <TabGalWs csrf={csrfToken} />}
    </div>
  )
}
