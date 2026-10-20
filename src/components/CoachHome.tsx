import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { getCoach } from '../coachChat/coaches';
import { brl } from '../coachChat/engine';
import { checkinMonths, currentMonth, monthName, todaySP } from '../coachChat/months';
import { project, statusOf, whenText, type Aporte, type Plan } from '../coachChat/plan';
import { useCoach } from '../coachChat/store';
import { painelToken, getName } from '../painel';
import { AgentAvatar } from './AgentPage';
import { AppShell, PageHead } from './AppShell';
import { PlanItems } from './PlanCard';

/* ---------- /coach/plano: o plano em um cartão e a conversa com o coach ---------- */

/** O mês que o coach quer saber: o anterior (nos 10 primeiros dias) ou, a partir do dia 20, o atual. Só se ainda não foi registrado. */
function pendingCheckin(plan: Plan, aportes: Aporte[], now: Date = new Date()): string | null {
  const done = new Set(aportes.map((a) => a.mes));
  const today = todaySP(now);
  const cur = currentMonth(now);
  const pending = checkinMonths(plan.criadoEm, now).filter((m) => !done.has(m) && (m < cur || Number(today.slice(8, 10)) >= 20));
  return pending[0] ?? null;
}

export function CoachHome() {
  const view = useCoach();
  const coach = getCoach(view.coach);
  const plan = view.plano;
  const name = getName();

  return (
    <AppShell>
      <PageHead title="Plano com o coach" sub={name ? `${name}, aqui está o seu plano e o check-in do mês.` : undefined} />
      <div className="home-stack">

        {!coach && (
          <section className="home-hero coach-empty">
            <span className="home-hero-top"><span>Comece por aqui</span></span>
            <b className="home-hero-number small">Escolha seu coach</b>
            <span className="home-hero-sub">Ele conversa com você, monta o seu plano e acompanha o mês.</span>
            <div className="coach-cta"><Link className="btn-primary" to="/coach">Escolher coach</Link></div>
          </section>
        )}

        {coach && !plan && (
          <section className="home-hero coach-empty">
            <span className="home-hero-top"><span>{coach.name}</span></span>
            <b className="home-hero-number small">Vamos montar seu plano</b>
            <span className="home-hero-sub">Poucas perguntas e o plano fica pronto, com valores e datas.</span>
            <div className="coach-cta"><Link className="btn-primary" to="/coach/chat">Começar a conversa</Link></div>
          </section>
        )}

        {coach && plan && <PlanHero plan={plan} aportes={view.aportes} />}

        {coach && plan && <Pending coachId={coach.id} plan={plan} aportes={view.aportes} />}

        {coach && plan && (
          <Link className="btn-primary coach-talk" to="/coach/chat">
            <MessageCircle size={18} /> Falar com {coach.name}
          </Link>
        )}

        {coach && (
          <p className="coach-switch">
            <AgentAvatar id={coach.id} name={coach.name} hue={coach.hue} size={26} /> Seu coach é {coach.name}. <Link className="link-btn" to="/coach">Trocar</Link>
          </p>
        )}

        {!painelToken() && (
          <p className="coach-note">Seu plano está salvo só neste aparelho. <Link className="link-btn" to="/entrar">Entre com o WhatsApp</Link> pra guardar na sua conta.</p>
        )}
      </div>
    </AppShell>
  );
}

function Pending({ coachId, plan, aportes }: { coachId: string; plan: Plan; aportes: Aporte[] }) {
  const coach = getCoach(coachId);
  const m = pendingCheckin(plan, aportes);
  if (!coach || !m) return null;
  return (
    <Link className="coach-pending" to={`/coach/chat?s=checkin&m=${m}`}>
      <AgentAvatar id={coach.id} name={coach.name} hue={coach.hue} size={44} />
      <span>
        <b>{coach.name} quer saber como foi {monthName(m)}</b>
        <small>Leva um minuto</small>
      </span>
    </Link>
  );
}

function PlanHero({ plan, aportes }: { plan: Plan; aportes: Aporte[] }) {
  const now = currentMonth();
  const { saved } = project(plan, aportes, now);
  const st = statusOf(plan, aportes, now);
  const pct = plan.meta > 0 ? Math.min(100, Math.round((saved / plan.meta) * 100)) : 0;
  return (
    <section className="home-hero plan-hero" aria-label="Seu plano">
      <span className="home-hero-top">
        <span>Seu plano</span>
        <span className={`plan-status ${st.ok ? 'ok' : 'late'}`}>{st.ok ? 'Em dia' : `Nova previsão: ${whenText(st.novaPrevisao)}`}</span>
      </span>
      <PlanItems plan={plan} tone="dark" />
      <div className="plan-progress">
        <div className="plan-progress-text"><span>{brl(saved)} guardado de {brl(plan.meta)}</span><b>{pct}%</b></div>
        <div className="plan-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
      </div>
    </section>
  );
}
