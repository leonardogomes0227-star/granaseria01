import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ClipboardList, MessageCircle, Plus, Users } from 'lucide-react';
import { fetchPainel, getName, painelToken, type PainelData } from '../painel';
import { formatBRL } from '../calculations';
import { todayBRT } from '../coach';
import { markTaskDone } from '../results';
import { fmtDue } from '../dates';
import { getTool, type ToolId } from '../tools';
import { WhatsAppButton } from './ContinueWhatsApp';
import { useTasks } from './CoachPanel';
import { PageHead } from './AppShell';

/* ---------- Início ---------- */
// Logado: o dia de hoje (o saldo do mês, o próximo passo e os conselheiros). Ainda não: o que é, em 3 linhas, e um botão.

const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);

function monthLeft(): { today: number; last: number } {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return { today: now.getUTCDate(), last: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate() };
}

function MonthCard() {
  const [painel, setPainel] = useState<PainelData | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void fetchPainel()
      .then(setPainel)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);
  const income = painel ? sum(painel.month.incomes) : 0;
  const spent = painel ? sum(painel.month.expenses) : 0;
  const left = income - spent;
  const { today, last } = monthLeft();
  const perDay = left > 0 ? Math.floor(left / Math.max(1, last - today + 1)) : 0;
  return (
    <section className="hero-money" aria-label="Quanto posso gastar hoje">
      <span className="hero-label">Quanto posso gastar hoje</span>
      {!loaded ? (
        <span className="skeleton skeleton-hero" aria-label="Carregando" />
      ) : (
        <b className="hero-number">{income === 0 ? '—' : formatBRL(perDay)}</b>
      )}
      <span className="hero-sub">
        {!loaded ? '\u00a0' : income === 0 ? 'Anote o que entrou e o que saiu pra ver.' : left > 0 ? `Sobram ${formatBRL(left)} até o fim do mês` : 'O que entrou este mês já foi usado.'}
      </span>
      <WhatsAppButton label="Anotar" origin="inicio" className="btn-primary hero-cta" />
      <Link className="hero-link" to="/mes">Ver meu mês</Link>
    </section>
  );
}


function NextSteps({ hasDiagnosis, onStart, onOpenTool }: { hasDiagnosis: boolean; onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  const tasks = useTasks();
  const today = todayBRT();
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const [more, setMore] = useState(false);
  const navigate = useNavigate();
  if (!hasDiagnosis)
    return (
      <button type="button" className="card focus-card" onClick={onStart}>
        <span className="card-label">Foco de hoje</span>
        <b className="focus-title">Monte o seu plano</b>
        <span className="focus-meta">10 minutos. Você recebe o que fazer, quanto e até quando.</span>
        <span className="next-go">Começar <ArrowRight size={16} /></span>
      </button>
    );
  if (open.length === 0)
    return (
      <div className="card focus-card">
        <span className="card-label">Foco de hoje</span>
        <b className="focus-title">Tudo em dia</b>
        <span className="focus-meta">Nada pra fazer agora.</span>
      </div>
    );
  const [focus, ...rest] = open;
  const go = (t: typeof focus) => (t.source === 'plano' ? navigate('/plano') : onOpenTool(t.source as ToolId));
  const meta = (t: typeof focus) => `${fmtDue(t.due, today)}${t.source !== 'plano' ? ` · ${getTool(t.source as ToolId).title}` : ''}`;
  return (
    <div className="card focus-card">
      <span className="card-label">Foco de hoje</span>
      <button type="button" className="focus-main" onClick={() => go(focus)}>
        <b className="focus-title">{focus.text}</b>
        <span className="focus-meta">{meta(focus)}</span>
      </button>
      <button type="button" className="btn-outline focus-done" onClick={() => markTaskDone(focus.id)}>
        <Check size={16} /> Marcar como feito
      </button>
      {rest.length > 0 && (
        <>
          <button type="button" className="link-btn focus-more" aria-expanded={more} onClick={() => setMore((v) => !v)}>
            {more ? 'Esconder' : `Ver mais tarefas (${rest.length})`}
          </button>
          {more && (
            <ul className="focus-list">
              {rest.map((t) => (
                <li key={t.id}>
                  <button type="button" className="task-check" aria-label={`Marcar como feito: ${t.text}`} onClick={() => markTaskDone(t.id)}>
                    <Check size={15} />
                  </button>
                  <button type="button" className="task-copy" onClick={() => go(t)}>
                    <b>{t.text}</b>
                    <small>{meta(t)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const FAQ: [string, string][] = [
  ['É de graça?', 'Sim. O plano, os conselheiros e as ferramentas são gratuitos. Você entra com o seu WhatsApp, sem senha.'],
  ['O que eu faço no WhatsApp?', 'Anota o que gastou e o que entrou, do seu jeito (ex.: mercado 80 no pix), por texto, áudio ou foto do cupom.'],
  ['Meus dados ficam onde?', 'Na sua conta, ligada ao seu número. Só você vê. Pra apagar tudo, mande "apagar meus dados" no WhatsApp.'],
  ['É consultoria financeira?', 'Não. É educação financeira, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre.'],
];

function Welcome({ resume, onStart, onResume }: { resume: number | null; onStart: () => void; onResume: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <section className="welcome">
        <span className="welcome-tag">Grátis · entra com o WhatsApp</span>
        <h1>Saia das dívidas com um plano que cabe no seu bolso</h1>
        <p>Você anota no WhatsApp, a gente monta o plano e um conselheiro te lembra do próximo passo.</p>
        <div className="welcome-cta">
          {resume !== null ? (
            <button type="button" className="btn-primary" onClick={onResume}>Continuar meu plano (etapa {resume} de 7) <ArrowRight size={16} /></button>
          ) : (
            <button type="button" className="btn-primary" onClick={onStart}>Montar meu plano <ArrowRight size={16} /></button>
          )}
          <Link className="btn-outline" to="/entrar">Já uso, entrar</Link>
        </div>
      </section>

      <section className="home-block how">
        {[
          [MessageCircle, 'Anote no WhatsApp', '"mercado 80 no pix", um áudio ou a foto do cupom.'],
          [ClipboardList, 'Receba o seu plano', 'Quanto pagar, guardar e cortar, com datas.'],
          [Users, 'Siga com um conselheiro', 'Ele monta os passos e te lembra no dia.'],
        ].map(([Icon, title, text], i) => {
          const I = Icon as typeof MessageCircle;
          return (
            <div key={i} className="how-row">
              <span className="how-icon"><I size={20} /></span>
              <span>
                <b>{title as string}</b>
                <small>{text as string}</small>
              </span>
            </div>
          );
        })}
      </section>

      <section className="home-block">
        <div className="block-head"><h2>Dúvidas</h2></div>
        <div className="faq-list">
          {FAQ.map(([q, a], i) => (
            <div key={q} className={`faq-row ${open === i ? 'open' : ''}`}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                {q} <Plus size={18} />
              </button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function HomePage({
  savedProgress,
  onStart,
  onResume,
  onOpenTool,
}: {
  savedProgress: { step: number } | null;
  onStart: () => void;
  onResume: () => void;
  onOpenTool: (id: ToolId) => void;
}) {
  const logged = Boolean(painelToken());
  const hasDiagnosis = Boolean(savedProgress && savedProgress.step >= 7);
  const resume = savedProgress && savedProgress.step > 0 && savedProgress.step < 7 ? savedProgress.step : null;
  if (!logged) return <Welcome resume={resume} onStart={onStart} onResume={onResume} />;
  const name = getName();
  return (
    <>
      <PageHead title={name ? `Oi, ${name}` : 'Oi!'} />
      {resume !== null && (
        <button type="button" className="card next-card" onClick={onResume}>
          <span className="card-label">Você parou no meio</span>
          <b>Continuar o meu plano</b>
          <span className="next-go">Continuar (etapa {resume} de 7) <ArrowRight size={16} /></span>
        </button>
      )}
      <div className="home-stack">
        <MonthCard />
        {resume === null && <NextSteps hasDiagnosis={hasDiagnosis} onStart={onStart} onOpenTool={onOpenTool} />}
      </div>
    </>
  );
}
