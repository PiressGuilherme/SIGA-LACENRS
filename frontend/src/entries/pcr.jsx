import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import PlacaPCREditor from "../pages/PlacaPCREditor";

const el = document.getElementById("pcr-app");
if (el) {
  const csrfToken = el.dataset.csrf || "";
  createRoot(el).render(<PlacaPCREditor csrfToken={csrfToken} />);
}
