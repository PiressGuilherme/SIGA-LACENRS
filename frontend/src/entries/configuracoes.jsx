import React from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import ErrorBoundary from "../components/ErrorBoundary";
import Configuracoes from "../pages/Configuracoes";

const el = document.getElementById("configuracoes-app");

if (!el) {
  console.error("[SIGA] #configuracoes-app nao encontrado no DOM");
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Configuracoes csrfToken={el.dataset.csrf} />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
