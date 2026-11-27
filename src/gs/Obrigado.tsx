import { Link } from 'react-router-dom';

/** Página depois do pagamento. O acesso só muda quando o servidor confirma o aviso da Cakto. */
export function Obrigado() {
  return (
    <div className="page-wrap anim-in" style={{ maxWidth: 640, textAlign: 'center' }}>
      <nav className="gs-migalhas" aria-label="Você está em" style={{ justifyContent: 'center' }}>
        <Link to="/">Início</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Pagamento</span>
      </nav>
      <h1>Recebemos o seu pedido</h1>
      <p className="wizard-sub">
        Se o pagamento foi aprovado, o plano entra sozinho em alguns minutos. Você não precisa marcar nada aqui no celular.
        Entre de novo com o mesmo WhatsApp ou e-mail usado na compra.
      </p>
      <div className="gs-acoes" style={{ justifyContent: 'center' }}>
        <Link to="/entrar" className="gs-btn">Entrar no app</Link>
        <Link to="/planos" className="gs-btn sec">Ver os planos</Link>
      </div>
      <p className="field-hint" style={{ marginTop: 18 }}>
        Não chegou? Espere um pouco e atualize a página. Se passar de um dia, fale pelo WhatsApp que está no <Link to="/perfil">perfil</Link>.
      </p>
    </div>
  );
}
