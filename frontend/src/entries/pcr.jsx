import React from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import PlacaPCREditor from "../pages/PlacaPCREditor";
import ErrorBoundary from "../components/ErrorBoundary";

const el = document.getElementById("pcr-app");
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
        <PlacaPCREditor csrfToken={el.dataset.csrf || ""} />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
