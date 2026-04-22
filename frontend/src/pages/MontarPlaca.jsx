import { useState, useRef, useCallback, useEffect } from "react";
import Button from "../components/Button";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
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

// Cores fixas para CN/CP e vazio — classes Tailwind
const CTRL_COLORS = {
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

// Cores de amostras por grupo (índice 0 = grupo 1) — classes Tailwind
// NOTA: bgActive deve ser declarado explicitamente (nunca derivado via .replace()) para o Tailwind detectar
const GROUP_COLORS = [
  {
    bg: "bg-blue-100",
    border: "border-blue-500",
    bgActive: "bg-blue-500",
    text: "text-blue-800",
  }, // grupo 1
  {
    bg: "bg-emerald-100",
    border: "border-emerald-500",
    bgActive: "bg-emerald-500",
    text: "text-emerald-800",
  }, // grupo 2
  {
    bg: "bg-orange-100",
    border: "border-orange-500",
    bgActive: "bg-orange-500",
    text: "text-orange-800",
  }, // grupo 3
  {
    bg: "bg-violet-100",
    border: "border-violet-500",
    bgActive: "bg-violet-500",
    text: "text-violet-800",
  }, // grupo 4
  {
    bg: "bg-pink-100",
    border: "border-pink-600",
    bgActive: "bg-pink-600",
    text: "text-pink-800",
  }, // grupo 5
];

function wellColors(w) {
  if (w.tipo_conteudo === TIPO.AMOSTRA) {
    return GROUP_COLORS[(w.grupo - 1) % GROUP_COLORS.length];
  }
  return CTRL_COLORS[w.tipo_conteudo] || CTRL_COLORS[TIPO.VAZIO];
}

const STATUS_PLACA = {
  aberta: { bg: "bg-blue-600", label: "Aberta" },
  extracao_confirmada: { bg: "bg-purple-700", label: "Extração confirmada" },
  submetida: { bg: "bg-orange-500", label: "Submetida" },
  resultados_importados: { bg: "bg-green-600", label: "Resultados" },
};

const emptyGrid = () => baseEmptyGrid({ grupo: 1 });
const gridFromPocos = (pocos) => baseGridFromPocos(pocos, { grupo: 1 });

const api = (url, { csrfToken: _csrf, ...opts } = {}) => apiFetch(url, opts);

// Extrai mensagem legível de um erro do DRF (aceita erros, detail ou {campo: [msg]})
function extrairErro(err, fallback) {
  const d = err?.data;
  if (!d) return fallback;
  if (Array.isArray(d.erros)) return d.erros.join("; ");
  if (d.erros) return String(d.erros);
  if (d.detail) return String(d.detail);
  if (d.erro) return String(d.erro);
  const partes = [];
  for (const [, v] of Object.entries(d)) {
    if (Array.isArray(v)) partes.push(...v.map(String));
    else if (typeof v === "string") partes.push(v);
  }
  return partes.length ? partes.join("; ") : fallback;
}

// ================================================================
export default function MontarPlaca({
  csrfToken,
  editarPlacaId = null,
  onEditarDone,
  operador,
}) {

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
  const [grupoAtivo, setGrupoAtivo] = useState(1);
  const [totalGrupos, setTotalGrupos] = useState(1);
  const [selectedSet, setSelectedSet] = useState(new Set());
  const inputRef = useRef();
  const dragSource = useRef(null);
  const isDraggingSelection = useRef(false);
  const lastClicked = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [kitsExtracao, setKitsExtracao] = useState([]);
  const [kitExtracaoId, setKitExtracaoId] = useState("");
  // Código da placa (input do usuário ao criar placa de extração)
  const [codigoPlaca, setCodigoPlaca] = useState("");
  // Status da verificação: null | 'checando' | 'disponivel' | 'duplicado'
  const [codigoStatus, setCodigoStatus] = useState(null);
  // Modal "Salvar como nova placa"
  const [novaPlacaModalOpen, setNovaPlacaModalOpen] = useState(false);
  const [novaPlacaCodigo, setNovaPlacaCodigo] = useState("");
  const [novaPlacaErro, setNovaPlacaErro] = useState(null);

  // Carrega kits de extração disponíveis
  useEffect(() => {
    api("/api/configuracoes/kits-extracao/?ativo=true")
      .then((data) => {
        setKitsExtracao(data.results || data);
        // Seleciona o primeiro kit como default se houver apenas um
        const lista = data.results || data;
        if (lista.length === 1) setKitExtracaoId(String(lista[0].id));
      })
      .catch(() => {});
  }, []);

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

  // Carrega placa solicitada pela aba de consulta
  useEffect(() => {
    if (editarPlacaId) {
      carregarPlaca(editarPlacaId);
      onEditarDone?.();
    }
  }, [editarPlacaId]);

  // Verifica duplicata do código em tempo real (debounce 400ms)
  useEffect(() => {
    if (!placa?.local) return;
    const val = codigoPlaca.trim();
    if (!val) {
      setCodigoStatus(null);
      return;
    }
    setCodigoStatus("checando");
    const t = setTimeout(async () => {
      try {
        const data = await api(
          `/api/placas/verificar-codigo/?codigo=${encodeURIComponent(val)}`,
        );
        setCodigoStatus(data.existe ? "duplicado" : "disponivel");
      } catch {
        setCodigoStatus(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [codigoPlaca, placa]);

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
        const grupos = [...new Set(data.pocos.map((p) => p.grupo || 1))].sort();
        const maxGrupo = grupos.length > 0 ? Math.max(...grupos) : 1;
        setTotalGrupos(maxGrupo);
        setGrupoAtivo(1);
      } else {
        setGrid(emptyGrid());
        setSalva(false);
        setTotalGrupos(1);
        setGrupoAtivo(1);
      }
      setSelected(FILL_ORDER[0]);
      if (data.kit_extracao) setKitExtracaoId(String(data.kit_extracao));
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
    setGrupoAtivo(1);
    setTotalGrupos(1);
    setCodigoPlaca("");
    setCodigoStatus(null);
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
        grupo: grupoAtivo,
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
        grupo: grupoAtivo,
      };
      return next;
    });
    const ne = nextEmpty(idx);
    setSelected(ne === -1 ? idx : ne);
    setSalva(false);
  }

  // ---- Adicionar novo grupo com controles automáticos ----
  function adicionarGrupo() {
    const novoGrupo = totalGrupos + 1;

    // Encontra os controles do grupo 1 como referência
    const cpGrupo1 = grid.find(
      (w) => w.tipo_conteudo === TIPO.CP && w.grupo === 1,
    );
    const cnGrupo1 = grid.find(
      (w) => w.tipo_conteudo === TIPO.CN && w.grupo === 1,
    );

    if (!cpGrupo1 || !cnGrupo1) {
      setFeedback({
        tipo: "erro",
        msg: "Defina os controles CP e CN do Grupo 1 antes de adicionar um novo grupo.",
      });
      return;
    }

    // Calcula posições dos controles do novo grupo (desloca coluna para esquerda)
    const offset = novoGrupo - 1;
    function deslocarPosicao(posicao) {
      const row = posicao[0];
      const col = parseInt(posicao.slice(1), 10);
      const newCol = col - offset;
      if (newCol < 1) return null;
      return `${row}${String(newCol).padStart(2, "0")}`;
    }

    const novaCpPos = deslocarPosicao(cpGrupo1.posicao);
    const novaCnPos = deslocarPosicao(cnGrupo1.posicao);

    if (!novaCpPos || !novaCnPos) {
      setFeedback({
        tipo: "erro",
        msg: `Não há espaço para os controles do Grupo ${novoGrupo} (coluna fora da placa).`,
      });
      return;
    }

    const cpIdx = ALL_POSITIONS.indexOf(novaCpPos);
    const cnIdx = ALL_POSITIONS.indexOf(novaCnPos);

    // Verifica colisão
    const colisoes = [];
    if (grid[cpIdx]?.tipo_conteudo !== TIPO.VAZIO)
      colisoes.push(`CP em ${novaCpPos}`);
    if (grid[cnIdx]?.tipo_conteudo !== TIPO.VAZIO)
      colisoes.push(`CN em ${novaCnPos}`);
    if (colisoes.length > 0) {
      setFeedback({
        tipo: "erro",
        msg: `Não foi possível inserir controles do Grupo ${novoGrupo}: poço(s) ocupado(s) — ${colisoes.join(", ")}. Libere os poços e tente novamente.`,
      });
      return;
    }

    setGrid((prev) => {
      const next = [...prev];
      next[cpIdx] = {
        ...next[cpIdx],
        tipo_conteudo: TIPO.CP,
        amostra_id: null,
        amostra_codigo: "",
        grupo: novoGrupo,
      };
      next[cnIdx] = {
        ...next[cnIdx],
        tipo_conteudo: TIPO.CN,
        amostra_id: null,
        amostra_codigo: "",
        grupo: novoGrupo,
      };
      return next;
    });
    setTotalGrupos(novoGrupo);
    setGrupoAtivo(novoGrupo);
    setSalva(false);
    setFeedback({
      tipo: "sucesso",
      msg: `Grupo ${novoGrupo} criado. CP em ${novaCpPos}, CN em ${novaCnPos}.`,
    });
  }

  // ---- Remover grupo (limpa todos os poços do grupo) ----
  function removerGrupo(grupo) {
    if (grupo === 1) return; // grupo 1 nunca pode ser removido
    setGrid((prev) =>
      prev.map((w) =>
        w.grupo === grupo
          ? {
              ...w,
              tipo_conteudo: TIPO.VAZIO,
              amostra_id: null,
              amostra_codigo: "",
              grupo: 1,
            }
          : w,
      ),
    );
    // Recalcula totalGrupos com base no que sobrou
    setTotalGrupos((prev) => {
      const novo = prev === grupo ? grupo - 1 : prev;
      return novo;
    });
    if (grupoAtivo === grupo) setGrupoAtivo(grupo - 1);
    setSalva(false);
    setFeedback({ tipo: "aviso", msg: `Grupo ${grupo} removido.` });
  }

  function moverParaGrupo(grupo) {
    const targets =
      selectedSet.size > 0
        ? [...selectedSet].filter((i) => grid[i].tipo_conteudo !== TIPO.VAZIO)
        : grid[selected]?.tipo_conteudo !== TIPO.VAZIO
          ? [selected]
          : [];
    if (targets.length === 0) return;
    setGrid((prev) => {
      const next = [...prev];
      targets.forEach((i) => {
        next[i] = { ...next[i], grupo };
      });
      return next;
    });
    setSalva(false);
    setFeedback({
      tipo: "sucesso",
      msg: `${targets.length} poço(s) movidos para Grupo ${grupo}.`,
    });
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
        };
      });
      return next;
    });
    setSelectedSet(new Set());
    setSalva(false);
    setFeedback({ tipo: "aviso", msg: `${filled.length} poço(s) limpo(s).` });
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
    if (placa.local) {
      const cod = codigoPlaca.trim();
      if (!cod) {
        setFeedback({
          tipo: "erro",
          msg: "Informe um código para a placa antes de salvar.",
        });
        return;
      }
      if (codigoStatus === "duplicado") {
        setFeedback({
          tipo: "erro",
          msg: `Código "${cod}" já está em uso em outra placa.`,
        });
        return;
      }
    }
    setCarregando(true);
    setFeedback(null);

    const pocos = grid
      .filter((w) => w.tipo_conteudo !== TIPO.VAZIO)
      .map((w) => ({
        posicao: w.posicao,
        tipo_conteudo: w.tipo_conteudo,
        amostra_codigo: w.amostra_codigo || "",
        grupo: w.grupo || 1,
      }));

    try {
      let placaAtual = placa;
      if (placa.local) {
        placaAtual = await api("/api/placas/", {
          csrfToken,
          method: "POST",
          body: { codigo: codigoPlaca.trim(), tipo_placa: "extracao" },
        });
        setPlaca(placaAtual);
      }

      const body = { pocos, numero_cracha: operador?.numero_cracha };
      if (kitExtracaoId) body.kit_extracao_id = kitExtracaoId;
      const data = await api(`/api/placas/${placaAtual.id}/salvar-pocos/`, {
        csrfToken,
        method: "POST",
        body,
      });
      setPlaca(data);
      setSalva(true);
      setFeedback({
        tipo: "sucesso",
        msg: `Placa ${data.codigo} salva — ${totalAmostras} amostras em extração.`,
      });
    } catch (err) {
      setFeedback({ tipo: "erro", msg: extrairErro(err, "Erro ao salvar.") });
    } finally {
      setCarregando(false);
    }
  }

  // ---- Salvar como nova placa (cópia / repetição) ----
  function salvarComoNova() {
    if (!hasControls) {
      setFeedback({
        tipo: "erro",
        msg: "A placa precisa ter pelo menos um CN e um CP.",
      });
      return;
    }
    setNovaPlacaCodigo("");
    setNovaPlacaErro(null);
    setNovaPlacaModalOpen(true);
  }

  async function confirmarSalvarComoNova() {
    const cod = novaPlacaCodigo.trim();
    if (!cod) {
      setNovaPlacaErro("Código é obrigatório.");
      return;
    }

    setCarregando(true);
    setNovaPlacaErro(null);

    const pocos = grid
      .filter((w) => w.tipo_conteudo !== TIPO.VAZIO)
      .map((w) => ({
        posicao: w.posicao,
        tipo_conteudo: w.tipo_conteudo,
        amostra_codigo: w.amostra_codigo || "",
        grupo: w.grupo || 1,
      }));

    try {
      const novaPlaca = await api("/api/placas/", {
        csrfToken,
        method: "POST",
        body: { codigo: cod, tipo_placa: "extracao" },
      });
      const bodyNova = { pocos, numero_cracha: operador?.numero_cracha };
      if (kitExtracaoId) bodyNova.kit_extracao_id = kitExtracaoId;
      const data = await api(`/api/placas/${novaPlaca.id}/salvar-pocos/`, {
        csrfToken,
        method: "POST",
        body: bodyNova,
      });
      setPlaca(data);
      setSalva(true);
      setNovaPlacaModalOpen(false);
      setFeedback({
        tipo: "sucesso",
        msg: `Nova placa ${data.codigo} criada com ${totalAmostras} amostra${totalAmostras !== 1 ? "s" : ""}.`,
      });
    } catch (err) {
      setNovaPlacaErro(extrairErro(err, "Erro ao criar nova placa."));
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
    setGrupoAtivo(1);
    setTotalGrupos(1);
    setCodigoPlaca("");
    setCodigoStatus(null);
  }

  // ================================================================
  // Render
  // ================================================================
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ---- Selecionar / Criar placa ---- */}
      {!placa && (
        <div className="mb-6">
          <p className="text-gray-500 mb-4">
            Crie uma nova placa ou use a aba "Consultar Placas" para abrir uma
            existente.
          </p>
          <Button
            variant="secondary"
            onClick={criarPlaca}
            disabled={carregando}
          >
            {carregando ? "Criando..." : "Criar Nova Placa"}
          </Button>
        </div>
      )}

      {/* ---- Info da placa ativa ---- */}
      {placa && (
        <div className="flex items-center gap-4 mb-3 flex-wrap shrink-0">
          {placa.local ? (
            <span className="text-blue-900 font-semibold text-[1rem] tracking-wider">
              Nova Placa
            </span>
          ) : (
            <span className="bg-blue-900 text-white px-4 py-1.5 rounded-md font-semibold text-[1rem] tracking-wider">
              {placa.codigo}
            </span>
          )}
          <span className="text-gray-500 text-[0.85rem]">
            {totalAmostras} amostras | {totalCN} CN | {totalCP} CP |{" "}
            {totalReacoes} reações
          </span>
          {salva && (
            <span className="text-green-700 font-medium text-[0.85rem]">
              Salva
            </span>
          )}
          {placa.status_placa && placa.status_placa !== "aberta" && (
            <span
              className={`${(STATUS_PLACA[placa.status_placa] || {}).bg || "bg-gray-600"} text-white px-3 py-0.5 rounded text-[0.8rem] font-medium`}
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
            {/* ---- Input de código (placa nova de extração) ---- */}
            {placa?.local && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Código da placa:
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={codigoPlaca}
                    onChange={(e) => setCodigoPlaca(e.target.value)}
                    placeholder="Ex: HPVe010426-1"
                    maxLength={20}
                    autoFocus
                    className={`px-3 py-1.5 text-sm border-2 rounded-md outline-none flex-1 min-w-[180px] transition-colors ${
                      codigoStatus === "duplicado"
                        ? "border-red-500 focus:border-red-600"
                        : codigoStatus === "disponivel"
                          ? "border-green-500 focus:border-green-600"
                          : "border-gray-300 focus:border-blue-500"
                    }`}
                  />
                  {codigoStatus === "checando" && (
                    <span className="text-xs text-gray-500">Verificando...</span>
                  )}
                  {codigoStatus === "disponivel" && (
                    <span className="text-xs font-medium text-green-700">
                      Disponível
                    </span>
                  )}
                  {codigoStatus === "duplicado" && (
                    <span className="text-xs font-medium text-red-700">
                      Em uso
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ---- Feedback ---- */}
            {feedback && (
              <div
                className={`px-3 py-2 rounded-md flex items-center gap-2 flex-wrap text-sm ${
                  feedback.tipo === "sucesso"
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : feedback.tipo === "erro"
                      ? "bg-red-100 text-red-800 border border-red-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}
              >
                <span>{feedback.msg}</span>
                {pendingDuplicate && (
                  <Button variant="ghost" size="sm" onClick={forceAddDuplicate}>
                    Adicionar mesmo assim
                  </Button>
                )}
              </div>
            )}

            {/* ---- Aviso de controles ---- */}
            {isEditable && !hasControls && (
              <div className="px-3 py-2 rounded-md bg-red-100 text-red-700 border border-red-300 text-[0.85rem]">
                A placa precisa de pelo menos um CN e um CP para ser salva.
              </div>
            )}

            {/* ---- Scanner + modo (só para placa aberta) ---- */}
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
                        ? "Escanear código da amostra..."
                        : `Clique em um poço vazio para inserir ${modo === TIPO.CN ? "CN" : "CP"}`
                    }
                    disabled={carregando || modo !== TIPO.AMOSTRA}
                    autoComplete="off"
                    className="flex-1 min-w-0 px-3 py-2 text-[0.9rem] border-2 border-blue-300 rounded-md outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <Button type="submit" variant="secondary" size="sm" disabled={carregando || modo !== TIPO.AMOSTRA}>
                    {modo === TIPO.AMOSTRA ? "Buscar" : "Inserir"}
                  </Button>
                </form>

                <div className="flex gap-1">
                  {[TIPO.AMOSTRA, TIPO.CN, TIPO.CP].map((t) => {
                    const gc = t === TIPO.AMOSTRA ? GROUP_COLORS[0] : null;
                    const isActive = modo === t;
                    const activeClass = gc
                      ? `bg-blue-500 border-blue-500`
                      : t === TIPO.CN
                        ? `bg-amber-500 border-amber-500`
                        : `bg-pink-500 border-pink-500`;
                    return (
                      <button
                        key={t}
                        onClick={() => setModo(t)}
                        className={`flex-1 px-3 py-1.5 rounded-md text-[0.8rem] font-medium transition-colors border-2 ${
                          isActive
                            ? `${activeClass} text-white`
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300 border-transparent"
                        }`}
                      >
                        {t === TIPO.AMOSTRA ? "Amostra" : t.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- Barra de grupos ---- */}
            {isEditable && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Grupos:</label>
                <div className="flex gap-1 flex-wrap items-center">
                  {Array.from({ length: totalGrupos }, (_, i) => i + 1).map((g) => {
                    const gc = GROUP_COLORS[(g - 1) % GROUP_COLORS.length];
                    const isAtivo = g === grupoAtivo;
                    const isUltimo = g === totalGrupos;
                    return (
                      <div key={g} className="flex items-center">
                        <button
                          onClick={() => setGrupoAtivo(g)}
                          className={`px-3 py-1.5 text-[0.82rem] border-2 cursor-pointer font-medium transition-colors
                            ${g > 1 || isUltimo ? "rounded-l-md" : "rounded-md"}
                            ${g === 1 && !isUltimo ? "rounded-md" : ""}
                            ${
                              isAtivo
                                ? `${gc.bgActive} ${gc.border} text-white font-bold`
                                : `bg-gray-50 ${gc.text} ${gc.border}`
                            }`}
                        >
                          Grupo {g}
                        </button>
                        {g > 1 && (
                          <button
                            onClick={() => removerGrupo(g)}
                            title={`Remover Grupo ${g}`}
                            className={`px-2 py-1.5 text-[0.75rem] border-2 border-l-0 cursor-pointer font-bold transition-colors
                              ${isUltimo ? "" : "rounded-r-md"}
                              ${
                                isAtivo
                                  ? `${gc.bgActive} ${gc.border} text-white`
                                  : `bg-gray-50 text-gray-400 ${gc.border}`
                              }`}
                          >
                            <Icon name="close" />
                          </button>
                        )}
                        {isUltimo && (
                          <button
                            onClick={adicionarGrupo}
                            title="Adicionar novo grupo"
                            className={`px-2 py-1.5 text-[0.9rem] leading-none border-2 border-l-0 rounded-r-md cursor-pointer font-bold transition-colors
                              ${
                                isAtivo
                                  ? `${gc.bgActive} ${gc.border} text-white`
                                  : `bg-gray-50 text-gray-500 ${gc.border} hover:bg-gray-100`
                              }`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- Kit de extração ---- */}
            {kitsExtracao.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Kit de extração:</label>
                <select
                  value={kitExtracaoId}
                  onChange={(e) => { setKitExtracaoId(e.target.value); setSalva(false); }}
                  disabled={!isEditable}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Selecione --</option>
                  {kitsExtracao.map((k) => (
                    <option key={k.id} value={k.id}>{k.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </aside>

          {/* ==================== COLUNA DIREITA ==================== */}
          <main className="flex-1 flex flex-col gap-3 min-w-0 items-start">
          {/* ---- Grid 8x12 ---- */}
          <WellGrid
            grid={grid}
            selected={selected}
            isEditable={isEditable}
            selectedSet={selectedSet}
            dragOver={dragOver}
            dragSource={dragSource}
            isDraggingSelection={isDraggingSelection}
            theme={THEMES.extracao}
            wellColors={wellColors}
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
                variant="primary"
                size="sm"
                onClick={salvarPlaca}
                disabled={
                  carregando ||
                  totalAmostras === 0 ||
                  !hasControls ||
                  (placa?.local &&
                    (!codigoPlaca.trim() ||
                      codigoStatus === "duplicado" ||
                      codigoStatus === "checando"))
                }
              >
                {carregando ? "Salvando..." : "Salvar Placa"}
              </Button>
            )}
            {placa && !placa.local && (
              <Button
                variant="secondary"
                size="sm"
                onClick={salvarComoNova}
                disabled={carregando || totalAmostras === 0 || !hasControls}
                title="Cria uma nova placa com os mesmos poços, sem alterar a original"
              >
                {carregando ? "Salvando..." : "Salvar como nova"}
              </Button>
            )}
            {salva && placa && (
              <a
                href={`/api/placas/${placa.id}/pdf/`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-transparent text-[#374151] border border-[#d1d5db] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:bg-[#f3f4f6] hover:border-[#9ca3af] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:-translate-y-px transition-all duration-200 no-underline"
              >
                Exportar Mapa
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={resetar}>
              {placa ? "Fechar Placa" : "Nova Placa"}
            </Button>
            {placa && (
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

      {/* ---- Modal: Salvar como nova placa ---- */}
      <Modal
        open={novaPlacaModalOpen}
        onClose={() => (!carregando ? setNovaPlacaModalOpen(false) : null)}
        title="Salvar como nova placa"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setNovaPlacaModalOpen(false)}
              disabled={carregando}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmarSalvarComoNova}
              disabled={carregando || !novaPlacaCodigo.trim()}
            >
              {carregando ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-gray-600">
          Informe o código da nova placa de extração:
        </p>
        <input
          type="text"
          value={novaPlacaCodigo}
          onChange={(e) => {
            setNovaPlacaCodigo(e.target.value);
            if (novaPlacaErro) setNovaPlacaErro(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && novaPlacaCodigo.trim() && !carregando) {
              confirmarSalvarComoNova();
            }
          }}
          placeholder="Ex: HPVe010426-2"
          maxLength={20}
          autoFocus
          className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-md outline-none focus:border-blue-500"
        />
        {novaPlacaErro && (
          <p className="mt-2 text-xs font-medium text-red-700">
            {novaPlacaErro}
          </p>
        )}
      </Modal>
    </div>
  );
}
