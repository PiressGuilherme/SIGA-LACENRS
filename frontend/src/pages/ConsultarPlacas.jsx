import { useState, useEffect } from "react";
import Button from "../design-system/components/Button";
import CrachaModal from "../components/CrachaModal";
import NavigationButtons from "../components/NavigationButtons";
import { getOperadorInicial, getCsrfToken } from "../utils/auth";

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];

const STATUS_PLACA = {
  aberta: { bg: "bg-rs-red", label: "Aberta" },
  extracao_confirmada: { bg: "bg-purple-500", label: "Extração confirmada" },
  submetida: { bg: "bg-warning-500", label: "Submetida" },
  resultados_importados: { bg: "bg-success-600", label: "Resultados" },
};

const POCO_COR = {
  amostra: {
    bg: "bg-info-100",
    border: "border-neutral-300",
    text: "text-info-800",
  },
  controle_positivo: {
    bg: "bg-warning-100",
    border: "border-warning-300",
    text: "text-warning-800",
  },
  controle_negativo: {
    bg: "bg-purple-100",
    border: "border-purple-300",
    text: "text-purple-800",
  },
  vazio: {
    bg: "bg-neutral-50",
    border: "border-neutral-200",
    text: "text-neutral-400",
  },
};

async function api(url, { csrfToken, method = "GET", body } = {}) {
  const token = localStorage.getItem("access_token");
  const opts = {
    method,
    headers: {
      "X-CSRFToken": getCsrfToken(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "same-origin",
  };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

function EspelhoPlaca({ pocos }) {
  const mapa = {};
  for (const p of pocos) mapa[p.posicao] = p;

  return (
    <div className="overflow-x-auto">
      <table
        className="border-collapse text-xs"
        style={{ tableLayout: "fixed" }}
      >
        <thead>
          <tr>
            <th className="w-[22px] p-0.5 text-neutral-400 font-normal"></th>
            {COLS.map((c) => (
              <th
                key={c}
                className="w-[68px] p-0.5 text-center text-neutral-400 font-medium"
              >
                {parseInt(c, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row}>
              <td className="p-0.5 font-semibold text-neutral-400 text-center">
                {row}
              </td>
              {COLS.map((col) => {
                const pos = `${row}${col}`;
                const p = mapa[pos];
                const tipo = p?.tipo_conteudo || "vazio";
                const cor = POCO_COR[tipo] || POCO_COR.vazio;
                const label =
                  tipo === "amostra"
                    ? p.amostra_codigo || "?"
                    : tipo === "controle_positivo"
                      ? "CP"
                      : tipo === "controle_negativo"
                        ? "CN"
                        : "";
                return (
                  <td key={col} className="p-[2px]">
                    <div
                      title={
                        tipo === "amostra" && p?.amostra_nome
                          ? `${p.amostra_codigo} — ${p.amostra_nome}`
                          : pos
                      }
                      className={`${cor.bg} ${cor.border} ${cor.text} border rounded-[3px] px-1 py-[3px] text-center font-${tipo === "amostra" ? "semibold" : "medium"} overflow-hidden text-ellipsis whitespace-nowrap min-h-[22px] leading-4`}
                    >
                      {label}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhaPlaca({ p, onEditar }) {
  const [aberta, setAberta] = useState(false);
  const badge = STATUS_PLACA[p.status_placa] || {
    bg: "bg-neutral-500",
    label: p.status_display,
  };

  const amostras = (p.pocos || [])
    .filter((w) => w.tipo_conteudo === "amostra" && w.amostra_codigo)
    .sort((a, b) => a.posicao.localeCompare(b.posicao));

  return (
    <>
      <tr
        onClick={() => setAberta((v) => !v)}
        className={`cursor-pointer transition-colors ${aberta ? "bg-purple-50 border-b-0" : "border-b border-neutral-100"}`}
        title="Clique para ver as amostras na placa"
      >
        <td className="px-3 py-2 text-neutral-700 font-semibold">
          <span className="mr-1.5 text-xs text-neutral-500">
            {aberta ? "▼" : "▶"}
          </span>
          {p.codigo}
        </td>
        <td className="px-3 py-2">
          <span
            className={`${badge.bg} text-white px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap`}
          >
            {badge.label}
          </span>
        </td>
        <td className="px-3 py-2 text-neutral-700">{p.total_amostras}</td>
        <td className="px-3 py-2 text-neutral-700">
          {p.responsavel_nome || "—"}
        </td>
        <td className="px-3 py-2 text-neutral-700">
          {fmtDate(p.data_criacao)}
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <div className="flex gap-1.5">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onEditar(p.id);
              }}
              variant="primary"
              size="sm"
            >
              Editar
            </Button>
            {p.total_amostras > 0 && (
              <a
                href={`/api/placas/${p.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 rounded bg-neutral-600 text-white text-xs font-medium no-underline inline-block hover:bg-neutral-700"
              >
                PDF
              </a>
            )}
          </div>
        </td>
      </tr>

      {aberta && (
        <tr className="border-b border-neutral-100 bg-purple-50">
          <td colSpan={6} className="px-4 py-3 pl-5">
            <div className="mb-2.5 flex gap-4 flex-wrap items-center">
              {[
                { tipo: "amostra", label: "Amostra" },
                { tipo: "controle_positivo", label: "CP" },
                { tipo: "controle_negativo", label: "CN" },
                { tipo: "vazio", label: "Vazio" },
              ].map(({ tipo, label }) => {
                const cor = POCO_COR[tipo];
                return (
                  <span
                    key={tipo}
                    className="flex items-center gap-1 text-xs text-neutral-700"
                  >
                    <span
                      className={`inline-block w-3 h-3 rounded-[2px] ${cor.bg} ${cor.border} border`}
                    />
                    {label}
                  </span>
                );
              })}
              <span className="text-xs text-neutral-400 ml-auto">
                Passe o mouse sobre uma célula para ver o nome da paciente
              </span>
            </div>

            <EspelhoPlaca pocos={p.pocos || []} />

            {amostras.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-purple-600 select-none">
                  Lista de amostras ({amostras.length})
                </summary>
                <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-y-1 gap-x-4 text-xs text-neutral-700">
                  {amostras.map((w) => (
                    <div key={w.id} className="flex gap-1">
                      <span className="text-neutral-400 min-w-[30px]">
                        {w.posicao}
                      </span>
                      <span className="font-semibold text-info-800 min-w-[60px]">
                        {w.amostra_codigo}
                      </span>
                      <span className="text-neutral-500 overflow-hidden text-ellipsis whitespace-nowrap">
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

export default function ConsultarPlacas({ csrfToken, onEditar }) {
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
      params.append("tipo_placa", "extracao");
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

  function handleSearch(e) {
    const val = e.target.value;
    setSearch(val);
    fetchPlacas(val, statusFilter);
  }

  function handleStatusFilter(e) {
    const val = e.target.value;
    setStatusFilter(val);
    fetchPlacas(search, val);
  }

  return (
    <div>
      <NavigationButtons currentStep="extracao" />

      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Consultar Placas" />
      )}

      <div>
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar por código (ex: PL2603)"
            className="flex-1 min-w-[200px] px-3 py-2 border border-neutral-300 rounded text-sm"
          />
          <select
            value={statusFilter}
            onChange={handleStatusFilter}
            className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white"
          >
            <option value="">Todos os status</option>
            <option value="aberta">Aberta</option>
            <option value="extracao_confirmada">Extração confirmada</option>
          </select>
          <Button onClick={() => fetchPlacas()} variant="outline" size="sm">
            Atualizar
          </Button>
        </div>

        {loading ? (
          <p className="text-neutral-500 py-4">Carregando...</p>
        ) : placas.length === 0 ? (
          <p className="text-neutral-400 py-4">Nenhuma placa encontrada.</p>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b-2 border-neutral-200">
                  <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                    Código
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                    Amostras
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                    Responsável
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                    Data
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {placas.map((p) => (
                  <LinhaPlaca key={p.id} p={p} onEditar={onEditar} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
