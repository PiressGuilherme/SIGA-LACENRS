import { useState, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial, getCsrfToken } from '../utils/auth'
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

// ── Tab: Reacoes ─────────────────────────────────────────────────────────────
function TabReacoes({ csrf }) {
  const [protocolos, setProtocolos] = useState([])
  const [editando, setEditando] = useState(null) // null = lista, objeto = form
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

  function setField(campo, valor) {
    setEditando(prev => ({ ...prev, [campo]: valor }))
  }

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
    setEditando(prev => ({
      ...prev,
      reagentes: prev.reagentes.filter((_, i) => i !== idx),
    }))
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        nome: editando.nome,
        descricao: editando.descricao,
        ativo: editando.ativo,
        margem_percentual: parseFloat(editando.margem_percentual) || 10,
        reagentes: editando.reagentes
          .filter(r => r.nome.trim())
          .map((r, i) => ({
            ...(r.id ? { id: r.id } : {}),
            nome: r.nome.trim(),
            volume_por_reacao: parseFloat(r.volume_por_reacao) || 0,
            ordem: i + 1,
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

  // ── Form de edicao ──
  if (editando) {
    return (
      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '1rem' }}>
          {editando.id ? 'Editar Protocolo' : 'Novo Protocolo de Reacao'}
        </h3>
        {msg && <div style={feedbackStyle(msg.tipo)}>{msg.texto}</div>}
        <form onSubmit={salvar}>
          <label style={label}>Nome</label>
          <input style={inputStyle} value={editando.nome} onChange={e => setField('nome', e.target.value)} required />

          <label style={label}>Descricao</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={editando.descricao} onChange={e => setField('descricao', e.target.value)} />

          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
              <input type="checkbox" checked={editando.ativo} onChange={e => setField('ativo', e.target.checked)} />
              Ativo
            </label>
            <div style={{ flex: 1 }}>
              <label style={label}>Margem extra (%)</label>
              <input style={{ ...inputStyle, width: 100, marginBottom: 0 }} type="number" step="0.1" min="0"
                value={editando.margem_percentual} onChange={e => setField('margem_percentual', e.target.value)} />
            </div>
          </div>

          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151', marginTop: '1rem', marginBottom: '0.5rem' }}>
            Reagentes
          </h4>
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
            <button type="submit" style={btn()} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Protocolo'}
            </button>
            <button type="button" onClick={() => { setEditando(null); setMsg(null) }} style={btn('#6b7280')}>
              Cancelar
            </button>
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
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c' }}>Protocolos de Reacao</h3>
        <button onClick={novoProtocolo} style={btn()}>+ Novo Protocolo</button>
      </div>
      {protocolos.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Nenhum protocolo cadastrado.</p>
      )}
      {protocolos.map(p => (
        <div key={p.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1a3a5c', marginBottom: 4 }}>
              {p.nome}
              {!p.ativo && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#9ca3af' }}>(inativo)</span>}
            </div>
            {p.descricao && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 6 }}>{p.descricao}</div>}
            <div style={{ fontSize: '0.82rem', color: '#374151' }}>
              {p.reagentes.map(r => `${r.nome}: ${r.volume_por_reacao} uL`).join(' | ')}
              {p.margem_percentual > 0 && <span style={{ color: '#6b7280' }}> (+{p.margem_percentual}% margem)</span>}
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
function TabKits({ csrf }) {
  const [kits, setKits] = useState([])
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

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
    })
    setMsg(null)
  }

  function setField(campo, valor) {
    setEditando(prev => ({ ...prev, [campo]: valor }))
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    try {
      const payload = {
        nome: editando.nome,
        descricao: editando.descricao,
        ativo: editando.ativo,
        cq_controle_max: parseFloat(editando.cq_controle_max),
        cq_amostra_ci_max: parseFloat(editando.cq_amostra_ci_max),
        cq_amostra_hpv_max: parseFloat(editando.cq_amostra_hpv_max),
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
      setMsg({ tipo: 'erro', texto: d.nome?.[0] || d.detail || 'Erro ao salvar.' })
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
    return (
      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '1rem' }}>
          {editando.id ? 'Editar Kit' : 'Novo Kit de Interpretacao'}
        </h3>
        {msg && <div style={feedbackStyle(msg.tipo)}>{msg.texto}</div>}
        <form onSubmit={salvar}>
          <label style={label}>Nome</label>
          <input style={inputStyle} value={editando.nome} onChange={e => setField('nome', e.target.value)} required />

          <label style={label}>Descricao</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={editando.descricao} onChange={e => setField('descricao', e.target.value)} />

          <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1rem' }}>
            <input type="checkbox" checked={editando.ativo} onChange={e => setField('ativo', e.target.checked)} />
            Ativo
          </label>

          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
            Limiares de Cq
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={label}>Controles (CP/CN CI)</label>
              <input style={inputStyle} type="number" step="0.1" min="0"
                value={editando.cq_controle_max} onChange={e => setField('cq_controle_max', e.target.value)} />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Cq maximo</span>
            </div>
            <div>
              <label style={label}>Amostra CI</label>
              <input style={inputStyle} type="number" step="0.1" min="0"
                value={editando.cq_amostra_ci_max} onChange={e => setField('cq_amostra_ci_max', e.target.value)} />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Cq maximo</span>
            </div>
            <div>
              <label style={label}>Amostra HPV</label>
              <input style={inputStyle} type="number" step="0.1" min="0"
                value={editando.cq_amostra_hpv_max} onChange={e => setField('cq_amostra_hpv_max', e.target.value)} />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Cq maximo</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" style={btn()} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Kit'}
            </button>
            <button type="button" onClick={() => { setEditando(null); setMsg(null) }} style={btn('#6b7280')}>
              Cancelar
            </button>
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
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c' }}>Kits de Interpretacao</h3>
        <button onClick={novoKit} style={btn()}>+ Novo Kit</button>
      </div>
      {kits.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Nenhum kit cadastrado.</p>
      )}
      {kits.map(k => (
        <div key={k.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1a3a5c', marginBottom: 4 }}>
              {k.nome}
              {!k.ativo && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#9ca3af' }}>(inativo)</span>}
            </div>
            {k.descricao && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 6 }}>{k.descricao}</div>}
            <div style={{ fontSize: '0.82rem', color: '#374151' }}>
              Controles: Cq &le; {k.cq_controle_max} | CI amostra: Cq &le; {k.cq_amostra_ci_max} | HPV amostra: Cq &le; {k.cq_amostra_hpv_max}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={() => setEditando({ ...k })} style={btnSmall()}>Editar</button>
            <button onClick={() => excluir(k.id)} style={btnSmall('#ef4444')}>Excluir</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: GAL WebService (sub-abas) ───────────────────────────────────────────
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
          <button key={t.id} onClick={() => setSubAba(t.id)}
            style={{
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

// ── Componente principal ─────────────────────────────────────────────────────
const TABS = [
  { id: 'reacoes', label: 'Reacoes' },
  { id: 'kits',    label: 'Kits de Interpretacao' },
  { id: 'gal-ws',  label: 'GAL WebService' },
]

export default function Configuracoes({ csrfToken }) {
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [aba, setAba] = useState('reacoes')

  return (
    <div style={{ maxWidth: 860 }}>
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Configuracoes" />
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#1a3a5c', marginBottom: '0.25rem' }}>
          Configuracoes
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Gerencie protocolos de reacao, kits de interpretacao e integracao GAL.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            style={{
              padding: '0.5rem 1.25rem', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              color: aba === t.id ? '#1a3a5c' : '#6b7280',
              borderBottom: aba === t.id ? '2px solid #1a3a5c' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'reacoes' && <TabReacoes csrf={csrfToken} />}
      {aba === 'kits' && <TabKits csrf={csrfToken} />}
      {aba === 'gal-ws' && <TabGalWs csrf={csrfToken} />}
    </div>
  )
}
