import { useState, useEffect, useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { Search, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import Button from "../design-system/components/Button";
import CrachaModal from "../components/CrachaModal";
import NavigationButtons from "../components/NavigationButtons";
import DataTable from "../components/ui/data-table";
import { getOperadorInicial, getCsrfToken } from "../utils/auth";
import { cn } from "../lib/utils";

// ── Constantes ────────────────────────────────────────────────────────────────

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

const STATUS_PLACA = {
  aberta:               { bg: "bg-rs-red",        label: "Aberta" },
  extracao_confirmada:  { bg: "bg-purple-500",    label: "Extração confirmada" },
  submetida:            { bg: "bg-warning-500",   label: "Submetida" },
  resultados_importados:{ bg: "bg-success-600",   label: "Resultados" },
};

const POCO_COR = {
  amostra:           { bg: "bg-success-100",  border: "border-success-300",  text: "text-success-800" },
  controle_positivo: { bg: "bg-warning-100",  border: "border-warning-300",  text: "text-warning-800" },
  controle_negativo: { bg: "bg-neutral-100",  border: "border-neutral-300",  text: "text-neutral-600" },
  vazio:             { bg: "bg-neutral-50",   border: "border-neutral-200",  text: "text-neutral-300" },
};

// ── API helper ────────────────────────────────────────────────────────────────

async function api(url, { method = "GET", body } = {}) {
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

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── EspelhoPlaca ─────────────────────────────────────────────────────────────

function EspelhoPlaca({ pocos }) {
  const mapa = {};
  for (const p of pocos) mapa[p.posicao] = p;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th className="w-[22px] p-0.5 text-neutral-400 font-normal" />
            {COLS.map(c => (
              <th key={c} className="w-[68px] p-0.5 text-center text-neutral-400 font-medium">
                {parseInt(c, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => (
            <tr key={row}>
              <td className="p-0.5 font-semibold text-neutral-400 text-center">{row}</td>
              {COLS.map(col => {
                const pos = `${row}${col}`;
                const p = mapa[pos];
                const tipo = p?.tipo_conteudo || "vazio";
                const cor = POCO_COR[tipo] || POCO_COR.vazio;
                const label = tipo === "amostra" ? p.amostra_codigo || "?"
                  : tipo === "controle_positivo" ? "CP"
                  : tipo === "controle_negativo" ? "CN" : "";
                return (
                  <td key={col} className="p-[2px]">
                    <div
                      title={tipo === "amostra" && p?.amostra_nome ? `${p.amostra_codigo} — ${p.amostra_nome}` : pos}
                      className={cn(
                        cor.bg, cor.border, cor.text,
                        "border rounded-[3px] px-1 py-[3px] text-center overflow-hidden text-ellipsis whitespace-nowrap min-h-[22px] leading-4",
                        tipo === "amostra" ? "font-semibold" : "font-medium"
                      )}
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

// ── Sub-row expansível ────────────────────────────────────────────────────────

function PlacaSubRow({ row }) {
  const p = row.original;
  const amostras = (p.pocos || [])
    .filter(w => w.tipo_conteudo === "amostra" && w.amostra_codigo)
    .sort((a, b) => a.posicao.localeCompare(b.posicao));

  return (
    <div className="px-2 py-3">
      {/* Legenda */}
      <div className="flex gap-4 flex-wrap items-center mb-3">
        {Object.entries(POCO_COR).map(([tipo, cor]) => (
          <span key={tipo} className="flex items-center gap-1 text-xs text-neutral-600">
            <span className={cn("inline-block w-3 h-3 rounded-[2px] border", cor.bg, cor.border)} />
            {tipo === "amostra" ? "Amostra" : tipo === "controle_positivo" ? "CP" : tipo === "controle_negativo" ? "CN" : "Vazio"}
          </span>
        ))}
        <span className="text-xs text-neutral-400 ml-auto">Hover = nome da paciente</span>
      </div>

      <EspelhoPlaca pocos={p.pocos || []} />

      {amostras.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-neutral-500 select-none hover:text-neutral-700">
            Lista de amostras ({amostras.length})
          </summary>
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-y-1 gap-x-4 text-xs text-neutral-700">
            {amostras.map(w => (
              <div key={w.id} className="flex gap-1">
                <span className="text-neutral-400 min-w-[30px]">{w.posicao}</span>
                <span className="font-semibold font-mono text-neutral-800 min-w-[60px]">{w.amostra_codigo}</span>
                <span className="text-neutral-500 overflow-hidden text-ellipsis whitespace-nowrap">{w.amostra_nome || ""}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Definição de colunas ──────────────────────────────────────────────────────

const col = createColumnHelper();

function buildColumns(onEditar) {
  return [
    col.display({
      id: "expand",
      size: 30,
      header: () => null,
      enableSorting: false,
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); row.toggleExpanded(); }}
          className="text-neutral-400 hover:text-rs-red transition-colors"
        >
          {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ),
    }),
    col.accessor("codigo", {
      header: "Código",
      cell: info => <span className="font-semibold font-mono text-neutral-800">{info.getValue()}</span>,
    }),
    col.accessor("status_placa", {
      header: "Status",
      cell: info => {
        const badge = STATUS_PLACA[info.getValue()] || { bg: "bg-neutral-500", label: info.row.original.status_display };
        return (
          <span className={cn(badge.bg, "text-white px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap")}>
            {badge.label}
          </span>
        );
      },
    }),
    col.accessor("total_amostras", {
      header: "Amostras",
      cell: info => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    col.accessor("responsavel_nome", {
      header: "Responsável",
      cell: info => <span className="text-neutral-600">{info.getValue() || "—"}</span>,
    }),
    col.accessor("data_criacao", {
      header: "Data",
      cell: info => <span className="text-neutral-500 text-xs whitespace-nowrap">{fmtDate(info.getValue())}</span>,
    }),
    col.display({
      id: "acoes",
      header: "Ações",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
            <Button onClick={() => onEditar?.(p.id)} variant="primary" size="sm">
              Editar
            </Button>
            {p.total_amostras > 0 && (
              <a
                href={`/api/placas/${p.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded bg-neutral-600 text-white text-xs font-medium no-underline inline-block hover:bg-neutral-700 transition-colors"
              >
                PDF
              </a>
            )}
          </div>
        );
      },
    }),
  ];
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConsultarPlacas({ onEditar }) {
  const [operador, setOperador]         = useState(() => getOperadorInicial());
  const [placas, setPlacas]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => { fetchPlacas(); }, []);

  async function fetchPlacas(s = search, sf = statusFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tipo_placa: "extracao" });
      if (s.trim()) params.append("search", s.trim());
      if (sf) params.append("status_placa", sf);
      const data = await api(`/api/placas/?${params}`);
      setPlacas(data.results || data);
    } catch {
      setPlacas([]);
    } finally {
      setLoading(false);
    }
  }

  const columns = useMemo(() => buildColumns(onEditar), [onEditar]);

  return (
    <div>
      <NavigationButtons currentStep="extracao" />

      {!operador && <CrachaModal onValidado={setOperador} modulo="Consultar Placas" />}

      {/* Toolbar */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); fetchPlacas(e.target.value, statusFilter); }}
            placeholder="Buscar por código (ex: PL2603)"
            className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-neutral-300 rounded-lg outline-none focus:border-rs-red focus:ring-1 focus:ring-rs-red transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); fetchPlacas(search, e.target.value); }}
          className="px-3 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-700 outline-none focus:border-rs-red min-w-[180px]"
        >
          <option value="">Todos os status</option>
          <option value="aberta">Aberta</option>
          <option value="extracao_confirmada">Extração confirmada</option>
        </select>
        <Button onClick={() => fetchPlacas()} variant="outline" size="sm">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={placas}
        loading={loading}
        skeletonRows={6}
        pageSize={30}
        getRowCanExpand={() => true}
        renderSubRow={row => <PlacaSubRow row={row} />}
        emptyMessage="Nenhuma placa encontrada."
      />
    </div>
  );
}
