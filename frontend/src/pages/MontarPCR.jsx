import { useState, useRef, useCallback, useEffect } from "react";
import Button from "../design-system/components/Button";
import CrachaModal from "../components/CrachaModal";
import NavigationButtons from "../components/NavigationButtons";
import {
  getOperadorInicial,
  getCsrfToken,
  isEspecialista,
} from "../utils/auth";

// ---- Constantes da placa 8x12 ----
const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const ALL_POSITIONS = ROWS.flatMap((r) => COLS.map((c) => r + c));

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

const REPETIDO_COLORS = {
  bg: "bg-yellow-100",
  border: "border-yellow-500",
  text: "text-yellow-800",
};

const DEFAULT_CP_IDX = 6 * 12 + 11; // G12
const DEFAULT_CN_IDX = 7 * 12 + 11; // H12

const REAGENTES = [
  { nome: "Master Mix", vol: 15 },
  { nome: "Primer Mix", vol: 5 },
];

function emptyGrid() {
  const g = ALL_POSITIONS.map((pos) => ({
    posicao: pos,
    tipo_conteudo: TIPO.VAZIO,
    amostra_id: null,
    amostra_codigo: "",
    tem_resultado: false,
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
    tem_resultado: false,
  }));
  for (const poco of pocos) {
    const idx = ALL_POSITIONS.indexOf(poco.posicao);
    if (idx === -1) continue;
    g[idx] = {
      posicao: poco.posicao,
      tipo_conteudo: poco.tipo_conteudo,
      amostra_id: poco.amostra || null,
      amostra_codigo: poco.amostra_codigo || "",
      tem_resultado: poco.tem_resultado || false,
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

const STATUS_PLACA = {
  aberta: { bg: "bg-rs-red", label: "Aberta" },
  submetida: { bg: "bg-warning-500", label: "Submetida" },
  resultados_importados: { bg: "bg-success-600", label: "Resultados" },
};

// ================================================================
export default function MontarPCR({
  csrfToken,
  editarPlacaId = null,
  onEditarDone,
}) {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [modoInicio, setModoInicio] = useState(null);
  const [placasExtracao, setPlacasExtracao] = useState([]);
  const [loadingExtracoes, setLoadingExtracoes] = useState(false);
  const [placaOrigemId, setPlacaOrigemId] = useState(null);
  const [placaOrigemCodigo, setPlacaOrigemCodigo] = useState("");
  const [carregandoRascunho, setCarregandoRascunho] = useState(false);
  const [showListPCR, setShowListPCR] = useState(false);
  const [placasPCR, setPlacasPCR] = useState([]);
  const [loadingListPCR, setLoadingListPCR] = useState(false);
  const [placa, setPlaca] = useState(null);
  const [grid, setGrid] = useState(emptyGrid);
  const [modo, setModo] = useState(TIPO.AMOSTRA);
  const [selected, setSelected] = useState(FILL_ORDER[0]);
  const [codigo, setCodigo] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [salva, setSalva] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState(null);
  const [pendingComResultado, setPendingComResultado] = useState(null);
  const inputRef = useRef();

  useEffect(() => {
    if (!carregando) inputRef.current?.focus();
  }, [carregando]);
  useEffect(() => {
    if (editarPlacaId) {
      carregarPlacaPCR(editarPlacaId);
      onEditarDone?.();
    }
  }, [editarPlacaId]);

  const isEditable =
    !!placa &&
    (!placa.status_placa || placa.status_placa === "aberta" || placa.local);
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

  async function fetchPlacasExtracao() {
    setLoadingExtracoes(true);
    try {
      const data = await api(
        "/api/placas/?tipo_placa=extracao&status_placa=extracao_confirmada",
        { csrfToken },
      );
      setPlacasExtracao(data.results || data);
    } catch {
      setPlacasExtracao([]);
    } finally {
      setLoadingExtracoes(false);
    }
  }

  async function fetchPlacasPCR() {
    setLoadingListPCR(true);
    try {
      const data = await api("/api/placas/?tipo_placa=pcr", { csrfToken });
      setPlacasPCR(data.results || data);
    } catch {
      setPlacasPCR([]);
    } finally {
      setLoadingListPCR(false);
    }
  }

  async function carregarRascunho(extId, extCodigo) {
    setCarregandoRascunho(true);
    setFeedback(null);
    try {
      const data = await api(`/api/placas/${extId}/rascunho-pcr/`, {
        csrfToken,
      });
      setPlaca({
        local: true,
        tipo_placa: "pcr",
        placa_origem_id: data.placa_origem_id,
      });
      setPlacaOrigemId(data.placa_origem_id);
      setPlacaOrigemCodigo(data.placa_origem_codigo);
      setGrid(gridFromPocos(data.pocos));
      setSalva(false);
      setModoInicio(null);
      setFeedback({
        tipo: "sucesso",
        msg: `Rascunho carregado da extração ${extCodigo}. Revise e salve.`,
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.erro || "Erro ao carregar rascunho.",
      });
    } finally {
      setCarregandoRascunho(false);
    }
  }

  async function carregarPlacaPCR(id) {
    setCarregando(true);
    setFeedback(null);
    try {
      const data = await api(`/api/placas/${id}/`, { csrfToken });
      setPlaca(data);
      setGrid(data.pocos?.length ? gridFromPocos(data.pocos) : emptyGrid());
      setSalva(true);
      setShowListPCR(false);
      setModoInicio(null);
      setFeedback({
        tipo: "sucesso",
        msg: `Placa PCR ${data.codigo} carregada.`,
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.detail || "Erro ao carregar placa.",
      });
    } finally {
      setCarregando(false);
    }
  }

  function iniciarDoZero() {
    setPlaca({ local: true, tipo_placa: "pcr" });
    setGrid(emptyGrid());
    setSelected(FILL_ORDER[0]);
    setSalva(false);
    setFeedback(null);
    setModoInicio(null);
    setPlacaOrigemId(null);
    setPlacaOrigemCodigo("");
  }

  function placeSample(amostra, gridIdx, temResultado = false) {
    setGrid((prev) => {
      const next = [...prev];
      next[gridIdx] = {
        ...next[gridIdx],
        tipo_conteudo: TIPO.AMOSTRA,
        amostra_id: amostra.id,
        amostra_codigo: amostra.codigo_interno,
        tem_resultado: temResultado,
      };
      return next;
    });
    const ne = nextEmpty(gridIdx);
    setSelected(ne === -1 ? gridIdx : ne);
    setFeedback({
      tipo: "sucesso",
      msg: `${amostra.codigo_interno} → ${ALL_POSITIONS[gridIdx]}${temResultado ? " (repetição)" : ""}`,
    });
    setSalva(false);
    setPendingDuplicate(null);
    setPendingComResultado(null);
  }

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
    setPendingComResultado(null);
    try {
      const amostra = await api(
        `/api/placas/buscar-amostra/?codigo=${encodeURIComponent(val)}&modulo=pcr`,
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
        setPendingDuplicate({
          amostra,
          idx,
          temResultado: amostra.tem_resultado,
        });
        setFeedback({
          tipo: "aviso",
          msg: `${amostra.codigo_interno} já está nesta placa.`,
        });
        setCodigo("");
        setCarregando(false);
        return;
      }
      if (amostra.tem_resultado) {
        setPendingComResultado({ amostra, idx });
        setFeedback({
          tipo: "aviso",
          msg: `${amostra.codigo_interno} já possui resultado registrado. Confirma inclusão para repetição?`,
        });
        setCodigo("");
        setCarregando(false);
        return;
      }
      placeSample(amostra, idx, false);
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
        tem_resultado: false,
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
        tem_resultado: false,
      };
      return next;
    });
    setSalva(false);
  }

  async function salvarPlaca() {
    if (!placa || !hasControls) return;
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
          body: { tipo_placa: "pcr", placa_origem: placaOrigemId || null },
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
        msg: `Placa PCR ${data.codigo} salva — ${totalAmostras} amostras.`,
      });
    } catch (err) {
      const erros = err.data?.erros || err.data?.erro || err.data?.detail;
      setFeedback({
        tipo: "erro",
        msg: Array.isArray(erros)
          ? erros.join("; ")
          : erros || `Erro ao salvar. (HTTP ${err.status})`,
      });
    } finally {
      setCarregando(false);
    }
  }

  async function submeterTermociclador() {
    if (!placa?.id) return;
    if (
      !window.confirm(
        `Enviar placa ${placa.codigo} ao termociclador? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setCarregando(true);
    setFeedback(null);
    try {
      const data = await api(`/api/placas/${placa.id}/submeter/`, {
        csrfToken,
        method: "POST",
        body: { numero_cracha: operador?.numero_cracha },
      });
      setPlaca(data);
      setFeedback({
        tipo: "sucesso",
        msg: `Placa ${data.codigo} enviada ao termociclador.`,
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.erro || err.data?.detail || "Erro ao submeter.",
      });
    } finally {
      setCarregando(false);
    }
  }

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
        body: {
          tipo_placa: "pcr",
          placa_origem: placa?.placa_origem || null,
        },
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
        msg: `Nova placa PCR ${data.codigo} criada com ${totalAmostras} amostra${totalAmostras !== 1 ? "s" : ""}.`,
      });
    } catch (err) {
      const erros = err.data?.erros || err.data?.erro || err.data?.detail;
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

  async function excluirPlaca() {
    if (!placa) return;
    if (placa.local) {
      resetar();
      return;
    }
    if (!window.confirm(`Excluir placa PCR ${placa.codigo}?`)) return;
    setCarregando(true);
    try {
      await api(`/api/placas/${placa.id}/`, { csrfToken, method: "DELETE" });
      resetar();
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.erro || "Erro ao excluir.",
      });
      setCarregando(false);
    }
  }

  async function rodarReplicata() {
    if (!placa || placa.local) return;
    if (
      !window.confirm(
        `Criar replicata da placa ${placa.codigo}? Uma nova placa PCR será criada com os mesmos poços.`,
      )
    )
      return;
    setCarregando(true);
    setFeedback(null);
    try {
      const data = await api(`/api/placas/${placa.id}/replicata/`, {
        csrfToken,
        method: "POST",
        body: { numero_cracha: operador?.numero_cracha },
      });
      setPlaca(data);
      setGrid(gridFromPocos(data.pocos || []));
      setSalva(true);
      setFeedback({
        tipo: "sucesso",
        msg: `Replicata criada: placa ${data.codigo}.`,
      });
    } catch (err) {
      setFeedback({
        tipo: "erro",
        msg: err.data?.erro || "Erro ao criar replicata.",
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
    setPendingComResultado(null);
    setModoInicio(null);
    setPlacaOrigemId(null);
    setPlacaOrigemCodigo("");
    setShowListPCR(false);
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div>
      <NavigationButtons currentStep="pcr" />
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="PCR — Montar Placa" />
      )}

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

      {/* ---- Tela de escolha de início ---- */}
      {!placa && modoInicio === null && (
        <div className="mb-6">
          <p className="text-neutral-500 mb-4">
            Monte uma nova placa de PCR a partir de uma extração ou do zero, ou
            abra uma existente.
          </p>
          <div className="flex gap-3 flex-wrap mb-4">
            <Button
              onClick={() => {
                setModoInicio("rascunho");
                fetchPlacasExtracao();
              }}
              variant="primary"
              size="md"
            >
              Carregar de Extração
            </Button>
            <Button
              onClick={iniciarDoZero}
              variant="primary"
              size="md"
              className="bg-success-700 hover:bg-success-800"
            >
              Nova Placa
            </Button>
            <Button
              onClick={() => {
                setShowListPCR((v) => !v);
                if (!showListPCR) fetchPlacasPCR();
              }}
              variant="outline"
              size="md"
            >
              {showListPCR ? "Fechar Lista" : "Abrir Placa de PCR"}
            </Button>
          </div>

          {showListPCR && (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
              {loadingListPCR ? (
                <p className="p-4 text-neutral-500">Carregando...</p>
              ) : placasPCR.length === 0 ? (
                <p className="p-4 text-neutral-400">
                  Nenhuma placa PCR encontrada.
                </p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-neutral-50 border-b-2 border-neutral-200">
                      <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                        Código
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                        Extração base
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                        Amostras
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                        Data
                      </th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {placasPCR.map((p) => {
                      const badge = STATUS_PLACA[p.status_placa] || {
                        bg: "bg-neutral-500",
                        label: p.status_display,
                      };
                      return (
                        <tr key={p.id} className="border-b border-neutral-100">
                          <td className="px-3 py-2 text-neutral-700 font-semibold">
                            {p.codigo}
                          </td>
                          <td className="px-3 py-2 text-neutral-500">
                            {p.placa_origem_codigo || "—"}
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
                            {fmtDate(p.data_criacao)}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              onClick={() => carregarPlacaPCR(p.id)}
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

      {/* ---- Seleção de placa de extração (rascunho) ---- */}
      {!placa && modoInicio === "rascunho" && (
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-base font-bold text-rs-red m-0">
              Selecionar Placa de Extração
            </h3>
            <Button
              onClick={() => setModoInicio(null)}
              variant="outline"
              size="sm"
            >
              Voltar
            </Button>
          </div>
          <p className="text-neutral-500 text-sm mb-4">
            Placas com extração confirmada. Amostras não elegíveis (não
            extraídas) serão omitidas do rascunho.
          </p>
          {loadingExtracoes ? (
            <p className="text-neutral-500">Carregando extrações...</p>
          ) : placasExtracao.length === 0 ? (
            <p className="text-neutral-400">
              Nenhuma placa de extração confirmada encontrada.
            </p>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-50 border-b-2 border-neutral-200">
                    <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                      Código
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
                  {placasExtracao.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-100">
                      <td className="px-3 py-2 text-neutral-700 font-semibold">
                        {p.codigo}
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
                          onClick={() => carregarRascunho(p.id, p.codigo)}
                          variant="primary"
                          size="sm"
                          loading={carregandoRascunho}
                        >
                          Usar como base
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---- Info da placa ativa ---- */}
      {placa && (
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <span className="bg-success-700 text-white px-4 py-1.5 rounded-md font-semibold text-base tracking-wide">
            {placa.local ? "Nova Placa PCR" : placa.codigo}
          </span>
          {placaOrigemCodigo && (
            <span className="text-neutral-500 text-sm">
              base: <b>{placaOrigemCodigo}</b>
            </span>
          )}
          <span className="text-neutral-500 text-sm">
            {totalAmostras} amostras | {totalCN} CN | {totalCP} CP |{" "}
            {totalReacoes} reações
          </span>
          {salva && (
            <span className="text-success-700 font-medium text-sm">Salva</span>
          )}
          {placa.status_placa && placa.status_placa !== "aberta" && (
            <span
              className={`${(STATUS_PLACA[placa.status_placa] || {}).bg || "bg-neutral-500"} text-white px-2.5 py-0.5 rounded text-xs font-medium`}
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
          {pendingComResultado && (
            <Button
              onClick={() =>
                placeSample(
                  pendingComResultado.amostra,
                  pendingComResultado.idx,
                  true,
                )
              }
              variant="primary"
              size="sm"
              className="bg-warning-700 hover:bg-warning-800"
            >
              Confirmar repetição
            </Button>
          )}
          {pendingDuplicate && !pendingComResultado && (
            <Button
              onClick={() =>
                placeSample(
                  pendingDuplicate.amostra,
                  pendingDuplicate.idx,
                  pendingDuplicate.temResultado,
                )
              }
              variant="primary"
              size="sm"
              className="bg-warning-700 hover:bg-warning-800"
            >
              Adicionar mesmo assim
            </Button>
          )}
        </div>
      )}

      {placa && isEditable && !hasControls && (
        <div className="px-4 py-2 rounded-md mb-4 bg-danger-50 text-danger-700 text-sm border border-danger-200">
          A placa precisa de pelo menos um CN e um CP para ser salva.
        </div>
      )}

      {placa && (
        <>
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
                      ? "Escanear código da amostra (extraída)..."
                      : `Enter para ${modo === TIPO.CN ? "CN" : "CP"}`
                  }
                  disabled={carregando}
                  autoComplete="off"
                  className="flex-1 px-3 py-2.5 text-sm border-2 border-success-300 rounded-md outline-none"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={carregando}
                  disabled={carregando}
                  className="bg-success-700 hover:bg-success-800"
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
                        ? "bg-success-600 text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    {t === TIPO.AMOSTRA ? "Amostra" : t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEditable && (
            <div className="flex gap-4 mb-3 text-xs text-neutral-500">
              <span>
                <span className="inline-block w-3 h-3 bg-info-100 border border-info-500 rounded-[2px] mr-1"></span>
                Amostra extraída
              </span>
              <span>
                <span className="inline-block w-3 h-3 bg-yellow-100 border border-yellow-500 rounded-[2px] mr-1"></span>
                Repetição (com resultado)
              </span>
            </div>
          )}

          {totalReacoes > 0 && (
            <div className="flex gap-6 mb-4 px-4 py-2.5 bg-success-50 rounded-md text-sm text-success-700 flex-wrap">
              {REAGENTES.map((r) => (
                <span key={r.nome}>
                  <b>{r.nome}:</b> {(totalReacoes * r.vol).toFixed(1)} uL (
                  {r.vol} x {totalReacoes})
                </span>
              ))}
            </div>
          )}

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
                      const colors = w.tem_resultado
                        ? REPETIDO_COLORS
                        : TIPO_COLORS[w.tipo_conteudo];
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
                            className={`w-[62px] h-[40px] ${colors.bg} ${isSelected ? "border-2 border-success-700 shadow-[0_0_0_2px_#34d399]" : `${colors.border} border`} rounded flex items-center justify-center cursor-${isEditable ? "pointer" : "default"} text-xs leading-tight relative`}
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

          <div className="flex gap-3 flex-wrap mb-8">
            {isEditable && (
              <Button
                onClick={salvarPlaca}
                variant="primary"
                size="md"
                loading={carregando}
                disabled={carregando || totalAmostras === 0 || !hasControls}
                className="bg-success-700 hover:bg-success-800"
              >
                {carregando ? "Salvando..." : "Salvar Placa PCR"}
              </Button>
            )}
            {placa && !placa.local && (
              <Button
                onClick={salvarComoNova}
                variant="primary"
                size="md"
                loading={carregando}
                disabled={carregando || totalAmostras === 0 || !hasControls}
                title="Cria uma nova placa PCR com os mesmos poços, sem alterar a original"
              >
                {carregando ? "Salvando..." : "Salvar como nova placa"}
              </Button>
            )}
            {placa &&
              !placa.local &&
              placa.status_placa === "aberta" &&
              salva && (
                <Button
                  onClick={submeterTermociclador}
                  variant="primary"
                  size="md"
                  loading={carregando}
                  className="bg-warning-500 hover:bg-warning-600"
                >
                  Enviar ao Termociclador
                </Button>
              )}
            {placa &&
              !placa.local &&
              (placa.status_placa === "submetida" ||
                placa.status_placa === "resultados_importados") && (
                <Button
                  onClick={rodarReplicata}
                  variant="primary"
                  size="md"
                  loading={carregando}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Rodar Replicata
                </Button>
              )}
            {salva && placa && !placa.local && isEspecialista() && (
              <a
                href={`/api/placas/${placa.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-md bg-neutral-600 text-white font-medium text-sm no-underline inline-block hover:bg-neutral-700"
              >
                Exportar PDF
              </a>
            )}
            {isEditable && placa && (
              <Button
                onClick={excluirPlaca}
                variant="danger"
                size="md"
                loading={carregando}
              >
                Excluir Placa
              </Button>
            )}
            <Button onClick={resetar} variant="outline" size="md">
              {placa ? "Fechar" : "Voltar"}
            </Button>
          </div>
        </>
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
