import { useState, useRef, useEffect } from 'react'
import CrachaModal from '../components/CrachaModal'
import { getOperadorInicial, getCsrfToken } from '../utils/auth'

const STATUS_LABEL = {
  novo:        { text: 'Nova',        bg: 'bg-success-50',   color: 'text-success-700' },
  atualizavel: { text: 'Atualizar',   bg: 'bg-info-50',      color: 'text-info-700' },
  duplicado:   { text: 'Duplicada',   bg: 'bg-gray-100',     color: 'text-gray-500' },
}

async function apiFetch(url, { csrfToken, body }) {
  const headers = { 'X-CSRFToken': getCsrfToken() }
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
  const [operador, setOperador] = useState(() => getOperadorInicial())
  const [etapa, setEtapa] = useState('upload')   // upload | preview | resultado
  const [arquivo, setArquivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [countdown, setCountdown] = useState(null)
  const inputRef = useRef()

  // Auto-reset 5 segundos após importação bem-sucedida
  useEffect(() => {
    if (etapa !== 'resultado') return
    setCountdown(5)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); resetar(); return null }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [etapa])

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
    <div>
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Importar CSV" />
      )}

      <h2 className="mb-6 text-xl font-bold text-primary-700">
        Importar CSV do GAL
      </h2>

      {erro && (
        <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-md mb-4">
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
            className="border-2 border-dashed border-info-300 rounded-lg p-12 text-center cursor-pointer bg-info-50 transition-colors hover:border-info-400"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.zip"
              className="hidden"
              onChange={e => handleArquivo(e.target.files[0])}
            />
            <div className="text-5xl mb-2">📁</div>
            <p className="text-info-700 font-medium">
              Clique ou arraste o arquivo CSV ou ZIP do GAL aqui
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Formato: exportação GAL (.csv ou .zip com CSVs), separador ponto-e-vírgula
            </p>
          </div>

          {arquivo && (
            <div className="mt-4 flex items-center gap-4">
              <span className="text-success-700 bg-success-50 px-3 py-1.5 rounded text-sm">
                ✓ {arquivo.name}
              </span>
              <button
                onClick={handlePreview}
                disabled={carregando}
                className="px-5 py-2.5 rounded-md bg-primary-700 text-white font-medium text-sm cursor-pointer hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {carregando ? 'Analisando…' : 'Analisar arquivo →'}
              </button>
            </div>
          )}

          <div className="mt-6">
            <a href="/" className="text-gray-500 text-sm underline">
              Voltar ao início
            </a>
          </div>
        </div>
      )}

      {/* ETAPA 2: Preview */}
      {etapa === 'preview' && preview && (
        <div>
          {/* Botões de ação no topo */}
          <div className="flex gap-4 mb-6">
            <button onClick={resetar} className="px-5 py-2.5 rounded-md bg-gray-500 text-white font-medium text-sm cursor-pointer hover:bg-gray-600">
              ← Voltar
            </button>
            {(preview.novos > 0 || preview.atualizaveis > 0) && (
              <button onClick={handleImportar} disabled={carregando} className="px-5 py-2.5 rounded-md bg-success-700 text-white font-medium text-sm cursor-pointer hover:bg-success-800 disabled:opacity-60 disabled:cursor-not-allowed">
                {carregando ? 'Importando…' : `Confirmar importação (${preview.novos + preview.atualizaveis} registros)`}
              </button>
            )}
          </div>

          {/* Aviso de diagnóstico quando 0 amostras detectadas */}
          {preview.aviso && (
            <div className="bg-warning-50 text-warning-700 px-4 py-3 rounded-md mb-4 text-sm">
              ⚠️ {preview.aviso}
            </div>
          )}

          {/* Contadores */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <Contador label="Total no arquivo" valor={preview.total} bg="bg-primary-700" />
            <Contador label="Novas" valor={preview.novos} bg="bg-success-50" color="text-success-700" />
            <Contador label="A atualizar" valor={preview.atualizaveis} bg="bg-info-50" color="text-info-700" />
            <Contador label="Duplicadas" valor={preview.duplicados} bg="bg-gray-100" color="text-gray-700" />
            <Contador label="Canceladas (GAL)" valor={preview.cancelados} bg="bg-warning-50" color="text-warning-700" />
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 mb-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  {COLUNAS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap cursor-pointer select-none"
                    >
                      {col.label}
                      <span className={`ml-1 ${sortKey === col.key ? 'opacity-100' : 'opacity-30'}`}>
                        {sortKey === col.key && sortDir === 'desc' ? '▼' : '▲'}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(sortKey ? sortRows(preview.amostras, sortKey, sortDir) : preview.amostras).map((a, i) => {
                  const st = STATUS_LABEL[a._status_importacao] || STATUS_LABEL.duplicado
                  return (
                    <tr key={i} className={`border-b border-gray-100 ${a._ignorar ? 'line-through opacity-50' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <span className={`${st.bg} ${st.color} px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap`}>
                          {st.text}
                          {a._campos_a_atualizar?.length > 0 &&
                            <span className="opacity-70"> ({a._campos_a_atualizar.join(', ')})</span>
                          }
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{a.cod_exame_gal}</td>
                      <td className="px-3 py-2 text-gray-700 font-mono">{a.codigo_interno || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{a.nome_paciente}</td>
                      <td className="px-3 py-2 text-gray-700">{a.cpf || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{a.municipio}</td>
                      <td className="px-3 py-2 text-gray-700">{fmtDate(a.data_coleta)}</td>
                      <td className="px-3 py-2 text-gray-700">{fmtDate(a.data_recebimento)}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {a._status_importacao === 'novo' && (
                          <button
                            onClick={() => {
                              const newPreview = {...preview}
                              newPreview.amostras = [...preview.amostras]
                              newPreview.amostras[i] = {...a, _ignorar: !a._ignorar}
                              if (newPreview.amostras[i]._ignorar) {
                                newPreview.novos = Math.max(0, newPreview.novos - 1)
                              } else {
                                newPreview.novos = newPreview.novos + 1
                              }
                              setPreview(newPreview)
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-medium text-white cursor-pointer border-none ${
                              a._ignorar ? 'bg-success-700' : 'bg-danger-600'
                            }`}
                          >
                            {a._ignorar ? 'Restaurar' : 'Ignorar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ETAPA 3: Resultado */}
      {etapa === 'resultado' && resultado && (
        <div>
          <div className="bg-success-50 border border-success-200 rounded-lg p-6 mb-6">
            <h3 className="text-success-700 font-bold mb-4">✓ Importação concluída</h3>
            <div className="flex gap-8 flex-wrap">
              <Stat label="Novas criadas" valor={resultado.importadas} />
              <Stat label="Atualizadas" valor={resultado.atualizadas} />
              <Stat label="Duplicadas (sem ação)" valor={resultado.duplicadas} />
              <Stat label="Canceladas (ignoradas)" valor={resultado.canceladas_gal} />
              {resultado.erros > 0 &&
                <Stat label="Erros" valor={resultado.erros} color="text-danger-700" />
              }
            </div>
          </div>

          {resultado.detalhes_atualizadas?.length > 0 && (
            <details className="mb-4">
              <summary className="cursor-pointer text-info-700">
                Ver registros atualizados ({resultado.detalhes_atualizadas.length})
              </summary>
              <ul className="mt-2 text-sm text-gray-700">
                {resultado.detalhes_atualizadas.map((a, i) => (
                  <li key={i}>{a.cod_exame_gal} — campos: {a.campos.join(', ')}</li>
                ))}
              </ul>
            </details>
          )}

          {resultado.detalhes_erros?.length > 0 && (
            <details className="mb-4">
              <summary className="cursor-pointer text-danger-700">
                Ver erros ({resultado.detalhes_erros.length})
              </summary>
              <ul className="mt-2 text-sm text-gray-700">
                {resultado.detalhes_erros.map((e, i) => (
                  <li key={i}>{e.cod_exame_gal}: {e.erro}</li>
                ))}
              </ul>
            </details>
          )}

          <button onClick={resetar} className="px-5 py-2.5 rounded-md bg-primary-700 text-white font-medium text-sm cursor-pointer hover:bg-primary-800">
            Importar outro arquivo{countdown != null ? ` (${countdown}s)` : ''}
          </button>
        </div>
      )}
    </div>
  )
}

// --- Helpers ---

function Contador({ label, valor, color = 'text-white', bg = 'bg-primary-700' }) {
  return (
    <div className={`${bg} rounded-lg px-5 py-3 min-w-[110px] text-center`}>
      <div className={`text-2xl font-bold ${color}`}>{valor}</div>
      <div className={`text-xs ${color} opacity-85`}>{label}</div>
    </div>
  )
}

function Stat({ label, valor, color = 'text-success-700' }) {
  return (
    <div>
      <span className={`text-2xl font-bold ${color}`}>{valor}</span>{' '}
      <span className="text-sm text-gray-700">{label}</span>
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