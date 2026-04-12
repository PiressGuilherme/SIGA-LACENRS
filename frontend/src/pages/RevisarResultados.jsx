import React, { useState, useEffect, useRef } from "react";
import CrachaModal from "../components/CrachaModal";
import NavigationButtons from "../components/NavigationButtons";
import Button from "../components/Button";
import { getOperadorInicial } from "../utils/auth";
import apiFetch from "../utils/apiFetch";

// ── Constantes ─────────────────────────────────────────────────────────────

const RESULTADO_FINAL = {
  hpv_nao_detectado: { label: "HPV não detectável", bg: "#198754" },
  hpv16: { label: "HPV-16 detectável", bg: "#dc3545" },
  hpv18: { label: "HPV-18 detectável", bg: "#dc3545" },
  hpv_ar: { label: "HPV AR detectável", bg: "#dc3545" },
  hpv18_ar: { label: "HPV-18 e HPV AR detectáveis", bg: "#dc3545" },
  hpv16_ar: { label: "HPV-16 e HPV AR detectáveis", bg: "#dc3545" },
  hpv16_18: { label: "HPV-16 e HPV-18 detectáveis", bg: "#dc3545" },
  hpv16_18_ar: { label: "HPV-16, HPV-18 e HPV AR detectáveis", bg: "#dc3545" },
  invalido: { label: "Inválido", bg: "#ffc107", color: "#000" },
  inconclusivo: { label: "Inconclusivo", bg: "#fd7e14" },
  pendente: { label: "Pendente", bg: "#6c757d" },
};

// canal key no DB → { label, resultKey }  (fallback quando kit não tem alvos)
const CANAIS_PADRAO = [
  { canal: "CI", label: "CI", key: "ci_resultado" },
  { canal: "HPV16", label: "HPV-16", key: "hpv16_resultado" },
  { canal: "HPV18", label: "HPV-18", key: "hpv18_resultado" },
  { canal: "HPV_AR", label: "HPV AR", key: "hpvar_resultado" },
];

// Mapeia nome do alvo → campo fixo de ResultadoAmostra
const ALVO_PARA_CAMPO = {
  CI: "ci_resultado",
  HPV16: "hpv16_resultado",
  HPV18: "hpv18_resultado",
  HPV_AR: "hpvar_resultado",
};

function formatAlvoLabel(nome) {
  const mapa = { CI: "CI", HPV16: "HPV-16", HPV18: "HPV-18", HPV_AR: "HPV AR" };
  return mapa[nome] || nome;
}

function canaisDynamic(kit) {
  if (!kit?.alvos?.length) return CANAIS_PADRAO;
  return kit.alvos
    .filter((a) => a.tipo_alvo !== "CONTROLE_EXTERNO")
    .sort((a, b) => a.ordem - b.ordem)
    .map((a) => ({
      canal: a.nome,
      label: formatAlvoLabel(a.nome),
      key: ALVO_PARA_CAMPO[a.nome] || null,
    }));
}

const INTERP_STYLE = {
  positivo: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
  negativo: { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  invalido: { bg: "#fefce8", color: "#a16207", border: "#fde047" },
  pendente: { bg: "#f9fafb", color: "#6b7280", border: "#d1d5db" },
};

// ── Componente principal ───────────────────────────────────────────────────

export default function RevisarResultados({}) {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [placas, setPlacas] = useState([]);
  const [placaSelecionada, setPlacaSelecionada] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [fase, setFase] = useState("inicial"); // 'inicial' | 'revisao'
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
  const [kits, setKits] = useState([]);
  const [kitId, setKitId] = useState(null);
  const [controleInvalidoModal, setControleInvalidoModal] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    fetchPlacas();
  }, []);

  // Carregar kits de interpretacao ativos
  useEffect(() => {
    apiFetch("/api/configuracoes/kits/?ativo=true")
      .then((data) => {
        const lista = data.results || data;
        setKits(lista);
        if (lista.length > 0 && !kitId) setKitId(lista[0].id);
      })
      .catch(() => {});
  }, []);

  async function fetchPlacas() {
    try {
      const [r1, r2, r3] = await Promise.all([
        apiFetch("/api/placas/?status_placa=submetida", {}),
        apiFetch("/api/placas/?status_placa=resultados_importados", {}),
        apiFetch("/api/placas/?status_placa=aberta", {}),
      ]);
      // Inclui placas "aberta" que já têm amostras extraídas (criadas antes da correção do status)
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
      const data = await apiFetch(`/api/resultados/?placa_id=${placaId}`, {});
      setResultados(data.results || data);
    } catch (err) {
      setErro(err.data?.erro || "Erro ao carregar resultados.");
    } finally {
      setCarregando(false);
    }
  }

  async function importarCSV(forcar = false) {
    if (!placaSelecionada || !arquivo) return;
    setCarregando(true);
    setErro(null);
    setImportFeedback(null);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("placa_id", placaSelecionada.id);
      if (kitId) form.append("kit_id", kitId);
      if (operador?.numero_cracha)
        form.append("numero_cracha", operador.numero_cracha);
      if (forcar) form.append("forcar_import", "true");
      const data = await apiFetch("/api/resultados/importar/", {
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
      setControleInvalidoModal(null);
      setFase("revisao");
    } catch (err) {
      const d = err.data || {};
      if (err.status === 422) {
        // Mostrar modal com detalhes dos controles inválidos
        setControleInvalidoModal({
          cp_msg: d.cp || "",
          cn_msg: d.cn || "",
          cp_detalhes: d.cp_detalhes || {},
          cn_detalhes: d.cn_detalhes || {},
          pode_forcar: d.pode_forcar,
        });
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
    <div className="max-w-6xl">
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal
          onValidado={setOperador}
          modulo="Revisão de Resultados PCR"
          gruposRequeridos={["especialista", "supervisor"]}
        />
      )}

      {/* Barra do operador */}
      {operador && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-300 rounded-lg px-4 py-2.5 mb-4">
          <span className="text-sm text-emerald-800 font-semibold">
            Operador: {operador.nome_completo}
          </span>
          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
            {operador.perfil}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setOperador(null)} className="ml-auto">
            Trocar operador
          </Button>
        </div>
      )}

      <NavigationButtons currentStep="resultados" />

      <h2 className="mb-5 text-lg text-blue-900 font-semibold">
        Revisão de Resultados PCR
      </h2>

      {/* Seletor de placa */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <label className="block font-semibold text-gray-700 mb-2 text-sm">
          Selecionar Placa
        </label>
        <div className="flex gap-3 flex-wrap items-center">
          <select
            value={placaSelecionada?.id || ""}
            onChange={(e) => {
              const p = placas.find((x) => x.id === Number(e.target.value));
              if (p) selecionarPlaca(p);
            }}
            className="px-2.5 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 outline-none min-w-[260px] flex-1"
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
          <Button variant="ghost" onClick={fetchPlacas} title="Atualizar lista">
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Upload (placa submetida) ────────────────────────── */}
      {placaSelecionada && fase === "inicial" && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <p className="text-gray-700 mb-4 text-sm">
            Placa <strong>{placaSelecionada.codigo}</strong> aguardando
            importação dos resultados do termociclador.
          </p>
          {/* Kit de interpretacao */}
          {kits.length > 0 && (
            <div className="mb-3">
              <label className="block font-semibold text-gray-700 mb-1.5 text-sm">
                Kit de Interpretacao
              </label>
              <select
                value={kitId || ""}
                onChange={(e) => setKitId(Number(e.target.value))}
                className="px-2.5 py-1 rounded border border-gray-300 text-sm min-w-fit"
              >
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nome}
                    {k.alvos?.length
                      ? ` — ${k.alvos.length} alvos, ${k.regras_interpretacao?.length || 0} regras`
                      : ` (CI ≤${k.cq_amostra_ci_max} / HPV ≤${k.cq_amostra_hpv_max})`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="block font-semibold text-gray-700 mb-1.5 text-sm">
            Arquivo CSV do CFX Manager
          </label>
          <div className="flex gap-3 items-center flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.CSV"
              onChange={(e) => setArquivo(e.target.files[0] || null)}
              className="text-sm flex-1 min-w-fit"
            />
            <Button
              variant="secondary"
              onClick={importarCSV}
              disabled={!arquivo || carregando}
            >
              {carregando ? "Importando…" : "Importar Resultados"}
            </Button>
          </div>
          {arquivo && (
            <p className="mt-1 text-xs text-gray-500">
              Arquivo: <strong>{arquivo.name}</strong> (
              {(arquivo.size / 1024).toFixed(1)} KB)
            </p>
          )}
          {erro && <AlertBox tipo="erro">{erro}</AlertBox>}
        </div>
      )}

      {/* ── Revisão (resultados carregados) ────────────────── */}
      {fase === "revisao" && (
        <>
          {/* Feedback do import */}
          {importFeedback && (
            <div className="flex gap-2 mb-3 flex-wrap">
              <ControleBadge ok label="CP" msg={importFeedback.cp} />
              <ControleBadge ok label="CN" msg={importFeedback.cn} />
              {importFeedback.mensagem && (
                <span className="text-xs text-gray-700 self-center">
                  {importFeedback.mensagem}
                </span>
              )}
              {importFeedback.avisos?.map((a, i) => (
                <div key={i} className="w-full bg-yellow-50 text-amber-900 px-3 py-2 rounded text-sm">
                  {a}
                </div>
              ))}
            </div>
          )}

          {erro && <AlertBox tipo="erro">{erro}</AlertBox>}

          {carregando ? (
            <p className="text-gray-500 text-sm">Carregando…</p>
          ) : (
            <ResultadosTable
              resultados={resultados}
              kit={kits.find((k) => k.id === kitId) || null}
              actionLoading={actionLoading}
              onConfirmar={confirmarResultado}
              onConfirmarTodos={confirmarTodos}
              onLiberar={liberarResultado}
              onRepeticao={solicitarRepeticao}
              onOverride={abrirOverride}
            />
          )}

          <Button
            variant="ghost"
            onClick={() => { setFase("inicial"); setImportFeedback(null); setErro(null); }}
            className="mt-4"
          >
            ← Importar outro arquivo
          </Button>
        </>
      )}

      {/* ── Modal de controle inválido ────────────────────────── */}
      {controleInvalidoModal && (
        <Modal onClose={() => setControleInvalidoModal(null)}>
          <h3 className="mb-4 text-base text-red-600">
            ⚠ Controles de Qualidade Inválidos
          </h3>
          <div className="mb-5 text-sm text-gray-700">
            <p className="mb-3">
              A corrida do PCR não atende aos critérios de validação
              configurados no kit. Você pode ignorar esta validação e continuar
              a análise, mas os resultados serão marcados como "amplificação
              analisada com controles inválidos".
            </p>

            {controleInvalidoModal.cp_detalhes &&
              Object.keys(controleInvalidoModal.cp_detalhes).length > 0 && (
                <div className="bg-red-50 border border-red-300 rounded p-3 mb-3">
                  <p className="font-semibold text-red-700 mb-2">
                    CP (Controle Positivo):
                  </p>
                  <ul className="m-0 pl-4 text-red-900">
                    {Object.entries(controleInvalidoModal.cp_detalhes).map(
                      ([alvo, det]) => (
                        <li key={alvo} className="text-sm mb-1">
                          <strong>{alvo}</strong>: Cq = {det.cq_str} (limiar{" "}
                          {det.operador} {det.limiar_str})
                          {det.status === "falha" && (
                            <span className="text-red-600"> ❌ FALHOU</span>
                          )}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

            {controleInvalidoModal.cn_detalhes &&
              Object.keys(controleInvalidoModal.cn_detalhes).length > 0 && (
                <div className="bg-red-50 border border-red-300 rounded p-3 mb-3">
                  <p className="font-semibold text-red-700 mb-2">
                    CN (Controle Negativo):
                  </p>
                  <ul className="m-0 pl-4 text-red-900">
                    {Object.entries(controleInvalidoModal.cn_detalhes).map(
                      ([alvo, det]) => (
                        <li key={alvo} className="text-sm mb-1">
                          <strong>{alvo}</strong>: Cq = {det.cq_str} (limiar{" "}
                          {det.operador} {det.limiar_str})
                          {det.status === "falha" && (
                            <span className="text-red-600"> ❌ FALHOU</span>
                          )}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setControleInvalidoModal(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => importarCSV(true)} disabled={carregando}>
              {carregando ? "Importando…" : "Ignorar e Importar"}
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Modal de override manual ────────────────────────── */}
      {overrideModal && (
        <Modal onClose={() => setOverrideModal(null)}>
          <h3 className="mb-4 text-base text-blue-900">
            Override manual — Canal {overrideModal.canalLabel}
          </h3>
          <label className="block font-semibold text-gray-700 text-xs mb-1">
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
            className="px-2.5 py-2 rounded border border-gray-300 text-sm w-full mb-3"
          >
            <option value="">— Limpar override (usar automático) —</option>
            <option value="positivo">Positivo</option>
            <option value="negativo">Negativo</option>
            <option value="invalido">Inválido</option>
          </select>
          <label className="block font-semibold text-gray-700 text-xs mb-1">
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
            className="w-full px-2 py-2 text-sm border border-gray-300 rounded resize-vertical outline-none mb-2"
          />
          {overrideErro && <AlertBox tipo="erro">{overrideErro}</AlertBox>}
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="ghost" onClick={() => setOverrideModal(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={salvarOverride} disabled={overrideLoading}>
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
  kit,
  actionLoading,
  onConfirmar,
  onConfirmarTodos,
  onLiberar,
  onRepeticao,
  onOverride,
}) {
  if (resultados.length === 0) {
    return (
      <p className="text-gray-400 text-sm py-4">
        Nenhum resultado encontrado para esta placa.
      </p>
    );
  }

  const canais = canaisDynamic(kit);
  const totalConfirmados = resultados.filter((r) => r.imutavel).length;
  const totalPendentes = resultados.length - totalConfirmados;

  return (
    <>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-xs text-gray-500">
          {resultados.length} amostra{resultados.length !== 1 ? "s" : ""} •{" "}
          {totalConfirmados} confirmada{totalConfirmados !== 1 ? "s" : ""}
          {totalPendentes > 0 &&
            ` • ${totalPendentes} pendente${totalPendentes !== 1 ? "s" : ""}`}
        </span>
        {totalPendentes > 0 && (
          <Button variant="secondary" size="sm" onClick={onConfirmarTodos}>
            Confirmar todos ({totalPendentes})
          </Button>
        )}
      </div>
      <div className="overflow-x-auto bg-white rounded border border-gray-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-gray-200">
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                Num. Interno
              </th>
              {canais.map((c) => (
                <th
                  key={c.canal}
                  className="px-3 py-2.5 text-center font-semibold text-gray-700 whitespace-nowrap"
                >
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                Resultado Final
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                Status
              </th>
              <th className="px-3 py-2.5 text-right font-semibold text-gray-700 whitespace-nowrap">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <ResultadoRow
                key={r.id}
                resultado={r}
                canais={canais}
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
  canais,
  actionLoading,
  onConfirmar,
  onLiberar,
  onRepeticao,
  onOverride,
}) {
  const rf = RESULTADO_FINAL[resultado.resultado_final] || {
    label: resultado.resultado_final || "Pendente",
    bg: "#6c757d",
  };
  const statusLabel = resultado.imutavel
    ? resultado.amostra_status === "resultado_liberado"
      ? "Liberado"
      : "Confirmado"
    : "Pendente";
  const statusColor = resultado.imutavel
    ? resultado.amostra_status === "resultado_liberado"
      ? "#198754"
      : "#0d6efd"
    : "#6c757d";

  const temControleInvalido = !resultado.cp_valido || !resultado.cn_valido;

  return (
    <tr
      className={`border-b border-blue-50 ${
        temControleInvalido ? "bg-yellow-50 border-l-4 border-l-amber-400" : ""
      }`}
      title={
        temControleInvalido ? resultado.motivo_controle_invalido : undefined
      }
    >
      <td className="px-3 py-2 text-gray-700 align-middle font-semibold">
        {resultado.amostra_codigo || "—"}
        {temControleInvalido && (
          <span
            title={resultado.motivo_controle_invalido}
            className="ml-1 text-amber-400"
          >
            ⚠
          </span>
        )}
      </td>

      {canais.map((c) => {
        const val = c.key ? resultado[c.key] : null;
        const s = INTERP_STYLE[val] || INTERP_STYLE.pendente;
        const canalObj = resultado.canais?.find((x) => x.canal === c.canal);
        const hasManual = canalObj?.interpretacao_manual != null;
        return (
          <td key={c.canal} className="px-3 py-2 text-gray-700 align-middle text-center">
            <div className="flex items-center justify-center gap-1">
              <span
                style={{
                  background: s.bg,
                  color: s.color,
                  border: `1px solid ${s.border}`,
                  padding: "1px 7px",
                  borderRadius: 4,
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {val || "—"}
                {hasManual && <sup title="Override manual"> *</sup>}
              </span>
              {!resultado.imutavel && canalObj && (
                <button
                  onClick={() => onOverride(resultado, c)}
                  title="Editar interpretação"
                  className="bg-transparent border-none cursor-pointer px-0.5 py-0.5 text-gray-400 hover:text-gray-600 text-xs leading-none transition-colors"
                >
                  ✎
                </button>
              )}
            </div>
            {canalObj?.cq != null && (
              <div className="text-xs text-gray-400 mt-0.5">
                Cq {canalObj.cq.toFixed(1)}
              </div>
            )}
          </td>
        );
      })}

      {/* Resultado final */}
      <td className="px-3 py-2 text-gray-700 align-middle">
        <span
          style={{
            background: rf.bg,
            color: rf.color || "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: "0.76rem",
            fontWeight: 500,
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          {rf.label}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2 text-gray-700 align-middle">
        <span
          style={{
            background: statusColor,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: "0.76rem",
            fontWeight: 500,
          }}
        >
          {statusLabel}
        </span>
      </td>

      {/* Ações */}
      <td className="px-3 py-2 text-gray-700 align-middle text-right whitespace-nowrap">
        {!resultado.imutavel && (
          <div className="flex gap-1 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onConfirmar(resultado.id)}
              disabled={!!actionLoading}
            >
              {actionLoading === "confirmar" ? "…" : "Confirmar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRepeticao(resultado.id)}
              disabled={!!actionLoading}
              title="Solicitar repetição de PCR"
            >
              {actionLoading === "repeticao" ? "…" : "Repetir"}
            </Button>
          </div>
        )}
        {resultado.imutavel && resultado.resultado_final !== "pendente" && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onLiberar(resultado.id)}
            disabled={!!actionLoading}
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
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        ok
          ? "bg-emerald-100 text-emerald-900 border-emerald-300"
          : "bg-red-100 text-red-900 border-red-300"
      }`}
      title={msg}
    >
      {label}: {ok ? "OK" : "FALHOU"}
    </span>
  );
}

function AlertBox({ tipo, children }) {
  const styles = {
    erro: "bg-red-100 text-red-700",
    aviso: "bg-yellow-50 text-amber-900",
    info: "bg-blue-50 text-blue-700",
  };
  const s = styles[tipo] || styles.info;
  return (
    <div className={`px-3.5 py-2 rounded text-sm my-2 ${s}`}>
      {children}
    </div>
  );
}

function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg p-6 w-96 max-w-[95vw] shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// ── Helpers de estilo ──────────────────────────────────────────────────────

const STATUS_LABEL = {
  aberta: "Aberta",
  submetida: "Submetida",
  resultados_importados: "Resultados Importados",
};

