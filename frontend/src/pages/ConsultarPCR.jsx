import { useState, useEffect } from "react";
import CrachaModal from "../components/CrachaModal";
import { getOperadorInicial } from "../utils/auth";
import apiFetch from "../utils/apiFetch";
import PlacaMiniGrid from "../components/plates/PlacaMiniGrid";
import { MINI_THEMES } from "../components/plates/PlateConstants";

const STATUS_PLACA = {
  aberta: { bg: "bg-blue-600", label: "Aberta" },
  submetida: { bg: "bg-orange-500", label: "Submetida" },
  resultados_importados: { bg: "bg-green-600", label: "Resultados" },
};

const api = (url, { csrfToken: _csrf, ...opts } = {}) => apiFetch(url, opts);

const THEME = MINI_THEMES.pcr;

// ── Linha de placa PCR com expandível ─────────────────────────────────────────
function LinhaPlacaPCR({ p, csrfToken, onAtualizar, onEditar }) {
  const [aberta, setAberta] = useState(false);
  const [submetendo, setSubmetendo] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const badge = STATUS_PLACA[p.status_placa] || {
    bg: "bg-gray-600",
    label: p.status_display,
  };

  const amostras = (p.pocos || [])
    .filter((w) => w.tipo_conteudo === "amostra" && w.amostra_codigo)
    .sort((a, b) => a.posicao.localeCompare(b.posicao));

  async function handleSubmeter(e) {
    e.stopPropagation();
    if (!window.confirm(`Enviar placa ${p.codigo} ao termociclador?`)) return;
    setSubmetendo(true);
    try {
      await api(`/api/placas/${p.id}/submeter/`, {
        csrfToken,
        method: "POST",
      });
      setFeedback({
        tipo: "sucesso",
        msg: `Placa ${p.codigo} enviada ao termociclador.`,
      });
      onAtualizar();
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.erro || "Erro ao submeter.",
      });
    } finally {
      setSubmetendo(false);
    }
  }

  return (
    <>
      <tr
        onClick={() => setAberta((v) => !v)}
        className={`border-b border-gray-100 cursor-pointer transition-colors ${aberta || feedback ? "border-b-0" : ""} ${aberta ? THEME.rowBg : ""}`}
        title="Clique para ver as amostras na placa"
      >
        <td className="px-3 py-2 text-gray-700 font-semibold">
          <span className="mr-1 text-[0.7rem] text-gray-500">
            {aberta ? "▼" : "▶"}
          </span>
          {p.codigo}
        </td>
        <td className="px-3 py-2 text-gray-500">
          {p.placa_origem_codigo || "—"}
        </td>
        <td className="px-3 py-2 text-gray-700">
          <span
            className={`${badge.bg} text-white px-2 py-0.5 rounded text-[0.78rem] font-medium whitespace-nowrap`}
          >
            {badge.label}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-700">{p.total_amostras}</td>
        <td className="px-3 py-2 text-gray-700">{p.responsavel_nome || "—"}</td>
        <td className="px-3 py-2 text-gray-700">{fmtDate(p.data_criacao)}</td>
        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditar(p.id);
              }}
              className="bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded text-[0.78rem] font-medium"
            >
              Editar
            </button>
            {p.total_amostras > 0 && (
              <a
                href={`/api/placas/${p.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-[0.78rem] font-medium no-underline"
              >
                PDF
              </a>
            )}
            {p.status_placa === "aberta" && (
              <button
                onClick={handleSubmeter}
                disabled={submetendo}
                className={`bg-orange-500 hover:bg-orange-400 text-white px-2 py-1 rounded text-[0.78rem] font-medium ${submetendo ? "opacity-60" : ""}`}
              >
                {submetendo ? "Enviando..." : "Enviar ao termociclador"}
              </button>
            )}
          </div>
        </td>
      </tr>

      {feedback && (
        <tr
          className={`border-b border-gray-100 ${aberta ? THEME.rowBg : ""}`}
        >
          <td colSpan={7} className="px-3 pb-2">
            <div
              className={`px-3 py-2 rounded text-[0.8rem] ${
                feedback.tipo === "sucesso"
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-red-100 text-red-700 border border-red-300"
              }`}
            >
              {feedback.msg}
            </div>
          </td>
        </tr>
      )}

      {aberta && (
        <tr className={`border-b border-gray-100 ${THEME.rowBg}`}>
          <td colSpan={7} className="px-4 py-3">
            <div className="mb-2 flex gap-4 flex-wrap items-center">
              {[
                { tipo: "amostra", label: "Amostra" },
                { tipo: "controle_positivo", label: "CP" },
                { tipo: "controle_negativo", label: "CN" },
                { tipo: "vazio", label: "Vazio" },
              ].map(({ tipo, label }) => {
                const cor = THEME[tipo];
                return (
                  <span
                    key={tipo}
                    className="flex items-center gap-1 text-[0.75rem] text-gray-700"
                  >
                    <span
                      className={`inline-block w-3 h-3 rounded ${cor.bg} ${cor.border} border`}
                    />
                    {label}
                  </span>
                );
              })}
              <span className="text-[0.75rem] text-gray-400 ml-auto">
                Passe o mouse sobre uma célula para ver o nome da paciente
              </span>
            </div>

            <PlacaMiniGrid pocos={p.pocos || []} theme={THEME} />

            {amostras.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.8rem] text-orange-600 select-none">
                  Lista de amostras ({amostras.length})
                </summary>
                <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-y-0.5 gap-x-4 text-[0.8rem] text-gray-700">
                  {amostras.map((w) => (
                    <div key={w.id} className="flex gap-1">
                      <span className="text-gray-400 min-w-[30px]">
                        {w.posicao}
                      </span>
                      <span className="font-semibold text-blue-900 min-w-[60px]">
                        {w.amostra_codigo}
                      </span>
                      <span className="text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
                        {w.amostra_nome || ""}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function ConsultarPCR({ csrfToken, onEditar }) {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [placas, setPlacas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchPlacas();
  }, []);

  async function fetchPlacas(s = search, sf = statusFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("tipo_placa", "pcr");
      if (s.trim()) params.append("search", s.trim());
      if (sf) params.append("status_placa", sf);
      const data = await api(`/api/placas/?${params}`, { csrfToken });
      setPlacas(data.results || data);
    } catch {
      setPlacas([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Consultar Placas PCR" />
      )}

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            fetchPlacas(e.target.value, statusFilter);
          }}
          placeholder="Buscar por código..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-[0.85rem]"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            fetchPlacas(search, e.target.value);
          }}
          className="px-3 py-2 border border-gray-300 rounded-md text-[0.85rem] bg-white"
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="submetida">Submetida</option>
          <option value="resultados_importados">Resultados</option>
        </select>
        <button
          onClick={() => fetchPlacas()}
          className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md text-[0.85rem] font-medium"
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 py-4">Carregando...</p>
      ) : placas.length === 0 ? (
        <p className="text-gray-400 py-4">Nenhuma placa PCR encontrada.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full border-collapse text-[0.85rem]">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Código PCR
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Extração base
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Amostras
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Responsável
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Data
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {placas.map((p) => (
                <LinhaPlacaPCR
                  key={p.id}
                  p={p}
                  csrfToken={csrfToken}
                  onAtualizar={fetchPlacas}
                  onEditar={onEditar}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
