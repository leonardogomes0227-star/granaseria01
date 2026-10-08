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
        A Grana Séria coleta as informações que você preenche no diagnóstico — renda, gastos, dívidas e reserva
        de emergência — apenas para calcular o seu resultado e o seu plano de ação. Não vendemos nem
        compartilhamos esses dados com terceiros para fins de publicidade.
      </p>
      <h3>Onde seus dados ficam</h3>
      <p>
        Sem conta, tudo o que você preenche fica salvo apenas no seu próprio navegador — é isso que permite
        continuar o diagnóstico de onde parou e acompanhar o plano mês a mês. Para apagar, basta limpar os dados
        de navegação deste site.
      </p>
      <p>
        Se você criar uma conta (login pelo e-mail), seu diagnóstico, seu plano e os vazamentos marcados passam a
        ser guardados também no nosso banco de dados (Supabase), para você acessar de qualquer aparelho. Só você,
        logado, consegue ler esses dados.
      </p>
      <h3>WhatsApp</h3>
      <p>
        Se você vincular seu WhatsApp, guardamos o número para responder suas mensagens e mandar o lembrete mensal
        do plano no dia que você escolher. Os gastos que você registra por lá ficam salvos para montar seus
        resumos. Você pode desligar os lembretes ou desvincular o número a qualquer momento.
      </p>
      <h3>Leitor de fatura</h3>
      <p>
        Quando você usa o leitor de fatura, o arquivo é enviado para a API da Anthropic (Claude), que faz a
        leitura e devolve o resultado. Não guardamos o arquivo. Evite enviar documentos com dados que você não
        quer compartilhar.
      </p>
      <h3>Métricas de uso</h3>
      <p>
        Usamos métricas sem cookies (Plausible) para saber quantas pessoas usam cada parte do site e melhorar o
        que não funciona. Elas nunca incluem valores em reais nem dados que identifiquem você. Se um dia usarmos
        o Pixel da Meta para anúncios, ele recebe só o nome das páginas e ações, nunca seus números.
      </p>
      <h3>Seus direitos</h3>
      <p>
        Você pode apagar seus dados a qualquer momento em Minha conta → Apagar meus dados, ou pedir a exclusão
        completa (inclusive do login e dos gastos registrados pelo WhatsApp) pelo canal de suporte indicado no
        rodapé do site. O pedido é atendido em até 15 dias.
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
