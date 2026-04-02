import React, { useState } from 'react'
import MontarPlaca from './MontarPlaca'
import ConfirmarExtracao from './ConfirmarExtracao'
import ConsultarPlacas from './ConsultarPlacas'

const TABS = [
  { id: 'montar',    label: 'Montar Placa' },
  { id: 'confirmar', label: 'Confirmar Placa' },
  { id: 'consultar', label: 'Consultar Placas' },
]

export default function PlateEditor({ csrfToken }) {
  const [activeTab, setActiveTab] = useState('montar')
  const [editarPlacaId, setEditarPlacaId] = useState(null)

  function handleEditar(id) {
    setEditarPlacaId(id)
    setActiveTab('montar')
  }

  return (
    <div>
      <h2 className="mb-4 text-[1.3rem] text-brand-800 font-bold">
        Placas de Extração
      </h2>

      {/* ---- Abas ---- */}
      <div className="flex border-b-2 border-neutral-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2.5 border-none bg-none text-[0.95rem] cursor-pointer -mb-[2px] transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-brand-800 text-brand-800 font-bold'
                : 'border-b-2 border-transparent text-neutral-500 font-normal hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'montar'    && <MontarPlaca        csrfToken={csrfToken} editarPlacaId={editarPlacaId} onEditarDone={() => setEditarPlacaId(null)} />}
      {activeTab === 'confirmar' && <ConfirmarExtracao   csrfToken={csrfToken} />}
      {activeTab === 'consultar' && <ConsultarPlacas     csrfToken={csrfToken} onEditar={handleEditar} />}
    </div>
  )
}