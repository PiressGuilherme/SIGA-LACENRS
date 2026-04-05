import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import ConsultaAmostras from "../pages/ConsultaAmostras";
import ConsultarPlacas from "../pages/ConsultarPlacas";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

function ConsultaApp({ csrfToken }) {
  return (
    <div>
      <Tabs defaultValue="amostras">
        <TabsList className="mb-6">
          <TabsTrigger value="amostras">Amostras</TabsTrigger>
          <TabsTrigger value="placas">Placas de Extração</TabsTrigger>
        </TabsList>
        <TabsContent value="amostras">
          <ConsultaAmostras csrfToken={csrfToken} />
        </TabsContent>
        <TabsContent value="placas">
          <ConsultarPlacas csrfToken={csrfToken} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const el = document.getElementById("consulta-app");

if (!el) {
  console.error("[SIGA] #consulta-app não encontrado no DOM");
} else {
  createRoot(el).render(
    <React.StrictMode>
      <ConsultaApp csrfToken={el.dataset.csrf} />
    </React.StrictMode>,
  );
}
