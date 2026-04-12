import { useState, useRef, useEffect } from "react";
import CrachaModal from "../components/CrachaModal";
import Button from "../components/Button";
import { getOperadorInicial } from "../utils/auth";
import apiFetch from "../utils/apiFetch";
import FeedbackBlock from "../components/FeedbackBlock";
import PlacaMiniGrid from "../components/plates/PlacaMiniGrid";
import { MINI_THEMES } from "../components/plates/PlateConstants";

const api = (url, { csrfToken: _csrf, ...opts } = {}) => apiFetch(url, opts);

const THEME = MINI_THEMES.extracao;

function LinhaPlaca({ p, onConfirmar }) {
  const [aberta, setAberta] = useState(false);

  const amostras = (p.pocos || [])
    .filter((w) => w.tipo_conteudo === "amostra" && w.amostra_codigo)
    .sort((a, b) => a.posicao.localeCompare(b.posicao));

  return (
    <>
      <tr
        onClick={() => setAberta((v) => !v)}
        className={`cursor-pointer transition-colors ${
          aberta
            ? `${THEME.rowBg} border-b-0`
            : "border-b border-gray-200 hover:bg-gray-50"
        }`}
      >
        <td className="px-3 py-2 text-gray-700 font-semibold">
          <span className="mr-1 text-xs text-gray-500">
            {aberta ? "▼" : "▶"}
          </span>
          {p.codigo}
        </td>
        <td className="px-3 py-2 text-gray-700">{p.total_amostras}</td>
        <td className="px-3 py-2 text-gray-700">{p.responsavel_nome || "—"}</td>
        <td className="px-3 py-2 text-gray-700">{fmtDate(p.data_criacao)}</td>
        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              onConfirmar(p.codigo);
            }}
          >
            Confirmar Extração
          </Button>
        </td>
      </tr>

      {aberta && (
        <tr className={`border-b border-gray-200 ${THEME.rowBg}`}>
          <td colSpan={5} className="p-4">
            <div className="mb-3 flex gap-4 flex-wrap items-center">
              {[
                { tipo: "amostra", label: "Amostra" },
                { tipo: "controle_positivo", label: "CP" },
                { tipo: "controle_negativo", label: "CN" },
                { tipo: "vazio", label: "Vazio" },
              ].map(({ tipo, label }) => {
                const cor = THEME[tipo];
                return (
                  <span
                    key={tipo}
                    className="flex items-center gap-1 text-xs text-gray-700"
                  >
                    <span
                      className={`inline-block w-3 h-3 rounded ${cor.bg} ${cor.border} border`}
                    />
                    {label}
                  </span>
                );
              })}
              <span className="text-xs text-gray-400 ml-auto">
                Passe o mouse sobre uma célula para ver o nome da paciente
              </span>
            </div>

            <PlacaMiniGrid pocos={p.pocos || []} theme={THEME} />

            {amostras.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-purple-600 font-medium select-none hover:text-purple-700">
                  Lista de amostras ({amostras.length})
                </summary>
                <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-y-1 gap-x-4 text-xs text-gray-700">
                  {amostras.map((w) => (
                    <div key={w.id} className="flex gap-1">
                      <span className="text-gray-400 min-w-7">
                        {w.posicao}
                      </span>
                      <span className="font-semibold text-blue-900 min-w-16">
                        {w.amostra_codigo}
                      </span>
                      <span className="text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">
                        {w.amostra_nome || ""}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function ConfirmarExtracao({ csrfToken }) {
  const [placas, setPlacas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [codigoExtracao, setCodigoExtracao] = useState("");
  const [feedbackExtracao, setFeedbackExtracao] = useState(null);
  const [amostrasExtraidas, setAmostrasExtraidas] = useState([]);
  const [carregandoExtracao, setCarregandoExtracao] = useState(false);
  const extracaoRef = useRef();

  useEffect(() => {
    fetchPlacas();
  }, []);
  useEffect(() => {
    if (!carregandoExtracao) extracaoRef.current?.focus();
  }, [carregandoExtracao]);

  async function fetchPlacas(s = search) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("tipo_placa", "extracao");
      params.append("status_placa", "aberta");
      if (s.trim()) params.append("search", s.trim());
      const data = await api(`/api/placas/?${params}`, { csrfToken });
      setPlacas(data.results || data);
    } catch {
      setPlacas([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    const val = e.target.value;
    setSearch(val);
    fetchPlacas(val);
  }

  async function handleConfirmarExtracao(placaCodigo) {
    const val = placaCodigo || codigoExtracao.trim();
    if (!val) return;
    setCarregandoExtracao(true);
    setFeedbackExtracao(null);
    setAmostrasExtraidas([]);
    try {
      const body = { codigo: val };
      if (operador) body.numero_cracha = operador.numero_cracha;
      const data = await api("/api/placas/confirmar-extracao/", {
        csrfToken,
        method: "POST",
        body,
      });
      const pocos = data.placa?.pocos || [];
      const codigos = pocos
        .filter((p) => p.tipo_conteudo === "amostra" && p.amostra_codigo)
        .map((p) => p.amostra_codigo)
        .sort();
      setAmostrasExtraidas(codigos);
      setFeedbackExtracao({
        tipo: "sucesso",
        msg: `Placa ${val} — ${codigos.length} amostra${codigos.length !== 1 ? "s" : ""} marcada${codigos.length !== 1 ? "s" : ""} como Extraída.`,
      });
      fetchPlacas();
    } catch (err) {
      setFeedbackExtracao({
        tipo: "erro",
        msg: err.data?.erro || "Placa não encontrada ou já processada.",
      });
    } finally {
      setCodigoExtracao("");
      setCarregandoExtracao(false);
    }
  }

  return (
    <div>
      {!operador && (
        <CrachaModal
          onValidado={(op) => {
            setOperador(op);
            setTimeout(() => extracaoRef.current?.focus(), 100);
          }}
          modulo="Confirmar Extração"
        />
      )}

      {operador && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 mb-7">
          <h3 className="text-base text-purple-700 mb-3 font-semibold">
            Confirmar Extração
          </h3>

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

          <p className="text-gray-600 text-sm mb-3">
            Escaneie o código de barras da placa após a extração de DNA para
            marcar todas as amostras como <b>Extraída</b>.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmarExtracao();
            }}
            className="flex gap-2 mb-3 max-w-md"
          >
            <input
              ref={extracaoRef}
              type="text"
              value={codigoExtracao}
              onChange={(e) => setCodigoExtracao(e.target.value)}
              placeholder="Escanear código da placa..."
              disabled={carregandoExtracao}
              autoComplete="off"
              className="flex-1 px-3 py-2 text-base border-2 border-purple-300 rounded outline-none focus:border-purple-500 disabled:bg-gray-100"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={carregandoExtracao || !codigoExtracao.trim()}
            >
              {carregandoExtracao ? "Confirmando..." : "Confirmar"}
            </Button>
          </form>

          {feedbackExtracao && (
            <div className="rounded-lg overflow-hidden">
              <FeedbackBlock feedback={feedbackExtracao} />
              {feedbackExtracao.tipo === "sucesso" &&
                amostrasExtraidas.length > 0 && (
                  <div className="p-3 bg-green-50 border-t border-green-200 text-xs text-green-700">
                    <b>Amostras extraídas:</b> {amostrasExtraidas.join(", ")}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar por código (ex: PL2603)"
            className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <Button variant="ghost" onClick={() => fetchPlacas()}>
            Atualizar
          </Button>
        </div>

        <p className="text-gray-600 text-sm mb-4">
          Placas com status <b>Aberta</b> aguardando confirmação de extração.
        </p>

        {loading ? (
          <p className="text-gray-600 py-4">Carregando...</p>
        ) : placas.length === 0 ? (
          <p className="text-gray-400 py-4">
            Nenhuma placa pendente de confirmação.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Código</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Amostras</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Responsável</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Data</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">Ação</th>
                </tr>
              </thead>
              <tbody>
                {placas.map((p) => (
                  <LinhaPlaca
                    key={p.id}
                    p={p}
                    onConfirmar={handleConfirmarExtracao}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
