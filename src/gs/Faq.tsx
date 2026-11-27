import { Link } from 'react-router-dom';

const PERGUNTAS: [string, string][] = [
  ['Preciso entender de finanças?', 'Não. As palavras são do dia a dia. Você informa os números e o app mostra o próximo passo.'],
  ['O app pede a senha do banco?', 'Nunca. Você digita os valores ou manda pelo WhatsApp. Nenhuma conta bancária é conectada.'],
  ['Onde ficam os meus dados?', 'No seu aparelho. Se você entra com WhatsApp ou e-mail, uma cópia fica na sua conta para abrir em outro aparelho. Só você acessa.'],
  ['Como funciona o pagamento?', 'O plano é mensal ou anual. O acesso pago só libera depois que o aviso do pagamento chega no servidor. Uma opção salva no celular não libera o plano.'],
  ['E se eu não gostar?', 'Você tem 7 dias para pedir o reembolso pelo mesmo canal do pagamento. Pode cancelar a assinatura quando quiser. O que você registrou continua seu.'],
  ['Como anoto um gasto?', 'No app, toque no mais. No WhatsApp, mande "mercado 35" ou um áudio dizendo o mesmo. O valor escrito por extenso, como "cinquenta reais", também vale.'],
  ['Esqueci como entrar.', 'O login é o link que o WhatsApp manda, ou um link no e-mail. Não há senha para memorizar. Se o link venceu, peça outro.'],
  ['Posso apagar tudo?', 'Sim. Em Meus dados há o botão para limpar o aparelho e a cópia da conta. O pedido de exclusão da conta também pode ir pelo suporte, e é atendido em até 15 dias.'],
];

export function Faq() {
  return (
    <div className="page-wrap anim-in" style={{ maxWidth: 720 }}>
      <nav className="gs-migalhas" aria-label="Você está em">
        <Link to="/">Início</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">Perguntas frequentes</span>
      </nav>
      <h1>Perguntas frequentes</h1>
      <p className="wizard-sub">Respostas curtas. Se faltar alguma, o Midas e o WhatsApp continuam por perto.</p>
      <div>
        {PERGUNTAS.map(([p, r]) => (
          <details key={p} className="gs-faq-item">
            <summary>{p}</summary>
            <p>{r}</p>
          </details>
        ))}
      </div>
      <div className="gs-acoes">
        <Link to="/planos" className="gs-btn">Ver planos</Link>
        <Link to="/entrar" className="gs-btn sec">Entrar</Link>
      </div>
    </div>
  );
}
