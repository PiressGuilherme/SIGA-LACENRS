import { useState, useRef, useEffect } from "react";
import CrachaModal from "../components/CrachaModal";
import NavigationButtons from "../components/NavigationButtons";
import Button from "../components/Button";
import OperatorBadge from "../components/OperatorBadge";
import { getOperadorInicial, getCsrfToken } from "../utils/auth";

const STATUS_BADGE = {
  aguardando_triagem: { bg: "bg-gray-600", label: "Aguardando Triagem" },
  exame_em_analise: { bg: "bg-cyan-500", label: "Exame em Análise" },
  aliquotada: { bg: "bg-blue-600", label: "Aliquotada" },
  extracao: { bg: "bg-orange-500", label: "Extração" },
  extraida: { bg: "bg-purple-600", label: "Extraída" },
  pcr: { bg: "bg-red-600", label: "PCR em andamento" },
  resultado: { bg: "bg-teal-500", label: "Resultado" },
  resultado_liberado: { bg: "bg-green-600", label: "Resultado Liberado" },
  cancelada: { bg: "bg-red-500", label: "Cancelada" },
  repeticao_solicitada: { bg: "bg-yellow-500", label: "Repetição Solicitada" },
};

export default function Aliquotagem({ csrfToken }) {
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmadas, setConfirmadas] = useState([]);
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const inputRef = useRef();

  // Re-foca o input de amostra após cada ação (se operador validado)
  useEffect(() => {
    if (operador) inputRef.current?.focus();
  }, [confirmadas, feedback, operador]);

  async function handleSubmit(e) {
    e.preventDefault();
    const val = codigo.trim();
    if (!val || !operador) return;

    setCarregando(true);
    setFeedback(null);

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/amostras/receber/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          codigo: val,
          numero_cracha: operador.numero_cracha,
        }),
        credentials: "same-origin",
      });

      const data = await res.json();

      if (data.sucesso) {
        setFeedback({
          tipo: "sucesso",
          msg: `${fmtAmostra(data.amostra)} confirmada.`,
        });
        setConfirmadas((prev) => [
          { ...data.amostra, _operador: operador.nome_completo },
          ...prev,
        ]);
      } else if (data.aviso) {
        setFeedback({
          tipo: "aviso",
          msg: `${fmtAmostra(data.amostra)} — ${data.aviso}`,
        });
      } else {
        setFeedback({ tipo: "erro", msg: data.erro || "Erro desconhecido." });
      }
    } catch (err) {
      setFeedback({ tipo: "erro", msg: `Falha de conexão: ${err.message}` });
    } finally {
      setCodigo("");
      setCarregando(false);
    }
  }

  function limparSessao() {
    setConfirmadas([]);
    setFeedback(null);
  }

  return (
    <div className="font-inherit">
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Aliquotagem" />
      )}

      {/* Barra do operador */}
      <OperatorBadge
        operador={operador}
        onTrocarOperador={() => setOperador(null)}
      />

      <NavigationButtons currentStep="aliquotagem" />

      {/* Input de leitura da amostra */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
        <input
          ref={inputRef}
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Escanear código da amostra..."
          disabled={carregando || !operador}
          autoComplete="off"
          className="flex-1 px-4 py-3 text-lg border-2 border-blue-300 rounded-lg outline-none transition-colors bg-white focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={carregando || !codigo.trim() || !operador}
        >
          {carregando ? "Verificando..." : "Confirmar"}
        </Button>
      </form>

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-md mb-6 ${
            feedback.tipo === "sucesso"
              ? "bg-green-100 text-green-800 border border-green-300"
              : feedback.tipo === "aviso"
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "bg-red-100 text-red-800 border border-red-300"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Contador + limpar */}
      {confirmadas.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="bg-green-100 text-green-800 px-4 py-1.5 rounded-md font-semibold text-sm">
            {confirmadas.length} amostra{confirmadas.length !== 1 ? "s" : ""}{" "}
            aliquotada{confirmadas.length !== 1 ? "s" : ""} nesta sessão
          </span>
          <Button variant="ghost" onClick={limparSessao}>
            Limpar sessão
          </Button>
        </div>
      )}

      {/* Lista de confirmadas */}
      {confirmadas.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-gray-200">
                <th className="p-2.5 text-left font-semibold text-gray-700 whitespace-nowrap text-center">
                  #
                </th>
                <th className="p-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Num. Interno
                </th>
                <th className="p-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Cód. Exame
                </th>
                <th className="p-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Paciente
                </th>
                <th className="p-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Município
                </th>
                <th className="p-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Status
                </th>
                <th className="p-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">
                  Operador
                </th>
              </tr>
            </thead>
            <tbody>
              {confirmadas.map((a, i) => {
                const badge = STATUS_BADGE[a.status] || {
                  bg: "bg-gray-600",
                  label: a.status_display,
                };
                return (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="p-2 text-gray-400 text-center font-medium">
                      {confirmadas.length - i}
                    </td>
                    <td className="p-2 text-gray-700 font-semibold">
                      {a.codigo_interno || "—"}
                    </td>
                    <td className="p-2 text-gray-700">{a.cod_exame_gal}</td>
                    <td className="p-2 text-gray-700">{a.nome_paciente}</td>
                    <td className="p-2 text-gray-700">{a.municipio || "—"}</td>
                    <td className="p-2 text-gray-700">
                      <span
                        className={`${badge.bg} text-white px-2 py-1 rounded text-xs font-medium inline-block`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-2 text-gray-500 text-xs">
                      {a._operador || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function fmtAmostra(a) {
  const id = a.codigo_interno || a.cod_exame_gal;
  return `${id} — ${a.nome_paciente}`;
}
