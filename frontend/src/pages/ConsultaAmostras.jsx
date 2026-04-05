import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import StatusBadge from "../design-system/components/StatusBadge";
import CrachaModal from "../components/CrachaModal";
import DataTable from "../components/ui/data-table";
import { getOperadorInicial } from "../utils/auth";
import { cn } from "../lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function diasNoLab(dataRecebimento) {
  if (!dataRecebimento) return null;
  const diff = Date.now() - new Date(dataRecebimento).getTime();
  return Math.floor(diff / 86400000);
}

const STATUS_COM_RESULTADO = new Set(["resultado", "resultado_liberado"]);

const RESULTADO_BADGE = {
  hpv_nao_detectado:  { label: "Não Detectado",          color: "text-success-700",  bg: "bg-success-50" },
  hpv16:              { label: "HPV-16",                  color: "text-warning-700",  bg: "bg-warning-50" },
  hpv18:              { label: "HPV-18",                  color: "text-warning-700",  bg: "bg-warning-50" },
  hpv_ar:             { label: "HPV AR",                  color: "text-warning-700",  bg: "bg-warning-50" },
  hpv18_ar:           { label: "HPV-18 + AR",             color: "text-warning-700",  bg: "bg-warning-50" },
  hpv16_ar:           { label: "HPV-16 + AR",             color: "text-warning-700",  bg: "bg-warning-50" },
  hpv16_18:           { label: "HPV-16 + HPV-18",         color: "text-warning-700",  bg: "bg-warning-50" },
  hpv16_18_ar:        { label: "HPV-16, HPV-18 + AR",     color: "text-warning-700",  bg: "bg-warning-50" },
  invalido:           { label: "Inválido",                color: "text-danger-700",   bg: "bg-danger-50"  },
  inconclusivo:       { label: "Inconclusivo",            color: "text-neutral-700",  bg: "bg-neutral-100"},
  pendente:           { label: "Pendente",                color: "text-neutral-700",  bg: "bg-neutral-100"},
};

const STATUS_DOT_COLOR = {
  aguardando_triagem:   "#6b7280",
  exame_em_analise:     "#f59e0b",
  aliquotada:           "#7f1d1d",
  extracao:             "#f59e0b",
  extraida:             "#a855f7",
  resultado:            "#14b8a6",
  resultado_liberado:   "#16a34a",
  cancelada:            "#ef4444",
  repeticao_solicitada: "#fbbf24",
};

// ── Subcomponentes ────────────────────────────────────────────────────────────

function CanalChip({ canal }) {
  if (!canal) return <span className="text-neutral-300">—</span>;
  const pos = canal.interpretacao_efetiva === "positivo";
  const neg = canal.interpretacao_efetiva === "negativo";
  return (
    <span className={cn("font-semibold text-xs", pos ? "text-danger-600" : neg ? "text-success-600" : "text-neutral-400")}>
      {pos ? "+" : neg ? "−" : "?"}
      {canal.cq != null && (
        <span className="font-normal text-neutral-500 text-[0.73rem]"> {canal.cq.toFixed(1)}</span>
      )}
    </span>
  );
}

function DiasChip({ data }) {
  const dias = diasNoLab(data);
  if (dias === null) return <span className="text-neutral-300">—</span>;
  const color = dias <= 3 ? "text-success-700" : dias <= 5 ? "text-warning-600" : "text-danger-700";
  return <span className={cn("text-xs font-semibold tabular-nums", color)}>{dias}d</span>;
}

function HistoricoPanel({ amostra }) {
  const [historico, setHistorico] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setCarregando(true);
    fetch(`/api/amostras/${amostra.id}/historico/`, {
      credentials: "same-origin",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(setHistorico)
      .catch(() => setHistorico([]))
      .finally(() => setCarregando(false));
  }, [amostra.id]);

  return (
    <div className="px-2 py-3">
      {/* Metadados */}
      <div className="flex gap-4 flex-wrap text-xs text-neutral-500 mb-3">
        {amostra.numero_gal && <span><b className="text-neutral-700">GAL:</b> {amostra.numero_gal}</span>}
        {amostra.cod_amostra_gal && <span><b className="text-neutral-700">Cód. Amostra:</b> {amostra.cod_amostra_gal}</span>}
        {amostra.recebido_por_nome && <span><b className="text-neutral-700">Recebido por:</b> {amostra.recebido_por_nome}</span>}
        {amostra.data_recebimento && <span><b className="text-neutral-700">Recebido em:</b> {fmtDate(amostra.data_recebimento)}</span>}
        {amostra.material && <span><b className="text-neutral-700">Material:</b> {amostra.material}</span>}
        {amostra.unidade_solicitante && <span><b className="text-neutral-700">Solicitante:</b> {amostra.unidade_solicitante}</span>}
      </div>

      <div className="font-semibold text-xs text-rs-red mb-2 uppercase tracking-wide">Histórico</div>

      {carregando && <span className="text-neutral-400 text-xs animate-pulse">Carregando...</span>}
      {!carregando && historico?.length === 0 && <span className="text-neutral-400 text-xs">Sem histórico registrado.</span>}
      {!carregando && historico?.length > 0 && (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-neutral-200" />
          {historico.map((h, idx) => (
            <div key={idx} className={cn("relative text-xs flex items-start gap-2", idx < historico.length - 1 && "pb-2")}>
              <div
                className="absolute -left-6 top-[3px] w-2.5 h-2.5 rounded-full border-2 border-white shadow-[0_0_0_1px_#d1d5db] z-[1]"
                style={{ backgroundColor: STATUS_DOT_COLOR[h.para_valor] || "#6b7280" }}
              />
              <div className="flex flex-wrap items-center gap-1">
                <StatusBadge status={h.para_valor} />
                {h.tipo === "criacao" && (
                  <span className="text-success-600 text-[0.73rem] font-medium">Importada</span>
                )}
                <span className="text-neutral-400 text-[0.73rem] whitespace-nowrap">{fmtDate(h.timestamp)}</span>
                {h.actor && <span className="text-neutral-600 text-[0.73rem]">· {h.actor}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Definição de colunas ──────────────────────────────────────────────────────

const col = createColumnHelper();

function buildColumns(resultadosMap) {
  return [
    col.display({
      id: "expand",
      size: 30,
      header: () => null,
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); row.toggleExpanded(); }}
          className="text-neutral-400 hover:text-rs-red transition-colors"
        >
          {row.getIsExpanded()
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
      ),
      enableSorting: false,
    }),
    col.accessor("codigo_interno", {
      header: "Num. Interno",
      cell: info => <span className="font-semibold font-mono text-neutral-800">{info.getValue() || "—"}</span>,
    }),
    col.accessor("numero_gal", {
      header: "Requisição",
      enableSorting: false,
      cell: info => <span className="text-neutral-500 text-xs">{info.getValue()}</span>,
    }),
    col.accessor("nome_paciente", {
      header: "Paciente",
      cell: info => {
        const v = info.getValue();
        return <span title={v}>{v?.length > 22 ? v.slice(0, 22) + "…" : v}</span>;
      },
    }),
    col.accessor("cpf", {
      header: "CPF",
      enableSorting: false,
      cell: info => <span className="text-neutral-500 font-mono text-xs">{info.getValue() || "—"}</span>,
    }),
    col.accessor("municipio", {
      header: "Município",
      cell: info => <span className="text-neutral-600">{info.getValue() || "—"}</span>,
    }),
    col.accessor("status", {
      header: "Status",
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    col.accessor("data_recebimento", {
      header: "Recebimento",
      cell: info => <span className="text-neutral-500 text-xs whitespace-nowrap">{fmtDate(info.getValue())}</span>,
    }),
    col.display({
      id: "dias_lab",
      header: "Dias",
      enableSorting: false,
      cell: ({ row }) => <DiasChip data={row.original.data_recebimento} />,
    }),
    col.display({
      id: "resultado",
      header: "Resultado",
      enableSorting: false,
      cell: ({ row }) => {
        const res = resultadosMap[row.original.id]?.[0];
        if (!res) return <span className="text-neutral-300">—</span>;
        const badge = RESULTADO_BADGE[res.resultado_final] || { label: res.resultado_final_display, color: "text-neutral-700", bg: "bg-neutral-100" };
        return (
          <span className={cn(badge.bg, badge.color, "px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap")}>
            {badge.label}
          </span>
        );
      },
    }),
    col.display({
      id: "ci",
      header: "CI",
      enableSorting: false,
      cell: ({ row }) => {
        const res = resultadosMap[row.original.id]?.[0];
        return <CanalChip canal={res?.canais?.find(c => c.canal === "CI")} />;
      },
    }),
    col.display({
      id: "hpv16",
      header: "HPV-16",
      enableSorting: false,
      cell: ({ row }) => {
        const res = resultadosMap[row.original.id]?.[0];
        return <CanalChip canal={res?.canais?.find(c => c.canal === "HPV16")} />;
      },
    }),
    col.display({
      id: "hpv18",
      header: "HPV-18",
      enableSorting: false,
      cell: ({ row }) => {
        const res = resultadosMap[row.original.id]?.[0];
        return <CanalChip canal={res?.canais?.find(c => c.canal === "HPV18")} />;
      },
    }),
    col.display({
      id: "hpvar",
      header: "HPV AR",
      enableSorting: false,
      cell: ({ row }) => {
        const res = resultadosMap[row.original.id]?.[0];
        return <CanalChip canal={res?.canais?.find(c => c.canal === "HPV_AR")} />;
      },
    }),
  ];
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConsultaAmostras() {
  const [operador, setOperador]           = useState(() => getOperadorInicial());
  const [amostras, setAmostras]           = useState([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [municipioFilter, setMunicipioFilter] = useState("");
  const [ordering]                         = useState("codigo_interno");
  const [filtros, setFiltros]             = useState(null);
  const [carregando, setCarregando]       = useState(false);
  const [erro, setErro]                   = useState(null);
  const [resultadosMap, setResultadosMap] = useState({});
  const debounceRef = useRef();

  useEffect(() => {
    fetch("/api/amostras/filtros/", { credentials: "same-origin" })
      .then(r => r.json()).then(setFiltros).catch(() => {});
  }, []);

  const fetchAmostras = useCallback(() => {
    setCarregando(true);
    setErro(null);
    const params = new URLSearchParams({ page });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (municipioFilter) params.set("municipio", municipioFilter);
    if (ordering) params.set("ordering", ordering);

    const token = localStorage.getItem("access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`/api/amostras/?${params}`, { credentials: "same-origin", headers })
      .then(r => { if (!r.ok) throw new Error(`Erro ${r.status}`); return r.json(); })
      .then(data => {
        const lista = data.results || [];
        setAmostras(lista);
        setTotal(data.count || 0);

        const idsComRes = lista.filter(a => STATUS_COM_RESULTADO.has(a.status)).map(a => a.id);
        if (idsComRes.length > 0) {
          Promise.all(
            idsComRes.map(id =>
              fetch(`/api/resultados/?amostra_id=${id}`, { credentials: "same-origin", headers })
                .then(r => r.json())
                .then(d => ({ id, resultados: d.results || d }))
                .catch(() => ({ id, resultados: [] }))
            )
          ).then(entries => {
            const map = {};
            entries.forEach(({ id, resultados }) => { map[id] = resultados; });
            setResultadosMap(map);
          });
        } else {
          setResultadosMap({});
        }
      })
      .catch(e => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [page, search, statusFilter, municipioFilter, ordering]);

  useEffect(() => { fetchAmostras(); }, [fetchAmostras]);

  function handleSearchInput(e) {
    clearTimeout(debounceRef.current);
    const val = e.target.value;
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  }

  const columns = useMemo(() => buildColumns(resultadosMap), [resultadosMap]);

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {!operador && <CrachaModal onValidado={setOperador} modulo="Consulta de Amostras" />}

      {/* Toolbar de filtros */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, CNS, código interno, GAL..."
            onChange={handleSearchInput}
            className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-neutral-300 rounded-lg outline-none focus:border-rs-red focus:ring-1 focus:ring-rs-red transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-700 outline-none focus:border-rs-red min-w-[160px]"
        >
          <option value="">Todos os status</option>
          {(filtros?.status_choices || []).map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={municipioFilter}
          onChange={e => { setMunicipioFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-700 outline-none focus:border-rs-red min-w-[160px]"
        >
          <option value="">Todos os municípios</option>
          {(filtros?.municipios || []).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Contador + status */}
      <div className="flex items-center gap-4 mb-3 text-sm text-neutral-500">
        <span><b className="text-neutral-800">{total}</b> amostra{total !== 1 ? "s" : ""} encontrada{total !== 1 ? "s" : ""}</span>
        {carregando && <span className="text-rs-red animate-pulse">Carregando...</span>}
      </div>

      {erro && (
        <div className="bg-danger-50 text-danger-700 px-4 py-2.5 rounded-lg mb-4 text-sm">{erro}</div>
      )}

      {/* Tabela TanStack */}
      <DataTable
        columns={columns}
        data={amostras}
        loading={carregando}
        skeletonRows={10}
        pageSize={pageSize}
        getRowCanExpand={() => true}
        renderSubRow={row => <HistoricoPanel amostra={row.original} />}
        emptyMessage="Nenhuma amostra encontrada."
      />

      {/* Paginação servidor (a DataTable tem paginação client-side; esta é a do server) */}
      {totalPages > 1 && !carregando && (
        <div className="flex items-center gap-2 justify-center mt-3 text-sm">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-neutral-600">Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
