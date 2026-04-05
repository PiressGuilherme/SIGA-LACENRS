import { useState, useEffect, useCallback, useRef } from "react";
import Button from "../design-system/components/Button";
import StatusBadge from "../design-system/components/StatusBadge";
import CrachaModal from "../components/CrachaModal";
import { getOperadorInicial } from "../utils/auth";

const RESULTADO_BADGE = {
  hpv_nao_detectado: {
    label: "Não Detectado",
    color: "text-success-700",
    bg: "bg-success-50",
  },
  hpv16: { label: "HPV-16", color: "text-warning-700", bg: "bg-warning-50" },
  hpv18: { label: "HPV-18", color: "text-warning-700", bg: "bg-warning-50" },
  hpv_ar: { label: "HPV AR", color: "text-warning-700", bg: "bg-warning-50" },
  hpv18_ar: {
    label: "HPV-18 + AR",
    color: "text-warning-700",
    bg: "bg-warning-50",
  },
  hpv16_ar: {
    label: "HPV-16 + AR",
    color: "text-warning-700",
    bg: "bg-warning-50",
  },
  hpv16_18: {
    label: "HPV-16 + HPV-18",
    color: "text-warning-700",
    bg: "bg-warning-50",
  },
  hpv16_18_ar: {
    label: "HPV-16, HPV-18 + AR",
    color: "text-warning-700",
    bg: "bg-warning-50",
  },
  invalido: { label: "Inválido", color: "text-danger-700", bg: "bg-danger-50" },
  inconclusivo: {
    label: "Inconclusivo",
    color: "text-neutral-700",
    bg: "bg-neutral-100",
  },
  pendente: {
    label: "Pendente",
    color: "text-neutral-700",
    bg: "bg-neutral-100",
  },
};

const STATUS_COM_RESULTADO = new Set(["resultado", "resultado_liberado"]);

const COLUNAS_BASE = [
  { key: "codigo_interno", label: "Num. Interno", sortable: true },
  { key: "numero_gal", label: "Requisição", sortable: false },
  { key: "nome_paciente", label: "Paciente", sortable: true },
  { key: "cpf", label: "CPF", sortable: false },
  { key: "municipio", label: "Município", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "data_recebimento", label: "Dt. Recebimento", sortable: true },
  { key: "_resultado", label: "Resultado", sortable: false },
  { key: "_ci", label: "CI", sortable: false },
  { key: "_hpv16", label: "HPV-16", sortable: false },
  { key: "_hpv18", label: "HPV-18", sortable: false },
  { key: "_hpvar", label: "HPV AR", sortable: false },
];

function CanalChip({ canal }) {
  if (!canal) return <span className="text-neutral-300">—</span>;
  const interp = canal.interpretacao_efetiva;
  const pos = interp === "positivo";
  const neg = interp === "negativo";
  return (
    <span
      className={`font-semibold text-xs ${pos ? "text-danger-600" : neg ? "text-success-600" : "text-neutral-400"}`}
    >
      {pos ? "+" : neg ? "−" : "?"}
      {canal.cq != null && (
        <span className="font-normal text-neutral-500 text-[0.73rem]">
          {" "}
          {canal.cq.toFixed(1)}
        </span>
      )}
    </span>
  );
}

function LinhaAmostra({ a, resultados }) {
  const [aberta, setAberta] = useState(false);
  const [historico, setHistorico] = useState(null);
  const [carregandoHist, setCarregandoHist] = useState(false);

  const ultimoRes = resultados?.[0] || null;
  const resBadge = ultimoRes
    ? RESULTADO_BADGE[ultimoRes.resultado_final] || {
        label: ultimoRes.resultado_final_display,
        color: "text-neutral-700",
        bg: "bg-neutral-100",
      }
    : null;

  function canalDe(res, nome) {
    return (res?.canais || []).find((c) => c.canal === nome) || null;
  }

  function toggle() {
    if (!aberta && !historico) carregarHistorico();
    setAberta((v) => !v);
  }

  function carregarHistorico() {
    const token = localStorage.getItem("access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setCarregandoHist(true);
    fetch(`/api/amostras/${a.id}/historico/`, {
      credentials: "same-origin",
      headers,
    })
      .then((r) => r.json())
      .then((d) => setHistorico(d))
      .catch(() => setHistorico([]))
      .finally(() => setCarregandoHist(false));
  }

  const numColunas = COLUNAS_BASE.length;

  return (
    <>
      <tr
        onClick={toggle}
        className={`cursor-pointer transition-colors ${aberta ? "bg-danger-50 border-b-0" : "border-b border-neutral-100"}`}
        title="Clique para ver histórico"
      >
        <td className="px-3 py-2 text-neutral-700 font-semibold whitespace-nowrap">
          <span className="mr-1.5 text-xs text-neutral-500">
            {aberta ? "▼" : "▶"}
          </span>
          {a.codigo_interno || "—"}
        </td>
        <td className="px-3 py-2 text-neutral-500">{a.numero_gal}</td>
        <td className="px-3 py-2 text-neutral-700" title={a.nome_paciente}>
          {a.nome_paciente?.length > 25
            ? a.nome_paciente.slice(0, 25) + "..."
            : a.nome_paciente}
        </td>
        <td className="px-3 py-2 text-neutral-500">{a.cpf || "—"}</td>
        <td className="px-3 py-2 text-neutral-700">{a.municipio || "—"}</td>
        <td className="px-3 py-2">
          <StatusBadge status={a.status} />
        </td>
        <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
          {fmtDate(a.data_recebimento)}
        </td>
        <td className="px-3 py-2">
          {resBadge ? (
            <span
              className={`${resBadge.bg} ${resBadge.color} px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap`}
            >
              {resBadge.label}
            </span>
          ) : (
            <span className="text-neutral-300">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          {ultimoRes ? (
            <CanalChip canal={canalDe(ultimoRes, "CI")} />
          ) : (
            <span className="text-neutral-300">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          {ultimoRes ? (
            <CanalChip canal={canalDe(ultimoRes, "HPV16")} />
          ) : (
            <span className="text-neutral-300">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          {ultimoRes ? (
            <CanalChip canal={canalDe(ultimoRes, "HPV18")} />
          ) : (
            <span className="text-neutral-300">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          {ultimoRes ? (
            <CanalChip canal={canalDe(ultimoRes, "HPV_AR")} />
          ) : (
            <span className="text-neutral-300">—</span>
          )}
        </td>
      </tr>

      {aberta && (
        <tr className="border-b border-neutral-100 bg-danger-50">
          <td colSpan={numColunas} className="p-0">
            <div className="overflow-x-auto px-4 py-3 pl-8">
              <div className="flex gap-6 flex-wrap text-xs text-neutral-500 mb-3">
                <span>
                  <b className="text-neutral-700">GAL:</b> {a.numero_gal}
                </span>
                <span>
                  <b className="text-neutral-700">Cód. Amostra:</b>{" "}
                  {a.cod_amostra_gal || "—"}
                </span>
                {a.recebido_por_nome && (
                  <span>
                    <b className="text-neutral-700">Recebido por:</b>{" "}
                    {a.recebido_por_nome}
                  </span>
                )}
                {a.data_recebimento && (
                  <span>
                    <b className="text-neutral-700">Recebido em:</b>{" "}
                    {fmtDate(a.data_recebimento)}
                  </span>
                )}
                {a.material && (
                  <span>
                    <b className="text-neutral-700">Material:</b> {a.material}
                  </span>
                )}
                {a.unidade_solicitante && (
                  <span>
                    <b className="text-neutral-700">Solicitante:</b>{" "}
                    {a.unidade_solicitante}
                  </span>
                )}
              </div>

              <div className="font-semibold text-xs text-rs-red mb-2">
                Histórico da amostra
              </div>

              {carregandoHist && (
                <span className="text-neutral-500 text-xs">Carregando...</span>
              )}

              {!carregandoHist &&
                historico !== null &&
                historico.length === 0 && (
                  <span className="text-neutral-400 text-xs">
                    Sem histórico registrado.
                  </span>
                )}

              {!carregandoHist &&
                historico !== null &&
                historico.length > 0 && (
                  <div className="relative pl-6">
                    <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-neutral-300" />

                    {historico.map((h, idx) => {
                      const isLast = idx === historico.length - 1;
                      return (
                        <div
                          key={idx}
                          className={`relative ${isLast ? "" : "pb-2"} text-xs flex items-start gap-2`}
                        >
                          <div
                            className={`absolute -left-6 top-[3px] w-2.5 h-2.5 rounded-full border-2 border-white shadow-[0_0_0_1px_#d1d5db] z-[1]`}
                            style={{
                              backgroundColor: getStatusColor(h.para_valor),
                            }}
                          />

                          <div className="flex flex-wrap items-center gap-1">
                            <StatusBadge status={h.para_valor} />
                            {h.de && (
                              <span className="text-neutral-400 text-[0.73rem]">
                                ← {h.de}
                              </span>
                            )}
                            {h.tipo === "criacao" && (
                              <span className="text-success-600 text-[0.73rem] font-medium">
                                Importada no sistema
                              </span>
                            )}
                            <span className="text-neutral-500 text-[0.73rem] whitespace-nowrap">
                              {fmtDate(h.timestamp)}
                            </span>
                            {h.actor && (
                              <span className="text-neutral-700 text-[0.73rem]">
                                · {h.actor}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function getStatusColor(status) {
  const colors = {
    aguardando_triagem: "#6b7280",
    exame_em_analise: "#3b82f6",
    aliquotada: "#1d4ed8",
    extracao: "#f59e0b",
    extraida: "#a855f7",
    resultado: "#14b8a6",
    resultado_liberado: "#16a34a",
    cancelada: "#ef4444",
    repeticao_solicitada: "#fbbf24",
  };
  return colors[status] || "#6b7280";
}

export default function ConsultaAmostras() {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [amostras, setAmostras] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [municipioFilter, setMunicipioFilter] = useState("");
  const [ordering, setOrdering] = useState("codigo_interno");
  const [filtros, setFiltros] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultadosMap, setResultadosMap] = useState({});
  const searchRef = useRef();
  const debounceRef = useRef();

  useEffect(() => {
    fetch("/api/amostras/filtros/", { credentials: "same-origin" })
      .then((r) => r.json())
      .then(setFiltros)
      .catch(() => {});
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
      .then((r) => {
        if (!r.ok) throw new Error(`Erro ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const lista = data.results || [];
        setAmostras(lista);
        setTotal(data.count || 0);

        const idsComRes = lista
          .filter((a) => STATUS_COM_RESULTADO.has(a.status))
          .map((a) => a.id);

        if (idsComRes.length > 0) {
          Promise.all(
            idsComRes.map((id) =>
              fetch(`/api/resultados/?amostra_id=${id}`, {
                credentials: "same-origin",
                headers,
              })
                .then((r) => r.json())
                .then((d) => ({ id, resultados: d.results || d }))
                .catch(() => ({ id, resultados: [] })),
            ),
          ).then((entries) => {
            const map = {};
            entries.forEach(({ id, resultados }) => {
              map[id] = resultados;
            });
            setResultadosMap(map);
          });
        } else {
          setResultadosMap({});
        }
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [page, search, statusFilter, municipioFilter, ordering]);

  useEffect(() => {
    fetchAmostras();
  }, [fetchAmostras]);

  function handleSearchInput(e) {
    clearTimeout(debounceRef.current);
    const val = e.target.value;
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  }

  function handleSort(key) {
    setOrdering((prev) => (prev === key ? `-${key}` : key));
    setPage(1);
  }

  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Consulta de Amostras" />
      )}

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar por nome, CPF, CNS, código interno, GAL..."
          onChange={handleSearchInput}
          className="flex-1 min-w-[260px] px-3 py-2.5 text-sm border border-neutral-300 rounded-md outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 text-sm border border-neutral-300 rounded-md bg-white text-neutral-700 outline-none min-w-[150px]"
        >
          <option value="">Todos os status</option>
          {(filtros?.status_choices || []).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={municipioFilter}
          onChange={(e) => {
            setMunicipioFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 text-sm border border-neutral-300 rounded-md bg-white text-neutral-700 outline-none min-w-[150px]"
        >
          <option value="">Todos os municípios</option>
          {(filtros?.municipios || []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4 mb-3 text-sm text-neutral-500">
        <span>
          <b>{total}</b> amostra{total !== 1 ? "s" : ""} encontrada
          {total !== 1 ? "s" : ""}
        </span>
        {carregando && <span className="text-rs-red">Carregando...</span>}
      </div>

      {erro && (
        <div className="bg-danger-50 text-danger-700 px-4 py-2.5 rounded-md mb-4">
          {erro}
        </div>
      )}

      <div className="overflow-auto max-h-[calc(100vh-220px)] bg-white rounded-lg border border-neutral-200 mb-4">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b-2 border-neutral-200 sticky top-0 z-[2]">
              {COLUNAS_BASE.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-3 py-2.5 text-left font-semibold whitespace-nowrap select-none ${
                    col.sortable ? "cursor-pointer" : ""
                  } ${col.key.startsWith("_") ? "text-success-600 border-l-2 border-neutral-200" : "text-neutral-700"}`}
                >
                  {col.label}
                  {col.sortable && (
                    <span
                      className={`ml-1 ${ordering.replace("-", "") === col.key ? "opacity-100" : "opacity-25"}`}
                    >
                      {ordering === `-${col.key}` ? "▼" : "▲"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {amostras.length === 0 && !carregando && (
              <tr>
                <td
                  colSpan={COLUNAS_BASE.length}
                  className="px-3 py-8 text-center text-neutral-400"
                >
                  Nenhuma amostra encontrada.
                </td>
              </tr>
            )}
            {amostras.map((a) => (
              <LinhaAmostra key={a.id} a={a} resultados={resultadosMap[a.id]} />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            variant="outline"
            size="sm"
          >
            Anterior
          </Button>
          <span className="text-sm text-neutral-700">
            Página {page} de {totalPages}
          </span>
          <Button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            variant="outline"
            size="sm"
          >
            Próxima
          </Button>
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
