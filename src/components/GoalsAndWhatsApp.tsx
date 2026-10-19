import { ArrowRight } from 'lucide-react';
import { SITE_GOALS, type SiteGoal } from '../goals';
import type { ToolId } from '../tools';
import { Reveal } from './motion';
import { WhatsAppButton } from './ContinueWhatsApp';
import { openWhatsApp } from '../whatsapp';
import { track } from '../analytics';

/* ---------- "O que você quer resolver?" ---------- */

export function GoalsSection({ onStart, onOpenTool }: { onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  const pick = (g: SiteGoal) => {
    track('objetivo_escolhido', { objetivo: g.id });
    if (g.action.kind === 'diag') onStart();
    else if (g.action.kind === 'tool') onOpenTool(g.action.tool);
    else void openWhatsApp('objetivo').catch(() => undefined);
  };
  return (
    <section className="section goals-section" id="objetivos">
      <Reveal className="section-head">
        <div className="kicker"><span className="wedge" />Comece pelo seu objetivo</div>
        <h2>O que você quer resolver agora?</h2>
        <p>Escolha e a gente te leva direto pra ferramenta certa. Tudo grátis: você entra com seu WhatsApp, sem senha.</p>
      </Reveal>
      <div className="goals-grid">
        {SITE_GOALS.map((g, i) => {
          const Icon = g.icon;
          return (
            <Reveal key={g.id} delay={(i % 4) * 70} variant="up">
              <button type="button" className={`goal-card ${g.action.kind === 'whatsapp' ? 'is-wa' : ''}`} onClick={() => pick(g)}>
                <span className={`tool-icon tone-${g.tone}`}><Icon size={20} strokeWidth={1.9} /></span>
                <span className="goal-copy">
                  <b>{g.title}</b>
                  <span>{g.description}</span>
                </span>
                <ArrowRight size={16} className="goal-arrow" />
              </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- O que o WhatsApp faz ---------- */

const CHAT: [('me' | 'bot'), string][] = [
  ['me', 'mercado 80 no pix'],
  ['bot', '✅ R$ 80,00 em Alimentação · Pix\nSaldo do mês: R$ 1.420 · uns R$ 109 por dia'],
  ['me', 'posso comprar um tênis de 300?'],
  ['bot', '🟢 Cabe sem apertar. Depois da compra restam R$ 1.120, uns R$ 86 por dia.'],
];

export function WhatsAppSection() {
  return (
    <section className="section wa-section" id="whatsapp">
      <div className="wa-grid">
        <Reveal className="section-head" variant="left">
          <div className="kicker"><span className="wedge" />No WhatsApp</div>
          <h2>O dia a dia do seu dinheiro, por mensagem.</h2>
          <p>
            Sem app e sem conectar o banco: você conta o que gastou ou recebeu (até por foto do cupom) e o assistente soma, separa por categoria e
            forma de pagamento, mostra quanto ainda dá pra gastar e manda um resumo todo domingo.
          </p>
          <div className="wa-block" style={{ marginTop: 22 }}>
            <WhatsAppButton label="Começar no WhatsApp" origin="landing" />
          </div>
          <p className="field-hint" style={{ marginTop: 10 }}>Fez o diagnóstico aqui? O botão leva ele junto e o assistente usa seus limites.</p>
        </Reveal>
        <Reveal className="wa-phone" variant="up" delay={120}>
          {CHAT.map(([who, msg], i) => (
            <p key={i} className={`wa-bubble ${who}`}>{msg}</p>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
