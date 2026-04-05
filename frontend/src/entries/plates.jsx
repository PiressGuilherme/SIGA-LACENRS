import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import PlateEditor from "../pages/PlateEditor";

const el = document.getElementById("plates-app");

if (!el) {
  console.error("[SIGA] #plates-app não encontrado no DOM");
} else {
  createRoot(el).render(
    <React.StrictMode>
      <PlateEditor csrfToken={el.dataset.csrf} />
    </React.StrictMode>,
  );
}
