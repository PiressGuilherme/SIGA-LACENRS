import { useState, useRef, useEffect } from "react";
import Button from "../design-system/components/Button";
import StatusBadge from "../design-system/components/StatusBadge";
import CrachaModal from "../components/CrachaModal";
import NavigationButtons from "../components/NavigationButtons";
import { getOperadorInicial, getCsrfToken } from "../utils/auth";

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
        setFeedback({
          tipo: "erro",
          msg: data.erro || "Erro desconhecido.",
        });
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
    <div>
      <NavigationButtons currentStep="aliquotagem" />

      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="Aliquotagem" />
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
          className="flex-1 px-4 py-3 text-lg border-2 border-neutral-300 rounded-lg outline-none transition-colors focus:border-rs-red bg-white"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={carregando}
          disabled={!codigo.trim() || !operador}
        >
          {carregando ? "Verificando..." : "Confirmar"}
        </Button>
      </form>

      {/* Feedback */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-md mb-6 ${
            feedback.tipo === "sucesso"
              ? "bg-success-50 text-success-700 border border-success-200"
              : feedback.tipo === "aviso"
                ? "bg-warning-50 text-warning-700 border border-warning-200"
                : "bg-danger-50 text-danger-700 border border-danger-200"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Contador + limpar */}
      {confirmadas.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <span className="bg-success-50 text-success-700 px-4 py-1.5 rounded-md font-semibold text-sm">
            {confirmadas.length} amostra
            {confirmadas.length !== 1 ? "s" : ""} aliquotada
            {confirmadas.length !== 1 ? "s" : ""} nesta sessão
          </span>
          <Button onClick={limparSessao} variant="outline" size="sm">
            Limpar sessão
          </Button>
        </div>
      )}

      {/* Lista de confirmadas */}
      {confirmadas.length > 0 && (
        <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b-2 border-neutral-200">
                <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                  #
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                  Num. Interno
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                  Cód. Exame
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                  Paciente
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                  Município
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-neutral-700 whitespace-nowrap">
                  Operador
                </th>
              </tr>
            </thead>
            <tbody>
              {confirmadas.map((a, i) => (
                <tr key={a.id} className="border-b border-neutral-100">
                  <td className="px-3 py-2 text-neutral-400 text-center">
                    {confirmadas.length - i}
                  </td>
                  <td className="px-3 py-2 text-neutral-700 font-semibold">
                    {a.codigo_interno || "—"}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {a.cod_exame_gal}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {a.nome_paciente}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {a.municipio || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {a._operador || "—"}
                  </td>
                </tr>
              ))}
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
