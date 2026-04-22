import React, { useEffect, useState } from "react";
import MontarPlaca from "./MontarPlaca";
import ConfirmarExtracao from "./ConfirmarExtracao";
import ConsultarPlacas from "./ConsultarPlacas";
import CrachaModal from "../components/CrachaModal";
import OperatorBadge from "../components/OperatorBadge";
import NavigationButtons from "../components/NavigationButtons";
import StepperTabs, { STEPPER_COLORS } from "../components/StepperTabs";
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

  const isMontar = activeTab === "montar";

  useEffect(() => {
    document.body.classList.toggle("no-scroll-viewport", isMontar);
    return () => document.body.classList.remove("no-scroll-viewport");
  }, [isMontar]);

  return (
    <div className={isMontar ? "flex flex-col flex-1 min-h-0" : "flex flex-col"}>
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

      {/* ---- Abas em formato stepper (flechas) ---- */}
      <StepperTabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        colors={STEPPER_COLORS.extracao}
      />

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
