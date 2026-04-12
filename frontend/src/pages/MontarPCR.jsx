import { useState, useRef, useCallback, useEffect } from "react";
import Button from "../components/Button";
import { isEspecialista } from "../utils/auth";
import apiFetch from "../utils/apiFetch";
import WellGrid from "../components/plates/WellGrid";
import {
  ALL_POSITIONS,
  FILL_ORDER,
  FILL_POS,
  TIPO,
  THEMES,
  emptyGrid as baseEmptyGrid,
  gridFromPocos as baseGridFromPocos,
} from "../components/plates/PlateConstants";

const TIPO_COLORS = {
  [TIPO.AMOSTRA]: {
    bg: "bg-blue-100",
    border: "border-blue-500",
    text: "text-blue-800",
  },
  [TIPO.CN]: {
    bg: "bg-amber-100",
    border: "border-amber-500",
    text: "text-amber-800",
  },
  [TIPO.CP]: {
    bg: "bg-pink-100",
    border: "border-pink-500",
    text: "text-pink-800",
  },
  [TIPO.VAZIO]: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-400",
  },
};

const REPETIDO_COLORS = {
  bg: "bg-yellow-100",
  border: "border-yellow-400",
  text: "text-yellow-900",
};

const emptyGrid = () => baseEmptyGrid({ tem_resultado: false });
const gridFromPocos = (pocos) =>
  baseGridFromPocos(pocos, { tem_resultado: false });

const api = (url, { csrfToken: _csrf, ...opts } = {}) => apiFetch(url, opts);

const STATUS_PLACA = {
  aberta: { bg: "bg-blue-600", label: "Aberta" },
  submetida: { bg: "bg-orange-500", label: "Submetida" },
  resultados_importados: { bg: "bg-green-600", label: "Resultados" },
};

// ================================================================
export default function MontarPCR({
  csrfToken,
  editarPlacaId = null,
  onEditarDone,
  operador,
}) {

  // ---- State: escolha de origem ----
  const [modoInicio, setModoInicio] = useState(null); // null | 'rascunho' | 'zero'
  const [placasExtracao, setPlacasExtracao] = useState([]);
  const [loadingExtracoes, setLoadingExtracoes] = useState(false);
  const [placaOrigemId, setPlacaOrigemId] = useState(null);
  const [placaOrigemCodigo, setPlacaOrigemCodigo] = useState("");
  const [carregandoRascunho, setCarregandoRascunho] = useState(false);

  // ---- State: protocolos de reacao ----
  const [protocolos, setProtocolos] = useState([]);
  const [protocoloId, setProtocoloId] = useState(null);

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
  // Confirmação para amostra com resultado
  const [pendingComResultado, setPendingComResultado] = useState(null);
  const [selectedSet, setSelectedSet] = useState(new Set());
  const inputRef = useRef();
  const dragSource = useRef(null);
  const isDraggingSelection = useRef(false);
  const lastClicked = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  // Carregar protocolos de reacao ativos
  useEffect(() => {
    apiFetch("/api/configuracoes/reacoes/?ativo=true")
      .then((data) => {
        const lista = data.results || data;
        setProtocolos(lista);
        if (lista.length > 0 && !protocoloId) setProtocoloId(lista[0].id);
      })
      .catch(() => {});
  }, []);

  const protocoloSelecionado =
    protocolos.find((p) => p.id === protocoloId) || null;
  const reagentes = protocoloSelecionado?.reagentes || [];
  const margemPct = protocoloSelecionado?.margem_percentual || 0;

  // Foco automático no input após cada scan (quando carregando volta a false)
  useEffect(() => {
    if (!carregando) inputRef.current?.focus();
  }, [carregando]);

  // Delete → limpa poços selecionados (ignora quando foco está num input)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== "Delete") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (selectedSet.size > 0) {
        e.preventDefault();
        clearSelected();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedSet]);

  // Carrega placa PCR solicitada pela aba de consulta
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

  // ---- Carregar placas de extração confirmada (para rascunho) ----
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

  // ---- Carregar rascunho de extração ----
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

  // ---- Carregar placa PCR existente ----
  async function carregarPlacaPCR(id) {
    setCarregando(true);
    setFeedback(null);
    try {
      const data = await api(`/api/placas/${id}/`, { csrfToken });
      setPlaca(data);
      setGrid(data.pocos?.length ? gridFromPocos(data.pocos) : emptyGrid());
      setSalva(true);
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

  // ---- Colocar amostra ----
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

  // ---- Scan de amostra para PCR ----
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

      // Verificar duplicata
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

      // Verificar se já tem resultado (pede confirmação)
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
    setSelectedSet((prev) => {
      const s = new Set(prev);
      s.delete(idx);
      return s;
    });
    setSalva(false);
  }

  function clearSelected() {
    if (!isEditable || selectedSet.size === 0) return;
    const filled = [...selectedSet].filter(
      (i) => grid[i].tipo_conteudo !== TIPO.VAZIO,
    );
    if (filled.length === 0) return;
    setGrid((prev) => {
      const next = [...prev];
      filled.forEach((i) => {
        next[i] = {
          ...next[i],
          tipo_conteudo: TIPO.VAZIO,
          amostra_id: null,
          amostra_codigo: "",
          tem_resultado: false,
        };
      });
      return next;
    });
    setSelectedSet(new Set());
    setSalva(false);
    setFeedback({ tipo: "aviso", msg: `${filled.length} poço(s) limpo(s).` });
  }

  // ---- Salvar placa PCR ----
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
          body: {
            tipo_placa: "pcr",
            placa_origem: placaOrigemId || null,
          },
        });
        setPlaca(placaAtual);
      }

      const data = await api(`/api/placas/${placaAtual.id}/salvar-pocos/`, {
        csrfToken,
        method: "POST",
        body: {
          pocos,
          numero_cracha: operador?.numero_cracha,
          protocolo_id: protocoloId,
        },
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

  // ---- Enviar ao termociclador ----
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

  // ---- Salvar como nova placa PCR (cópia / repetição) ----
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
        body: { tipo_placa: "pcr", placa_origem: placa?.placa_origem || null },
      });
      const data = await api(`/api/placas/${novaPlaca.id}/salvar-pocos/`, {
        csrfToken,
        method: "POST",
        body: {
          pocos,
          numero_cracha: operador?.numero_cracha,
          protocolo_id: protocoloId,
        },
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

  // ---- Excluir placa PCR ----
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
      setFeedback({ tipo: "erro", msg: err.data?.erro || "Erro ao excluir." });
      setCarregando(false);
    }
  }

  // ---- Rodar replicata (duplicar placa que falhou) ----
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
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div className="font-inherit">

      {/* ---- Tela de escolha de início ---- */}
      {!placa && modoInicio === null && (
        <div className="mb-6">
          <p className="text-gray-500 mb-4">
            Monte uma nova placa de PCR a partir de uma extração ou do zero. Use
            a aba "Consultar Placas PCR" para abrir uma existente.
          </p>
          <div className="flex gap-3 flex-wrap mb-4">
            <Button
              variant="secondary"
              onClick={() => {
                setModoInicio("rascunho");
                fetchPlacasExtracao();
              }}
            >
              Carregar de Extração
            </Button>
            <Button variant="primary" onClick={iniciarDoZero}>
              Nova Placa
            </Button>
          </div>
        </div>
      )}

      {/* ---- Seleção de placa de extração (rascunho) ---- */}
      {!placa && modoInicio === "rascunho" && (
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-base text-slate-800 font-semibold m-0">
              Selecionar Placa de Extração
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModoInicio(null)}
            >
              Voltar
            </Button>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Placas com extração confirmada. Amostras não elegíveis (não
            extraídas) serão omitidas do rascunho.
          </p>
          {loadingExtracoes ? (
            <p className="text-gray-500">Carregando extrações...</p>
          ) : placasExtracao.length === 0 ? (
            <p className="text-gray-400">
              Nenhuma placa de extração confirmada encontrada.
            </p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="py-2.5 px-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                      Código
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                      Amostras
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                      Responsável
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                      Data
                    </th>
                    <th className="py-2.5 px-3 text-left font-semibold text-gray-700 whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {placasExtracao.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-700 font-semibold">
                        {p.codigo}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {p.total_amostras}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {p.responsavel_nome || "—"}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {fmtDate(p.data_criacao)}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => carregarRascunho(p.id, p.codigo)}
                          disabled={carregandoRascunho}
                        >
                          {carregandoRascunho ? "..." : "Usar como base"}
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
          <span className="bg-green-700 text-white py-1.5 px-4 rounded-md font-semibold tracking-wider">
            {placa.local ? "Nova Placa PCR" : placa.codigo}
          </span>
          {placaOrigemCodigo && (
            <span className="text-gray-500 text-sm">
              base: <b>{placaOrigemCodigo}</b>
            </span>
          )}
          <span className="text-gray-500 text-sm">
            {totalAmostras} amostras | {totalCN} CN | {totalCP} CP |{" "}
            {totalReacoes} reações
          </span>
          {salva && (
            <span className="text-green-700 font-medium text-sm">Salva</span>
          )}
          {placa.status_placa && placa.status_placa !== "aberta" && (
            <span
              className={`${(STATUS_PLACA[placa.status_placa] || {}).bg || "bg-gray-500"} text-white px-2.5 py-0.5 rounded text-xs font-medium`}
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
          className={`p-2.5 px-4 rounded-md mb-4 flex items-center gap-3 flex-wrap ${
            feedback.tipo === "sucesso"
              ? "bg-green-50 text-green-800 border border-green-200"
              : feedback.tipo === "erro"
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-yellow-50 text-yellow-800 border border-yellow-200"
          }`}
        >
          <span>{feedback.msg}</span>
          {/* Confirmar amostra com resultado */}
          {pendingComResultado && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                placeSample(
                  pendingComResultado.amostra,
                  pendingComResultado.idx,
                  true,
                )
              }
            >
              Confirmar repetição
            </Button>
          )}
          {pendingDuplicate && !pendingComResultado && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                placeSample(
                  pendingDuplicate.amostra,
                  pendingDuplicate.idx,
                  pendingDuplicate.temResultado,
                )
              }
            >
              Adicionar mesmo assim
            </Button>
          )}
        </div>
      )}

      {/* ---- Aviso de controles ---- */}
      {placa && isEditable && !hasControls && (
        <div className="p-2 px-4 rounded-md mb-4 bg-red-50 text-red-700 text-sm border border-red-200">
          A placa precisa de pelo menos um CN e um CP para ser salva.
        </div>
      )}

      {placa && (
        <>
          {/* ---- Scanner + modo ---- */}
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
                  className="flex-1 py-2.5 px-3 text-base border-2 border-emerald-300 rounded-md outline-none focus:border-emerald-500 transition-colors"
                />
                <Button type="submit" variant="secondary" disabled={carregando}>
                  {modo === TIPO.AMOSTRA ? "Buscar" : "Inserir"}
                </Button>
              </form>
              <div className="flex gap-1.5">
                {[TIPO.AMOSTRA, TIPO.CN, TIPO.CP].map((t) => {
                  const activeClass =
                    t === TIPO.AMOSTRA
                      ? "bg-blue-500 border-blue-500"
                      : t === TIPO.CN
                        ? "bg-amber-500 border-amber-500"
                        : "bg-pink-500 border-pink-500";
                  return (
                    <button
                      key={t}
                      onClick={() => setModo(t)}
                      className={`py-2 px-3 text-sm rounded-md font-medium transition-colors border-2 ${
                        modo === t
                          ? `${activeClass} text-white`
                          : "text-gray-700 bg-gray-300 hover:bg-gray-400 border-transparent"
                      }`}
                    >
                      {t === TIPO.AMOSTRA ? "Amostra" : t.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---- Legenda ---- */}
          {isEditable && (
            <div className="flex gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span
                  className={`inline-block w-3 h-3 rounded-sm border ${TIPO_COLORS[TIPO.AMOSTRA].bg} ${TIPO_COLORS[TIPO.AMOSTRA].border}`}
                />
                Amostra extraída
              </span>
              <span className="flex items-center gap-1">
                <span
                  className={`inline-block w-3 h-3 rounded-sm border ${REPETIDO_COLORS.bg} ${REPETIDO_COLORS.border}`}
                />
                Repetição (com resultado)
              </span>
            </div>
          )}

          {/* ---- Protocolo de reacao ---- */}
          {isEditable && protocolos.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm font-semibold text-gray-700">
                Protocolo:
              </label>
              <select
                value={protocoloId || ""}
                onChange={(e) => setProtocoloId(Number(e.target.value))}
                className="py-1.5 px-2.5 rounded-md border border-gray-300 text-sm"
              >
                {protocolos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ---- Reagentes ---- */}
          {totalReacoes > 0 && reagentes.length > 0 && (
            <div className="flex gap-6 mb-4 p-2.5 px-4 bg-emerald-50 rounded-md text-sm text-emerald-800 flex-wrap">
              {reagentes.map((r) => {
                const vol = parseFloat(r.volume_por_reacao);
                const volBase = totalReacoes * vol;
                const volTotal =
                  margemPct > 0 ? volBase * (1 + margemPct / 100) : volBase;
                return (
                  <span key={r.nome}>
                    <b>{r.nome}:</b> {volTotal.toFixed(1)} uL ({vol} x{" "}
                    {totalReacoes}
                    {margemPct > 0 ? ` +${margemPct}%` : ""})
                  </span>
                );
              })}
            </div>
          )}

          {/* ---- Grid 8x12 ---- */}
          <WellGrid
            grid={grid}
            selected={selected}
            isEditable={isEditable}
            selectedSet={selectedSet}
            dragOver={dragOver}
            dragSource={dragSource}
            isDraggingSelection={isDraggingSelection}
            theme={THEMES.pcr}
            wellColors={(w) =>
              w.tem_resultado ? REPETIDO_COLORS : TIPO_COLORS[w.tipo_conteudo]
            }
            onDrop={(src, dst) => {
              setGrid((prev) => {
                const next = [...prev];
                const srcPos = next[src].posicao;
                const dstPos = next[dst].posicao;
                next[src] = { ...next[dst], posicao: srcPos };
                next[dst] = { ...prev[src], posicao: dstPos };
                return next;
              });
              setSelectedSet(new Set());
            }}
            onMultiDrop={(moves) => {
              setGrid((prev) => {
                const next = [...prev];
                const moving = moves.map(({ from }) => ({ ...prev[from] }));
                moves.forEach(({ from }) => {
                  next[from] = {
                    ...next[from],
                    tipo_conteudo: TIPO.VAZIO,
                    amostra_id: null,
                    amostra_codigo: "",
                    tem_resultado: false,
                  };
                });
                moves.forEach(({ to }, i) => {
                  next[to] = { ...moving[i], posicao: next[to].posicao };
                });
                return next;
              });
              setSelectedSet(new Set(moves.map(({ to }) => to)));
            }}
            onDragOver={setDragOver}
            onDragEnd={() => {
              dragSource.current = null;
              isDraggingSelection.current = false;
            }}
            onClick={(idx, e) => {
              const w = grid[idx];
              if (e.ctrlKey || e.metaKey) {
                setSelectedSet((prev) => {
                  const next = new Set(prev);
                  if (next.has(idx)) next.delete(idx);
                  else next.add(idx);
                  return next;
                });
                lastClicked.current = idx;
              } else if (e.shiftKey && lastClicked.current !== null) {
                const from = Math.min(lastClicked.current, idx);
                const to = Math.max(lastClicked.current, idx);
                setSelectedSet((prev) => {
                  const next = new Set(prev);
                  for (let i = from; i <= to; i++) {
                    if (grid[i].tipo_conteudo !== TIPO.VAZIO) next.add(i);
                  }
                  return next;
                });
              } else {
                setSelectedSet(new Set());
                lastClicked.current = idx;
                if (w.tipo_conteudo === TIPO.VAZIO) {
                  if (modo !== TIPO.AMOSTRA) placeControl(modo);
                  else setSelected(idx);
                } else {
                  setSelected(idx);
                }
              }
            }}
            onContextMenu={clearWell}
            onFeedback={setFeedback}
            setSalva={setSalva}
            setSelectedSet={setSelectedSet}
          />

          {/* ---- Ações ---- */}
          <div className="flex gap-3 flex-wrap mb-8 mt-4">
            {isEditable && (
              <Button
                variant="primary"
                onClick={salvarPlaca}
                disabled={carregando || totalAmostras === 0 || !hasControls}
              >
                {carregando ? "Salvando..." : "Salvar Placa PCR"}
              </Button>
            )}
            {placa && !placa.local && (
              <Button
                variant="secondary"
                onClick={salvarComoNova}
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
                  variant="secondary"
                  onClick={submeterTermociclador}
                  disabled={carregando}
                >
                  Enviar ao Termociclador
                </Button>
              )}
            {placa &&
              !placa.local &&
              (placa.status_placa === "submetida" ||
                placa.status_placa === "resultados_importados") && (
                <Button
                  variant="secondary"
                  onClick={rodarReplicata}
                  disabled={carregando}
                >
                  Rodar Replicata
                </Button>
              )}
            {salva && placa && !placa.local && isEspecialista() && (
              <a
                href={`/api/placas/${placa.id}/pdf/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-transparent text-[#374151] border border-[#d1d5db] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-[#f3f4f6] hover:border-[#9ca3af] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:-translate-y-px transition-all duration-200 no-underline"
              >
                Exportar PDF
              </a>
            )}
            <Button variant="ghost" onClick={resetar}>
              {placa ? "Fechar" : "Voltar"}
            </Button>
            {isEditable && placa && (
              <Button
                variant="danger"
                onClick={excluirPlaca}
                disabled={carregando}
              >
                Excluir Placa
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Helpers / Styles ----
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
