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
    <div style={{ fontFamily: 'inherit' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.3rem', color: '#1a3a5c' }}>
        Placas de Extração
      </h2>

      {/* ---- Abas ---- */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.6rem 1.5rem',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #1a3a5c' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.id ? '#1a3a5c' : '#6b7280',
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

      {activeTab === 'montar'    && <MontarPlaca        csrfToken={csrfToken} editarPlacaId={editarPlacaId} onEditarDone={() => setEditarPlacaId(null)} />}
      {activeTab === 'confirmar' && <ConfirmarExtracao   csrfToken={csrfToken} />}
      {activeTab === 'consultar' && <ConsultarPlacas     csrfToken={csrfToken} onEditar={handleEditar} />}
    </div>
  )
}
