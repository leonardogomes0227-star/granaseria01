import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Check, ClipboardList, MessageCircle, Plus, Users } from 'lucide-react';
import { fetchPainel, getName, painelToken, type PainelData } from '../painel';
import { formatBRL } from '../calculations';
import { todayBRT, type CoachTask } from '../coach';
import { AGENTS, CUSTOM_AGENTS_KEY, customPlan, loadChosen, type CustomAgent } from '../agents';
import { markTaskDone } from '../results';
import { fmtDue } from '../dates';
import { faturaEnabled, getTool, type ToolId } from '../tools';
import { WhatsAppButton } from './ContinueWhatsApp';
import { useTasks } from './CoachPanel';
import { PageHead } from './AppShell';
import { FixedBills, fixedSummary, useBills } from './FixedBills';
import { monthOf, monthStatus, paidThisMonth } from '../bills';
import { AgentArt } from './AgentArt';
import { AgentAvatar } from './AgentPage';

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
  const bills = useBills();
  const left = income - spent - paidThisMonth(bills, monthOf(todayBRT()));
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


/* ---------- Seus agentes: quem está de olho nas suas finanças ---------- */
// Cada conselheiro vigia o que a pessoa montou com ele (os passos dele, com data) e avisa no WhatsApp no dia.
// Quem ainda não tem nada ativo aparece apagado, com o convite pra conversar. Os criados pela pessoa entram também.

function loadCustom(): CustomAgent[] {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_AGENTS_KEY) || '[]') as CustomAgent[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

interface Watcher {
  id: string;
  name: string;
  role: string;
  does: string;
  hue: number;
  extra: ToolId[]; // outras telas que ele abre
  tool: ToolId | null; // a tela de cálculo dele (null = criado pela pessoa)
  custom: boolean;
  tasks: CoachTask[]; // os avisos abertos, do mais perto pro mais longe
}

function buildWatchers(tasks: CoachTask[], custom: CustomAgent[], chosen: string[]): Watcher[] {
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const own = (source: string) => open.filter((t) => t.source === source || (source === 'tracker' && t.source === 'plano'));
  const list: Watcher[] = AGENTS.filter((a) => chosen.includes(a.id) || own(a.tool).length > 0).map((a) => ({ id: a.id, name: a.name, role: a.role, does: a.does, extra: a.extra ?? [], hue: a.hue, tool: a.tool, custom: false, tasks: own(a.tool) }));
  const goals = open.filter((t) => t.source === 'goal');
  custom.forEach((c) => list.push({ id: c.id, name: c.name, role: customPlan(c).lines[0], does: customPlan(c).lines[0], extra: [], hue: 45, tool: null, custom: true, tasks: goals }));
  // quem está vigiando vem primeiro, e dentro deles o aviso mais próximo
  return list.sort((x, y) => (x.tasks.length ? 0 : 1) - (y.tasks.length ? 0 : 1) || (x.tasks[0]?.due ?? '9').localeCompare(y.tasks[0]?.due ?? '9'));
}

function AgentsPanel({ hasDiagnosis, onStart, onOpenTool }: { hasDiagnosis: boolean; onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  const navigate = useNavigate();
  const tasks = useTasks();
  const today = todayBRT();
  const [mine, setMine] = useState<string[]>(loadChosen);
  useEffect(() => {
    const on = () => setMine(loadChosen());
    window.addEventListener('gs-agentes', on);
    return () => window.removeEventListener('gs-agentes', on);
  }, []);
  const watchers = buildWatchers(tasks, loadCustom(), mine);
  const active = watchers.filter((w) => w.tasks.length > 0).length;
  const [sel, setSel] = useState<string | null>(null);
  const bills = useBills();
  const [cats, setCats] = useState<[string, number][]>([]);
  useEffect(() => {
    if (!painelToken()) return;
    void fetchPainel()
      .then((d) => {
        const by = new Map<string, number>();
        for (const e of d?.month.expenses ?? []) by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
        setCats([...by.entries()].sort((a, b) => b[1] - a[1]));
      })
      .catch(() => undefined);
  }, []);
  const fixed = fixedSummary(monthStatus(bills, monthOf(today), today));
  // o que o agente mostra no cartão é o dado que ele controla, não só o que ele faz
  const liveLine = (id: string, fallback: string): string => {
    if (id === 'bansir') return fixed.total === 0 ? 'Cadastre seus gastos fixos' : fixed.left > 0 ? `${fixed.total - fixed.paid} a pagar · faltam ${formatBRL(fixed.left)}` : 'Todos os gastos fixos pagos';
    if (id === 'nomasir') return cats[0] ? `Mais gastou: ${cats[0][0]}, ${formatBRL(cats[0][1])}` : fallback;
    return fallback;
  };
  const [fatura, setFatura] = useState(false);
  useEffect(() => {
    void faturaEnabled().then(setFatura);
  }, []);
  const chosen = watchers.find((w) => w.id === sel) ?? null;
  const meta = (t: CoachTask) => `${fmtDue(t.due, today)}${t.repeat === 'monthly' ? ' · todo mês' : ''}`;
  const go = (t: CoachTask) => (t.source === 'plano' ? navigate('/plano') : onOpenTool(t.source as ToolId));
  return (
    <section className="home-block agents-panel" aria-label="Seus agentes">
      <div className="block-head">
        <h2>Seus agentes ativos</h2>
        <span className="agents-count">{active === 0 ? 'nenhum ainda' : `${active} de olho`}</span>
      </div>
      {watchers.length === 0 && <p className="agents-hint">Adicione um agente. Ele cuida de uma coisa por você e avisa no WhatsApp.</p>}
      <div className="agent-strip live">
        {watchers.map((w) => {
          const first = w.tasks[0];
          const on = w.tasks.length > 0;
          return (
            <button key={w.id} type="button" className={`agent-live ${on ? 'on' : 'off'} ${sel === w.id ? 'sel' : ''}`} aria-expanded={sel === w.id} onClick={() => setSel(sel === w.id ? null : w.id)}>
              <span className="agent-live-art">
                {w.custom ? <AgentAvatar name={w.name} hue={w.hue} size={52} /> : <AgentArt id={w.id} hue={w.hue} />}
                {on && <i className="live-dot" aria-label="Ativo" />}
              </span>
              <b>{w.name}</b>
              <small className="live-line">{liveLine(w.id, w.does)}</small>
              <span className={`live-when ${on ? '' : 'idle'}`}>
                <Bell size={12} /> {on ? `Aviso: ${fmtDue(first.due, today)}` : 'Em espera'}
              </span>
            </button>
          );
        })}
        <button type="button" className="agent-live create" onClick={() => navigate('/conselheiros')}>
          <span className="agent-live-art"><Plus size={26} /></span>
          <b>Adicionar agente</b>
          <small className="live-line">Escolha os que fazem sentido pra você</small>
        </button>
      </div>

      {chosen && (
        <div className="card agent-detail">
          <div className="agent-detail-head">
            <span>
              <b>{chosen.name}</b>
              <small>{chosen.does}</small>
            </span>
          </div>
          {chosen.id === 'nomasir' && cats.length > 0 && (
            <ul className="cat-list">
              {cats.slice(0, 4).map(([name, value]) => (
                <li key={name}>
                  <span>{name}</span>
                  <b>{formatBRL(value)}</b>
                </li>
              ))}
            </ul>
          )}
          {chosen.id === 'bansir' ? (
            <FixedBills />
          ) : chosen.tasks.length > 0 ? (
            <ul className="focus-list">
              {chosen.tasks.map((t) => (
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
          ) : (
            <p className="focus-meta">Ainda não está vigiando nada. Converse com ele e ele monta os seus avisos.</p>
          )}
          <div className="agent-detail-actions">
            <Link className="btn-outline" to={chosen.custom ? '/conselheiros' : `/conselheiros/${chosen.id}`}>
              <MessageCircle size={15} /> {chosen.tasks.length > 0 ? 'Conversar' : `Conversar com ${chosen.name}`}
            </Link>
            {[...(chosen.tool ? [chosen.tool] : []), ...chosen.extra].filter((id) => id !== 'fatura' || fatura).map((id) => (
              <button key={id} type="button" className="link-btn" onClick={() => onOpenTool(id)}>
                {getTool(id).title}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasDiagnosis && (
        <button type="button" className="dir-row soft" style={{ marginTop: 14 }} onClick={onStart}>
          <span className="tool-icon tone-gold"><ClipboardList size={20} strokeWidth={1.9} /></span>
          <span className="dir-row-copy">
            <b>Quer um plano completo de uma vez?</b>
            <span>10 minutos e você recebe o que fazer, quanto e até quando.</span>
          </span>
          <ArrowRight size={18} className="dir-row-arrow" />
        </button>
      )}
    </section>
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
        {resume === null && <AgentsPanel hasDiagnosis={hasDiagnosis} onStart={onStart} onOpenTool={onOpenTool} />}
      </div>
    </>
  );
}
