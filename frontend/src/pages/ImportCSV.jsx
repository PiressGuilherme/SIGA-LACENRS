import { useState, useRef, useEffect } from "react";
import CrachaModal from "../components/CrachaModal";
import OperatorBadge from "../components/OperatorBadge";
import NavigationButtons from "../components/NavigationButtons";
import { getOperadorInicial } from "../utils/auth";
import apiFetch from "../utils/apiFetch";

const STATUS_LABEL = {
  novo: { text: "Nova", class: "bg-emerald-100 text-emerald-800" },
  atualizavel: { text: "Atualizar", class: "bg-blue-100 text-blue-800" },
  duplicado: { text: "Duplicada", class: "bg-gray-100 text-gray-600" },
};

const COLUNAS = [
  { label: "Status", key: "_status_importacao" },
  { label: "Cód. Exame", key: "cod_exame_gal" },
  { label: "Num. Interno", key: "codigo_interno" },
  { label: "Paciente", key: "nome_paciente" },
  { label: "CPF", key: "cpf" },
  { label: "Município", key: "municipio" },
  { label: "Dt. Cadastro", key: "data_coleta" },
  { label: "Dt. Recebimento", key: "data_recebimento" },
];

function parseCodigoInterno(v) {
  if (!v) return [Infinity, Infinity];
  const m = v.match(/^(\d+)\/(\d+)$/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [Infinity, Infinity];
}

function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => {
    let cmp;
    if (key === "codigo_interno") {
      const [as, ay] = parseCodigoInterno(a[key]);
      const [bs, by] = parseCodigoInterno(b[key]);
      cmp = as !== bs ? as - bs : ay - by;
    } else {
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      cmp = av < bv ? -1 : av > bv ? 1 : 0;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function Contador({ label, valor, class: classes }) {
  return (
    <div
      className={`px-4 py-3 rounded-md text-center min-w-[110px] ${classes}`}
    >
      <div className="font-semibold text-lg">{valor}</div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function Stat({ label, valor, cor }) {
  return (
    <div>
      <div className={`text-xl font-semibold ${cor || "text-emerald-800"}`}>
        {valor}
      </div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}

export default function ImportCSV({ csrfToken }) {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [etapa, setEtapa] = useState("upload"); // upload | preview | resultado
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [countdown, setCountdown] = useState(null);
  const inputRef = useRef();

  // Auto-reset 5 segundos após importação bem-sucedida
  useEffect(() => {
    if (etapa !== "resultado") return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          resetar();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [etapa]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ------------------------------------------------------------------ upload
  function handleArquivo(file) {
    if (!file) return;
    setArquivo(file);
    setErro(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    handleArquivo(e.dataTransfer.files[0]);
  }

  async function handlePreview() {
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      const data = await apiFetch("/api/amostras/preview-csv/", {
        method: "POST",
        body: form,
        isMultipart: true,
      });
      setPreview(data);
      setEtapa("preview");
    } catch (e) {
      setErro(
        e?.data?.erro ||
          e?.data?.detail ||
          e?.message ||
          `Erro ${e?.status ?? ""}`,
      );
    } finally {
      setCarregando(false);
    }
  }

  // ----------------------------------------------------------------- importar
  async function handleImportar() {
    setCarregando(true);
    setErro(null);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      const data = await apiFetch("/api/amostras/importar-csv/", {
        method: "POST",
        body: form,
        isMultipart: true,
      });
      setResultado(data);
      setEtapa("resultado");
    } catch (e) {
      setErro(
        e?.data?.erro ||
          e?.data?.detail ||
          e?.message ||
          `Erro ${e?.status ?? ""}`,
      );
    } finally {
      setCarregando(false);
    }
  }

  function resetar() {
    setEtapa("upload");
    setArquivo(null);
    setPreview(null);
    setResultado(null);
    setErro(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ------------------------------------------------------------------ render
  return (
    <div>
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Importar CSV" />
      )}

      {/* Barra do operador */}
      <OperatorBadge
        operador={operador}
        onTrocarOperador={() => setOperador(null)}
      />

      <NavigationButtons currentStep="importar" />

      <h2 className="mb-6 text-xl font-medium text-slate-800">
        Importar CSV do GAL
      </h2>

      {erro && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-md mb-4">
          {erro}
        </div>
      )}

      {/* ETAPA 1: Upload */}
      {etapa === "upload" && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center cursor-pointer bg-blue-50 hover:border-blue-400 transition-colors"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.zip"
              className="hidden"
              onChange={(e) => handleArquivo(e.target.files[0])}
            />
            <div className="text-5xl mb-2">📁</div>
            <p className="text-blue-800 font-medium">
              Clique ou arraste o arquivo CSV ou ZIP do GAL aqui
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Formato: exportação GAL (.csv ou .zip com CSVs), separador
              ponto-e-vírgula
            </p>
          </div>

          {arquivo && (
            <div className="mt-4 flex items-center gap-4">
              <span className="text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded text-sm">
                ✓ {arquivo.name}
              </span>
              <button
                onClick={handlePreview}
                disabled={carregando}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-5 py-2 rounded-md font-medium text-sm"
              >
                {carregando ? "Analisando…" : "Analisar arquivo →"}
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
      {etapa === "preview" && preview && (
        <div>
          {/* Botões de ação no topo */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={resetar}
              className="bg-gray-600 hover:bg-gray-500 text-white px-5 py-2 rounded-md font-medium text-sm"
            >
              ← Voltar
            </button>
            {(preview.novos > 0 || preview.atualizaveis > 0) && (
              <button
                onClick={handleImportar}
                disabled={carregando}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-2 rounded-md font-medium text-sm"
              >
                {carregando
                  ? "Importando…"
                  : `Confirmar importação (${preview.novos + preview.atualizaveis} registros)`}
              </button>
            )}
          </div>

          {/* Aviso de diagnóstico quando 0 amostras detectadas */}
          {preview.aviso && (
            <div className="bg-amber-100 text-amber-800 px-4 py-3 rounded-md mb-4 text-sm">
              ⚠️ {preview.aviso}
            </div>
          )}

          {/* Contadores */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <Contador
              label="Total no arquivo"
              valor={preview.total}
              class="bg-slate-800 text-white"
            />
            <Contador
              label="Novas"
              valor={preview.novos}
              class="bg-emerald-100 text-emerald-800"
            />
            <Contador
              label="A atualizar"
              valor={preview.atualizaveis}
              class="bg-blue-100 text-blue-800"
            />
            <Contador
              label="Duplicadas"
              valor={preview.duplicados}
              class="bg-gray-200 text-gray-700"
            />
            <Contador
              label="Canceladas (GAL)"
              valor={preview.cancelados}
              class="bg-amber-100 text-amber-800"
            />
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 mb-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-gray-200">
                  {COLUNAS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap cursor-pointer select-none"
                    >
                      {col.label}
                      <span
                        className={`ml-1 ${sortKey === col.key ? "opacity-100" : "opacity-30"}`}
                      >
                        {sortKey === col.key && sortDir === "desc" ? "▼" : "▲"}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {(sortKey
                  ? sortRows(preview.amostras, sortKey, sortDir)
                  : preview.amostras
                ).map((a, i) => {
                  const st =
                    STATUS_LABEL[a._status_importacao] ||
                    STATUS_LABEL.duplicado;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-100 ${a._ignorar ? "line-through opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`${st.class} px-2 py-1 rounded text-xs font-medium whitespace-nowrap`}
                        >
                          {st.text}
                          {a._campos_a_atualizar?.length > 0 && (
                            <span className="opacity-70">
                              {" "}
                              ({a._campos_a_atualizar.join(", ")})
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {a.cod_exame_gal}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {a.codigo_interno || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {a.nome_paciente}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {a.cpf || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{a.municipio}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {fmtDate(a.data_coleta)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {fmtDate(a.data_recebimento)}
                      </td>
                      <td className="px-3 py-2">
                        {a._status_importacao === "novo" && (
                          <button
                            onClick={() => {
                              const newPreview = { ...preview };
                              newPreview.amostras = [...preview.amostras];
                              newPreview.amostras[i] = {
                                ...a,
                                _ignorar: !a._ignorar,
                              };
                              if (newPreview.amostras[i]._ignorar) {
                                newPreview.novos = Math.max(
                                  0,
                                  newPreview.novos - 1,
                                );
                              } else {
                                newPreview.novos = newPreview.novos + 1;
                              }
                              setPreview(newPreview);
                            }}
                            className={`${a._ignorar ? "bg-emerald-700" : "bg-red-600"} text-white px-2 py-1 rounded text-xs cursor-pointer`}
                          >
                            {a._ignorar ? "Restaurar" : "Ignorar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ETAPA 3: Resultado */}
      {etapa === "resultado" && resultado && (
        <div>
          <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-6 mb-6">
            <h3 className="text-emerald-800 font-semibold mb-4">
              ✓ Importação concluída
            </h3>
            <div className="flex gap-8 flex-wrap">
              <Stat label="Novas criadas" valor={resultado.importadas} />
              <Stat label="Atualizadas" valor={resultado.atualizadas} />
              <Stat
                label="Duplicadas (sem ação)"
                valor={resultado.duplicadas}
              />
              <Stat
                label="Canceladas (ignoradas)"
                valor={resultado.canceladas_gal}
              />
              {resultado.erros > 0 && (
                <Stat
                  label="Erros"
                  valor={resultado.erros}
                  cor="text-red-700"
                />
              )}
            </div>
          </div>

          {resultado.detalhes_atualizadas?.length > 0 && (
            <details className="mb-4">
              <summary className="cursor-pointer text-blue-800">
                Ver registros atualizados (
                {resultado.detalhes_atualizadas.length})
              </summary>
              <ul className="mt-2 text-sm text-gray-700">
                {resultado.detalhes_atualizadas.map((a, i) => (
                  <li key={i}>
                    {a.cod_exame_gal} — campos: {a.campos.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {resultado.detalhes_erros?.length > 0 && (
            <details className="mb-4">
              <summary className="cursor-pointer text-red-700">
                Ver erros ({resultado.detalhes_erros.length})
              </summary>
              <ul className="mt-2 text-sm text-gray-700">
                {resultado.detalhes_erros.map((e, i) => (
                  <li key={i}>
                    {e.cod_exame_gal}: {e.erro}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            onClick={resetar}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-md font-medium text-sm"
          >
            Importar outro arquivo{countdown != null ? ` (${countdown}s)` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
