import React, { useState } from "react";
import MontarPlaca from "./MontarPlaca";
import ConfirmarExtracao from "./ConfirmarExtracao";
import ConsultarPlacas from "./ConsultarPlacas";
import CrachaModal from "../components/CrachaModal";
import OperatorBadge from "../components/OperatorBadge";
import NavigationButtons from "../components/NavigationButtons";
import { getOperadorInicial } from "../utils/auth";

const TABS = [
  { id: "montar", label: "Montar Placa" },
  { id: "confirmar", label: "Confirmar Placa" },
  { id: "consultar", label: "Consultar Placas" },
];

export default function PlateEditor({ csrfToken }) {
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
        <CrachaModal onValidado={setOperador} modulo="Extração" />
      )}

      <OperatorBadge
        operador={operador}
        onTrocarOperador={() => setOperador(null)}
      />

      <NavigationButtons currentStep="extracao" />

      <h2 className="mb-4 text-lg text-blue-900 font-semibold">
        Placas de Extração
      </h2>

      {/* ---- Abas ---- */}
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
                  ? "border-b-2 border-blue-900 text-blue-900 font-bold"
                  : "border-b-2 border-transparent text-gray-500 font-normal"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "montar" && (
        <MontarPlaca
          csrfToken={csrfToken}
          editarPlacaId={editarPlacaId}
          onEditarDone={() => setEditarPlacaId(null)}
          operador={operador}
        />
      )}
      {activeTab === "confirmar" && <ConfirmarExtracao csrfToken={csrfToken} operador={operador} />}
      {activeTab === "consultar" && (
        <ConsultarPlacas csrfToken={csrfToken} onEditar={handleEditar} />
      )}
    </div>
  );
}
