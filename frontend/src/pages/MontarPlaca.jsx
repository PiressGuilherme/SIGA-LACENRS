import { useState, useRef, useCallback, useEffect } from "react";
import Button from "../design-system/components/Button";
import CrachaModal from "../components/CrachaModal";
import NavigationButtons from "../components/NavigationButtons";
import { getOperadorInicial, getCsrfToken } from "../utils/auth";

// ---- Constantes da placa 8x12 ----
const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const ALL_POSITIONS = ROWS.flatMap((r) => COLS.map((c) => r + c));

// Ordem de preenchimento vertical (coluna-major): A01, B01, C01...H01, A02, B02...
const FILL_ORDER = [];
for (let ci = 0; ci < 12; ci++) {
  for (let ri = 0; ri < 8; ri++) {
    FILL_ORDER.push(ri * 12 + ci);
  }
}
const FILL_POS = new Array(96);
FILL_ORDER.forEach((gridIdx, fillPos) => {
  FILL_POS[gridIdx] = fillPos;
});

const TIPO = { AMOSTRA: "amostra", CN: "cn", CP: "cp", VAZIO: "vazio" };

const TIPO_COLORS = {
  [TIPO.AMOSTRA]: {
    bg: "bg-info-100",
    border: "border-info-500",
    text: "text-info-700",
  },
  [TIPO.CN]: {
    bg: "bg-warning-100",
    border: "border-warning-500",
    text: "text-warning-700",
  },
  [TIPO.CP]: {
    bg: "bg-pink-100",
    border: "border-pink-500",
    text: "text-pink-700",
  },
  [TIPO.VAZIO]: {
    bg: "bg-neutral-50",
    border: "border-neutral-200",
    text: "text-neutral-400",
  },
};

const DEFAULT_CP_IDX = 6 * 12 + 11; // G12
const DEFAULT_CN_IDX = 7 * 12 + 11; // H12

const REAGENTES = [
  { nome: "Tampão de Lise", vol: 200 },
  { nome: "Oligomix", vol: 5 },
  { nome: "Enzima", vol: 0.5 },
];

const STATUS_PLACA = {
  aberta: { bg: "bg-rs-red", label: "Aberta" },
  extracao_confirmada: { bg: "bg-purple-500", label: "Extração confirmada" },
  submetida: { bg: "bg-warning-500", label: "Submetida" },
  resultados_importados: { bg: "bg-success-600", label: "Resultados" },
};

function emptyGrid() {
  const g = ALL_POSITIONS.map((pos) => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: "",
  }));
  g[DEFAULT_CP_IDX] = { ...g[DEFAULT_CP_IDX], tipo_conteudo: TIPO.CP };
  g[DEFAULT_CN_IDX] = { ...g[DEFAULT_CN_IDX], tipo_conteudo: TIPO.CN };
  return g;
}

function gridFromPocos(pocos) {
  const g = ALL_POSITIONS.map((pos) => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: "",
  }));
  for (const poco of pocos) {
    const idx = ALL_POSITIONS.indexOf(poco.posicao);
    if (idx === -1) continue;
    g[idx] = {
      posicao: poco.posicao,
      tipo_conteudo: poco.tipo_conteudo,
      amostra_id: poco.amostra || null,
      amostra_codigo: poco.amostra_codigo || "",
    };
  }
  return g;
}

async function api(url, { csrfToken, method = "GET", body } = {}) {
  const opts = {
    method,
    headers: { "X-CSRFToken": getCsrfToken() },
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

// ================================================================
export default function MontarPlaca({
  csrfToken,
  editarPlacaId = null,
  onEditarDone,
}) {
  // ---- State: operador (crachá ou admin) ----
  const [operador, setOperador] = useState(() => getOperadorInicial());

  // ---- State: lista de placas ----
  const [placas, setPlacas] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showList, setShowList] = useState(false);
  const [searchPlacas, setSearchPlacas] = useState("");
  const [statusFilterPlacas, setStatusFilterPlacas] = useState("");

  // ---- State: editor ----
  const [placa, setPlaca] = useState(null);
  const [grid, setGrid] = useState(emptyGrid);
  const [modo, setModo] = useState(TIPO.AMOSTRA);
  const [selected, setSelected] = useState(FILL_ORDER[0]);
  const [codigo, setCodigo] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [salva, setSalva] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState(null);
  const inputRef = useRef();

  // Foco automático no input após cada scan (quando carregando volta a false)
  useEffect(() => {
    if (!carregando) inputRef.current?.focus();
  }, [carregando]);

  // Carrega placa solicitada pela aba de consulta
  useEffect(() => {
    if (editarPlacaId) {
      carregarPlaca(editarPlacaId);
      onEditarDone?.();
    }
  }, [editarPlacaId]);

  const isEditable =
    !!placa &&
    (!placa.status_placa || placa.status_placa === "aberta" || placa.local);

  // ---- Contadores ----
  const totalAmostras = grid.filter(
    (w) => w.tipo_conteudo === TIPO.AMOSTRA && w.amostra_codigo,
  ).length;
  const totalCN = grid.filter((w) => w.tipo_conteudo === TIPO.CN).length;
  const totalCP = grid.filter((w) => w.tipo_conteudo === TIPO.CP).length;
  const totalReacoes = totalAmostras + totalCN + totalCP;
  const hasControls = totalCN > 0 && totalCP > 0;

  const nextEmpty = useCallback(
    (afterGridIdx) => {
      const startFP = FILL_POS[afterGridIdx] + 1;
      for (let fp = startFP; fp < FILL_ORDER.length; fp++) {
        if (grid[FILL_ORDER[fp]].tipo_conteudo === TIPO.VAZIO)
          return FILL_ORDER[fp];
      }
      return -1;
    },
    [grid],
  );

  const firstEmpty = useCallback(() => {
    for (let fp = 0; fp < FILL_ORDER.length; fp++) {
      if (grid[FILL_ORDER[fp]].tipo_conteudo === TIPO.VAZIO)
        return FILL_ORDER[fp];
    }
    return -1;
  }, [grid]);

  // ---- Carregar lista de placas ----
  async function fetchPlacas(
    search = searchPlacas,
    statusFilter = statusFilterPlacas,
  ) {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (statusFilter) params.append("status_placa", statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await api(`/api/placas/${qs}`, { csrfToken });
      setPlacas(data.results || data);
    } catch {
      setPlacas([]);
    } finally {
      setLoadingList(false);
    }
  }

  function toggleList() {
    if (!showList) fetchPlacas();
    setShowList(!showList);
  }

  function handleSearchPlacas(e) {
    const val = e.target.value;
    setSearchPlacas(val);
    fetchPlacas(val, statusFilterPlacas);
  }

  function handleStatusFilterPlacas(e) {
    const val = e.target.value;
    setStatusFilterPlacas(val);
    fetchPlacas(searchPlacas, val);
  }

  // ---- Carregar placa existente ----
  async function carregarPlaca(id) {
    setCarregando(true);
    setFeedback(null);
    try {
      const data = await api(`/api/placas/${id}/`, { csrfToken });
      setPlaca(data);
      if (data.pocos && data.pocos.length > 0) {
        setGrid(gridFromPocos(data.pocos));
        setSalva(true);
      } else {
        setGrid(emptyGrid());
        setSalva(false);
      }
      setSelected(FILL_ORDER[0]);
      setShowList(false);
      setFeedback({ tipo: "sucesso", msg: `Placa ${data.codigo} carregada.` });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.detail || "Erro ao carregar placa.",
      });
    } finally {
      setCarregando(false);
    }
  }

  // ---- Criar placa (local — só persiste ao salvar) ----
  function criarPlaca() {
    setPlaca({ local: true });
    setGrid(emptyGrid());
    setSelected(FILL_ORDER[0]);
    setSalva(false);
    setFeedback(null);
    setShowList(false);
  }

  // ---- Colocar amostra ----
  function placeSample(amostra, gridIdx) {
    setGrid((prev) => {
      const next = [...prev];
      next[gridIdx] = {
        ...next[gridIdx],
        tipo_conteudo: TIPO.AMOSTRA,
        amostra_id: amostra.id,
        amostra_codigo: amostra.codigo_interno,
      };
      return next;
    });
    const ne = nextEmpty(gridIdx);
    setSelected(ne === -1 ? gridIdx : ne);
    setFeedback({
      tipo: "sucesso",
      msg: `${amostra.codigo_interno} → ${ALL_POSITIONS[gridIdx]}`,
    });
    setSalva(false);
    setPendingDuplicate(null);
  }

  // ---- Scan / digitar amostra ----
  async function handleScan(e) {
    e.preventDefault();
    const val = codigo.trim();
    if (!val) return;

    if (modo !== TIPO.AMOSTRA) {
      placeControl(modo);
      setCodigo("");
      return;
    }

    setCarregando(true);
    setFeedback(null);
    setPendingDuplicate(null);
    try {
      const amostra = await api(
        `/api/placas/buscar-amostra/?codigo=${encodeURIComponent(val)}`,
        { csrfToken },
      );

      let idx = selected;
      if (grid[idx].tipo_conteudo !== TIPO.VAZIO) idx = firstEmpty();
      if (idx === -1) {
        setFeedback({ tipo: "aviso", msg: "Placa cheia." });
        setCodigo("");
        setCarregando(false);
        return;
      }

      if (grid.some((w) => w.amostra_codigo === amostra.codigo_interno)) {
        setPendingDuplicate({ amostra, idx });
        setFeedback({
          tipo: "aviso",
          msg: `${amostra.codigo_interno} já está nesta placa.`,
        });
        setCodigo("");
        setCarregando(false);
        return;
      }

      placeSample(amostra, idx);
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.erro || "Amostra não encontrada.",
      });
    } finally {
      setCodigo("");
      setCarregando(false);
    }
  }

  function forceAddDuplicate() {
    if (!pendingDuplicate) return;
    placeSample(pendingDuplicate.amostra, pendingDuplicate.idx);
  }

  function placeControl(tipo) {
    let idx = selected;
    if (grid[idx].tipo_conteudo !== TIPO.VAZIO) idx = firstEmpty();
    if (idx === -1) return;

    setGrid((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        tipo_conteudo: tipo,
        amostra_id: null,
        amostra_codigo: "",
      };
      return next;
    });
    const ne = nextEmpty(idx);
    setSelected(ne === -1 ? idx : ne);
    setSalva(false);
  }

  function clearWell(idx) {
    if (!isEditable) return;
    setGrid((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        tipo_conteudo: TIPO.VAZIO,
        amostra_id: null,
        amostra_codigo: "",
      };
      return next;
    });
    setSalva(false);
  }

  // ---- Salvar placa ----
  async function salvarPlaca() {
    if (!placa) return;
    if (!hasControls) {
      setFeedback({
        tipo: "erro",
        msg: "A placa precisa ter pelo menos um CN e um CP.",
      });
      return;
    }
    setCarregando(true);
    setFeedback(null);

    const pocos = grid
      .filter((w) => w.tipo_conteudo !== TIPO.VAZIO)
      .map((w) => ({
        posicao: w.posicao,
        tipo_conteudo: w.tipo_conteudo,
        amostra_codigo: w.amostra_codigo || "",
      }));

    try {
      let placaAtual = placa;
      if (placa.local) {
        placaAtual = await api("/api/placas/", {
          csrfToken,
          method: "POST",
          body: {},
        });
        setPlaca(placaAtual);
      }

      const data = await api(`/api/placas/${placaAtual.id}/salvar-pocos/`, {
        csrfToken,
        method: "POST",
        body: { pocos, numero_cracha: operador?.numero_cracha },
      });
      setPlaca(data);
      setSalva(true);
      setFeedback({
        tipo: "sucesso",
        msg: `Placa ${data.codigo} salva — ${totalAmostras} amostras em extração.`,
      });
    } catch (err) {
      const erros = err.data?.erros || err.data?.detail;
      setFeedback({
        tipo: "erro",
        msg: Array.isArray(erros)
          ? erros.join("; ")
          : erros || "Erro ao salvar.",
      });
    } finally {
      setCarregando(false);
    }
  }

  // ---- Salvar como nova placa (cópia / repetição) ----
  async function salvarComoNova() {
    if (!hasControls) {
      setFeedback({
        tipo: "erro",
        msg: "A placa precisa ter pelo menos um CN e um CP.",
      });
      return;
    }
    setCarregando(true);
    setFeedback(null);

    const pocos = grid
      .filter((w) => w.tipo_conteudo !== TIPO.VAZIO)
      .map((w) => ({
        posicao: w.posicao,
        tipo_conteudo: w.tipo_conteudo,
        amostra_codigo: w.amostra_codigo || "",
      }));

    try {
      const novaPlaca = await api("/api/placas/", {
        csrfToken,
        method: "POST",
        body: {},
      });
      const data = await api(`/api/placas/${novaPlaca.id}/salvar-pocos/`, {
        csrfToken,
        method: "POST",
        body: { pocos, numero_cracha: operador?.numero_cracha },
      });
      setPlaca(data);
      setSalva(true);
      setFeedback({
        tipo: "sucesso",
        msg: `Nova placa ${data.codigo} criada com ${totalAmostras} amostra${totalAmostras !== 1 ? "s" : ""}.`,
      });
    } catch (err) {
      const erros = err.data?.erros || err.data?.detail;
      setFeedback({
        tipo: "erro",
        msg: Array.isArray(erros)
          ? erros.join("; ")
          : erros || "Erro ao criar nova placa.",
      });
    } finally {
      setCarregando(false);
    }
  }

  // ---- Excluir placa ----
  async function excluirPlaca() {
    if (!placa) return;
    if (placa.local) {
      resetar();
      return;
    }
    if (
      !window.confirm(
        `Excluir placa ${placa.codigo}? As amostras voltarão ao status Aliquotada.`,
      )
    )
      return;
    setCarregando(true);
    setFeedback(null);
    try {
      await api(`/api/placas/${placa.id}/`, { csrfToken, method: "DELETE" });
      setFeedback({ tipo: "sucesso", msg: `Placa ${placa.codigo} excluída.` });
      resetar();
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.erro || err.data?.detail || "Erro ao excluir.",
      });
    } finally {
      setCarregando(false);
    }
  }

  function resetar() {
    setPlaca(null);
    setGrid(emptyGrid());
    setSelected(FILL_ORDER[0]);
    setFeedback(null);
    setSalva(false);
    setCodigo("");
    setPendingDuplicate(null);
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div>
      <NavigationButtons currentStep="extracao" />

      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal
          onValidado={setOperador}
          modulo="Extração — Montar Placa"
        />
      )}

      {/* Barra do operador */}
      {operador && (
        <div className="flex items-center gap-3 bg-success-50 border border-success-200 rounded-lg px-4 py-2.5 mb-4">
          <span className="text-sm text-success-700 font-semibold">
            Operador: {operador.nome_completo}
          </span>
          <span className="text-xs bg-success-100 text-success-700 px-1.5 py-0.5 rounded-full font-medium">
            {operador.perfil}
          </span>
          <Button
            onClick={() => setOperador(null)}
            variant="outline"
            size="sm"
            className="ml-auto border-success-200 text-success-700 hover:bg-success-100"
          >
            Trocar operador
          </Button>
        </div>
      )}

      {/* ---- Selecionar / Criar placa ---- */}
      {!placa && (
        <div className="mb-6">
          <p className="text-neutral-500 mb-4">
            Crie uma nova placa ou abra uma existente para editar.
          </p>
          <div className="flex gap-3 flex-wrap mb-4">
            <Button
              onClick={criarPlaca}
              variant="primary"
              size="md"
              loading={carregando}
            >
              {carregando ? "Criando..." : "Criar Nova Placa"}
            </Button>
            <Button
              onClick={toggleList}
              variant="outline"
              size="md"
              disabled={carregando}
            >
              {showList ? "Fechar Lista" : "Abrir Placa Existente"}
            </Button>
          </div>

          {/* ---- Lista de placas (apenas ABERTA) ---- */}
          {showList && (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
              <div className="flex gap-2 p-3 border-b border-neutral-200 flex-wrap">
                <input
                  type="text"
                  value={searchPlacas}
                  onChange={handleSearchPlacas}
                  placeholder="Buscar por código (ex: PL2603)"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-neutral-300 rounded text-sm"
                />
                <select
                  value={statusFilterPlacas}
                  onChange={handleStatusFilterPlacas}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white"
                >
                  <option value="">Todos os status</option>
                  <option value="aberta">Aberta</option>
                  <option value="extracao_confirmada">
                    Extração confirmada
                  </option>
                  <option value="submetida">Submetida</option>
                  <option value="resultados_importados">Resultados</option>
                </select>
              </div>
              {loadingList ? (
                <p className="p-4 text-neutral-500">Carregando...</p>
              ) : placas.length === 0 ? (
                <p className="p-4 text-neutral-400">
                  Nenhuma placa encontrada.
                </p>
              ) : (
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
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {placas.map((p) => {
                      const badge = STATUS_PLACA[p.status_placa] || {
                        bg: "bg-neutral-500",
                        label: p.status_display,
                      };
                      return (
                        <tr key={p.id} className="border-b border-neutral-100">
                          <td className="px-3 py-2 text-neutral-700 font-semibold">
                            {p.codigo}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`${badge.bg} text-white px-2 py-0.5 rounded text-xs font-medium`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-neutral-700">
                            {p.total_amostras}
                          </td>
                          <td className="px-3 py-2 text-neutral-700">
                            {p.responsavel_nome || "—"}
                          </td>
                          <td className="px-3 py-2 text-neutral-700">
                            {fmtDate(p.data_criacao)}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              onClick={() => carregarPlaca(p.id)}
                              variant="primary"
                              size="sm"
                            >
                              Abrir
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- Info da placa ativa ---- */}
      {placa && (
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <span className="bg-rs-red text-white px-4 py-1.5 rounded-md font-semibold text-base tracking-wide">
            {placa.local ? "Nova Placa" : placa.codigo}
          </span>
          <span className="text-neutral-500 text-sm">
            {totalAmostras} amostras | {totalCN} CN | {totalCP} CP |{" "}
            {totalReacoes} reações
          </span>
          {salva && (
            <span className="text-success-700 font-medium text-sm">Salva</span>
          )}
          {placa.status_placa && placa.status_placa !== "aberta" && (
            <span
              className={`${
                (STATUS_PLACA[placa.status_placa] || {}).bg || "bg-neutral-500"
              } text-white px-2.5 py-0.5 rounded text-xs font-medium`}
            >
              {(STATUS_PLACA[placa.status_placa] || {}).label ||
                placa.status_display}
            </span>
          )}
        </div>
      )}

      {/* ---- Feedback ---- */}
      {feedback && (
        <div
          className={`px-4 py-2.5 rounded-md mb-4 flex items-center gap-3 flex-wrap ${
            feedback.tipo === "sucesso"
              ? "bg-success-50 text-success-700 border border-success-200"
              : feedback.tipo === "aviso"
                ? "bg-warning-50 text-warning-700 border border-warning-200"
                : "bg-danger-50 text-danger-700 border border-danger-200"
          }`}
        >
          <span>{feedback.msg}</span>
          {pendingDuplicate && (
            <Button
              onClick={forceAddDuplicate}
              variant="primary"
              size="sm"
              className="bg-warning-700 hover:bg-warning-800"
            >
              Adicionar mesmo assim
            </Button>
          )}
        </div>
      )}

      {/* ---- Aviso de controles ---- */}
      {placa && isEditable && !hasControls && (
        <div className="px-4 py-2 rounded-md mb-4 bg-danger-50 text-danger-700 text-sm border border-danger-200">
          A placa precisa de pelo menos um CN e um CP para ser salva.
        </div>
      )}

      {placa && (
        <>
          {/* ---- Scanner + modo (só para placa aberta) ---- */}
          {isEditable && (
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <form
                onSubmit={handleScan}
                className="flex gap-2 flex-1 min-w-[280px]"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder={
                    modo === TIPO.AMOSTRA
                      ? "Escanear código da amostra..."
                      : `Clique no poço ou Enter para ${modo === TIPO.CN ? "CN" : "CP"}`
                  }
                  disabled={carregando}
                  autoComplete="off"
                  className="flex-1 px-3 py-2.5 text-sm border-2 border-neutral-300 rounded-md outline-none"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={carregando}
                >
                  {modo === TIPO.AMOSTRA ? "Buscar" : "Inserir"}
                </Button>
              </form>

              <div className="flex gap-1">
                {[TIPO.AMOSTRA, TIPO.CN, TIPO.CP].map((t) => (
                  <button
                    key={t}
                    onClick={() => setModo(t)}
                    className={`px-3 py-2 rounded-md text-xs font-medium cursor-pointer border-none ${
                      modo === t
                        ? `${TIPO_COLORS[t].border} text-white bg-info-500`
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    {t === TIPO.AMOSTRA ? "Amostra" : t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---- Reagentes ---- */}
          {totalReacoes > 0 && (
            <div className="flex gap-6 mb-4 px-4 py-2.5 bg-info-50 rounded-md text-sm text-info-700 flex-wrap">
              {REAGENTES.map((r) => (
                <span key={r.nome}>
                  <b>{r.nome}:</b> {(totalReacoes * r.vol).toFixed(1)} uL (
                  {r.vol} x {totalReacoes})
                </span>
              ))}
            </div>
          )}

          {/* ---- Grid 8x12 ---- */}
          <div className="overflow-x-auto mb-6">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="w-[28px]" />
                  {COLS.map((c) => (
                    <th
                      key={c}
                      className="text-center text-xs text-neutral-500 pb-1 pt-0.5"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, ri) => (
                  <tr key={row}>
                    <td className="font-semibold text-xs text-neutral-500 text-center pr-1">
                      {row}
                    </td>
                    {COLS.map((col, ci) => {
                      const idx = ri * 12 + ci;
                      const w = grid[idx];
                      const colors = TIPO_COLORS[w.tipo_conteudo];
                      const isSelected = idx === selected && isEditable;

                      return (
                        <td key={col} className="p-[1.5px]">
                          <div
                            onClick={() => {
                              if (!isEditable) return;
                              if (w.tipo_conteudo === TIPO.VAZIO) {
                                if (modo !== TIPO.AMOSTRA) placeControl(modo);
                                else setSelected(idx);
                              } else {
                                setSelected(idx);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              clearWell(idx);
                            }}
                            title={w.amostra_codigo || w.tipo_conteudo}
                            className={`w-[62px] h-[40px] ${colors.bg} ${isSelected ? `border-2 border-rs-red shadow-[0_0_0_2px_#3b82f6]` : `${colors.border} border`} rounded flex items-center justify-center cursor-${isEditable ? "pointer" : "default"} text-xs leading-tight relative`}
                          >
                            {w.tipo_conteudo === TIPO.AMOSTRA &&
                              w.amostra_codigo && (
                                <span
                                  className={`font-bold ${colors.text} text-[0.7rem]`}
                                >
                                  {w.amostra_codigo}
                                </span>
                              )}
                            {w.tipo_conteudo === TIPO.CN && (
                              <span className={`font-bold ${colors.text}`}>
                                CN
                              </span>
                            )}
                            {w.tipo_conteudo === TIPO.CP && (
                              <span className={`font-bold ${colors.text}`}>
                                CP
                              </span>
                            )}
                            {w.tipo_conteudo !== TIPO.VAZIO && isEditable && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearWell(idx);
                                }}
                                className="absolute top-[1px] right-[3px] text-neutral-400 cursor-pointer text-[0.65rem] leading-none"
                              >
                                x
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---- Ações ---- */}
          <div className="flex gap-3 flex-wrap mb-8">
            {isEditable && (
              <Button
                onClick={salvarPlaca}
                variant="primary"
                size="md"
                loading={carregando}
                disabled={totalAmostras === 0 || !hasControls}
                className="bg-success-700 hover:bg-success-800"
              >
                {carregando ? "Salvando..." : "Salvar Placa"}
              </Button>
            )}
            {placa && !placa.local && (
              <Button
                onClick={salvarComoNova}
                variant="primary"
                size="md"
                loading={carregando}
                disabled={totalAmostras === 0 || !hasControls}
                title="Cria uma nova placa com os mesmos poços, sem alterar a original"
              >
                {carregando ? "Salvando..." : "Salvar como nova placa"}
              </Button>
            )}
            {placa && (
              <Button
                onClick={excluirPlaca}
                variant="danger"
                size="md"
                loading={carregando}
              >
                Excluir Placa
              </Button>
            )}
            {salva && placa && (
              <a
                href={`/api/placas/${placa.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-md bg-neutral-600 text-white font-medium text-sm no-underline inline-block hover:bg-neutral-700"
              >
                Exportar PDF
              </a>
            )}
            <Button onClick={resetar} variant="outline" size="md">
              {placa ? "Fechar Placa" : "Nova Placa"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Helpers ----
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
