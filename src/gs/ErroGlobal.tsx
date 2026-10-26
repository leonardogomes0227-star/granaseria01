import { Component, type ErrorInfo, type ReactNode } from 'react';

/* ---------- Se uma tela quebrar, a pessoa vê isto (e não uma tela em branco) ---------- */

export class ErroGlobal extends Component<{ children: ReactNode }, { erro: boolean; motivo: string }> {
  state = { erro: false, motivo: '' };
  static getDerivedStateFromError(e: Error) {
    return { erro: true, motivo: String(e?.message ?? e).slice(0, 140) };
  }
  componentDidCatch(_e: Error, info: ErrorInfo) {
    // sem dados pessoais no log
    console.error('Erro de tela', info.componentStack?.split('\n')[1]?.trim());
  }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="gs-card gs-vazio" role="alert">
        <b>Algo deu errado nesta tela</b>
        <p>Seus dados estão salvos. Tente de novo.</p>
        {this.state.motivo && <small className="gs-mudo" style={{ display: 'block', margin: '0 0 10px' }}>Detalhe: {this.state.motivo}</small>}
        <button type="button" className="gs-btn" onClick={() => this.setState({ erro: false, motivo: '' })}>Tentar de novo</button>
      </div>
    );
  }
}
