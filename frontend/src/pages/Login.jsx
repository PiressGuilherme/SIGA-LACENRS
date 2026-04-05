import { useEffect, useRef, useState } from "react";
import Button from "../design-system/components/Button";
import { getCsrfToken } from "../utils/auth";

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
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify({ email: form.email, senha: form.senha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || "Erro ao autenticar.");
        return;
      }
      onSuccess(data);
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={submeter}>
      {erro && (
        <div className="bg-danger-50 text-danger-700 rounded-lg px-3.5 py-2.5 text-sm mb-4">
          {erro}
        </div>
      )}
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        E-mail
      </label>
      <input
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm mb-4 outline-none transition-colors focus:border-rs-red focus:ring-1 focus:ring-rs-red"
        type="email"
        autoFocus
        autoComplete="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        placeholder="seu@email.com"
        required
      />
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        Senha
      </label>
      <input
        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm mb-4 outline-none transition-colors focus:border-rs-red focus:ring-1 focus:ring-rs-red"
        type="password"
        autoComplete="current-password"
        value={form.senha}
        onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
        placeholder="••••••••"
        required
      />
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={carregando}
        className="w-full"
      >
        {carregando ? "Entrando…" : "Entrar"}
      </Button>
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
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify({ numero_cracha: numero }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || "Crachá não reconhecido.");
      } else {
        onSuccess(data);
      }
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    }
  }

  return (
    <div className="text-center py-2 pb-4">
      {erro && (
        <div className="bg-danger-50 text-danger-700 rounded-lg px-3.5 py-2.5 text-sm mb-4 text-left">
          {erro}
        </div>
      )}

      <div className="text-5xl mb-2 opacity-85">ID</div>
      <p className="text-sm text-gray-500 leading-relaxed mb-5">
        {lendo
          ? "Passe o crachá no leitor agora…"
          : "Clique no botão abaixo e passe o crachá no leitor."}
      </p>

      <button
        type="button"
        onClick={ativar}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 text-sm font-semibold cursor-pointer transition-all ${
          lendo
            ? "border-rs-red bg-danger-50 text-rs-red"
            : "border-neutral-300 bg-neutral-50 text-neutral-500 hover:border-neutral-400"
        }`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full transition-all ${
            lendo
              ? "bg-success-500 shadow-[0_0_0_3px_rgba(34,197,94,0.3)]"
              : "bg-neutral-300"
          }`}
        />
        {lendo ? "Aguardando leitura…" : "Ativar leitor de crachá"}
      </button>

      {/* Input oculto que captura o barcode */}
      <input
        ref={inputRef}
        className="absolute left-[-9999px] opacity-0 w-px h-px"
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
    <div className="w-full max-w-[420px] px-4">
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {/* Header */}
        <div className="bg-rs-red px-8 py-8 text-center text-white">
          <div className="text-4xl mb-2">SIGA</div>
          <div className="text-lg font-bold tracking-wide">SIGA-LACEN</div>
          <div className="text-xs text-red-200 mt-1">
            Sistema de Informação e Gerenciamento de Amostras
          </div>
          <div className="text-xs text-red-200 mt-0.5">
            Laboratório de HPV · LACEN-RS / CEVS
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          {/* Tab bar */}
          <div className="flex border-b-2 border-neutral-200 mb-6">
            <button
              className={`flex-1 py-2.5 border-none bg-none cursor-pointer text-sm font-semibold transition-colors ${
                aba === "email"
                  ? "text-rs-red border-b-2 border-rs-red -mb-0.5"
                  : "text-neutral-400 border-b-2 border-transparent -mb-0.5"
              }`}
              onClick={() => setAba("email")}
            >
              E-mail e Senha
            </button>
            <button
              className={`flex-1 py-2.5 border-none bg-none cursor-pointer text-sm font-semibold transition-colors ${
                aba === "cracha"
                  ? "text-rs-red border-b-2 border-rs-red -mb-0.5"
                  : "text-neutral-400 border-b-2 border-transparent -mb-0.5"
              }`}
              onClick={() => setAba("cracha")}
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

        {/* Faixa tricolor RS — rodapé do card */}
        <div className="h-1.5 flex">
          <div className="flex-1 bg-rs-red" />
          <div className="flex-1 bg-rs-yellow" />
          <div className="flex-1 bg-rs-green" />
        </div>
      </div>

      <p className="text-center mt-5 text-xs text-neutral-400">
        LACEN-RS · CEVS · Secretaria da Saúde do RS
      </p>
    </div>
  );
}
