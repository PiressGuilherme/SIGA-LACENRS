import { useEffect, useState } from 'react'
import api from '../services/api'

const STATUS = { idle: 'idle', loading: 'loading', ok: 'ok', erro: 'erro' }

// ---------------------------------------------------------------------------
// Estilos inline compartilhados
// ---------------------------------------------------------------------------
const card = {
  background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
  padding: '1.5rem', marginBottom: '1.5rem',
}
const label = { display: 'block', fontSize: '0.8rem', fontWeight: 600,
  color: '#374151', marginBottom: 4 }
const input = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: '0.9rem', marginBottom: '0.75rem',
  boxSizing: 'border-box',
}
const btn = (color = '#1a3a5c') => ({
  padding: '0.5rem 1.25rem', borderRadius: 6, border: 'none',
  background: color, color: '#fff', fontWeight: 600, cursor: 'pointer',
  fontSize: '0.875rem',
})
const badge = (ok) => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 999,
  fontSize: '0.75rem', fontWeight: 700,
  background: ok ? '#d1fae5' : '#fee2e2',
  color: ok ? '#065f46' : '#991b1b',
})

// ---------------------------------------------------------------------------
// Tab: Configuração
// ---------------------------------------------------------------------------
function TabConfiguracao({ csrf }) {
  const [form, setForm] = useState({
    usuario: '', senha: '', codigo_laboratorio: '', url_ws: '', verificar_ssl: false,
  })
  const [senhaConfigurada, setSenhaConfigurada] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    api.get('/gal-ws/configuracao/', { headers: { 'X-CSRFToken': csrf } })
      .then(r => {
        const d = r.data
        setForm(f => ({
          ...f,
          usuario:            d.usuario || '',
          codigo_laboratorio: d.codigo_laboratorio || '',
          url_ws:             d.url_ws || '',
          verificar_ssl:      d.verificar_ssl || false,
        }))
        setSenhaConfigurada(d.senha_configurada)
      })
      .catch(() => setMsg({ tipo: 'erro', texto: 'Erro ao carregar configuração.' }))
  }, [])

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg(null)
    try {
      await api.post('/gal-ws/configuracao/', form, { headers: { 'X-CSRFToken': csrf } })
      setMsg({ tipo: 'ok', texto: 'Configuração salva com sucesso.' })
      if (form.senha) setSenhaConfigurada(true)
      setForm(f => ({ ...f, senha: '' }))
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.response?.data?.erro || 'Erro ao salvar.' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div style={card}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '1rem' }}>
          Credenciais e Endpoint
        </h3>
        <form onSubmit={salvar}>
          <label style={label}>URL do WebService</label>
          <input style={input} value={form.url_ws}
            onChange={e => set('url_ws', e.target.value)} placeholder="https://..." />

          <label style={label}>Usuário GAL</label>
          <input style={input} value={form.usuario}
            onChange={e => set('usuario', e.target.value)} placeholder="usuario_integracao" />

          <label style={label}>
            Senha GAL{' '}
            {senhaConfigurada
              ? <span style={badge(true)}>configurada</span>
              : <span style={badge(false)}>não configurada</span>}
          </label>
          <input style={input} type="password" value={form.senha}
            onChange={e => set('senha', e.target.value)}
            placeholder={senhaConfigurada ? 'Deixe em branco para manter a atual' : 'Nova senha'} />

          <label style={label}>Código do Laboratório</label>
          <input style={input} value={form.codigo_laboratorio}
            onChange={e => set('codigo_laboratorio', e.target.value)}
            placeholder="Ex: LACEN-RS ou código numérico do GAL" />

          <label style={{ ...label, flexDirection: 'row', gap: 8, display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <input type="checkbox" checked={form.verificar_ssl}
              onChange={e => set('verificar_ssl', e.target.checked)} />
            Verificar certificado SSL{' '}
            <span style={{ color: '#6b7280', fontWeight: 400 }}>
              (desative se o servidor GAL usar certificado auto-assinado)
            </span>
          </label>

          {msg && (
            <div style={{
              padding: '0.6rem 1rem', borderRadius: 6, marginBottom: '1rem',
              background: msg.tipo === 'ok' ? '#d1fae5' : '#fee2e2',
              color: msg.tipo === 'ok' ? '#065f46' : '#991b1b',
              fontSize: '0.875rem',
            }}>
              {msg.texto}
            </div>
          )}

          <button type="submit" style={btn()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar Configuração'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Testar Conexão
// ---------------------------------------------------------------------------
function TabTestarConexao({ csrf }) {
  const [st, setSt] = useState(STATUS.idle)
  const [resultado, setResultado] = useState(null)

  async function testar() {
    setSt(STATUS.loading)
    setResultado(null)
    try {
      const r = await api.post('/gal-ws/testar-conexao/', {}, { headers: { 'X-CSRFToken': csrf } })
      setResultado({ ok: true, data: r.data })
      setSt(STATUS.ok)
    } catch (err) {
      setResultado({ ok: false, data: err.response?.data || { erro: 'Sem resposta do servidor.' } })
      setSt(STATUS.erro)
    }
  }

  return (
    <div style={card}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '1rem' }}>
        Testar Conexão com o GAL WS
      </h3>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
        Executa em sequência: <code>autenticacao</code> → <code>mensagem</code> → <code>validaData</code>
      </p>
      <button style={btn()} onClick={testar} disabled={st === STATUS.loading}>
        {st === STATUS.loading ? 'Testando…' : '▶ Testar Agora'}
      </button>

      {resultado && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{
            padding: '0.5rem 1rem', borderRadius: 6, marginBottom: '0.75rem',
            background: resultado.ok ? '#d1fae5' : '#fee2e2',
            color: resultado.ok ? '#065f46' : '#991b1b',
            fontWeight: 700, fontSize: '0.875rem',
          }}>
            {resultado.ok ? '✓ Conexão bem-sucedida' : '✗ Falha na conexão'}
          </div>
          <ResultRow label="Autenticação" value={resultado.data.autenticacao} />
          {resultado.data.token_prefixo && <ResultRow label="Token (prefixo)" value={resultado.data.token_prefixo} />}
          {resultado.data.mensagem && <ResultRow label="mensagem()" value={resultado.data.mensagem} />}
          {resultado.data.valida_data && <ResultRow label="validaData()" value={resultado.data.valida_data} />}
          {resultado.data.erro && <ResultRow label="Erro" value={resultado.data.erro} erro />}
          {resultado.data.etapa && <ResultRow label="Etapa" value={resultado.data.etapa} />}
        </div>
      )}
    </div>
  )
}

function ResultRow({ label: l, value, erro }) {
  return (
    <div style={{
      display: 'flex', gap: '1rem', padding: '0.4rem 0',
      borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem', alignItems: 'flex-start',
    }}>
      <span style={{ minWidth: 160, color: '#6b7280', fontWeight: 600 }}>{l}</span>
      <span style={{ color: erro ? '#dc2626' : '#111827', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Buscar Exames
// ---------------------------------------------------------------------------
function TabBuscarExames({ csrf }) {
  const [laboratorio, setLaboratorio] = useState('')
  const [st, setSt] = useState(STATUS.idle)
  const [resultado, setResultado] = useState(null)

  async function buscar() {
    setSt(STATUS.loading)
    setResultado(null)
    try {
      const r = await api.post('/gal-ws/buscar-exames/',
        { laboratorio },
        { headers: { 'X-CSRFToken': csrf } }
      )
      setResultado({ ok: true, data: r.data })
      setSt(STATUS.ok)
    } catch (err) {
      setResultado({ ok: false, data: err.response?.data || { erro: 'Sem resposta.' } })
      setSt(STATUS.erro)
    }
  }

  return (
    <div style={card}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a3a5c', marginBottom: '1rem' }}>
        Buscar Exames Pendentes
      </h3>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
        Chama <code>buscarExames(laboratorio)</code> no GAL WS. O retorno bruto é exibido para
        inspeção do schema antes de implementar a importação automática.
        Se o campo estiver vazio, usa o código configurado na aba Configuração.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Código do Laboratório</label>
          <input style={{ ...input, marginBottom: 0 }} value={laboratorio}
            onChange={e => setLaboratorio(e.target.value)}
            placeholder="Deixe vazio para usar o código configurado" />
        </div>
        <button style={btn()} onClick={buscar} disabled={st === STATUS.loading}>
          {st === STATUS.loading ? 'Buscando…' : '🔍 Buscar'}
        </button>
      </div>

      {resultado && (
        <div style={{ marginTop: '0.75rem' }}>
          {resultado.ok ? (
            <>
              <div style={{
                padding: '0.5rem 1rem', borderRadius: 6, marginBottom: '0.75rem',
                background: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: '0.875rem',
              }}>
                ✓ {resultado.data.total} exame{resultado.data.total !== 1 ? 's' : ''} encontrado{resultado.data.total !== 1 ? 's' : ''}
                {resultado.data.laboratorio && ` — ${resultado.data.laboratorio}`}
              </div>
              <pre style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
                padding: '1rem', fontSize: '0.78rem', overflowX: 'auto', maxHeight: 400,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {JSON.stringify(resultado.data.exames, null, 2)}
              </pre>
            </>
          ) : (
            <div style={{
              padding: '0.6rem 1rem', borderRadius: 6,
              background: '#fee2e2', color: '#991b1b', fontSize: '0.875rem',
            }}>
              ✗ {resultado.data.erro}
              {resultado.data.etapa && <span style={{ marginLeft: 8, opacity: 0.7 }}>({resultado.data.etapa})</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'config',  label: '⚙ Configuração' },
  { id: 'testar',  label: '🔌 Testar Conexão' },
  { id: 'exames',  label: '📋 Buscar Exames' },
]

export default function GalWs({ csrfToken }) {
  const [aba, setAba] = useState('config')

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: '#1a3a5c', marginBottom: '0.25rem' }}>
          Integração GAL WebService
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Configure e teste a conexão direta com o sistema GAL do Rio Grande do Sul.
        </p>
      </div>

      {/* Abas */}
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

      {aba === 'config' && <TabConfiguracao csrf={csrfToken} />}
      {aba === 'testar' && <TabTestarConexao csrf={csrfToken} />}
      {aba === 'exames' && <TabBuscarExames csrf={csrfToken} />}
    </div>
  )
}
