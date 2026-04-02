import React, { useState } from 'react'
import MontarPCR from './MontarPCR'
import ConsultarPCR from './ConsultarPCR'

const TABS = [
  { id: 'montar',    label: 'Montar Placa PCR' },
  { id: 'consultar', label: 'Consultar Placas PCR' },
]

export default function PlacaPCREditor({ csrfToken }) {
  const [activeTab, setActiveTab] = useState('montar')
  const [editarPlacaId, setEditarPlacaId] = useState(null)

  function handleEditar(id) {
    setEditarPlacaId(id)
    setActiveTab('montar')
  }

  return (
    <div>
      <h2 className="mb-4 text-[1.3rem] text-success-800 font-bold">
        Módulo PCR
      </h2>

      <div className="flex border-b-2 border-neutral-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2.5 border-none bg-none text-[0.95rem] cursor-pointer -mb-[2px] transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-success-800 text-success-800 font-bold'
                : 'border-b-2 border-transparent text-neutral-500 font-normal hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'montar'    && <MontarPCR    csrfToken={csrfToken} editarPlacaId={editarPlacaId} onEditarDone={() => setEditarPlacaId(null)} />}
      {activeTab === 'consultar' && <ConsultarPCR csrfToken={csrfToken} onEditar={handleEditar} />}
    </div>
  )
}