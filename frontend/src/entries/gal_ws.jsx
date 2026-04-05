import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import GalWs from "../pages/GalWs";

const el = document.getElementById("gal-ws-app");

if (!el) {
  console.error("[SIGA] #gal-ws-app não encontrado no DOM");
} else {
  createRoot(el).render(
    <React.StrictMode>
      <GalWs csrfToken={el.dataset.csrf} />
    </React.StrictMode>,
  );
}
