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
    <div style={{ fontFamily: 'inherit' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem', color: '#065f46' }}>
        Módulo PCR
      </h2>

      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.6rem 1.5rem',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #065f46' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.id ? '#065f46' : '#6b7280',
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: '0.95rem',
              cursor: 'pointer',
              marginBottom: '-2px',
              transition: 'color 0.15s',
            }}
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
