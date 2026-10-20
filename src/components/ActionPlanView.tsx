import { useState } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, CreditCard, Phone, PiggyBank, Scissors, ShieldAlert, Target, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { CopyMessage } from './CopyMessage';
import { ActionPlan, PlanStep, monthShort } from '../plan';
import { RIGHTS, relevantRights } from '../leaks';
import { ToolId, getTool } from '../tools';
import { ToolIcon } from './Layout';
import { formatBRL } from '../calculations';

/* ---------- Plano de ação: valor mensal, fases, passos, renegociação e calendário ---------- */

const FIRST_STEPS = 3;

export function ActionPlanView({
  plan,
  locked,
  lockedSlot,
  onOpenTool,
}: {
  plan: ActionPlan;
  locked: boolean;
  lockedSlot?: React.ReactNode;
  onOpenTool: (id: ToolId) => void;
}) {
  // os primeiros passos aparecem; o resto e os extras (mensagem pra renegociar, direitos, calendário) ficam a um toque
  const [allSteps, setAllSteps] = useState(false);
  const [extras, setExtras] = useState(false);
  const visibleSteps = locked ? plan.steps.slice(0, 1) : allSteps ? plan.steps : plan.steps.slice(0, FIRST_STEPS);
  const hiddenSteps = locked ? 0 : plan.steps.length - visibleSteps.length;
  const hasRights = relevantRights(plan).length > 0;
  const hasExtras = !locked && (Boolean(plan.negotiation) || plan.schedule.length > 0 || hasRights);

  return (
    <div className="plan">
      <PlanSummary plan={plan} />
      {!locked && <ThisMonth plan={plan} onOpenTool={onOpenTool} />}
      <Journey plan={plan} />
      <GrowthChart plan={plan} />

      <p className="diag-label plan-steps-label">Passo a passo</p>

      <div className={locked ? 'paywall' : undefined}>
        <ol className={locked ? 'paywall-teaser steps' : 'steps'}>
          {visibleSteps.map((s, i) => (
            <StepCard key={i} n={i + 1} step={s} onOpenTool={onOpenTool} />
          ))}
          {locked && <div className="paywall-fade" />}
        </ol>
        {locked && lockedSlot}
        {hiddenSteps > 0 && (
          <button type="button" className="plan-more" onClick={() => setAllSteps(true)}>
            <ChevronDown size={14} /> Ver os outros {hiddenSteps} {hiddenSteps === 1 ? 'passo' : 'passos'}
          </button>
        )}
      </div>

      {hasExtras && !extras && (
        <button type="button" className="plan-extras-btn" onClick={() => setExtras(true)}>
          <span>
            <b>Mais ajuda pro seu plano</b>
            <small>{[plan.negotiation && 'mensagem pronta pra renegociar', hasRights && 'seus direitos', plan.schedule.length > 0 && 'calendário mês a mês', 'como acelerar'].filter(Boolean).join(' · ')}</small>
          </span>
          <ChevronDown size={18} />
        </button>
      )}
      {extras && (
        <>
          {plan.negotiation && <NegotiationCard negotiation={plan.negotiation} />}
          <RightsCard plan={plan} onOpenTool={onOpenTool} />
          <Boosters plan={plan} onOpenTool={onOpenTool} />
          {plan.schedule.length > 0 && <ScheduleTable plan={plan} />}
        </>
      )}

      <p className="field-hint" style={{ marginTop: 14 }}>
        Estimativa feita com os seus números e, quando você não informou, com taxas típicas de mercado. Não é recomendação
        individual de investimento: confira as taxas do seu contrato.
      </p>
    </div>
  );
}

/** O que fazer neste mês, em reais: a primeira coisa que a pessoa precisa ver. */
function ThisMonth({ plan, onOpenTool }: { plan: ActionPlan; onOpenTool: (id: ToolId) => void }) {
  const row = plan.schedule[0];
  const items: [LucideIcon, string, string][] = [];
  if (plan.stuck) items.push([Phone, 'Ligar pro banco e pedir pra renegociar (mensagem pronta em "Mais ajuda")', 'agora']);
  if (row) {
    for (const p of row.payments) items.push([CreditCard, `Pagar ${p.name}`, formatBRL(p.amount)]);
    if (row.toReserve >= 1) items.push([PiggyBank, 'Guardar pra emergências', formatBRL(row.toReserve)]);
  } else if (plan.monthlyPower > 0 && plan.debts.length === 0) {
    items.push([PiggyBank, plan.reserve.alreadyDone ? 'Investir' : 'Guardar pra emergências', formatBRL(plan.monthlyPower)]);
  }
  for (const g of plan.goals) items.push([Target, `Juntar pra ${g.name}`, formatBRL(g.monthly)]);
  for (const c of plan.cuts) items.push([Scissors, `Gastar no máximo em ${c.label.toLowerCase()}`, formatBRL(c.ceiling)]);
  if (items.length === 0) return null;
  const month = monthShort(plan.start, 1);
  return (
    <div className="this-month">
      <p className="this-month-head">
        <b>Este mês ({month}), faça isto:</b>
      </p>
      <ul>
        {items.map(([Icon, what, amount], i) => (
          <li key={i}>
            <span className="this-month-icon" aria-hidden="true"><Icon size={16} /></span>
            <span className="this-month-what">{what}</span>
            <b>{amount}</b>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary" onClick={() => onOpenTool('tracker')}>
        Já fiz? Marcar em Acompanhar meu plano <ArrowRight size={15} />
      </button>
    </div>
  );
}

/** As etapas do plano como uma jornada, com barra de progresso e data de cada uma. */
function Journey({ plan }: { plan: ActionPlan }) {
  const short = (n: number | null) => (n === null ? 'sem data ainda' : monthShort(plan.start, n));
  const totalDebt = plan.debts.reduce((x, d) => x + d.balance, 0);
  const stages: { icon: LucideIcon; title: string; now: string; goal: string; pct: number; when: string }[] = [];
  if (plan.debts.length > 0) stages.push({ icon: CreditCard, title: 'Sair das dívidas', now: `Falta pagar ${formatBRL(totalDebt)}`, goal: 'Zerar', pct: 0, when: plan.stuck ? 'renegociar primeiro' : `livre em ${short(plan.debtFreeMonth)}` });
  if (plan.reserve.target > 0) {
    const pct = Math.min(100, (plan.reserve.current / plan.reserve.target) * 100);
    stages.push({ icon: PiggyBank, title: 'Reserva de emergência', now: `${formatBRL(plan.reserve.current)} guardados`, goal: formatBRL(plan.reserve.target), pct, when: plan.reserve.alreadyDone ? 'pronta' : plan.reserve.doneMonth === null ? 'depois das dívidas' : `pronta em ${short(plan.reserve.doneMonth)}` });
  }
  for (const g of plan.goals) stages.push({ icon: Target, title: g.name.charAt(0).toUpperCase() + g.name.slice(1), now: `${formatBRL(g.monthly)} por mês`, goal: formatBRL(g.target), pct: 0, when: `em ${g.months} meses` });
  if (plan.investFrom !== null) stages.push({ icon: TrendingUp, title: 'Investir', now: `${formatBRL(plan.monthlyPower)} por mês`, goal: `${formatBRL(plan.invest10y)} em 10 anos`, pct: 0, when: `começa em ${short(plan.investFrom)}` });
  if (stages.length === 0) return null;
  return (
    <div className="journey-plan">
      <p className="diag-label">Sua jornada</p>
      <ol>
        {stages.map((st, i) => (
          <li key={i}>
            <span className="jp-icon" aria-hidden="true"><st.icon size={18} /></span>
            <div className="jp-body">
              <p className="jp-head">
                <b>{st.title}</b>
                <span>{st.when}</span>
              </p>
              <div className="jp-bar"><i style={{ width: `${Math.max(st.pct, 2)}%` }} /></div>
              <p className="jp-nums">
                <span>{st.now}</span>
                <span>Meta: {st.goal}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Gráfico simples do dinheiro guardado mês a mês, com as datas das metas marcadas. */
function GrowthChart({ plan }: { plan: ActionPlan }) {
  if (plan.monthlyPower <= 0 || plan.stuck) return null;
  const debtEnd = plan.debtFreeMonth ?? 0;
  const horizon = Math.min(120, Math.max(24, (plan.investFrom ?? debtEnd + 24) + 24));
  const pts: number[] = [];
  let bal = plan.reserve.current;
  for (let m = 1; m <= horizon; m++) {
    if (m > debtEnd) bal = bal * 1.008 + plan.monthlyPower;
    pts.push(bal);
  }
  const max = Math.max(...pts, plan.reserve.target) || 1;
  const W = 600;
  const H = 180;
  const x = (m: number) => (m / horizon) * W;
  const y = (v: number) => H - (v / max) * (H - 20);
  const line = pts.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const marks: [number, string][] = [];
  if (plan.debts.length > 0 && plan.debtFreeMonth) marks.push([plan.debtFreeMonth, 'Sem dívidas']);
  if (plan.reserve.doneMonth && !plan.reserve.alreadyDone) marks.push([plan.reserve.doneMonth, 'Reserva pronta']);
  return (
    <div className="growth stat-card">
      <p className="diag-label">Seu dinheiro guardado, se seguir o plano</p>
      <p className="growth-big">
        {formatBRL(pts[pts.length - 1])} <small>em {horizon >= 24 ? `${Math.round(horizon / 12)} anos` : `${horizon} meses`}</small>
      </p>
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="growth-svg" role="img" aria-label="Gráfico do dinheiro guardado ao longo do tempo">
        {plan.reserve.target > 0 && (
          <g>
            <line x1="0" x2={W} y1={y(plan.reserve.target)} y2={y(plan.reserve.target)} className="growth-target" />
            <text x="4" y={y(plan.reserve.target) - 5} className="growth-label">reserva: {formatBRL(plan.reserve.target)}</text>
          </g>
        )}
        <polygon points={`0,${H} ${line} ${W},${H}`} className="growth-area" />
        <polyline points={line} className="growth-line" />
        {marks.map(([m, label]) => (
          <g key={label}>
            <line x1={x(m)} x2={x(m)} y1="0" y2={H} className="growth-mark" />
            <text x={Math.min(x(m) + 4, W - 90)} y="14" className="growth-label">{label}</text>
          </g>
        ))}
        <text x="0" y={H + 18} className="growth-axis">hoje</text>
        <text x={W} y={H + 18} textAnchor="end" className="growth-axis">{monthShort(plan.start, horizon)}</text>
      </svg>
    </div>
  );
}

/** O plano numa olhada: quanto você guarda hoje, quanto o plano usa (e de onde vem) e as etapas com datas. */
function PlanSummary({ plan }: { plan: ActionPlan }) {
  const parts = [
    { label: 'cortando gastos', value: plan.sources.cuts },
    { label: 'parcelas que já paga', value: plan.sources.installments },
    { label: 'vazamentos achados', value: plan.sources.leaks },
  ].filter((p) => p.value > 0);
  const when = (from: number, to: number | null) => (to === null ? `a partir de ${monthShort(plan.start, from)}` : `até ${monthShort(plan.start, to)}`);
  return (
    <div className="plan-summary stat-card">
      <div className="plan-summary-row">
        <span>
          <small>Você guarda hoje</small>
          <b>{formatBRL(plan.savingNow)}</b>
        </span>
        <span className="arrow-sep" aria-hidden="true">→</span>
        <span className="target">
          <small>Com o plano</small>
          <b>{formatBRL(plan.monthlyPower)}<em>/mês</em></b>
        </span>
      </div>
      <p className="plan-summary-from">
        {plan.powerAssumed
          ? 'Hoje não sobra nada: o plano começa separando 10% da renda.'
          : parts.length > 0
            ? `O que falta vem de: ${parts.map((p) => `${formatBRL(p.value)} ${p.label}`).join(' + ')}.`
            : 'É o que você já guarda: o plano diz pra onde vai cada real.'}
      </p>
      {plan.phases.length > 0 && (
        <ol className="plan-stages">
          {plan.phases.map((ph, i) => (
            <li key={ph.id}>
              <span className="plan-stage-n">{i + 1}</span>
              <span>
                <b>{ph.title}</b>
                <small>{ph.to === null && ph.id !== 'invest' ? 'sem data ainda' : when(ph.from, ph.to)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Um passo: o que fazer, pra que serve, quanto e até quando. O como fazer e a ferramenta ficam a um toque. */
function StepCard({ n, step, onOpenTool }: { n: number; step: PlanStep; onOpenTool: (id: ToolId) => void }) {
  const [open, setOpen] = useState(false);
  const tool = step.tool ? getTool(step.tool) : null;
  return (
    <li className={`step tone-${step.tone}`}>
      <span className="step-n">{n}</span>
      <div className="step-body">
        <p className="step-title">{step.title}</p>
        {step.why && <p className="step-why">{step.why}</p>}
        {(step.amount || step.when) && (
          <p className="step-chips">
            {step.amount && <span><Wallet size={13} /> {step.amount}</span>}
            {step.when && <span><CalendarDays size={13} /> {step.when}</span>}
          </p>
        )}
        <div className="step-actions">
          <button type="button" className="step-how" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            Como fazer <ChevronDown size={14} />
          </button>
          {tool && (
            <button type="button" className="step-tool" onClick={() => onOpenTool(tool.id)}>
              <ToolIcon tool={tool} size="sm" /> {tool.title} <ArrowRight size={14} />
            </button>
          )}
        </div>
        {open && <p className="step-detail">{step.detail}</p>}
      </div>
    </li>
  );
}

function NegotiationCard({ negotiation }: { negotiation: NonNullable<ActionPlan['negotiation']> }) {
  return (
    <div className="stat-card plan-nego">
      <p className="diag-label" style={{ marginBottom: 4 }}>Mensagem pronta pra renegociar · {negotiation.debtName}</p>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Mande pelo app, chat ou SAC de quem você deve. Também dá pra negociar no Serasa Limpa Nome e reclamar no consumidor.gov.br se não tiver resposta.
      </p>
      <CopyMessage text={negotiation.message} />
      <p className="plan-nego-warn">
        <ShieldAlert size={15} /> Nunca pague taxa antecipada pra "limpar o nome" ou liberar empréstimo — é golpe.
      </p>
    </div>
  );
}

function RightsCard({ plan, onOpenTool }: { plan: ActionPlan; onOpenTool: (id: ToolId) => void }) {
  const ids = relevantRights(plan);
  if (ids.length === 0) return null;
  return (
    <div className="stat-card plan-rights">
      <p className="diag-label" style={{ marginBottom: 8 }}>Seus direitos nesse caso</p>
      {RIGHTS.filter((r) => ids.includes(r.id)).map((r) => (
        <div className="plan-right" key={r.id}>
          <p className="plan-step-title">{r.title}</p>
          <p>{r.summary}</p>
        </div>
      ))}
      <button type="button" className="plan-more" onClick={() => onOpenTool('rights')}>
        Ver todos os direitos e as mensagens prontas →
      </button>
    </div>
  );
}

// Atalhos pra acelerar o plano: dinheiro extra e vazamentos
function Boosters({ plan, onOpenTool }: { plan: ActionPlan; onOpenTool: (id: ToolId) => void }) {
  const items: { id: ToolId; text: string }[] = [
    { id: 'extra', text: 'Vai receber 13º, restituição ou FGTS? Veja quantos meses ele tira do seu plano.' },
    {
      id: 'leaks',
      text:
        plan.sources.leaks > 0
          ? `Você já achou ${formatBRL(plan.sources.leaks)}/mês em vazamentos. Tem mais?`
          : 'Tarifas, seguros que você não pediu, assinaturas: ache dinheiro escondido pra acelerar o plano.',
    },
  ];
  return (
    <div className="plan-boosters">
      <p className="diag-label" style={{ marginBottom: 6 }}>Acelere seu plano</p>
      {items.map((it) => {
        const t = getTool(it.id);
        return (
          <button type="button" className="mega-item" key={it.id} onClick={() => onOpenTool(it.id)} style={{ border: '1px solid var(--hairline-soft)' }}>
            <ToolIcon tool={t} size="sm" />
            <span>
              <b>{t.title}</b>
              <span className="desc">{it.text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ScheduleTable({ plan }: { plan: ActionPlan }) {
  const [all, setAll] = useState(false);
  const rows = all ? plan.schedule : plan.schedule.slice(0, 6);

  return (
    <div className="stat-card plan-schedule">
      <p className="diag-label" style={{ marginBottom: 8 }}>Calendário mês a mês</p>
      <div className="plan-schedule-rows">
        {rows.map((r) => (
          <div className="plan-row" key={r.month}>
            <span className="plan-row-month">{r.label}</span>
            <span className="plan-row-pay">
              {r.payments.map((p) => (
                <span key={p.id}>
                  {formatBRL(p.amount)} <small>{p.name}</small>
                </span>
              ))}
              {r.toReserve >= 1 && (
                <span>
                  {formatBRL(r.toReserve)} <small>reserva</small>
                </span>
              )}
            </span>
            <span className="plan-row-left">
              {r.debtLeft > 0.5 ? (
                <>
                  <small>falta</small> {formatBRL(r.debtLeft)}
                </>
              ) : (
                <b className="tone-text-good">quitado!</b>
              )}
            </span>
          </div>
        ))}
      </div>
      {plan.schedule.length > 6 && (
        <button type="button" className="plan-more" onClick={() => setAll((v) => !v)}>
          <ChevronDown size={15} style={{ transform: all ? 'rotate(180deg)' : undefined }} />
          {all ? 'Mostrar menos' : `Ver os ${plan.schedule.length} meses`}
        </button>
      )}
    </div>
  );
}
