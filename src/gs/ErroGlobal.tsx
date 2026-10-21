import { Component, type ErrorInfo, type ReactNode } from 'react';

/* ---------- Se uma tela quebrar, a pessoa vê isto (e não uma tela em branco) ---------- */

export class ErroGlobal extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
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
        <button type="button" className="gs-btn" onClick={() => this.setState({ erro: false })}>Tentar de novo</button>
      </div>
    );
  }
}
