import React, { useState, useRef, useCallback, useEffect } from "react";
import Button from "../components/Button";
import { isEspecialista } from "../utils/auth";
import apiFetch from "../utils/apiFetch";
import WellGrid from "../components/plates/WellGrid";
import PlacaMiniGrid from "../components/plates/PlacaMiniGrid";
import {
  ALL_POSITIONS,
  FILL_ORDER,
  FILL_POS,
  TIPO,
  THEMES,
  MINI_THEMES,
  alocarImport,
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

  // ---- State: origens (placas de extração usadas como base desta PCR) ----
  const [origensImportadas, setOrigensImportadas] = useState([]); // [{id, codigo}]

  // ---- State: modal de import ----
  const [importOpen, setImportOpen] = useState(false);
  const [importLista, setImportLista] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importExpandedId, setImportExpandedId] = useState(null);
  const [importPocosCache, setImportPocosCache] = useState({}); // { [extId]: pocos[] }
  const [importingId, setImportingId] = useState(null);

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

  // ---- Carregar placa PCR existente ----
  async function carregarPlacaPCR(id) {
    setCarregando(true);
    setFeedback(null);
    try {
      const data = await api(`/api/placas/${id}/`, { csrfToken });
      setPlaca(data);
      setGrid(data.pocos?.length ? gridFromPocos(data.pocos) : emptyGrid());
      setSalva(true);
      const origens = (data.placas_origem || []).map((oid, i) => ({
        id: oid,
        codigo: data.placas_origem_codigos?.[i] || String(oid),
      }));
      setOrigensImportadas(origens);
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
    setOrigensImportadas([]);
  }

  // ---- Abrir modal de import e carregar lista de extrações ----
  async function abrirImport() {
    setImportOpen(true);
    setImportExpandedId(null);
    setImportLoading(true);
    try {
      const data = await api(
        "/api/placas/?tipo_placa=extracao&status_placa=extracao_confirmada",
        { csrfToken },
      );
      setImportLista(data.results || data);
    } catch {
      setImportLista([]);
    } finally {
      setImportLoading(false);
    }
  }

  // ---- Expandir linha do modal: busca poços da extração (lazy + cache) ----
  async function toggleExpandImport(extId) {
    if (importExpandedId === extId) {
      setImportExpandedId(null);
      return;
    }
    setImportExpandedId(extId);
    if (importPocosCache[extId]) return;
    try {
      const data = await api(`/api/placas/${extId}/rascunho-pcr/`, {
        csrfToken,
      });
      setImportPocosCache((prev) => ({ ...prev, [extId]: data.pocos || [] }));
    } catch {
      setImportPocosCache((prev) => ({ ...prev, [extId]: [] }));
    }
  }

  // ---- Confirmar import de uma extração ----
  async function handleImport(ext) {
    setImportingId(ext.id);
    try {
      let pocos = importPocosCache[ext.id];
      if (!pocos) {
        const data = await api(`/api/placas/${ext.id}/rascunho-pcr/`, {
          csrfToken,
        });
        pocos = data.pocos || [];
        setImportPocosCache((prev) => ({ ...prev, [ext.id]: pocos }));
      }

      // Só amostras (ignora CN/CP da extração — a PCR mantém os seus)
      const amostras = pocos
        .filter(
          (p) => p.tipo_conteudo === TIPO.AMOSTRA && p.amostra_codigo,
        )
        .sort((a, b) => {
          const ia = ALL_POSITIONS.indexOf(a.posicao);
          const ib = ALL_POSITIONS.indexOf(b.posicao);
          return FILL_POS[ia] - FILL_POS[ib];
        });

      if (amostras.length === 0) {
        setFeedback({
          tipo: "aviso",
          msg: `Extração ${ext.codigo} não tem amostras elegíveis para PCR.`,
        });
        return;
      }

      // Já importada?
      if (origensImportadas.some((o) => o.id === ext.id)) {
        setFeedback({
          tipo: "aviso",
          msg: `Extração ${ext.codigo} já foi importada nesta placa.`,
        });
        return;
      }

      // Capacidade (pré-check amigável; alocarImport também verifica)
      const vazios = grid.reduce(
        (n, w) => n + (w.tipo_conteudo === TIPO.VAZIO ? 1 : 0),
        0,
      );
      if (amostras.length > vazios) {
        setFeedback({
          tipo: "erro",
          msg: `Não cabe: ${amostras.length} amostras para ${vazios} poços livres na PCR.`,
        });
        return;
      }

      // Amostras com resultado — confirm único
      const comResultado = amostras.filter((a) => a.tem_resultado).length;
      if (
        comResultado > 0 &&
        !window.confirm(
          `${comResultado} amostra(s) da extração ${ext.codigo} já possuem resultado. Importar assim mesmo?`,
        )
      ) {
        return;
      }

      const {
        grid: novoGrid,
        posicoesUsadas,
        erro,
      } = alocarImport(grid, amostras);
      if (erro) {
        setFeedback({ tipo: "erro", msg: erro });
        return;
      }

      setGrid(novoGrid);
      setSalva(false);
      setOrigensImportadas((prev) => [
        ...prev,
        { id: ext.id, codigo: ext.codigo },
      ]);
      setImportOpen(false);
      setFeedback({
        tipo: "sucesso",
        msg: `${amostras.length} amostra(s) importadas de ${ext.codigo} (${posicoesUsadas[0]}–${posicoesUsadas.at(-1)}).`,
      });
    } finally {
      setImportingId(null);
    }
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

  function placeControl(tipo, targetIdx = null) {
    let idx = targetIdx ?? selected;
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
            placas_origem: origensImportadas.map((o) => o.id),
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

      // Baixar planilha Sample Info para o Amplio® 96
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`/api/placas/${placa.id}/sample-info/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "same-origin",
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${data.codigo}_sample_info.xlsx`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } catch {
        // Download falhou silenciosamente — não bloqueia o fluxo
      }

      setFeedback({
        tipo: "sucesso",
        msg: `Placa ${data.codigo} enviada ao termociclador. Planilha Sample Info baixada.`,
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
        body: {
          tipo_placa: "pcr",
          placas_origem: placa?.placas_origem || [],
        },
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
    setOrigensImportadas([]);
    setImportOpen(false);
    setImportExpandedId(null);
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div className="font-inherit flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ---- Tela de início: apenas Nova Placa ---- */}
      {!placa && (
        <div className="mb-6">
          <p className="text-gray-500 mb-4">
            Monte uma nova placa de PCR. Use a aba "Consultar Placas PCR" para
            abrir uma existente.
          </p>
          <div className="flex gap-3 flex-wrap mb-4">
            <Button variant="primary" onClick={iniciarDoZero}>
              Nova Placa
            </Button>
          </div>
        </div>
      )}

      {/* ---- Info da placa ativa ---- */}
      {placa && (
        <div className="flex items-center gap-4 mb-3 flex-wrap shrink-0">
          {placa.local ? (
            <span className="text-green-700 font-semibold tracking-wider">
              Nova Placa PCR
            </span>
          ) : (
            <span className="bg-green-700 text-white py-1.5 px-4 rounded-md font-semibold tracking-wider">
              {placa.codigo}
            </span>
          )}
          {origensImportadas.length > 0 && (
            <span className="text-gray-500 text-sm">
              base:{" "}
              <b>{origensImportadas.map((o) => o.codigo).join(", ")}</b>
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

      {placa && (
        <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
          {/* ==================== COLUNA ESQUERDA ==================== */}
          <aside className="w-full xl:w-[380px] shrink-0 flex flex-col gap-3 xl:overflow-y-auto xl:pr-1">
            {/* ---- Feedback ---- */}
            {feedback && (
              <div
                className={`px-3 py-2 rounded-md flex items-center gap-2 flex-wrap text-sm ${
                  feedback.tipo === "sucesso"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : feedback.tipo === "erro"
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : "bg-yellow-50 text-yellow-800 border border-yellow-200"
                }`}
              >
                <span>{feedback.msg}</span>
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
            {isEditable && !hasControls && (
              <div className="px-3 py-2 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
                A placa precisa de pelo menos um CN e um CP para ser salva.
              </div>
            )}

            {/* ---- Scanner + modo ---- */}
            {isEditable && (
              <div className="flex flex-col gap-2">
                <form onSubmit={handleScan} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={modo === TIPO.AMOSTRA ? codigo : ""}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder={
                      modo === TIPO.AMOSTRA
                        ? "Escanear código da amostra (extraída)..."
                        : `Clique em um poço vazio para inserir ${modo === TIPO.CN ? "CN" : "CP"}`
                    }
                    disabled={carregando || modo !== TIPO.AMOSTRA}
                    autoComplete="off"
                    className="flex-1 min-w-0 py-2 px-3 text-[0.9rem] border-2 border-emerald-300 rounded-md outline-none focus:border-emerald-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <Button type="submit" variant="secondary" size="sm" disabled={carregando || modo !== TIPO.AMOSTRA}>
                    {modo === TIPO.AMOSTRA ? "Buscar" : "Inserir"}
                  </Button>
                </form>
                <div className="flex gap-1">
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
                        className={`flex-1 py-1.5 px-3 text-[0.8rem] rounded-md font-medium transition-colors border-2 ${
                          modo === t
                            ? `${activeClass} text-white`
                            : "text-gray-700 bg-gray-200 hover:bg-gray-300 border-transparent"
                        }`}
                      >
                        {t === TIPO.AMOSTRA ? "Amostra" : t.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- Protocolo de reacao ---- */}
            {isEditable && protocolos.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">
                  Protocolo:
                </label>
                <select
                  value={protocoloId || ""}
                  onChange={(e) => setProtocoloId(Number(e.target.value))}
                  className="py-1.5 px-2.5 rounded-md border border-gray-300 text-sm bg-white"
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
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">Reagentes:</label>
                <div className="flex gap-x-4 gap-y-1 p-2.5 px-3 bg-emerald-50 rounded-md text-xs text-emerald-800 flex-wrap">
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
              </div>
            )}
          </aside>

          {/* ==================== COLUNA DIREITA ==================== */}
          <main className="flex-1 flex flex-col gap-2 min-w-0 items-start">
          {/* ---- Legenda ---- */}
          {isEditable && (
            <div className="flex gap-4 text-xs text-gray-500">
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
                  if (modo !== TIPO.AMOSTRA) placeControl(modo, idx);
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
          <div className="flex gap-2 flex-wrap items-center">
            {isEditable && (
              <Button
                variant="secondary"
                size="sm"
                onClick={abrirImport}
                disabled={carregando}
              >
                Importar placa base
              </Button>
            )}
            {isEditable && (
              <Button
                variant="primary"
                size="sm"
                onClick={salvarPlaca}
                disabled={carregando || totalAmostras === 0 || !hasControls}
              >
                {carregando ? "Salvando..." : "Salvar Placa PCR"}
              </Button>
            )}
            {placa && !placa.local && (
              <Button
                variant="secondary"
                size="sm"
                onClick={salvarComoNova}
                disabled={carregando || totalAmostras === 0 || !hasControls}
                title="Cria uma nova placa PCR com os mesmos poços, sem alterar a original"
              >
                {carregando ? "Salvando..." : "Salvar como nova"}
              </Button>
            )}
            {placa &&
              !placa.local &&
              placa.status_placa === "aberta" &&
              salva && (
                <Button
                  variant="secondary"
                  size="sm"
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
                  size="sm"
                  onClick={rodarReplicata}
                  disabled={carregando}
                >
                  Rodar Replicata
                </Button>
              )}
            {salva && placa && !placa.local && isEspecialista() && (
              <a
                href={`/api/placas/${placa.id}/pdf/`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-transparent text-[#374151] border border-[#d1d5db] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-[#f3f4f6] hover:border-[#9ca3af] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:-translate-y-px transition-all duration-200 no-underline"
              >
                Exportar Mapa
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={resetar}>
              {placa ? "Fechar" : "Voltar"}
            </Button>
            {isEditable && placa && (
              <Button
                variant="ghost"
                size="sm"
                onClick={excluirPlaca}
                disabled={carregando}
                className="text-red-600 hover:bg-red-50 hover:border-red-400"
              >
                Excluir
              </Button>
            )}
          </div>
          </main>
        </div>
      )}

      {/* ---- Modal: Importar placa de extração ---- */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-6 overflow-y-auto"
          onClick={() => setImportOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl mt-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-slate-800 m-0">
                Importar placa de extração
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImportOpen(false)}
              >
                Fechar
              </Button>
            </div>
            <div className="px-5 py-3 text-sm text-gray-500">
              Placas com extração confirmada. Amostras não elegíveis (não
              extraídas) são omitidas. Clique na linha para ver a placa.
            </div>
            <div className="px-5 pb-5">
              {importLoading ? (
                <p className="text-gray-500">Carregando extrações...</p>
              ) : importLista.length === 0 ? (
                <p className="text-gray-400">
                  Nenhuma placa de extração confirmada encontrada.
                </p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="py-2.5 px-3 text-left font-semibold text-gray-700 whitespace-nowrap w-6"></th>
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
                        <th className="py-2.5 px-3 text-right font-semibold text-gray-700 whitespace-nowrap"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {importLista.map((p) => {
                        const aberta = importExpandedId === p.id;
                        const jaImportada = origensImportadas.some(
                          (o) => o.id === p.id,
                        );
                        return (
                          <React.Fragment key={p.id}>
                            <tr
                              className={`border-b border-gray-100 cursor-pointer ${aberta ? "bg-orange-50" : "hover:bg-gray-50"}`}
                              onClick={() => toggleExpandImport(p.id)}
                            >
                              <td className="py-2 px-3 text-gray-500 text-xs">
                                {aberta ? "▼" : "▶"}
                              </td>
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
                              <td
                                className="py-2 px-3 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleImport(p)}
                                  disabled={
                                    importingId === p.id || jaImportada
                                  }
                                  title={
                                    jaImportada
                                      ? "Já importada nesta placa"
                                      : "Importar amostras desta extração"
                                  }
                                >
                                  {jaImportada
                                    ? "Já importada"
                                    : importingId === p.id
                                      ? "..."
                                      : "Importar placa"}
                                </Button>
                              </td>
                            </tr>
                            {aberta && (
                              <tr className="bg-orange-50 border-b border-gray-100">
                                <td colSpan={6} className="px-3 py-3">
                                  {importPocosCache[p.id] ? (
                                    <PlacaMiniGrid
                                      pocos={importPocosCache[p.id]}
                                      theme={MINI_THEMES.extracao}
                                    />
                                  ) : (
                                    <p className="text-gray-500 text-sm">
                                      Carregando poços...
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
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
