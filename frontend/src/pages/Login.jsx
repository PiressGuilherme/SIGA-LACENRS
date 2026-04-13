import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Aba: email + senha
// ---------------------------------------------------------------------------
function TabEmail({ onSuccess, csrf }) {
  const [form, setForm] = useState({ email: "", senha: "" });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch("/api/auth/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrf || ""
        },
        body: JSON.stringify({ email: form.email, senha: form.senha }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 403 Forbidden geralmente indica erro de CSRF token
        if (res.status === 403) {
          console.error(
            "[SIGA Login] 403 Forbidden — Possível erro de CSRF token. " +
            "Recarregue a página e tente novamente."
          );
          setErro(
            "Erro de segurança (CSRF). Recarregue a página e tente novamente."
          );
        } else {
          setErro(data.erro || `Erro ${res.status} ao autenticar.`);
        }
        return;
      }
      onSuccess(data);
    } catch (err) {
      console.error("[SIGA Login] Erro de rede:", err);
      setErro("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={submeter}>
      {erro && (
        <div className="bg-red-50 text-red-800 rounded-lg p-2.5 text-sm mb-4">
          {erro}
        </div>
      )}

      <label className="block text-xs font-semibold text-gray-700 mb-1">
        E-mail
      </label>
      <input
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm mb-4 outline-none focus:border-red-700 transition-colors"
        type="email"
        autoFocus
        autoComplete="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        placeholder="seu@email.com"
        required
      />

      <label className="block text-xs font-semibold text-gray-700 mb-1">
        Senha
      </label>
      <input
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm mb-4 outline-none focus:border-red-700 transition-colors"
        type="password"
        autoComplete="current-password"
        value={form.senha}
        onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
        placeholder="••••••••"
        required
      />

      <button
        type="submit"
        disabled={carregando}
        className="w-full py-3 bg-red-800 text-white rounded-lg text-base font-bold mt-1 cursor-pointer transition-colors hover:bg-red-900 disabled:opacity-70"
      >
        {carregando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Aba: crachá
// ---------------------------------------------------------------------------
function TabCracha({ onSuccess, csrf }) {
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [buffer, setBuffer] = useState("");
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Foca o input oculto ao ativar a aba
  useEffect(() => {
    if (lendo) inputRef.current?.focus();
  }, [lendo]);

  function ativar() {
    setErro("");
    setBuffer("");
    setLendo(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Leitores de barcode enviam os caracteres rapidamente e terminam com Enter.
  // Capturamos via keydown no input oculto.
  function handleKeyDown(e) {
    if (!lendo) return;
    clearTimeout(timerRef.current);

    if (e.key === "Enter") {
      const numero = buffer.trim();
      setBuffer("");
      if (numero) autenticar(numero);
      return;
    }

    if (e.key.length === 1) {
      setBuffer((b) => b + e.key);
      // Timeout: se o leitor parar de enviar por 300ms, tenta com o que tem
      timerRef.current = setTimeout(() => {
        const numero = buffer.trim() + e.key;
        setBuffer("");
        if (numero) autenticar(numero);
      }, 300);
    }
  }

  async function autenticar(numero) {
    setLendo(false);
    setErro("");
    try {
      const res = await fetch("/api/auth/login-cracha/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrf || ""
        },
        body: JSON.stringify({ numero_cracha: numero }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          console.error("[SIGA Cracha] 403 Forbidden — Possível erro de CSRF.");
          setErro(
            "Erro de segurança (CSRF). Recarregue a página e tente novamente."
          );
        } else {
          setErro(data.erro || `Erro ${res.status} ao autenticar.`);
        }
      } else {
        onSuccess(data);
      }
    } catch (err) {
      console.error("[SIGA Cracha] Erro de rede:", err);
      setErro("Não foi possível conectar ao servidor.");
    }
  }

  return (
    <div className="text-center py-2 pb-4">
      {erro && (
        <div className="bg-red-50 text-red-800 rounded-lg p-2.5 text-sm mb-4 text-left">
          {erro}
        </div>
      )}

      <div className="text-5xl mb-2 opacity-85">ID</div>

      <p className="text-sm text-gray-500 leading-6 mb-5">
        {lendo
          ? "Passe o crachá no leitor agora…"
          : "Clique no botão abaixo e passe o crachá no leitor."}
      </p>

      <button
        type="button"
        onClick={ativar}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 text-sm font-semibold cursor-pointer transition-all ${
          lendo
            ? "border-red-800 bg-red-50 text-red-800"
            : "border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400"
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full transition-all ${
            lendo
              ? "bg-green-500 shadow-[0_0_0_3px] shadow-green-200"
              : "bg-gray-300"
          }`}
        />
        {lendo ? "Aguardando leitura…" : "Ativar leitor de crachá"}
      </button>

      {/* Input oculto que captura o barcode */}
      <input
        ref={inputRef}
        className="absolute -left-[9999px] opacity-0 w-0.5 h-0.5"
        onKeyDown={handleKeyDown}
        onBlur={() => setLendo(false)}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function Login({ csrfToken, nextUrl }) {
  const [aba, setAba] = useState("email");

  function onSuccess({ access, refresh, usuario }) {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    localStorage.setItem("usuario", JSON.stringify(usuario));
    window.location.href = nextUrl || "/";
  }

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div className="bg-white rounded-2xl shadow-[0_4px_32px_rgba(92,10,20,0.15)] overflow-hidden">
        <div className="bg-red-800 px-8 pt-8 pb-6 text-center text-white">
          <div className="text-3xl mb-2">SIGA</div>
          <div className="text-xl font-bold tracking-wider">SIGA-LACEN</div>
          <div className="text-xs text-red-200 mt-1">
            Sistema de Informação e Gerenciamento de Amostras
          </div>
          <div className="text-xs text-red-200 mt-0.5">
            Laboratório de HPV · LACEN-RS / CEVS
          </div>
        </div>

        <div className="p-7">
          <div className="flex border-b-2 border-gray-200 mb-6">
            <button
              onClick={() => setAba("email")}
              className={`flex-1 py-2.5 border-none bg-transparent cursor-pointer text-sm font-semibold border-b-2 -mb-0.5 transition-colors ${
                aba === "email"
                  ? "text-red-800 border-red-800"
                  : "text-gray-400 border-transparent hover:text-gray-600"
              }`}
            >
              E-mail e Senha
            </button>
            <button
              onClick={() => setAba("cracha")}
              className={`flex-1 py-2.5 border-none bg-transparent cursor-pointer text-sm font-semibold border-b-2 -mb-0.5 transition-colors ${
                aba === "cracha"
                  ? "text-red-800 border-red-800"
                  : "text-gray-400 border-transparent hover:text-gray-600"
              }`}
            >
              Crachá
            </button>
          </div>

          {aba === "email" && (
            <TabEmail onSuccess={onSuccess} csrf={csrfToken} />
          )}
          {aba === "cracha" && (
            <TabCracha onSuccess={onSuccess} csrf={csrfToken} />
          )}
        </div>

        {/* Faixa tricolor — bandeira do RS */}
        <div className="flex h-1.5">
          <div className="flex-1 bg-red-600" />
          <div className="flex-1 bg-yellow-400" />
          <div className="flex-1 bg-green-600" />
        </div>
      </div>

      <p className="text-center mt-5 text-xs text-gray-400">
        LACEN-RS · CEVS · Secretaria da Saúde do RS
      </p>
    </div>
  );
}
