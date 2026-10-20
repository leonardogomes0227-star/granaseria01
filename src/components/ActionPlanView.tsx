import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, CreditCard, Phone, PiggyBank, Scissors, ShieldAlert, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import { CopyMessage } from './CopyMessage';
import { ActionPlan, PlanStep, monthShort } from '../plan';
import { RIGHTS, relevantRights } from '../leaks';
import { ToolId, getTool } from '../tools';
import { ToolIcon } from './Layout';
import { formatBRL } from '../calculations';

/* ---------- Plano de ação: valor mensal, fases, passos, renegociação e calendário ---------- */

type PotId = 'debts' | 'reserve' | 'invest' | 'gastos' | `goal-${number}`;

interface Pot {
  id: PotId;
  icon: LucideIcon;
  title: string;
  status: 'agora' | 'depois' | 'pronto';
  statusText: string;
  amount: string | null; // "R$ 500 por mês"
  when: string | null; // "até jul/28"
  progress: { now: string; goal: string; pct: number } | null;
  why: string;
  steps: PlanStep[];
  tool: ToolId | null;
  extra?: React.ReactNode;
}

// cada passo do plano vai pro pote (objetivo) a que ele pertence
function potOfStep(step: PlanStep, plan: ActionPlan): PotId | null {
  const t = step.title;
  if (/dívida|Pague primeiro|pra abater|Troque /i.test(t)) return 'debts';
  if (/emergência/i.test(t)) return 'reserve';
  if (/investir/i.test(t)) return 'invest';
  if (/^Gaste menos|resto do dinheiro|moradia/i.test(t)) return 'gastos';
  const g = plan.goals.findIndex((x) => t === `Junte pra ${x.name}`);
  return g >= 0 ? `goal-${g}` : null;
}

const fmtPct = (r: number) => `${r.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function buildPots(plan: ActionPlan): Pot[] {
  const short = (n: number | null) => (n === null ? 'sem data ainda' : monthShort(plan.start, n));
  const phase = (id: 'debts' | 'reserve' | 'invest') => plan.phases.find((p) => p.id === id);
  const stepsOf = (id: PotId) => plan.steps.filter((s) => potOfStep(s, plan) === id);
  const status = (from: number | undefined): Pick<Pot, 'status' | 'statusText'> =>
    from === undefined || from <= 1 ? { status: 'agora', statusText: 'Agora' } : { status: 'depois', statusText: `Começa em ${short(from)}` };
  const pots: Pot[] = [];

  if (plan.debts.length > 0) {
    const total = plan.debts.reduce((x, d) => x + d.balance, 0);
    const ph = phase('debts');
    pots.push({
      id: 'debts',
      icon: CreditCard,
      title: 'Dívidas',
      ...status(ph?.from),
      amount: ph ? `${formatBRL(ph.amount)} por mês` : null,
      when: plan.stuck ? 'renegociar primeiro' : `livre em ${short(plan.debtFreeMonth)}`,
      progress: { now: `Falta pagar ${formatBRL(total)}`, goal: 'Zerar', pct: 0 },
      why: plan.stuck ? 'Hoje o que você paga não cobre nem os juros. O primeiro passo é renegociar.' : 'Dívida com juros alto come o seu salário. Pagando na ordem certa, você sai mais rápido e paga menos juros.',
      steps: stepsOf('debts'),
      tool: 'debts',
      extra: (
        <>
          <p className="pot-sub">A ordem pra pagar</p>
          <ol className="pot-list">
            {plan.debts.map((d) => (
              <li key={d.id}>
                <span>
                  <b>{d.name}</b>
                  <small>{fmtPct(d.rate)} ao mês{d.rateAssumed ? ' (taxa típica)' : ''}</small>
                </span>
                <span className="pot-list-right">
                  <b>{formatBRL(d.balance)}</b>
                  <small>{d.payoffMonth === null ? 'sem data ainda' : `quita em ${short(d.payoffMonth)}`}</small>
                </span>
              </li>
            ))}
          </ol>
          {plan.negotiation && <NegotiationFold negotiation={plan.negotiation} />}
        </>
      ),
    });
  }

  if (plan.reserve.target > 0) {
    const ph = phase('reserve');
    const pct = Math.min(100, (plan.reserve.current / plan.reserve.target) * 100);
    pots.push({
      id: 'reserve',
      icon: PiggyBank,
      title: 'Reserva',
      ...(plan.reserve.alreadyDone ? { status: 'pronto' as const, statusText: 'Pronta' } : status(ph?.from)),
      amount: ph && !plan.reserve.alreadyDone ? `${formatBRL(ph.amount)} por mês` : null,
      when: plan.reserve.alreadyDone ? null : plan.reserve.doneMonth === null ? 'depois das dívidas' : `pronta em ${short(plan.reserve.doneMonth)}`,
      progress: { now: `${formatBRL(plan.reserve.current)} guardados`, goal: formatBRL(plan.reserve.target), pct },
      why: 'Dinheiro guardado pra imprevistos (6 meses de gastos). Com ela, um problema não vira dívida nova.',
      steps: stepsOf('reserve'),
      tool: 'tracker',
    });
  }

  plan.goals.forEach((g, i) => {
    pots.push({
      id: `goal-${i}`,
      icon: Target,
      title: cap(g.name),
      status: 'agora',
      statusText: 'Agora',
      amount: `${formatBRL(g.monthly)} por mês`,
      when: `em ${g.months} meses`,
      progress: { now: `${formatBRL(g.monthly)} por mês`, goal: formatBRL(g.target), pct: 0 },
      why: 'A meta que você criou. Separando todo mês, ela chega na data.',
      steps: stepsOf(`goal-${i}`),
      tool: 'goal',
    });
  });

  if (plan.investFrom !== null) {
    pots.push({
      id: 'invest',
      icon: TrendingUp,
      title: 'Investir',
      ...status(plan.investFrom),
      amount: `${formatBRL(plan.monthlyPower)} por mês`,
      when: `a partir de ${short(plan.investFrom)}`,
      progress: { now: 'Começa depois da reserva', goal: `${formatBRL(plan.invest10y)} em 10 anos`, pct: 0 },
      why: 'Com as dívidas pagas e a reserva pronta, o dinheiro passa a trabalhar por você: é o que o Pai Rico chama de comprar ativos.',
      steps: stepsOf('invest'),
      tool: 'richdad',
    });
  }

  if (plan.cuts.length > 0 || plan.unaccounted > 0) {
    const cut = plan.cuts.reduce((x, c) => x + c.amount, 0);
    pots.push({
      id: 'gastos',
      icon: Scissors,
      title: 'Gastos',
      status: 'agora',
      statusText: 'Agora',
      amount: cut > 0 ? `${formatBRL(cut)} a menos por mês` : null,
      when: null,
      progress: null,
      why: 'Cada real que deixa de sair vai pro seu plano e adianta as datas.',
      steps: stepsOf('gastos'),
      tool: 'leaks',
      extra: plan.cuts.length > 0 && (
        <>
          <p className="pot-sub">Seu limite em cada coisa</p>
          <ol className="pot-list">
            {plan.cuts.map((c) => (
              <li key={c.key}>
                <span>
                  <b>{c.label}</b>
                  <small>hoje {formatBRL(c.current)}</small>
                </span>
                <span className="pot-list-right">
                  <b>{formatBRL(c.ceiling)}</b>
                  <small>no máximo</small>
                </span>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }
  return pots;
}

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
  const pots = buildPots(plan);
  const [potId, setPotId] = useState<PotId | null>(pots.find((p) => p.status === 'agora')?.id ?? pots[0]?.id ?? null);
  const pot = pots.find((p) => p.id === potId) ?? pots[0];
  const [extras, setExtras] = useState(false);
  const general = plan.steps.filter((s) => potOfStep(s, plan) === null);
  const open = (id: PotId) => {
    setPotId(id);
    requestAnimationFrame(() => document.getElementById('pot-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="plan">
      {!locked && <PlanRoad plan={plan} />}
      <ThisMonth plan={plan} general={general} onOpenTool={onOpenTool} onPick={locked ? undefined : open} />

      {locked ? (
        lockedSlot
      ) : (
        pot && (
          <>
            <p className="diag-label plan-steps-label">Cada objetivo no seu lugar</p>
            <div className="pot-tabs" role="tablist" aria-label="Objetivos do plano">
              {pots.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={p.id === pot.id} className={`pot-tab ${p.status} ${p.id === pot.id ? 'active' : ''}`} onClick={() => setPotId(p.id)}>
                  <p.icon size={16} />
                  <span>{p.title}</span>
                  <i />
                </button>
              ))}
            </div>
            <PotDetail key={pot.id} pot={pot} onOpenTool={onOpenTool} />
          </>
        )
      )}

      {!locked && !extras && (
        <button type="button" className="plan-extras-btn" onClick={() => setExtras(true)}>
          <span>
            <b>Ver mais</b>
            <small>{['gráfico do seu dinheiro', plan.schedule.length > 0 && 'calendário mês a mês', 'seus direitos', 'como acelerar'].filter(Boolean).join(' · ')}</small>
          </span>
          <ChevronDown size={18} />
        </button>
      )}
      {extras && (
        <>
          <GrowthChart plan={plan} />
          {plan.schedule.length > 0 && <ScheduleTable plan={plan} />}
          <RightsCard plan={plan} onOpenTool={onOpenTool} />
          <Boosters plan={plan} onOpenTool={onOpenTool} />
        </>
      )}

      <p className="field-hint" style={{ marginTop: 14 }}>
        Estimativa feita com os seus números e, quando você não informou, com taxas típicas de mercado. Não é recomendação
        individual de investimento: confira as taxas do seu contrato.
      </p>
    </div>
  );
}

/** Um objetivo do plano, sozinho: quanto, até quando, o progresso, pra que serve, como fazer e a ferramenta. */
function PotDetail({ pot, onOpenTool }: { pot: Pot; onOpenTool: (id: ToolId) => void }) {
  const tool = pot.tool ? getTool(pot.tool) : null;
  return (
    <div className={`pot stat-card ${pot.status}`} id="pot-detail">
      <div className="pot-head">
        <span className="pot-icon" aria-hidden="true"><pot.icon size={20} /></span>
        <h4>{pot.title}</h4>
        <em className={`pot-status ${pot.status}`}>{pot.statusText}</em>
      </div>
      {(pot.amount || pot.when) && (
        <div className="pot-nums">
          {pot.amount && (
            <span>
              <small>Quanto</small>
              <b>{pot.amount}</b>
            </span>
          )}
          {pot.when && (
            <span>
              <small>Quando</small>
              <b>{pot.when}</b>
            </span>
          )}
        </div>
      )}
      {pot.progress && (
        <div className="pot-progress">
          <div className="jp-bar"><i style={{ width: `${Math.max(pot.progress.pct, 2)}%` }} /></div>
          <p className="jp-nums">
            <span>{pot.progress.now}</span>
            <span>Meta: {pot.progress.goal}</span>
          </p>
        </div>
      )}
      <p className="pot-why">{pot.why}</p>
      {pot.steps.length > 0 && (
        <>
          <p className="pot-sub">Como fazer</p>
          <ol className="pot-steps">
            {pot.steps.map((s, i) => (
              <PotStep key={i} step={s} />
            ))}
          </ol>
        </>
      )}
      {pot.extra}
      {tool && (
        <button type="button" className="btn-primary pot-tool" onClick={() => onOpenTool(tool.id)}>
          Abrir {tool.title} <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function PotStep({ step }: { step: PlanStep }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" className="pot-step" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>
          <b>{step.title}</b>
          {(step.amount || step.when) && <small>{[step.amount, step.when].filter(Boolean).join(' · ')}</small>}
        </span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && <p className="step-detail">{step.why ? `${step.why} ` : ''}{step.detail}</p>}
    </li>
  );
}

/** O que fazer neste mês, em reais: a primeira coisa que a pessoa vê. Cada linha leva pro objetivo dela. */
const DONE_KEY = 'gs-mes-feito';
const ym = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
function readDone(): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) || '{}') as Record<string, string[]>;
    return Array.isArray(all[ym()]) ? all[ym()] : [];
  } catch {
    return [];
  }
}
function writeDone(list: string[]) {
  try {
    // só o mês atual fica guardado
    localStorage.setItem(DONE_KEY, JSON.stringify({ [ym()]: list }));
  } catch {
    // segue sem salvar
  }
}

/** O que fazer neste mês, em reais, com caixinha pra marcar. Cada linha leva pro objetivo dela. */
function ThisMonth({ plan, general, onOpenTool, onPick }: { plan: ActionPlan; general: PlanStep[]; onOpenTool: (id: ToolId) => void; onPick?: (id: PotId) => void }) {
  const [how, setHow] = useState(false);
  const [done, setDone] = useState<string[]>(readDone);
  const row = plan.schedule[0];
  const items: [LucideIcon, string, string, PotId | null][] = [];
  if (plan.stuck) items.push([Phone, 'Ligar pro banco e pedir pra renegociar', 'agora', 'debts']);
  if (row) {
    for (const p of row.payments) items.push([CreditCard, `Pagar ${p.name}`, formatBRL(p.amount), 'debts']);
    if (row.toReserve >= 1) items.push([PiggyBank, 'Guardar pra emergências', formatBRL(row.toReserve), 'reserve']);
  } else if (plan.monthlyPower > 0 && plan.debts.length === 0) {
    items.push(plan.reserve.alreadyDone ? [TrendingUp, 'Investir', formatBRL(plan.monthlyPower), 'invest'] : [PiggyBank, 'Guardar pra emergências', formatBRL(plan.monthlyPower), 'reserve']);
  }
  plan.goals.forEach((g, i) => items.push([Target, `Juntar pra ${g.name}`, formatBRL(g.monthly), `goal-${i}`]));
  for (const c of plan.cuts) items.push([Scissors, `No máximo em ${c.label.toLowerCase()}`, formatBRL(c.ceiling), 'gastos']);
  const month = monthShort(plan.start, 1);
  const count = items.filter(([, what]) => done.includes(what)).length;
  const all = items.length > 0 && count === items.length;
  const toggle = (what: string) => {
    const next = done.includes(what) ? done.filter((d) => d !== what) : [...done, what];
    setDone(next);
    writeDone(next);
  };
  return (
    <div className="this-month">
      <div className="this-month-top">
        <p className="this-month-head">
          <b>Este mês ({month})</b>
          <small>
            {plan.powerAssumed
              ? `Hoje não sobra nada: o plano começa separando 10% da renda, ${formatBRL(plan.monthlyPower)} por mês.`
              : `Com o plano, vão ${formatBRL(plan.monthlyPower)} por mês pros seus objetivos.`}
          </small>
        </p>
        {items.length > 0 && <span className={`month-count ${all ? 'all' : ''}`}>{count}/{items.length}</span>}
      </div>
      {items.length > 0 && (
        <>
          <div className="jp-bar"><i style={{ width: `${Math.max(3, (count / items.length) * 100)}%` }} /></div>
          <ul className="month-list">
            {items.map(([Icon, what, amount, pot], i) => {
              const ok = done.includes(what);
              return (
                <li key={i} className={ok ? 'ok' : ''}>
                  <button type="button" className={`task-check ${ok ? 'on' : ''}`} aria-pressed={ok} aria-label={ok ? `Desmarcar: ${what}` : `Marcar como feito: ${what}`} onClick={() => toggle(what)}>
                    <Check size={15} />
                  </button>
                  <button type="button" className="month-item" disabled={!onPick || !pot} onClick={() => pot && onPick?.(pot)}>
                    <span className="this-month-icon" aria-hidden="true"><Icon size={16} /></span>
                    <span className="this-month-what">{what}</span>
                    <b>{amount}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {all && <p className="month-ok">Mês cumprido. Registre no acompanhamento pra o plano ajustar as datas.</p>}
      {general.length > 0 && (
        <>
          <button type="button" className="plan-more" aria-expanded={how} onClick={() => setHow((v) => !v)}>
            <ChevronDown size={14} style={{ transform: how ? 'rotate(180deg)' : undefined }} /> Como começar
          </button>
          {how && general.map((s, i) => <p key={i} className="step-detail"><b>{s.title}.</b> {s.detail}</p>)}
        </>
      )}
      <button type="button" className={all ? 'btn-primary' : 'btn-outline'} onClick={() => onOpenTool('tracker')}>
        {all ? 'Registrar o mês' : 'Acompanhar mês a mês'} <ArrowRight size={15} />
      </button>
    </div>
  );
}

/** O caminho do plano inteiro: de hoje até o fim, com a data de cada etapa. */
function PlanRoad({ plan }: { plan: ActionPlan }) {
  const short = (n: number) => monthShort(plan.start, n);
  const stops: { label: string; title: string; text: string }[] = [
    { label: 'Começo', title: 'Hoje', text: `Separar ${formatBRL(plan.monthlyPower)} por mês` },
  ];
  for (const ph of plan.phases) {
    if (ph.id === 'invest') continue;
    stops.push({ label: ph.to === null ? 'Depois' : `Até ${short(ph.to)}`, title: ph.title, text: ph.id === 'debts' ? 'Uma dívida de cada vez' : `${formatBRL(plan.reserve.target)} guardados` });
  }
  stops.push({
    label: 'Fim',
    title: plan.investFrom !== null ? 'Dinheiro trabalhando por você' : 'Plano cumprido',
    text: plan.investFrom !== null ? `Investindo a partir de ${short(plan.investFrom)}` : 'Tudo em dia',
  });
  return (
    <ol className="plan-road" aria-label="O caminho do seu plano">
      {stops.map((st, i) => (
        <li key={i} className={i === 0 ? 'now' : ''}>
          <span className="road-dot" />
          <small>{st.label}</small>
          <b>{st.title}</b>
          <span>{st.text}</span>
        </li>
      ))}
    </ol>
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



function NegotiationFold({ negotiation }: { negotiation: NonNullable<ActionPlan['negotiation']> }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <NegotiationCard negotiation={negotiation} />
  ) : (
    <button type="button" className="pot-step" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
      <span>
        <b>Mensagem pronta pra renegociar</b>
        <small>É só copiar e mandar pro banco</small>
      </span>
      <ChevronDown size={16} />
    </button>
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
