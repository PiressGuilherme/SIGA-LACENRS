import { useEffect, useState } from "react";
import Button from "../design-system/components/Button";
import api from "../services/api";
import CrachaModal from "../components/CrachaModal";
import { getOperadorInicial, getCsrfToken } from "../utils/auth";

const STATUS = { idle: "idle", loading: "loading", ok: "ok", erro: "erro" };

// ---------------------------------------------------------------------------
// Tab: Configuração
// ---------------------------------------------------------------------------
function TabConfiguracao({ csrf }) {
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
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h3 className="text-base font-bold text-rs-red mb-4">
          Credenciais e Endpoint
        </h3>
        <form onSubmit={salvar}>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            URL do WebService
          </label>
          <input
            className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm mb-3 box-border"
            value={form.url_ws}
            onChange={(e) => set("url_ws", e.target.value)}
            placeholder="https://..."
          />

          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            Usuário GAL
          </label>
          <input
            className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm mb-3 box-border"
            value={form.usuario}
            onChange={(e) => set("usuario", e.target.value)}
            placeholder="usuario_integracao"
          />

          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            Senha GAL{" "}
            {senhaConfigurada ? (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-50 text-success-700">
                configurada
              </span>
            ) : (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger-50 text-danger-700">
                não configurada
              </span>
            )}
          </label>
          <input
            className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm mb-3 box-border"
            type="password"
            value={form.senha}
            onChange={(e) => set("senha", e.target.value)}
            placeholder={
              senhaConfigurada
                ? "Deixe em branco para manter a atual"
                : "Nova senha"
            }
          />

          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            Código do Laboratório
          </label>
          <input
            className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm mb-3 box-border"
            value={form.codigo_laboratorio}
            onChange={(e) => set("codigo_laboratorio", e.target.value)}
            placeholder="Ex: LACEN-RS ou código numérico do GAL"
          />

          <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 mb-4">
            <input
              type="checkbox"
              checked={form.verificar_ssl}
              onChange={(e) => set("verificar_ssl", e.target.checked)}
              className="rounded"
            />
            Verificar certificado SSL{" "}
            <span className="text-neutral-500 font-normal">
              (desative se o servidor GAL usar certificado auto-assinado)
            </span>
          </label>

          {msg && (
            <div
              className={`px-4 py-2.5 rounded-md mb-4 text-sm ${
                msg.tipo === "ok"
                  ? "bg-success-50 text-success-700"
                  : "bg-danger-50 text-danger-700"
              }`}
            >
              {msg.texto}
            </div>
          )}

          <Button type="submit" variant="primary" size="md" loading={salvando}>
            {salvando ? "Salvando…" : "Salvar Configuração"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Testar Conexão
// ---------------------------------------------------------------------------
function TabTestarConexao({ csrf }) {
  const [st, setSt] = useState(STATUS.idle);
  const [resultado, setResultado] = useState(null);

  async function testar() {
    setSt(STATUS.loading);
    setResultado(null);
    try {
      const r = await api.post(
        "/gal-ws/testar-conexao/",
        {},
        { headers: { "X-CSRFToken": getCsrfToken() } },
      );
      setResultado({ ok: true, data: r.data });
      setSt(STATUS.ok);
    } catch (err) {
      setResultado({
        ok: false,
        data: err.response?.data || { erro: "Sem resposta do servidor." },
      });
      setSt(STATUS.erro);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-base font-bold text-rs-red mb-4">
        Testar Conexão com o GAL WS
      </h3>
      <p className="text-sm text-neutral-500 mb-4">
        Executa em sequência: <code className="font-mono">autenticacao</code> →{" "}
        <code className="font-mono">mensagem</code> →{" "}
        <code className="font-mono">validaData</code>
      </p>
      <Button
        onClick={testar}
        variant="primary"
        size="md"
        loading={st === STATUS.loading}
      >
        {st === STATUS.loading ? "Testando…" : "▶ Testar Agora"}
      </Button>

      {resultado && (
        <div className="mt-5">
          <div
            className={`px-4 py-2 rounded-md mb-3 font-bold text-sm ${
              resultado.ok
                ? "bg-success-50 text-success-700"
                : "bg-danger-50 text-danger-700"
            }`}
          >
            {resultado.ok ? "✓ Conexão bem-sucedida" : "✗ Falha na conexão"}
          </div>
          <ResultRow label="Autenticação" value={resultado.data.autenticacao} />
          {resultado.data.token_prefixo && (
            <ResultRow
              label="Token (prefixo)"
              value={resultado.data.token_prefixo}
            />
          )}
          {resultado.data.mensagem && (
            <ResultRow label="mensagem()" value={resultado.data.mensagem} />
          )}
          {resultado.data.valida_data && (
            <ResultRow
              label="validaData()"
              value={resultado.data.valida_data}
            />
          )}
          {resultado.data.erro && (
            <ResultRow label="Erro" value={resultado.data.erro} erro />
          )}
          {resultado.data.etapa && (
            <ResultRow label="Etapa" value={resultado.data.etapa} />
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ label: l, value, erro }) {
  return (
    <div className="flex gap-4 py-1.5 border-b border-neutral-100 text-sm items-start">
      <span className="min-w-[160px] text-neutral-500 font-semibold">{l}</span>
      <span
        className={`font-mono ${erro ? "text-danger-600" : "text-neutral-900"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Buscar Exames
// ---------------------------------------------------------------------------
function TabBuscarExames({ csrf }) {
  const [laboratorio, setLaboratorio] = useState("");
  const [st, setSt] = useState(STATUS.idle);
  const [resultado, setResultado] = useState(null);

  async function buscar() {
    setSt(STATUS.loading);
    setResultado(null);
    try {
      const r = await api.post(
        "/gal-ws/buscar-exames/",
        { laboratorio },
        { headers: { "X-CSRFToken": getCsrfToken() } },
      );
      setResultado({ ok: true, data: r.data });
      setSt(STATUS.ok);
    } catch (err) {
      setResultado({
        ok: false,
        data: err.response?.data || { erro: "Sem resposta." },
      });
      setSt(STATUS.erro);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-base font-bold text-rs-red mb-4">
        Buscar Exames Pendentes
      </h3>
      <p className="text-sm text-neutral-500 mb-4">
        Chama <code className="font-mono">buscarExames(laboratorio)</code> no
        GAL WS. O retorno bruto é exibido para inspeção do schema antes de
        implementar a importação automática. Se o campo estiver vazio, usa o
        código configurado na aba Configuração.
      </p>

      <div className="flex gap-3 mb-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            Código do Laboratório
          </label>
          <input
            className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm mb-0 box-border"
            value={laboratorio}
            onChange={(e) => setLaboratorio(e.target.value)}
            placeholder="Deixe vazio para usar o código configurado"
          />
        </div>
        <Button
          onClick={buscar}
          variant="primary"
          size="md"
          loading={st === STATUS.loading}
        >
          {st === STATUS.loading ? "Buscando…" : "🔍 Buscar"}
        </Button>
      </div>

      {resultado && (
        <div className="mt-3">
          {resultado.ok ? (
            <>
              <div className="px-4 py-2 rounded-md mb-3 bg-success-50 text-success-700 font-bold text-sm">
                ✓ {resultado.data.total} exame
                {resultado.data.total !== 1 ? "s" : ""} encontrado
                {resultado.data.total !== 1 ? "s" : ""}
                {resultado.data.laboratorio &&
                  ` — ${resultado.data.laboratorio}`}
              </div>
              <pre className="bg-neutral-50 border border-neutral-200 rounded-md p-4 text-xs overflow-x-auto max-h-[400px] whitespace-pre-wrap break-all">
                {JSON.stringify(resultado.data.exames, null, 2)}
              </pre>
            </>
          ) : (
            <div className="px-4 py-2.5 rounded-md bg-danger-50 text-danger-700 text-sm">
              ✗ {resultado.data.erro}
              {resultado.data.etapa && (
                <span className="ml-2 opacity-70">
                  ({resultado.data.etapa})
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
const TABS = [
  { id: "config", label: "⚙ Configuração" },
  { id: "testar", label: "🔌 Testar Conexão" },
  { id: "exames", label: "📋 Buscar Exames" },
];

export default function GalWs({ csrfToken }) {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [aba, setAba] = useState("config");

  return (
    <div className="max-w-[760px]">
      {/* Modal bloqueante de identificação */}
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="GAL WebService" />
      )}

      <div className="mb-6">
        <h2 className="text-xl text-rs-red mb-1 font-bold">
          Integração GAL WebService
        </h2>
        <p className="text-neutral-500 text-sm">
          Configure e teste a conexão direta com o sistema GAL do Rio Grande do
          Sul.
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-6 border-b-2 border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`px-5 py-2 border-none bg-none cursor-pointer text-sm font-semibold transition-colors ${
              aba === t.id
                ? "text-rs-red border-b-2 border-rs-red -mb-0.5"
                : "text-neutral-500 border-b-2 border-transparent -mb-0.5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === "config" && <TabConfiguracao csrf={csrfToken} />}
      {aba === "testar" && <TabTestarConexao csrf={csrfToken} />}
      {aba === "exames" && <TabBuscarExames csrf={csrfToken} />}
    </div>
  );
}
