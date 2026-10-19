import { ArrowRight } from 'lucide-react';
import { Reveal } from './motion';
import { WhatsAppButton } from './ContinueWhatsApp';

/* ---------- Como funciona: o caminho de verdade, em três passos ---------- */
// 1. diagnóstico no site → 2. plano de ação → 3. dia a dia no WhatsApp. Cada passo com uma mini-tela do que a
// pessoa vai ver, pra ela entender antes de começar. O passo 3 é a âncora #whatsapp (o bot e o menu apontam pra cá).

function MiniScore() {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="mini mini-score" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--sand-deep)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--gold)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * 0.32} transform="rotate(-90 32 32)" />
        <text x="32" y="37" textAnchor="middle" fontSize="16" fontFamily="Cinzel, serif" fill="var(--ink)">68</text>
      </svg>
      <div className="mini-lines">
        {[['Poupança', 40], ['Reserva', 25], ['Dívidas', 80], ['Gastos', 60]].map(([l, v]) => (
          <span key={l as string}>
            <small>{l}</small>
            <i><em style={{ width: `${v}%` }} /></i>
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniPlan() {
  const steps: [string, string][] = [
    ['nov', 'Guarde R$ 300 na reserva'],
    ['mar', 'Cartão quitado 🎉'],
    ['2028', 'Reserva de 6 meses pronta'],
  ];
  return (
    <ol className="mini mini-plan" aria-hidden="true">
      {steps.map(([when, what]) => (
        <li key={when}>
          <b>{when}</b>
          <span>{what}</span>
        </li>
      ))}
    </ol>
  );
}

function MiniChat() {
  return (
    <div className="mini mini-chat" aria-hidden="true">
      <p className="me">uber 18,50 débito</p>
      <p className="bot">✅ R$ 18,50 em 🚗 Transporte{'\n'}🎯 uns R$ 112 por dia</p>
    </div>
  );
}

const STEPS = [
  {
    n: 1,
    title: 'Faça o diagnóstico',
    text: 'Umas perguntas sobre renda, gastos e dívidas. Na hora você vê sua nota e o que mais pesa.',
    where: 'No site · 10 min',
    visual: <MiniScore />,
  },
  {
    n: 2,
    title: 'Receba seu plano de ação',
    text: 'O que fazer, quanto e até quando, na ordem certa. Fica salvo no seu painel.',
    where: 'No site · sempre salvo',
    visual: <MiniPlan />,
  },
  {
    n: 3,
    title: 'Anote o dia a dia no WhatsApp',
    text: 'Mande o que gastou ou recebeu. O assistente soma e mostra no seu painel quanto ainda dá pra gastar.',
    where: 'No WhatsApp · em segundos',
    visual: <MiniChat />,
  },
];

export function Journey({ onStart }: { onStart: () => void }) {
  return (
    <section className="section journey" id="como-funciona">
      <Reveal className="section-head center">
        <div className="kicker"><span className="wedge" />Como funciona</div>
        <h2>Simples assim</h2>
        <p>O site te dá o plano e o painel. O WhatsApp só anota o que entra e o que sai.</p>
      </Reveal>
      <div className="journey-track">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} className="journey-step" delay={i * 120} variant="up">
            <div id={s.n === 3 ? 'whatsapp' : undefined} className="journey-card">
              <span className="journey-n">{s.n}</span>
              <span className="journey-where">{s.where}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              {s.visual}
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="journey-cta" delay={200}>
        <button className="btn-primary btn-shine" type="button" onClick={onStart}>
          Fazer meu diagnóstico grátis <ArrowRight size={17} className="arrow" />
        </button>
        <WhatsAppButton label="Começar no WhatsApp" origin="como-funciona" className="btn-outline" />
      </Reveal>
    </section>
  );
}
