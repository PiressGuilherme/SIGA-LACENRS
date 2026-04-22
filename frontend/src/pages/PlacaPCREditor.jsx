import React, { useEffect, useState } from "react";
import MontarPCR from "./MontarPCR";
import ConsultarPCR from "./ConsultarPCR";
import CrachaModal from "../components/CrachaModal";
import OperatorBadge from "../components/OperatorBadge";
import NavigationButtons from "../components/NavigationButtons";
import StepperTabs, { STEPPER_COLORS } from "../components/StepperTabs";
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

  const isMontar = activeTab === "montar";

  useEffect(() => {
    document.body.classList.toggle("no-scroll-viewport", isMontar);
    return () => document.body.classList.remove("no-scroll-viewport");
  }, [isMontar]);

  return (
    <div className={isMontar ? "flex flex-col flex-1 min-h-0" : "flex flex-col"}>
      {!operador && (
        <CrachaModal onValidado={setOperador} modulo="PCR" />
      )}

      <OperatorBadge
        operador={operador}
        onTrocarOperador={() => setOperador(null)}
      />

      <NavigationButtons currentStep="pcr" />

      <h2 className="mb-4 text-lg text-emerald-800 font-semibold">
        Módulo PCR
      </h2>

      <StepperTabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        colors={STEPPER_COLORS.pcr}
      />

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
