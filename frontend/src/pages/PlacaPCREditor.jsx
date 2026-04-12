import React, { useState } from "react";
import MontarPCR from "./MontarPCR";
import ConsultarPCR from "./ConsultarPCR";
import CrachaModal from "../components/CrachaModal";
import OperatorBadge from "../components/OperatorBadge";
import { getOperadorInicial } from "../utils/auth";

const TABS = [
  { id: "montar", label: "Montar Placa PCR" },
  { id: "consultar", label: "Consultar Placas PCR" },
];

export default function PlacaPCREditor({ csrfToken }) {
  const [operador, setOperador] = useState(() => getOperadorInicial());
  const [activeTab, setActiveTab] = useState("montar");
  const [editarPlacaId, setEditarPlacaId] = useState(null);

  function handleEditar(id) {
    setEditarPlacaId(id);
    setActiveTab("montar");
  }

  return (
    <div>
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="PCR" />
      )}

      <OperatorBadge
        operador={operador}
        onTrocarOperador={() => setOperador(null)}
      />

      <h2 className="mb-4 text-lg text-emerald-800 font-semibold">
        Módulo PCR
      </h2>

      <div className="flex border-b-2 border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-6 py-2.5 border-none bg-none cursor-pointer -mb-0.5
              transition-colors duration-150 text-[0.95rem]
              ${
                activeTab === tab.id
                  ? "border-b-2 border-emerald-800 text-emerald-800 font-bold"
                  : "border-b-2 border-transparent text-gray-500 font-normal"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "montar" && (
        <MontarPCR
          csrfToken={csrfToken}
          editarPlacaId={editarPlacaId}
          onEditarDone={() => setEditarPlacaId(null)}
          operador={operador}
        />
      )}
      {activeTab === "consultar" && (
        <ConsultarPCR csrfToken={csrfToken} onEditar={handleEditar} operador={operador} />
      )}
    </div>
  );
}
