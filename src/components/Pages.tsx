import { Link } from 'react-router-dom';

function PageShell({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-wrap anim-in">
      <div className="kicker"><span className="wedge" />{kicker}</div>
      <h1>{title}</h1>
      <div className="page-body">{children}</div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <PageShell title="Política de privacidade" kicker="Legal">
      <p>
        A Grana Séria coleta os dados da sua conta — nome, e-mail e número de WhatsApp —, as informações que você
        preenche no diagnóstico — renda, gastos, dívidas e reserva de emergência — e os gastos que você anota no
        site ou pelo WhatsApp. Usamos esses dados apenas para calcular o seu resultado, montar o seu plano de ação e
        mostrar o acompanhamento dos seus gastos. Não vendemos nem compartilhamos esses dados com terceiros para
        fins de publicidade.
      </p>
      <h3>Como usamos seus dados</h3>
      <p>
        Os dados da sua conta, o seu diagnóstico e os seus gastos ficam guardados no nosso banco de dados
        (Supabase), protegido de forma que cada pessoa só consegue acessar os próprios dados. É isso que permite
        rever o seu último diagnóstico e acompanhar seus gastos de qualquer aparelho. O seu número de WhatsApp é
        usado para identificar você quando anota gastos pelo assistente. O progresso de um diagnóstico em
        andamento e o histórico do check-in mensal também ficam salvos no seu navegador, neste aparelho.
      </p>
      <h3>Seus direitos</h3>
      <p>
        Você pode pedir a exclusão completa dos seus dados a qualquer momento. Para isso, entre em contato pelo
        canal de suporte indicado no rodapé do site. O pedido é atendido em até 15 dias.
      </p>
      <h3>Contato</h3>
      <p>Dúvidas sobre esta política podem ser enviadas pelo mesmo canal de suporte.</p>
    </PageShell>
  );
}

export function TermsPage() {
  return (
    <PageShell title="Termos de uso" kicker="Legal">
      <h3>O que é a Grana Séria</h3>
      <p>
        A Grana Séria é uma ferramenta de educação financeira baseada nos princípios do livro <i>O Homem Mais
        Rico da Babilônia</i>. Ela gera um diagnóstico e um plano de ação personalizados a partir das informações
        que você informa.
      </p>
      <h3>Não é consultoria financeira</h3>
      <p>
        A Grana Séria não é uma consultoria financeira registrada, não substitui o aconselhamento de um
        profissional certificado e não garante resultados financeiros. As projeções mostradas (incluindo a
        projeção de 10 anos) são estimativas baseadas nos dados informados e em premissas de rendimento, não uma
        promessa de retorno.
      </p>
      <h3 id="reembolso">Política de reembolso</h3>
      <p>
        Se você não ficar satisfeito com o diagnóstico, pode solicitar reembolso integral em até 7 dias corridos
        após a compra, pelo mesmo canal usado no pagamento (Kiwify, Hotmart ou Eduzz, conforme a plataforma
        usada).
      </p>
      <h3>Uso do serviço</h3>
      <p>
        Você é responsável pela veracidade das informações que insere no diagnóstico. Resultados e planos de
        ação dependem diretamente da precisão desses dados.
      </p>
    </PageShell>
  );
}

export function NotFoundPage() {
  return (
    <div className="page-wrap anim-in" style={{ textAlign: 'center', maxWidth: 560 }}>
      <div className="kicker" style={{ justifyContent: 'center' }}><span className="wedge" />404</div>
      <h1 style={{ marginBottom: 16 }}>Essa página não existe.</h1>
      <p className="wizard-sub" style={{ marginBottom: 28 }}>
        Pode ter sido movida, ou o link está errado. Volta pro início e tenta de novo.
      </p>
      <Link to="/" className="btn-primary">
        Voltar pro início
      </Link>
    </div>
  );
}
