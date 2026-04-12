import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import ErrorBoundary from "../components/ErrorBoundary";
import ConsultaAmostras from "../pages/ConsultaAmostras";
import ConsultarPlacas from "../pages/ConsultarPlacas";

const ABAS = [
  { key: "amostras", label: "Amostras" },
  { key: "placas", label: "Placas de Extração" },
];

function ConsultaApp({ csrfToken }) {
  const [aba, setAba] = useState("amostras");

  return (
    <div style={{ fontFamily: "inherit" }}>
      {/* Abas */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #e5e7eb",
          marginBottom: "1.5rem",
        }}
      >
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            style={{
              padding: "0.6rem 1.25rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              border: "none",
              borderBottom:
                aba === a.key ? "2px solid #1a3a5c" : "2px solid transparent",
              marginBottom: -2,
              background: "none",
              color: aba === a.key ? "#1a3a5c" : "#6b7280",
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "amostras" && <ConsultaAmostras csrfToken={csrfToken} />}
      {aba === "placas" && <ConsultarPlacas csrfToken={csrfToken} />}
    </div>
  );
}

const el = document.getElementById("consulta-app");

if (!el) {
  console.error("[SIGA] #consulta-app não encontrado no DOM");
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ConsultaApp csrfToken={el.dataset.csrf} />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
