import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import Recebimento from "../pages/Recebimento";

const el = document.getElementById("recebimento-app");

if (!el) {
  console.error("[SIGA] #recebimento-app não encontrado no DOM");
} else {
  createRoot(el).render(
    <React.StrictMode>
      <Recebimento csrfToken={el.dataset.csrf} />
    </React.StrictMode>,
  );
}
