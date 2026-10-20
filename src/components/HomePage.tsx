import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ClipboardList, MessageCircle, Plus, Users } from 'lucide-react';
import { fetchPainel, getName, painelToken, type PainelData } from '../painel';
import { formatBRL } from '../calculations';
import { getAnswers, recommend } from '../profile';
import { AGENTS } from '../agents';
import { daysBetween, todayBRT } from '../coach';
import { markTaskDone } from '../results';
import { getTool, type ToolId } from '../tools';
import { WhatsAppButton } from './ContinueWhatsApp';
import { AgentArt } from './AgentArt';
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
  useEffect(() => {
    void fetchPainel().then(setPainel).catch(() => undefined);
  }, []);
  const income = painel ? sum(painel.month.incomes) : 0;
  const spent = painel ? sum(painel.month.expenses) : 0;
  const left = income - spent;
  const { today, last } = monthLeft();
  const perDay = left > 0 ? Math.floor(left / Math.max(1, last - today + 1)) : 0;
  return (
    <Link to="/mes" className="card money-card">
      <span className="card-label">Saldo do mês</span>
      <b className={`money-big ${left < 0 ? 'neg' : ''}`}>{painel ? formatBRL(left) : '—'}</b>
      <span className="money-flow">
        <span>Entrou <b>{formatBRL(income)}</b></span>
        <span>Saiu <b>{formatBRL(spent)}</b></span>
      </span>
      <span className="money-hint">
        {income === 0 ? 'Anote o que entrou no WhatsApp pra ver o saldo.' : left > 0 ? `Dá pra gastar ${formatBRL(perDay)} por dia` : 'O mês passou do que entrou.'}
        <ArrowRight size={15} />
      </span>
    </Link>
  );
}

const when = (due: string, today: string) => {
  const d = daysBetween(today, due);
  if (d < 0) return 'atrasado';
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  return new Date(`${due}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

function NextSteps({ hasDiagnosis, onStart, onOpenTool }: { hasDiagnosis: boolean; onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  const tasks = useTasks();
  const today = todayBRT();
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const [all, setAll] = useState(false);
  const navigate = useNavigate();
  if (!hasDiagnosis)
    return (
      <button type="button" className="card next-card" onClick={onStart}>
        <span className="card-label">Seu próximo passo</span>
        <b>Monte o seu plano</b>
        <span className="next-sub">10 perguntas sobre renda, gastos e dívidas. Você recebe o plano com valores e datas.</span>
        <span className="next-go">Começar <ArrowRight size={16} /></span>
      </button>
    );
  const shown = all ? open : open.slice(0, 3);
  return (
    <div className="card">
      <div className="card-row">
        <span className="card-label">Próximos passos</span>
        {open.length > 0 && <span className="card-count">{open.length}</span>}
      </div>
      {open.length === 0 ? (
        <p className="next-empty">Tudo em dia. Use um conselheiro ou uma ferramenta e os próximos passos aparecem aqui.</p>
      ) : (
        <ul className="task-list">
          {shown.map((t) => (
            <li key={t.id} className={t.due < today ? 'late' : t.due === today ? 'today' : ''}>
              <button type="button" className="task-check" aria-label={`Marcar como feito: ${t.text}`} onClick={() => markTaskDone(t.id)}>
                <Check size={15} />
              </button>
              <button type="button" className="task-copy" onClick={() => (t.source === 'plano' ? navigate('/plano') : onOpenTool(t.source as ToolId))}>
                <b>{t.text}</b>
                <small>
                  {when(t.due, today)}
                  {t.source !== 'plano' ? ` · ${getTool(t.source as ToolId).title}` : ''}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open.length > 3 && (
        <button type="button" className="link-btn" onClick={() => setAll((v) => !v)}>
          {all ? 'Mostrar menos' : `Ver todos (${open.length})`}
        </button>
      )}
    </div>
  );
}

function AgentsStrip({ hasDiagnosis }: { hasDiagnosis: boolean }) {
  const navigate = useNavigate();
  const answers = getAnswers();
  const picked = answers ? recommend(answers, hasDiagnosis).map((p) => AGENTS.find((a) => a.tool === p.tool)?.id) : ['dabasir', 'bansir', 'arkad'];
  const order = [...AGENTS].sort((a, b) => (picked.indexOf(a.id) === -1 ? 99 : picked.indexOf(a.id)) - (picked.indexOf(b.id) === -1 ? 99 : picked.indexOf(b.id)));
  return (
    <section className="home-block">
      <div className="block-head">
        <h2>Seus conselheiros</h2>
        <Link to="/conselheiros">Ver todos</Link>
      </div>
      <div className="agent-strip">
        {order.map((a) => (
          <button key={a.id} type="button" className="agent-mini" onClick={() => navigate(`/conselheiros/${a.id}`)}>
            <span className="agent-mini-art"><AgentArt id={a.id} hue={a.hue} /></span>
            <b>{a.name}</b>
            <small>{a.role}</small>
          </button>
        ))}
        <button type="button" className="agent-mini create" onClick={() => navigate('/conselheiros#criar')}>
          <span className="agent-mini-art"><Plus size={26} /></span>
          <b>Criar o meu</b>
          <small>Pro seu objetivo</small>
        </button>
      </div>
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

      <AgentsStrip hasDiagnosis={false} />

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
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' });
  return (
    <>
      <PageHead title={name ? `Oi, ${name}` : 'Oi!'} sub={date.charAt(0).toUpperCase() + date.slice(1)} />
      {resume !== null && (
        <button type="button" className="card next-card" onClick={onResume}>
          <span className="card-label">Você parou no meio</span>
          <b>Continuar o meu plano</b>
          <span className="next-sub">Etapa {resume} de 7.</span>
          <span className="next-go">Continuar <ArrowRight size={16} /></span>
        </button>
      )}
      <div className="home-grid">
        <MonthCard />
        {resume === null && <NextSteps hasDiagnosis={hasDiagnosis} onStart={onStart} onOpenTool={onOpenTool} />}
      </div>
      <div className="wa-line">
        <WhatsAppButton label="Anotar no WhatsApp" origin="inicio" className="btn-outline" />
      </div>
      <AgentsStrip hasDiagnosis={hasDiagnosis} />
    </>
  );
}
