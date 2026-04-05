import { useState, useEffect, useRef } from "react";
import Button from "../design-system/components/Button";
import CrachaModal from "../components/CrachaModal";
import NavigationButtons from "../components/NavigationButtons";
import { getOperadorInicial, getCsrfToken } from "../utils/auth";

// ── Constantes ─────────────────────────────────────────────────────────────

const RESULTADO_FINAL = {
  hpv_nao_detectado: {
    label: "HPV não detectável",
    bg: "bg-success-600",
  },
  hpv16: { label: "HPV-16 detectável", bg: "bg-danger-600" },
  hpv18: { label: "HPV-18 detectável", bg: "bg-danger-600" },
  hpv_ar: { label: "HPV AR detectável", bg: "bg-danger-600" },
  hpv18_ar: { label: "HPV-18 e HPV AR detectáveis", bg: "bg-danger-600" },
  hpv16_ar: { label: "HPV-16 e HPV AR detectáveis", bg: "bg-danger-600" },
  hpv16_18: { label: "HPV-16 e HPV-18 detectáveis", bg: "bg-danger-600" },
  hpv16_18_ar: {
    label: "HPV-16, HPV-18 e HPV AR detectáveis",
    bg: "bg-danger-600",
  },
  invalido: {
    label: "Inválido",
    bg: "bg-warning-500",
    textClass: "text-black",
  },
  inconclusivo: { label: "Inconclusivo", bg: "bg-warning-500" },
  pendente: { label: "Pendente", bg: "bg-neutral-500" },
};

const CANAIS = [
  { canal: "CI", label: "CI", key: "ci_resultado" },
  { canal: "HPV16", label: "HPV-16", key: "hpv16_resultado" },
  { canal: "HPV18", label: "HPV-18", key: "hpv18_resultado" },
  { canal: "HPV_AR", label: "HPV AR", key: "hpvar_resultado" },
];

const INTERP_STYLE = {
  positivo: {
    bg: "bg-danger-50",
    color: "text-danger-700",
    border: "border-danger-300",
  },
  negativo: {
    bg: "bg-success-50",
    color: "text-success-700",
    border: "border-success-300",
  },
  invalido: {
    bg: "bg-warning-50",
    color: "text-warning-700",
    border: "border-warning-300",
  },
  pendente: {
    bg: "bg-neutral-50",
    color: "text-neutral-500",
    border: "border-neutral-200",
  },
};

// ── API helper ─────────────────────────────────────────────────────────────

async function apiFetch(
  url,
  { csrfToken, method = "GET", body, isMultipart = false } = {},
) {
  const opts = {
    method,
    headers: { "X-CSRFToken": getCsrfToken() },
    credentials: "same-origin",
  };
  if (body && !isMultipart) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  } else if (body && isMultipart) {
    opts.body = body;
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

// ── Componente principal ───────────────────────────────────────────────────

export default function RevisarResultados({ csrfToken }) {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [placas, setPlacas] = useState([]);
  const [placaSelecionada, setPlacaSelecionada] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [fase, setFase] = useState("inicial");
  const [resultados, setResultados] = useState([]);
  const [importFeedback, setImportFeedback] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    interpretacao_manual: "",
    justificativa_manual: "",
  });
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideErro, setOverrideErro] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const fileRef = useRef();

  useEffect(() => {
    fetchPlacas();
  }, []);

  async function fetchPlacas() {
    try {
      const [r1, r2, r3] = await Promise.all([
        apiFetch("/api/placas/?status_placa=submetida", { csrfToken }),
        apiFetch("/api/placas/?status_placa=resultados_importados", {
          csrfToken,
        }),
        apiFetch("/api/placas/?status_placa=aberta", { csrfToken }),
      ]);
      const abertas = (r3.results || r3).filter((p) => p.total_amostras > 0);
      setPlacas([...(r1.results || r1), ...(r2.results || r2), ...abertas]);
    } catch {
      setPlacas([]);
    }
  }

  function selecionarPlaca(placa) {
    setPlacaSelecionada(placa);
    setArquivo(null);
    setErro(null);
    setImportFeedback(null);
    setResultados([]);
    if (placa.status_placa === "resultados_importados") {
      setFase("revisao");
      carregarResultados(placa.id);
    } else {
      setFase("inicial");
    }
  }

  async function carregarResultados(placaId) {
    setCarregando(true);
    setErro(null);
    try {
      const data = await apiFetch(`/api/resultados/?placa_id=${placaId}`, {
        csrfToken,
      });
      setResultados(data.results || data);
    } catch (err) {
      setErro(err.data?.erro || "Erro ao carregar resultados.");
    } finally {
      setCarregando(false);
    }
  }

  async function importarCSV() {
    if (!placaSelecionada || !arquivo) return;
    setCarregando(true);
    setErro(null);
    setImportFeedback(null);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("placa_id", placaSelecionada.id);
      if (operador?.numero_cracha)
        form.append("numero_cracha", operador.numero_cracha);
      const data = await apiFetch("/api/resultados/importar/", {
        csrfToken,
        method: "POST",
        body: form,
        isMultipart: true,
      });
      setImportFeedback({
        cp: data.cp,
        cn: data.cn,
        avisos: data.avisos,
        mensagem: data.mensagem,
      });
      setResultados(data.resultados || []);
      setPlacaSelecionada((prev) => ({
        ...prev,
        status_placa: "resultados_importados",
      }));
      setFase("revisao");
    } catch (err) {
      const d = err.data || {};
      if (err.status === 422) {
        setErro(
          `Corrida inválida — ${[d.cp, d.cn].filter(Boolean).join("; ")}`,
        );
      } else {
        setErro(d.erro || d.detail || "Erro ao importar CSV.");
      }
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarResultado(id) {
    setActionLoading((p) => ({ ...p, [id]: "confirmar" }));
    try {
      const updated = await apiFetch(`/api/resultados/${id}/confirmar/`, {
        csrfToken,
        method: "POST",
        body: { numero_cracha: operador?.numero_cracha },
      });
      setResultados((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r)),
      );
    } catch (err) {
      alert(err.data?.erro || "Erro ao confirmar resultado.");
    } finally {
      setActionLoading((p) => ({ ...p, [id]: null }));
    }
  }

  async function confirmarTodos() {
    const pendentes = resultados.filter((r) => !r.imutavel);
    if (pendentes.length === 0) return;
    if (
      !confirm(
        `Confirmar todos os ${pendentes.length} resultados pendentes desta placa?`,
      )
    )
      return;
    for (const r of pendentes) {
      await confirmarResultado(r.id);
    }
  }

  async function liberarResultado(id) {
    setActionLoading((p) => ({ ...p, [id]: "liberar" }));
    try {
      const updated = await apiFetch(`/api/resultados/${id}/liberar/`, {
        csrfToken,
        method: "POST",
        body: { numero_cracha: operador?.numero_cracha },
      });
      setResultados((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r)),
      );
    } catch (err) {
      alert(err.data?.erro || "Erro ao liberar resultado.");
    } finally {
      setActionLoading((p) => ({ ...p, [id]: null }));
    }
  }

  async function solicitarRepeticao(id) {
    if (!confirm("Confirma solicitação de repetição para esta amostra?"))
      return;
    setActionLoading((p) => ({ ...p, [id]: "repeticao" }));
    try {
      await apiFetch(`/api/resultados/${id}/solicitar-repeticao/`, {
        csrfToken,
        method: "POST",
        body: { numero_cracha: operador?.numero_cracha },
      });
      await carregarResultados(placaSelecionada.id);
    } catch (err) {
      alert(err.data?.erro || "Erro ao solicitar repetição.");
    } finally {
      setActionLoading((p) => ({ ...p, [id]: null }));
    }
  }

  function abrirOverride(resultado, canalDef) {
    const canalObj = resultado.canais?.find((c) => c.canal === canalDef.canal);
    if (!canalObj) return;
    setOverrideModal({
      resultadoId: resultado.id,
      canalId: canalObj.id,
      canalLabel: canalDef.label,
      canalKey: canalDef.canal,
    });
    setOverrideForm({
      interpretacao_manual: canalObj.interpretacao_manual || "",
      justificativa_manual: canalObj.justificativa_manual || "",
    });
    setOverrideErro(null);
  }

  async function salvarOverride() {
    setOverrideLoading(true);
    setOverrideErro(null);
    try {
      await apiFetch(`/api/resultados/pocos/${overrideModal.canalId}/`, {
        csrfToken,
        method: "PATCH",
        body: {
          interpretacao_manual: overrideForm.interpretacao_manual || null,
          justificativa_manual: overrideForm.justificativa_manual,
        },
      });
      setOverrideModal(null);
      await carregarResultados(placaSelecionada.id);
    } catch (err) {
      const d = err.data || {};
      setOverrideErro(
        d.justificativa_manual?.[0] ||
          d.non_field_errors?.[0] ||
          d.erro ||
          "Erro ao salvar.",
      );
    } finally {
      setOverrideLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1200px]">
      <NavigationButtons currentStep="resultados" />

      {!operador && (
        <CrachaModal
          onValidado={setOperador}
          modulo="Revisão de Resultados PCR"
          gruposRequeridos={["especialista", "supervisor"]}
        />
      )}

      <h2 className="mb-5 text-xl font-bold text-rs-red">
        Revisão de Resultados PCR
      </h2>

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

      {/* Seletor de placa */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 mb-4">
        <label className="block font-semibold text-neutral-700 mb-1.5 text-sm">
          Selecionar Placa
        </label>
        <div className="flex gap-3 flex-wrap items-center">
          <select
            value={placaSelecionada?.id || ""}
            onChange={(e) => {
              const p = placas.find((x) => x.id === Number(e.target.value));
              if (p) selecionarPlaca(p);
            }}
            className="px-3 py-2 text-sm border border-neutral-300 rounded-md bg-white text-neutral-700 outline-none min-w-[260px] flex-1"
          >
            <option value="">— Escolha uma placa —</option>
            {placas.length === 0 && (
              <option disabled>Nenhuma placa disponível</option>
            )}
            {placas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {STATUS_LABEL[p.status_placa] || p.status_placa}
              </option>
            ))}
          </select>
          <Button onClick={fetchPlacas} variant="outline" size="sm">
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Upload (placa submetida) ────────────────────────── */}
      {placaSelecionada && fase === "inicial" && (
        <div className="bg-white border border-neutral-200 rounded-lg p-5 mb-4">
          <p className="text-neutral-700 mb-4 text-sm">
            Placa <strong>{placaSelecionada.codigo}</strong> aguardando
            importação dos resultados do termociclador.
          </p>
          <label className="block font-semibold text-neutral-700 mb-1.5 text-sm">
            Arquivo CSV do CFX Manager
          </label>
          <div className="flex gap-3 items-center flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.CSV"
              onChange={(e) => setArquivo(e.target.files[0] || null)}
              className="text-sm flex-1 min-w-[200px]"
            />
            <Button
              onClick={importarCSV}
              variant="primary"
              size="sm"
              loading={carregando}
              disabled={!arquivo || carregando}
            >
              {carregando ? "Importando…" : "Importar Resultados"}
            </Button>
          </div>
          {arquivo && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Arquivo: <strong>{arquivo.name}</strong> (
              {(arquivo.size / 1024).toFixed(1)} KB)
            </p>
          )}
          {erro && (
            <div className="mt-2 bg-danger-50 text-danger-700 px-3.5 py-2 rounded-md text-sm">
              {erro}
            </div>
          )}
        </div>
      )}

      {/* ── Revisão (resultados carregados) ────────────────── */}
      {fase === "revisao" && (
        <>
          {importFeedback && (
            <div className="flex gap-2 mb-3 flex-wrap">
              <ControleBadge ok label="CP" msg={importFeedback.cp} />
              <ControleBadge ok label="CN" msg={importFeedback.cn} />
              {importFeedback.mensagem && (
                <span className="text-sm text-neutral-700 self-center">
                  {importFeedback.mensagem}
                </span>
              )}
              {importFeedback.avisos?.map((a, i) => (
                <div
                  key={i}
                  className="w-full bg-warning-50 text-warning-700 px-3 py-1.5 rounded text-xs"
                >
                  {a}
                </div>
              ))}
            </div>
          )}

          {erro && (
            <div className="bg-danger-50 text-danger-700 px-3.5 py-2 rounded-md text-sm mb-2">
              {erro}
            </div>
          )}

          {carregando ? (
            <p className="text-neutral-500 text-sm">Carregando…</p>
          ) : (
            <ResultadosTable
              resultados={resultados}
              actionLoading={actionLoading}
              onConfirmar={confirmarResultado}
              onConfirmarTodos={confirmarTodos}
              onLiberar={liberarResultado}
              onRepeticao={solicitarRepeticao}
              onOverride={abrirOverride}
            />
          )}

          <Button
            onClick={() => {
              setFase("inicial");
              setImportFeedback(null);
              setErro(null);
            }}
            variant="outline"
            size="sm"
            className="mt-4"
          >
            ← Importar outro arquivo
          </Button>
        </>
      )}

      {/* ── Modal de override manual ────────────────────────── */}
      {overrideModal && (
        <Modal onClose={() => setOverrideModal(null)}>
          <h3 className="mb-4 text-base font-bold text-rs-red">
            Override manual — Canal {overrideModal.canalLabel}
          </h3>
          <label className="block font-semibold text-neutral-700 text-xs mb-1">
            Interpretação manual
          </label>
          <select
            value={overrideForm.interpretacao_manual}
            onChange={(e) =>
              setOverrideForm((f) => ({
                ...f,
                interpretacao_manual: e.target.value,
              }))
            }
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md bg-white text-neutral-700 outline-none mb-3"
          >
            <option value="">— Limpar override (usar automático) —</option>
            <option value="positivo">Positivo</option>
            <option value="negativo">Negativo</option>
            <option value="invalido">Inválido</option>
          </select>
          <label className="block font-semibold text-neutral-700 text-xs mb-1">
            Justificativa{" "}
            {overrideForm.interpretacao_manual ? "(obrigatória)" : ""}
          </label>
          <textarea
            rows={3}
            value={overrideForm.justificativa_manual}
            onChange={(e) =>
              setOverrideForm((f) => ({
                ...f,
                justificativa_manual: e.target.value,
              }))
            }
            placeholder="Descreva o motivo da alteração…"
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md outline-none resize-vertical box-border mb-2"
          />
          {overrideErro && (
            <div className="bg-danger-50 text-danger-700 px-3 py-1.5 rounded text-xs mb-2">
              {overrideErro}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-3">
            <Button
              onClick={() => setOverrideModal(null)}
              variant="outline"
              size="sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarOverride}
              variant="primary"
              size="sm"
              loading={overrideLoading}
            >
              {overrideLoading ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

function ResultadosTable({
  resultados,
  actionLoading,
  onConfirmar,
  onConfirmarTodos,
  onLiberar,
  onRepeticao,
  onOverride,
}) {
  if (resultados.length === 0)
    return (
      <p className="text-neutral-400 text-sm py-4">
        Nenhum resultado encontrado para esta placa.
      </p>
    );

  const totalConfirmados = resultados.filter((r) => r.imutavel).length;
  const totalPendentes = resultados.length - totalConfirmados;

  return (
    <>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-xs text-neutral-500">
          {resultados.length} amostra{resultados.length !== 1 ? "s" : ""} •{" "}
          {totalConfirmados} confirmada{totalConfirmados !== 1 ? "s" : ""}
          {totalPendentes > 0 &&
            ` • ${totalPendentes} pendente${totalPendentes !== 1 ? "s" : ""}`}
        </span>
        {totalPendentes > 0 && (
          <Button onClick={onConfirmarTodos} variant="primary" size="sm">
            Confirmar todos ({totalPendentes})
          </Button>
        )}
      </div>
      <div className="overflow-x-auto bg-white rounded-lg border border-neutral-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-50 border-b-2 border-neutral-200">
              <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                Num. Interno
              </th>
              {CANAIS.map((c) => (
                <th
                  key={c.canal}
                  className="px-3 py-2.5 text-center font-semibold text-neutral-700 whitespace-nowrap"
                >
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                Resultado Final
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                Status
              </th>
              <th className="px-3 py-2.5 text-right font-semibold text-neutral-700 whitespace-nowrap">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <ResultadoRow
                key={r.id}
                resultado={r}
                actionLoading={actionLoading[r.id]}
                onConfirmar={onConfirmar}
                onLiberar={onLiberar}
                onRepeticao={onRepeticao}
                onOverride={onOverride}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ResultadoRow({
  resultado,
  actionLoading,
  onConfirmar,
  onLiberar,
  onRepeticao,
  onOverride,
}) {
  const rf =
    RESULTADO_FINAL[resultado.resultado_final] || RESULTADO_FINAL.pendente;
  const statusLabel = resultado.imutavel
    ? resultado.amostra_status === "resultado_liberado"
      ? "Liberado"
      : "Confirmado"
    : "Pendente";
  const statusBg = resultado.imutavel
    ? resultado.amostra_status === "resultado_liberado"
      ? "bg-success-600"
      : "bg-rs-red"
    : "bg-neutral-500";

  return (
    <tr className="border-b border-neutral-100">
      <td className="px-3 py-2 text-neutral-700 font-semibold">
        {resultado.amostra_codigo || "—"}
      </td>
      {CANAIS.map((c) => {
        const val = resultado[c.key];
        const s = INTERP_STYLE[val] || INTERP_STYLE.pendente;
        const canalObj = resultado.canais?.find((x) => x.canal === c.canal);
        const hasManual = canalObj?.interpretacao_manual != null;
        return (
          <td key={c.canal} className="px-3 py-2 text-center align-middle">
            <div className="flex items-center justify-center gap-1">
              <span
                className={`${s.bg} ${s.color} border ${s.border} px-1.5 py-[1px] rounded text-[0.78rem] font-medium whitespace-nowrap`}
              >
                {val || "—"}
                {hasManual && <sup title="Override manual"> *</sup>}
              </span>
              {!resultado.imutavel && canalObj && (
                <button
                  onClick={() => onOverride(resultado, c)}
                  title="Editar interpretação"
                  className="bg-none border-none cursor-pointer p-[1px_2px] text-neutral-400 text-xs leading-none"
                >
                  ✎
                </button>
              )}
            </div>
            {canalObj?.cq != null && (
              <div className="text-[0.7rem] text-neutral-400 mt-[1px]">
                Cq {canalObj.cq.toFixed(1)}
              </div>
            )}
          </td>
        );
      })}
      <td className="px-3 py-2">
        <span
          className={`${rf.bg} ${rf.textClass || "text-white"} px-2 py-0.5 rounded text-[0.76rem] font-medium whitespace-nowrap inline-block`}
        >
          {rf.label}
        </span>
      </td>
      <td className="px-3 py-2">
        <span
          className={`${statusBg} text-white px-2 py-0.5 rounded text-[0.76rem] font-medium`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {!resultado.imutavel && (
          <>
            <Button
              onClick={() => onConfirmar(resultado.id)}
              variant="primary"
              size="sm"
              loading={actionLoading === "confirmar"}
              disabled={!!actionLoading}
              className="ml-1"
            >
              {actionLoading === "confirmar" ? "…" : "Confirmar"}
            </Button>
            <Button
              onClick={() => onRepeticao(resultado.id)}
              variant="primary"
              size="sm"
              loading={actionLoading === "repeticao"}
              disabled={!!actionLoading}
              className="ml-1 bg-warning-500 hover:bg-warning-600"
              title="Solicitar repetição de PCR"
            >
              {actionLoading === "repeticao" ? "…" : "Repetir"}
            </Button>
          </>
        )}
        {resultado.imutavel && resultado.resultado_final !== "pendente" && (
          <Button
            onClick={() => onLiberar(resultado.id)}
            variant="primary"
            size="sm"
            loading={actionLoading === "liberar"}
            disabled={!!actionLoading}
            className="ml-1 bg-success-600 hover:bg-success-700"
          >
            {actionLoading === "liberar" ? "…" : "Liberar"}
          </Button>
        )}
      </td>
    </tr>
  );
}

function ControleBadge({ ok, label, msg }) {
  return (
    <span
      className={`${ok ? "bg-success-50 text-success-700 border-success-200" : "bg-danger-50 text-danger-700 border-danger-200"} border px-2.5 py-0.5 rounded-full text-xs font-semibold`}
      title={msg}
    >
      {label}: {ok ? "OK" : "FALHOU"}
    </span>
  );
}

function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl p-6 w-[440px] max-w-[95vw] shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
        {children}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  aberta: "Aberta",
  submetida: "Submetida",
  resultados_importados: "Resultados Importados",
};
