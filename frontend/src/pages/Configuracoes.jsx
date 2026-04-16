import { useState, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import Button from '../components/Button'
import Icon from '../components/Icon'
import { getOperadorInicial } from '../utils/auth'
import apiFetch from '../utils/apiFetch'
import { TabConfiguracao, TabTestarConexao, TabBuscarExames } from './GalWs'
import FeedbackBlock from '../components/FeedbackBlock'

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
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-base font-bold text-lacen-secondary mb-4">
          {editando.id ? 'Editar Protocolo' : 'Novo Protocolo de Reação'}
        </h3>
        <FeedbackBlock feedback={msg} />
        <form onSubmit={salvar}>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Nome</label>
          <input className="w-full px-3 py-2 rounded border border-gray-300 text-sm mb-3" value={editando.nome} onChange={e => setField('nome', e.target.value)} required />

          <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
          <textarea className="w-full px-3 py-2 rounded border border-gray-300 text-sm mb-3 min-h-15" value={editando.descricao} onChange={e => setField('descricao', e.target.value)} />

          <div className="flex gap-6 mb-3 items-center flex-wrap">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              <input type="checkbox" checked={editando.ativo} onChange={e => setField('ativo', e.target.checked)} /> Ativo
            </label>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Margem Extra (%)</label>
              <input className="w-24 px-3 py-2 rounded border border-gray-300 text-sm" type="number" step="0.1" min="0"
                value={editando.margem_percentual} onChange={e => setField('margem_percentual', e.target.value)} />
            </div>
          </div>

          <h4 className="text-sm font-bold text-gray-700 mt-4 mb-2">Reagentes</h4>
          <table className="w-full border-collapse mb-3">
            <thead>
              <tr className="text-xs text-gray-600 text-left">
                <th className="px-2 py-1">Reagente</th>
                <th className="px-2 py-1 w-30">Volume (uL)</th>
                <th className="px-2 py-1 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {editando.reagentes.map((r, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-0.5">
                    <input className="w-full px-3 py-1 rounded border border-gray-300 text-sm" value={r.nome}
                      onChange={e => setReagente(idx, 'nome', e.target.value)} placeholder="Ex: Master Mix" />
                  </td>
                  <td className="px-2 py-0.5">
                    <input className="w-full px-3 py-1 rounded border border-gray-300 text-sm" type="number" step="0.01" min="0"
                      value={r.volume_por_reacao} onChange={e => setReagente(idx, 'volume_por_reacao', e.target.value)} />
                  </td>
                  <td className="px-2 py-0.5 text-center">
                    {editando.reagentes.length > 1 && (
                      <Button type="button" variant="danger" size="sm" onClick={() => removerReagente(idx)}><Icon name="close" /></Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" variant="ghost" size="sm" onClick={adicionarReagente} className="mb-4">+ Reagente</Button>

          <div className="flex gap-3 mt-5">
            <Button type="submit" variant="primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Protocolo'}</Button>
            <Button type="button" variant="ghost" onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div>
      <FeedbackBlock feedback={msg} />
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-lacen-secondary">Protocolos de Reação</h3>
        <Button variant="primary" onClick={novoProtocolo}>+ Novo Protocolo</Button>
      </div>
      {protocolos.length === 0 && <p className="text-gray-500 text-sm">Nenhum protocolo cadastrado.</p>}
      {protocolos.map(p => (
        <div key={p.id} className="bg-white rounded-lg border border-slate-200 p-6 mb-6 flex justify-between items-start">
          <div>
            <div className="font-bold text-lacen-secondary mb-1">
              {p.nome}{!p.ativo && <span className="ml-2 text-xs text-gray-400">(inativo)</span>}
            </div>
            {p.descricao && <div className="text-xs text-gray-500 mb-1.5">{p.descricao}</div>}
            <div className="text-xs text-gray-700">
              {p.reagentes.map(r => `${r.nome}: ${r.volume_por_reacao} uL`).join(' | ')}
              {p.margem_percentual > 0 && <span className="text-gray-500"> (+{p.margem_percentual}% Margem)</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={() => editarProtocolo(p)}>Editar</Button>
            <Button variant="danger" size="sm" onClick={() => excluir(p.id)}>Excluir</Button>
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
  const [abaKit, setAbaKit] = useState('basico')
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

  if (editando) {
    const alvoNomes = editando.alvos.map(a => a.nome).filter(Boolean)
    const subAbas = [
      { id: 'basico', label: 'Informações' },
      { id: 'alvos', label: `Alvos (${editando.alvos.length})` },
      { id: 'regras', label: `Regras (${editando.regras_interpretacao.length})` },
    ]
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-base font-bold text-lacen-secondary mb-3">
          {editando.id ? 'Editar Kit' : 'Novo Kit de Interpretação'}
        </h3>
        <FeedbackBlock feedback={msg} />

        <div className="flex gap-1 mb-5 border-b-2 border-slate-200">
          {subAbas.map(t => (
            <button key={t.id} type="button" onClick={() => setAbaKit(t.id)} className={`px-4 py-2 border-none bg-transparent cursor-pointer text-sm font-semibold transition-colors -mb-0.5 ${
              abaKit === t.id
                ? 'text-lacen-secondary border-b-2 border-lacen-secondary'
                : 'text-gray-500 border-b-2 border-transparent hover:text-gray-700'
            }`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={salvar}>
          {abaKit === 'basico' && (
            <>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome</label>
              <input className="w-full px-3 py-2 rounded border border-gray-300 text-sm mb-3" value={editando.nome} onChange={e => setField('nome', e.target.value)} required />

              <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
              <textarea className="w-full px-3 py-2 rounded border border-gray-300 text-sm mb-3 min-h-15" value={editando.descricao} onChange={e => setField('descricao', e.target.value)} />

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-4">
                <input type="checkbox" checked={editando.ativo} onChange={e => setField('ativo', e.target.checked)} /> Ativo
              </label>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button type="button" onClick={() => setExpandirLimiares(!expandirLimiares)} className="w-full px-3 py-3 bg-slate-100 border-none cursor-pointer flex items-center gap-2 text-sm font-semibold text-gray-700 hover:bg-slate-200">
                  <span className="text-base leading-none">{expandirLimiares ? '▼' : '▶'}</span>
                  Limiares Padrão (fallback quando alvos não configurados)
                </button>
                {expandirLimiares && (
                  <div className="p-4 bg-white border-t border-slate-200">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Controles CP/CN CI</label>
                        <input className="w-full px-3 py-2 rounded border border-gray-300 text-sm" type="number" step="0.1" min="0"
                          value={editando.cq_controle_max} onChange={e => setField('cq_controle_max', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Amostra CI</label>
                        <input className="w-full px-3 py-2 rounded border border-gray-300 text-sm" type="number" step="0.1" min="0"
                          value={editando.cq_amostra_ci_max} onChange={e => setField('cq_amostra_ci_max', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Amostra HPV</label>
                        <input className="w-full px-3 py-2 rounded border border-gray-300 text-sm" type="number" step="0.1" min="0"
                          value={editando.cq_amostra_hpv_max} onChange={e => setField('cq_amostra_hpv_max', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {abaKit === 'alvos' && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Defina os alvos do kit (canais PCR) e os limiares de Cq para cada contexto.
              </p>
              {editando.alvos.length === 0 && (
                <p className="text-gray-400 text-xs mb-3">Nenhum alvo definido.</p>
              )}
              {editando.alvos.map((alvo, ai) => (
                <div key={alvo._key || ai} className="border border-slate-200 rounded-lg p-3 mb-3">
                  <div className="flex gap-2 items-end mb-2 flex-wrap">
                    <div className="flex-1 min-w-30">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Nome (código)</label>
                      <input className="w-full px-3 py-2 rounded border border-gray-300 text-sm" placeholder="Ex: HPV16"
                        value={alvo.nome} onChange={e => setAlvo(ai, 'nome', e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-36">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                      <select className="w-full px-3 py-2 rounded border border-gray-300 text-sm"
                        value={alvo.tipo_alvo} onChange={e => setAlvo(ai, 'tipo_alvo', e.target.value)}>
                        {TIPOS_ALVO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-28">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Canal/Fluoróforo</label>
                      <input className="w-full px-3 py-2 rounded border border-gray-300 text-sm" placeholder="FAM, VIC, ROX..."
                        value={alvo.canal} onChange={e => setAlvo(ai, 'canal', e.target.value)} />
                    </div>
                    <div className="w-16">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Ordem</label>
                      <input className="w-full px-3 py-2 rounded border border-gray-300 text-sm" type="number" min="0"
                        value={alvo.ordem} onChange={e => setAlvo(ai, 'ordem', e.target.value)} />
                    </div>
                    <Button type="button" variant="danger" size="sm" onClick={() => removeAlvo(ai)}>Remover</Button>
                  </div>
                  <div className="bg-slate-100 rounded p-2">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Limiares de Cq</div>
                    <table className="border-collapse text-xs w-full">
                      <thead>
                        <tr>
                          <th className="px-2 py-1 bg-slate-200 text-left font-semibold text-gray-700 whitespace-nowrap">Contexto</th>
                          <th className="px-2 py-1 bg-slate-200 text-left font-semibold text-gray-700 whitespace-nowrap">Operador</th>
                          <th className="px-2 py-1 bg-slate-200 text-left font-semibold text-gray-700 whitespace-nowrap">Ct limiar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alvo.limiares.map((l, li) => (
                          <tr key={l.contexto} className="border-b border-slate-200">
                            <td className="px-2 py-1 text-gray-700">{CONTEXTO_LABEL[l.contexto] || l.contexto}</td>
                            <td className="px-2 py-1 text-gray-700">
                              <select className="px-2 py-0.5 rounded border border-gray-300 text-xs" value={l.operador}
                                onChange={e => setLimiar(ai, li, 'operador', e.target.value)}>
                                {OPERADORES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1 text-gray-700">
                              {l.operador !== 'SEM_AMP' ? (
                                <input type="number" step="0.1" min="0"
                                  className="w-16 px-2 py-0.5 rounded border border-gray-300 text-xs"
                                  value={l.ct_limiar} onChange={e => setLimiar(ai, li, 'ct_limiar', e.target.value)} />
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={addAlvo}>+ Alvo</Button>
            </div>
          )}

          {abaKit === 'regras' && (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Regras avaliadas em ordem crescente de prioridade. A primeira que casar define o resultado.
              </p>
              {editando.regras_interpretacao.length === 0 && (
                <p className="text-gray-400 text-xs mb-3">Nenhuma regra definida.</p>
              )}
              <div className="overflow-x-auto">
                <table className="border-collapse w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap w-14">Prio.</th>
                      {alvoNomes.map(n => <th key={n} className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">{n}</th>)}
                      <th className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">CP</th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap">CN</th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap min-w-36">Laudo</th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap min-w-28">Código</th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap min-w-32">Tipo</th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-700 whitespace-nowrap"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editando.regras_interpretacao.map((r, ri) => (
                      <tr key={r._key || ri} className="border-b border-slate-200">
                        <td className="px-2 py-1 text-gray-700">
                          <input type="number" min="1" className="w-12 px-1 py-0.5 rounded border border-gray-300 text-xs"
                            value={r.prioridade} onChange={e => setRegra(ri, 'prioridade', e.target.value)} />
                        </td>
                        {alvoNomes.map(n => (
                          <td key={n} className="px-2 py-1 text-gray-700">
                            <select className="px-1 py-0.5 rounded border border-gray-300 text-xs" value={r.condicoes[n] || 'QUALQUER'}
                              onChange={e => setCondicao(ri, n, e.target.value)}>
                              {COND_ALVO_OPTS.map(v => <option key={v} value={v}>{v === 'QUALQUER' ? '—' : v.toLowerCase()}</option>)}
                            </select>
                          </td>
                        ))}
                        {['CP', 'CN'].map(k => (
                          <td key={k} className="px-2 py-1 text-gray-700">
                            <select className="px-1 py-0.5 rounded border border-gray-300 text-xs" value={r.condicoes[k] || 'QUALQUER'}
                              onChange={e => setCondicao(ri, k, e.target.value)}>
                              {COND_CTRL_OPTS.map(v => <option key={v} value={v}>{v === 'QUALQUER' ? '—' : v.toLowerCase()}</option>)}
                            </select>
                          </td>
                        ))}
                        <td className="px-2 py-1 text-gray-700">
                          <input className="w-full px-1 py-0.5 rounded border border-gray-300 text-xs"
                            placeholder="Laudo exibido" value={r.resultado_label}
                            onChange={e => setRegra(ri, 'resultado_label', e.target.value)} />
                        </td>
                        <td className="px-2 py-1 text-gray-700">
                          <input className="w-full px-1 py-0.5 rounded border border-gray-300 text-xs"
                            placeholder="hpv16..." value={r.resultado_codigo}
                            onChange={e => setRegra(ri, 'resultado_codigo', e.target.value)} />
                        </td>
                        <td className="px-2 py-1 text-gray-700">
                          <select className="px-1 py-0.5 rounded border border-gray-300 text-xs" value={r.tipo_resultado}
                            onChange={e => setRegra(ri, 'tipo_resultado', e.target.value)}>
                            {TIPOS_RESULTADO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1 text-gray-700">
                          <Button type="button" variant="danger" size="sm" onClick={() => removeRegra(ri)}><Icon name="close" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={addRegra} className="mt-2">+ Regra</Button>
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <Button type="submit" variant="primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Kit'}</Button>
            <Button type="button" variant="ghost" onClick={() => { setEditando(null); setMsg(null) }}>Cancelar</Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div>
      <FeedbackBlock feedback={msg} />
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-lacen-secondary">Kits de Interpretação</h3>
        <Button variant="primary" onClick={novoKit}>+ Novo Kit</Button>
      </div>
      {kits.length === 0 && <p className="text-gray-500 text-sm">Nenhum kit cadastrado.</p>}
      {kits.map(k => (
        <div key={k.id} className="bg-white rounded-lg border border-slate-200 p-6 mb-6 flex justify-between items-start">
          <div>
            <div className="font-bold text-lacen-secondary mb-1">
              {k.nome}{!k.ativo && <span className="ml-2 text-xs text-gray-400">(inativo)</span>}
            </div>
            {k.descricao && <div className="text-xs text-gray-500 mb-1">{k.descricao}</div>}
            {k.alvos?.length > 0
              ? <div className="text-xs text-gray-700">
                  {k.alvos.map(a => a.nome).join(', ')} — {k.regras_interpretacao?.length || 0} regras
                </div>
              : <div className="text-xs text-gray-500">
                  Limiares padrão: CI ≤{k.cq_amostra_ci_max} / HPV ≤{k.cq_amostra_hpv_max}
                </div>
            }
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={() => editarKit(k)}>Editar</Button>
            <Button variant="danger" size="sm" onClick={() => excluir(k.id)}>Excluir</Button>
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
      <div className="flex gap-1 mb-4">
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubAba(t.id)} className={`px-3 py-1.5 rounded text-sm font-medium border border-gray-300 cursor-pointer transition-colors ${
            subAba === t.id
              ? 'bg-lacen-secondary text-white border-lacen-secondary'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}>
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

// ── Tab: Kits de Extração ────────────────────────────────────────────────────
function TabKitsExtracao() {
  const [kits, setKits] = useState([])
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    try {
      const data = await apiFetch('/api/configuracoes/kits-extracao/')
      setKits(data.results || data)
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao carregar kits de extração.' }) }
  }

  function novo() {
    setEditando({ id: null, nome: '', descricao: '', ativo: true })
    setMsg(null)
  }

  function editar(k) {
    setEditando({ ...k })
    setMsg(null)
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    try {
      const payload = { nome: editando.nome, descricao: editando.descricao, ativo: editando.ativo }
      if (editando.id) {
        await apiFetch(`/api/configuracoes/kits-extracao/${editando.id}/`, { method: 'PUT', body: payload })
      } else {
        await apiFetch('/api/configuracoes/kits-extracao/', { method: 'POST', body: payload })
      }
      setEditando(null)
      carregar()
      setMsg({ tipo: 'sucesso', texto: 'Kit salvo.' })
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.data?.nome?.[0] || err.data?.detail || 'Erro ao salvar.' })
    } finally { setSalvando(false) }
  }

  async function excluir(id) {
    if (!confirm('Excluir este kit de extração?')) return
    try {
      await apiFetch(`/api/configuracoes/kits-extracao/${id}/`, { method: 'DELETE' })
      carregar()
      setMsg({ tipo: 'sucesso', texto: 'Kit excluído.' })
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao excluir.' }) }
  }

  if (editando) return (
    <form onSubmit={salvar} className="space-y-4 max-w-lg">
      <h3 className="text-lg font-bold">{editando.id ? 'Editar' : 'Novo'} Kit de Extração</h3>
      <FeedbackBlock feedback={msg} />
      <div>
        <label className="block text-sm font-medium mb-1">Nome</label>
        <input className="border rounded px-3 py-2 w-full text-sm" required value={editando.nome}
          onChange={e => setEditando(p => ({ ...p, nome: e.target.value }))} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Descrição</label>
        <textarea className="border rounded px-3 py-2 w-full text-sm" rows={2} value={editando.descricao}
          onChange={e => setEditando(p => ({ ...p, descricao: e.target.value }))} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={editando.ativo} onChange={e => setEditando(p => ({ ...p, ativo: e.target.checked }))} />
        Ativo
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
      </div>
    </form>
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">Kits de Extração</h3>
        <Button size="sm" onClick={novo}>Novo Kit</Button>
      </div>
      <FeedbackBlock feedback={msg} />
      {kits.length === 0 && <p className="text-gray-500 text-sm">Nenhum kit cadastrado.</p>}
      {kits.map(k => (
        <div key={k.id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-white">
          <div>
            <span className="font-medium">{k.nome}</span>
            {!k.ativo && <span className="ml-2 text-xs text-gray-400">(inativo)</span>}
            {k.descricao && <div className="text-xs text-gray-500">{k.descricao}</div>}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={() => editar(k)}>Editar</Button>
            <Button variant="danger" size="sm" onClick={() => excluir(k.id)}>Excluir</Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
const TABS = [
  { id: 'kits-extracao', label: 'Kits de Extração' },
  { id: 'reacoes', label: 'Reações PCR' },
  { id: 'kits',    label: 'Kits de Interpretação' },
  { id: 'gal-ws',  label: 'GAL WebService' },
]

export default function Configuracoes({ csrfToken }) {
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [aba, setAba] = useState('kits-extracao')

  return (
    <div className="max-w-5xl">
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Configuracoes" />
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-lacen-secondary mb-1">Configurações</h2>
        <p className="text-gray-500 text-sm">
          Gerencie kits de extração, protocolos de reação, kits de interpretação e integração GAL.
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b-2 border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setAba(t.id)} className={`px-5 py-2 border-none bg-transparent cursor-pointer text-sm font-semibold transition-colors -mb-0.5 ${
            aba === t.id
              ? 'text-lacen-secondary border-b-2 border-lacen-secondary'
              : 'text-gray-500 border-b-2 border-transparent hover:text-gray-700'
          }`}>
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'kits-extracao' && <TabKitsExtracao />}
      {aba === 'reacoes' && <TabReacoes />}
      {aba === 'kits' && <TabKits />}
      {aba === 'gal-ws' && <TabGalWs csrf={csrfToken} />}
    </div>
  )
}
