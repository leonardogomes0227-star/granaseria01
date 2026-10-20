import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MessageCircle, Sparkles } from 'lucide-react';
import { LISTED_TOOLS, faturaEnabled, getTool, type ToolId } from '../tools';
import { getResults } from '../results';
import { fetchPainel, painelToken, type PainelData } from '../painel';
import { formatBRL } from '../calculations';
import { WhatsAppButton } from './ContinueWhatsApp';
import { ToolIcon } from './Layout';
import { CountUp } from './motion';

/* ---------- Topo: o dia a dia no WhatsApp ---------- */
// Logado: o mês de verdade (o que entrou e saiu pelo WhatsApp). Ainda não: como funciona, com uma conversa de exemplo.

const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);

export function DailyTop() {
  const logged = Boolean(painelToken());
  const [painel, setPainel] = useState<PainelData | null>(null);
  useEffect(() => {
    if (logged) void fetchPainel().then(setPainel).catch(() => undefined);
  }, [logged]);

  if (logged && painel) {
    const income = sum(painel.month.incomes);
    const spent = sum(painel.month.expenses);
    const left = income - spent;
    return (
      <div className="daily wallet">
        <div className="wallet-top">
          <span className="wallet-month">Seu mês, anotado no WhatsApp</span>
        </div>
        <p className={`wallet-balance ${left < 0 ? 'neg' : ''}`}>
          {left < 0 ? '−' : ''}R$ <CountUp value={Math.abs(left)} format={(n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
        </p>
        <div className="wallet-flow">
          <span><small>📥 Entrou</small><b>{formatBRL(income)}</b></span>
          <span><small>📤 Saiu</small><b>{formatBRL(spent)}</b></span>
        </div>
        <div className="wallet-actions">
          <WhatsAppButton label="Anotar no WhatsApp" origin="inicio" className="wallet-cta" />
          <Link className="wallet-out" to="/painel">Ver meu painel <ArrowRight size={13} /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="daily daily-intro">
      <div className="daily-copy">
        <p className="daily-label"><MessageCircle size={15} /> Controle do dia a dia</p>
        <h2>Anote o que entra e o que sai, direto no WhatsApp</h2>
        <p>Mande do seu jeito. O assistente soma, separa por categoria e mostra quanto ainda dá pra gastar no mês. Tudo aparece no seu painel aqui.</p>
        <WhatsAppButton label="Começar no WhatsApp" origin="inicio" className="btn-primary btn-shine" />
      </div>
      <div className="daily-chat" aria-hidden="true">
        <p className="me">mercado 80 no pix</p>
        <p className="bot">✅ R$ 80,00 em 🍽️ Alimentação · Pix{'\n'}Saldo do mês: R$ 1.420{'\n'}🎯 uns R$ 109 por dia</p>
        <p className="me">recebi 3000 salário</p>
        <p className="bot">💰 Entrada anotada: R$ 3.000,00{'\n'}🟢 Saldo do mês: R$ 4.420</p>
      </div>
    </div>
  );
}

/* ---------- Todas as ferramentas, separadas pelo que a pessoa quer fazer ---------- */

const GROUPS: { title: string; text: string; tools: ToolId[] }[] = [
  { title: 'Organizar e planejar', text: 'Seu plano de ação e o acompanhamento dele.', tools: ['tracker', 'goal', 'richdad'] },
  { title: 'Dívidas e banco', text: 'Sair das dívidas pagando menos juros.', tools: ['debts', 'rights', 'loan', 'fatura'] },
  { title: 'Economizar', text: 'Achar dinheiro e gastar com cabeça.', tools: ['leaks', 'extra', 'impulse'] },
];

// de outubro a dezembro o 13º está chegando: a ferramenta dele sobe pro topo
const isThirteenthSeason = () => [9, 10, 11].includes(new Date().getMonth()); // out a dez: a 1ª parcela sai até 30/11

export function ToolsDirectory({ onStart, onOpenTool, hasDiagnosis }: { onStart: () => void; onOpenTool: (id: ToolId) => void; hasDiagnosis: boolean }) {
  const [results] = useState(getResults);
  const [fatura, setFatura] = useState(false);
  useEffect(() => {
    void faturaEnabled().then(setFatura);
  }, []);
  const listed = new Set(LISTED_TOOLS.map((t) => t.id));
  const groups = GROUPS.map((g) => ({ ...g, tools: g.tools.filter((id) => listed.has(id) && (id !== 'fatura' || fatura)) }));
  const season = isThirteenthSeason();
  return (
    <section className="section tools-dir" id="ferramentas">
      <div className="section-head center">
        <div className="kicker"><span className="wedge" />Ferramentas</div>
        <h2>O que você quer fazer?</h2>
        <p>Cada ferramenta resolve uma coisa. O que você faz em uma fica salvo e entra no seu plano de ação.</p>
      </div>

      <button type="button" className={`dir-diag ${hasDiagnosis ? 'done' : ''}`} onClick={onStart}>
        <span className="tool-icon lg tone-gold"><Sparkles size={24} strokeWidth={1.9} /></span>
        <span className="dir-copy">
          <em className="pick-badge">{hasDiagnosis ? 'Feito · refazer quando quiser' : 'Comece por aqui'}</em>
          <b>Diagnóstico e plano de ação</b>
          <span>Umas perguntas sobre renda, gastos e dívidas. Você recebe sua nota e um plano com valores e datas, que as outras ferramentas usam.</span>
        </span>
        <ArrowRight size={20} className="pick-arrow" />
      </button>

      {season && (
        <button type="button" className="dir-season" onClick={() => onOpenTool('extra')}>
          🎁 <span><b>O 13º está chegando.</b> Veja onde colocar cada real e quantos meses ele adianta no seu plano.</span>
          <ArrowRight size={18} />
        </button>
      )}

      {groups.map((g) => (
        <div className="dir-group" key={g.title}>
          <h3>{g.title}{g.text && <small> · {g.text}</small>}</h3>
          <div className="dir-grid">
            {g.tools.map((id) => {
              const t = getTool(id);
              const done = results[id];
              return (
                <button type="button" key={id} className={`dir-card ${done ? 'done' : ''}`} onClick={() => onOpenTool(id)}>
                  <span className="dir-card-head">
                    <ToolIcon tool={t} />
                    <b>{t.title}</b>
                  </span>
                  <span className="dir-serve">{t.guide.serve}</span>
                  <span className="dir-get">
                    {done ? (
                      <><CheckCircle2 size={13} /> {done.summary}</>
                    ) : (
                      <>Você recebe: {t.guide.recebe}</>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
