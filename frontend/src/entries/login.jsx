import React from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import ErrorBoundary from "../components/ErrorBoundary";
import Login from "../pages/Login";

/**
 * Extrai o CSRF token do DOM (data-csrf) ou do cookie como fallback.
 * Necessário para evitar erros 403 Forbidden nas requisições POST.
 */
function getCsrfToken() {
  const el = document.getElementById("login-app");
  let token = el?.dataset.csrf;

  // Fallback: extrair do cookie se data attribute não existir
  if (!token) {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    token = match ? match[1] : null;
  }

  return token || "";
}

const el = document.getElementById("login-app");

if (!el) {
  console.error("[SIGA] #login-app não encontrado no DOM");
} else {
  const csrfToken = getCsrfToken();
  const nextUrl = el.dataset.next || "/";
  const isDev = !document.body.classList.contains("production");

  if (isDev && !csrfToken) {
    console.warn(
      "[SIGA] ⚠️ CSRF token não encontrado. " +
      "Verifique se o template renderiza data-csrf ou se há cookie csrftoken.",
    );
  }

  createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Login csrfToken={csrfToken} nextUrl={nextUrl} />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
