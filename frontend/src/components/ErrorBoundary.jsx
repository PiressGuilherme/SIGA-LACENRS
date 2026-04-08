import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  render() {
    if (this.state.erro) {
      return (
        <div style={{ padding: '2rem', color: '#dc3545', fontFamily: 'monospace' }}>
          <strong>Erro inesperado:</strong>
          <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.erro?.message || String(this.state.erro)}
          </pre>
          <button onClick={() => this.setState({ erro: null })} style={{ marginTop: '1rem' }}>
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
