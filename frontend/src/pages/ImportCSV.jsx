import { useState, useRef } from 'react'

const STATUS_LABEL = {
  novo:        { text: 'Nova',        bg: '#d1fae5', color: '#065f46' },
  atualizavel: { text: 'Atualizar',   bg: '#dbeafe', color: '#1e40af' },
  duplicado:   { text: 'Duplicada',   bg: '#f3f4f6', color: '#6b7280' },
}

async function apiFetch(url, { csrfToken, body }) {
  const headers = { 'X-CSRFToken': csrfToken }
  const token = localStorage.getItem('access_token')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const msg = data?.erro || data?.detail || `Erro ${res.status}`
    throw new Error(msg)
  }
  return res.json()
}

const COLUNAS = [
  { label: 'Status',          key: '_status_importacao' },
  { label: 'Cód. Exame',      key: 'cod_exame_gal' },
  { label: 'Num. Interno',    key: 'codigo_interno' },
  { label: 'Paciente',        key: 'nome_paciente' },
  { label: 'CPF',             key: 'cpf' },
  { label: 'Município',       key: 'municipio' },
  { label: 'Dt. Cadastro',    key: 'data_coleta' },
  { label: 'Dt. Recebimento', key: 'data_recebimento' },
]

function parseCodigoInterno(v) {
  if (!v) return [Infinity, Infinity]
  const m = v.match(/^(\d+)\/(\d+)$/)
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [Infinity, Infinity]
}

function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => {
    let cmp
    if (key === 'codigo_interno') {
      const [as, ay] = parseCodigoInterno(a[key])
      const [bs, by] = parseCodigoInterno(b[key])
      cmp = as !== bs ? as - bs : ay - by
    } else {
      const av = a[key] ?? ''
      const bv = b[key] ?? ''
      cmp = av < bv ? -1 : av > bv ? 1 : 0
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

export default function ImportCSV({ csrfToken }) {
  const [etapa, setEtapa] = useState('upload')   // upload | preview | resultado
  const [arquivo, setArquivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const inputRef = useRef()

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // ------------------------------------------------------------------ upload
  function handleArquivo(file) {
    if (!file) return
    setArquivo(file)
    setErro(null)
  }

  function handleDrop(e) {
    e.preventDefault()
    handleArquivo(e.dataTransfer.files[0])
  }

  async function handlePreview() {
    if (!arquivo) return
    setCarregando(true)
    setErro(null)
    try {
      const form = new FormData()
      form.append('file', arquivo)
      const data = await apiFetch('/api/amostras/preview-csv/', { csrfToken, body: form })
      setPreview(data)
      setEtapa('preview')
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  // ----------------------------------------------------------------- importar
  async function handleImportar() {
    setCarregando(true)
    setErro(null)
    try {
      const form = new FormData()
      form.append('file', arquivo)
      const data = await apiFetch('/api/amostras/importar-csv/', { csrfToken, body: form })
      setResultado(data)
      setEtapa('resultado')
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  function resetar() {
    setEtapa('upload')
    setArquivo(null)
    setPreview(null)
    setResultado(null)
    setErro(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  // ------------------------------------------------------------------ render
  return (
    <div style={{ fontFamily: 'inherit' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.3rem', color: '#1a3a5c' }}>
        Importar CSV do GAL
      </h2>

      {erro && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem 1rem',
                      borderRadius: 6, marginBottom: '1rem' }}>
          {erro}
        </div>
      )}

      {/* ETAPA 1: Upload */}
      {etapa === 'upload' && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{
              border: '2px dashed #93c5fd', borderRadius: 8, padding: '3rem',
              textAlign: 'center', cursor: 'pointer', background: '#f0f7ff',
              transition: 'border-color 0.2s',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.zip"
              style={{ display: 'none' }}
              onChange={e => handleArquivo(e.target.files[0])}
            />
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
            <p style={{ color: '#1e40af', fontWeight: 500 }}>
              Clique ou arraste o arquivo CSV ou ZIP do GAL aqui
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Formato: exportação GAL (.csv ou .zip com CSVs), separador ponto-e-vírgula
            </p>
          </div>

          {arquivo && (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: '#065f46', background: '#d1fae5',
                             padding: '0.4rem 0.75rem', borderRadius: 4, fontSize: '0.9rem' }}>
                ✓ {arquivo.name}
              </span>
              <button
                onClick={handlePreview}
                disabled={carregando}
                style={btnStyle('#1a3a5c')}
              >
                {carregando ? 'Analisando…' : 'Analisar arquivo →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ETAPA 2: Preview */}
      {etapa === 'preview' && preview && (
        <div>
          {/* Aviso de diagnóstico quando 0 amostras detectadas */}
          {preview.aviso && (
            <div style={{ background: '#fef3c7', color: '#92400e', padding: '0.75rem 1rem',
                          borderRadius: 6, marginBottom: '1rem', fontSize: '0.88rem' }}>
              ⚠️ {preview.aviso}
            </div>
          )}

          {/* Contadores */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <Contador label="Total no arquivo" valor={preview.total} cor="#fff" />
            <Contador label="Novas" valor={preview.novos} cor="#065f46" bg="#d1fae5" />
            <Contador label="A atualizar" valor={preview.atualizaveis} cor="#1e40af" bg="#dbeafe" />
            <Contador label="Duplicadas" valor={preview.duplicados} cor="#374151" bg="#d1d5db" />
            <Contador label="Canceladas (GAL)" valor={preview.cancelados} cor="#92400e" bg="#fef3c7" />
          </div>

          {/* Tabela */}
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8,
                        border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  {COLUNAS.map(col => (
                    <th key={col.key}
                        onClick={() => handleSort(col.key)}
                        style={{ ...thStyle, cursor: 'pointer', userSelect: 'none',
                                 whiteSpace: 'nowrap' }}>
                      {col.label}
                      <span style={{ marginLeft: 4, opacity: sortKey === col.key ? 1 : 0.3 }}>
                        {sortKey === col.key && sortDir === 'desc' ? '▼' : '▲'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(sortKey ? sortRows(preview.amostras, sortKey, sortDir) : preview.amostras).map((a, i) => {
                  const st = STATUS_LABEL[a._status_importacao] || STATUS_LABEL.duplicado
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ background: st.bg, color: st.color,
                                       padding: '2px 8px', borderRadius: 4,
                                       fontSize: '0.78rem', fontWeight: 500,
                                       whiteSpace: 'nowrap' }}>
                          {st.text}
                          {a._campos_a_atualizar?.length > 0 &&
                            <span style={{ opacity: 0.7 }}> ({a._campos_a_atualizar.join(', ')})</span>
                          }
                        </span>
                      </td>
                      <td style={tdStyle}>{a.cod_exame_gal}</td>
                      <td style={tdStyle}>{a.codigo_interno || '—'}</td>
                      <td style={tdStyle}>{a.nome_paciente}</td>
                      <td style={tdStyle}>{a.cpf || '—'}</td>
                      <td style={tdStyle}>{a.municipio}</td>
                      <td style={tdStyle}>{fmtDate(a.data_coleta)}</td>
                      <td style={tdStyle}>{fmtDate(a.data_recebimento)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={resetar} style={btnStyle('#6b7280')}>← Voltar</button>
            {(preview.novos > 0 || preview.atualizaveis > 0) && (
              <button onClick={handleImportar} disabled={carregando} style={btnStyle('#065f46')}>
                {carregando ? 'Importando…' : `Confirmar importação (${preview.novos + preview.atualizaveis} registros)`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ETAPA 3: Resultado */}
      {etapa === 'resultado' && resultado && (
        <div>
          <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7',
                        borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#065f46', marginBottom: '1rem' }}>✓ Importação concluída</h3>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <Stat label="Novas criadas" valor={resultado.importadas} />
              <Stat label="Atualizadas" valor={resultado.atualizadas} />
              <Stat label="Duplicadas (sem ação)" valor={resultado.duplicadas} />
              <Stat label="Canceladas (ignoradas)" valor={resultado.canceladas_gal} />
              {resultado.erros > 0 &&
                <Stat label="Erros" valor={resultado.erros} cor="#b91c1c" />
              }
            </div>
          </div>

          {resultado.detalhes_atualizadas?.length > 0 && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', color: '#1e40af' }}>
                Ver registros atualizados ({resultado.detalhes_atualizadas.length})
              </summary>
              <ul style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
                {resultado.detalhes_atualizadas.map((a, i) => (
                  <li key={i}>{a.cod_exame_gal} — campos: {a.campos.join(', ')}</li>
                ))}
              </ul>
            </details>
          )}

          {resultado.detalhes_erros?.length > 0 && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', color: '#b91c1c' }}>
                Ver erros ({resultado.detalhes_erros.length})
              </summary>
              <ul style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#374151' }}>
                {resultado.detalhes_erros.map((e, i) => (
                  <li key={i}>{e.cod_exame_gal}: {e.erro}</li>
                ))}
              </ul>
            </details>
          )}

          <button onClick={resetar} style={btnStyle('#1a3a5c')}>
            Importar outro arquivo
          </button>
        </div>
      )}
    </div>
  )
}

// --- Helpers de estilo ---

const btnStyle = (bg) => ({
  background: bg, color: '#fff', border: 'none', padding: '0.6rem 1.25rem',
  borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
})

const thStyle = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600,
  color: '#374151', whiteSpace: 'nowrap',
}

const tdStyle = { padding: '0.5rem 0.75rem', color: '#374151' }

function Contador({ label, valor, cor = '#fff', bg = '#1a3a5c' }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: '0.75rem 1.25rem',
                  minWidth: 110, textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: cor }}>{valor}</div>
      <div style={{ fontSize: '0.78rem', color: cor, opacity: 0.85 }}>{label}</div>
    </div>
  )
}

function Stat({ label, valor, cor = '#065f46' }) {
  return (
    <div>
      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: cor }}>{valor}</span>
      {' '}
      <span style={{ fontSize: '0.9rem', color: '#374151' }}>{label}</span>
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
