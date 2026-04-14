import { useEffect, useState } from "react";
import api from "../services/api";
import CrachaModal from "../components/CrachaModal";
import { getOperadorInicial, getCsrfToken } from "../utils/auth";
import FeedbackBlock from "../components/FeedbackBlock";

// ---------------------------------------------------------------------------
// Tab: Configuração
// ---------------------------------------------------------------------------
export function TabConfiguracao({ csrf }) {
  const [form, setForm] = useState({
    usuario: "",
    senha: "",
    codigo_laboratorio: "",
    url_ws: "",
    verificar_ssl: false,
  });
  const [senhaConfigurada, setSenhaConfigurada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api
      .get("/gal-ws/configuracao/", {
        headers: { "X-CSRFToken": getCsrfToken() },
      })
      .then((r) => {
        const d = r.data;
        setForm((f) => ({
          ...f,
          usuario: d.usuario || "",
          codigo_laboratorio: d.codigo_laboratorio || "",
          url_ws: d.url_ws || "",
          verificar_ssl: d.verificar_ssl || false,
        }));
        setSenhaConfigurada(d.senha_configurada);
      })
      .catch(() =>
        setMsg({ tipo: "erro", texto: "Erro ao carregar configuração." }),
      );
  }, []);

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      await api.post("/gal-ws/configuracao/", form, {
        headers: { "X-CSRFToken": getCsrfToken() },
      });
      setMsg({ tipo: "ok", texto: "Configuração salva com sucesso." });
      if (form.senha) setSenhaConfigurada(true);
      setForm((f) => ({ ...f, senha: "" }));
    } catch (err) {
      setMsg({
        tipo: "erro",
        texto: err.response?.data?.erro || "Erro ao salvar.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-base font-bold text-lacen-secondary mb-4">
          Credenciais e Endpoint
        </h3>
        <form onSubmit={salvar}>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            URL do WebService
          </label>
          <input
            className="w-full px-3 py-2 rounded border border-gray-300 text-sm mb-3 box-border"
            value={form.url_ws}
            onChange={(e) => set("url_ws", e.target.value)}
            placeholder="https://..."
          />

          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Usuário GAL
          </label>
          <input
            className="w-full px-3 py-2 rounded border border-gray-300 text-sm mb-3 box-border"
            value={form.usuario}
            onChange={(e) => set("usuario", e.target.value)}
            placeholder="usuario_integracao"
          />

          <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-2">
            Senha GAL
            {senhaConfigurada ? (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                configurada
              </span>
            ) : (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900">
                não configurada
              </span>
            )}
          </label>
          <input
            className="w-full px-3 py-2 rounded border border-gray-300 text-sm mb-3 box-border"
            type="password"
            value={form.senha}
            onChange={(e) => set("senha", e.target.value)}
            placeholder={
              senhaConfigurada
                ? "Deixe em branco para manter a atual"
                : "Nova senha"
            }
          />

          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Código do Laboratório
          </label>
          <input
            className="w-full px-3 py-2 rounded border border-gray-300 text-sm mb-3 box-border"
            value={form.codigo_laboratorio}
            onChange={(e) => set("codigo_laboratorio", e.target.value)}
            placeholder="Ex: LACEN-RS ou código numérico do GAL"
          />

          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-4">
            <input
              type="checkbox"
              checked={form.verificar_ssl}
              onChange={(e) => set("verificar_ssl", e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Verificar certificado SSL
          </label>

          <button
            type="submit"
            disabled={salvando}
            className={`px-5 py-2 rounded border-none bg-lacen-secondary text-white font-semibold cursor-pointer text-sm ${
              salvando ? "opacity-50 cursor-not-allowed" : "hover:bg-opacity-90"
            }`}
          >
            {salvando ? "Salvando..." : "Salvar Configuração"}
          </button>
        </form>
      </div>

      <FeedbackBlock feedback={msg} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Testar Conexão
// ---------------------------------------------------------------------------
export function TabTestarConexao({ csrf }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function testar() {
    setTestando(true);
    setResultado(null);
    try {
      const r = await api.post(
        "/gal-ws/testar-conexao/",
        {},
        {
          headers: { "X-CSRFToken": getCsrfToken() },
        },
      );
      setResultado({ tipo: "ok", texto: r.data.mensagem });
    } catch (err) {
      setResultado({
        tipo: "erro",
        texto: err.response?.data?.erro || "Erro na conexão.",
      });
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h3 className="text-base font-bold text-lacen-secondary mb-4">
        Testar Conexão com GAL-WS
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Clique no botão abaixo para verificar se a conexão está funcionando.
      </p>
      <button
        onClick={testar}
        disabled={testando}
        className={`px-5 py-2 rounded border-none bg-blue-600 text-white font-semibold cursor-pointer text-sm ${
          testando ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
        }`}
      >
        {testando ? "Testando..." : "Testar Conexão"}
      </button>

      <FeedbackBlock feedback={resultado} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Buscar Exames
// ---------------------------------------------------------------------------
export function TabBuscarExames({ csrf }) {
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [registros, setRegistros] = useState([]);

  async function buscar() {
    setBuscando(true);
    setResultado(null);
    setRegistros([]);
    try {
      const r = await api.get("/gal-ws/buscar-exames/", {
        headers: { "X-CSRFToken": getCsrfToken() },
      });
      setRegistros(r.data.registros || []);
      setResultado({
        tipo: "ok",
        texto: `${r.data.total || 0} exames encontrados.`,
      });
    } catch (err) {
      setResultado({
        tipo: "erro",
        texto: err.response?.data?.erro || "Erro ao buscar exames.",
      });
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <h3 className="text-base font-bold text-lacen-secondary mb-4">
          Buscar Exames do GAL
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Sincronize os últimos exames disponíveis no servidor GAL.
        </p>
        <button
          onClick={buscar}
          disabled={buscando}
          className={`px-5 py-2 rounded border-none bg-green-600 text-white font-semibold cursor-pointer text-sm ${
            buscando ? "opacity-50 cursor-not-allowed" : "hover:bg-green-700"
          }`}
        >
          {buscando ? "Buscando..." : "Buscar Exames"}
        </button>
      </div>

      <FeedbackBlock feedback={resultado} />

      {registros.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                  Amostra
                </th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                  Data
                </th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-800">
                    {r.amostra_codigo}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-800">{r.status}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {r.data_hora}
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

// ---------------------------------------------------------------------------
// Componente principal: GalWs
// ---------------------------------------------------------------------------
export default function GalWs() {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [abaAtiva, setAbaAtiva] = useState("config");
  const csrf = getCsrfToken();

  return (
    <div>
      {!operador && (
        <CrachaModal
          onValidado={setOperador}
          modulo="Configurações — GAL WebService"
        />
      )}

      {operador && (
        <>
          <div className="flex items-center gap-3 bg-green-50 border border-green-400 rounded-lg px-4 py-2 mb-4">
            <span className="text-sm text-green-800 font-semibold">
              Operador: {operador.nome_completo}
            </span>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
              {operador.perfil}
            </span>
            <button
              onClick={() => setOperador(null)}
              className="ml-auto bg-transparent border border-green-400 rounded px-3 py-1 text-xs text-green-800 cursor-pointer font-medium hover:bg-green-100 transition-colors"
            >
              Trocar operador
            </button>
          </div>

          <div className="flex gap-1 mb-6 flex-wrap">
            <button
              onClick={() => setAbaAtiva("config")}
              className={`px-4 py-2 rounded text-sm font-semibold border-2 transition-colors ${
                abaAtiva === "config"
                  ? "bg-lacen-secondary text-white border-lacen-secondary"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              }`}
            >
              Configuração
            </button>
            <button
              onClick={() => setAbaAtiva("testar")}
              className={`px-4 py-2 rounded text-sm font-semibold border-2 transition-colors ${
                abaAtiva === "testar"
                  ? "bg-lacen-secondary text-white border-lacen-secondary"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              }`}
            >
              Testar Conexão
            </button>
            <button
              onClick={() => setAbaAtiva("buscar")}
              className={`px-4 py-2 rounded text-sm font-semibold border-2 transition-colors ${
                abaAtiva === "buscar"
                  ? "bg-lacen-secondary text-white border-lacen-secondary"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              }`}
            >
              Buscar Exames
            </button>
          </div>

          {abaAtiva === "config" && <TabConfiguracao csrf={csrf} />}
          {abaAtiva === "testar" && <TabTestarConexao csrf={csrf} />}
          {abaAtiva === "buscar" && <TabBuscarExames csrf={csrf} />}
        </>
      )}
    </div>
  );
}
