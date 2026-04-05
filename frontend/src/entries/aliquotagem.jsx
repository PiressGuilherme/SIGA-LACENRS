import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import Aliquotagem from "../pages/Aliquotagem";

const el = document.getElementById("aliquotagem-app");

if (!el) {
  console.error("[SIGA] #aliquotagem-app não encontrado no DOM");
} else {
  createRoot(el).render(
    <React.StrictMode>
      <Aliquotagem csrfToken={el.dataset.csrf} />
    </React.StrictMode>,
  );
}
