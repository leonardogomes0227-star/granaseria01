import { Link } from 'react-router-dom';
import { Titulo } from './ui';

/* ---------- Sobre e avisos ---------- */

export function Sobre() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 100px' }} className="gs-sobre">
      <Titulo titulo="Sobre e avisos" />
      <section className="gs-card">
        <h2 className="gs-h2" style={{ marginTop: 0 }}>Conteúdo educativo</h2>
        <p>A Grana Séria ensina e organiza. Nada aqui é recomendação personalizada de investimento, crédito ou consultoria. Para valores grandes ou decisões complexas, converse com um profissional certificado.</p>
        <h2 className="gs-h2">Investimentos</h2>
        <p>Rentabilidade passada não garante resultado futuro. Renda variável, cripto e derivativos podem causar perdas, inclusive maiores que o valor colocado.</p>
        <h2 className="gs-h2">Seus dados</h2>
        <p>Seus dados financeiros ficam no seu aparelho. Se você entrou com o WhatsApp ou o e-mail, uma cópia fica guardada na sua conta, pra você ver em outro aparelho e pro assistente do WhatsApp enxergar o mesmo que o app. No chat de investimentos, só um resumo (renda, reserva, dívidas e perfil) vai ao servidor, sem nome, sem credor e sem dados pessoais. Você pode exportar ou apagar tudo em Meus dados, inclusive a cópia da conta.</p>
        <p><Link to="/politica-de-privacidade" className="gs-btn link">Política de privacidade</Link> · <Link to="/termos-de-uso" className="gs-btn link">Termos de uso</Link></p>
      </section>
    </div>
  );
}
