import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, MoreHorizontal, Plus, CreditCard, Phone, PiggyBank, Scissors, ShieldAlert, Target, TrendingUp, type LucideIcon } from 'lucide-react';
import { CopyMessage } from './CopyMessage';
import { ActionPlan, PlanStep, monthShort } from '../plan';
import { RIGHTS, relevantRights } from '../leaks';
import { ToolId, getTool } from '../tools';
import { ToolIcon } from './Layout';
import { formatBRL } from '../calculations';
import { AGENTS, CUSTOM_AGENTS_KEY, customPlan, loadChosen, saveChosen, type CustomAgent } from '../agents';
import { getTasks, restoreTasks, setToolTasks } from '../results';
import type { CoachTask } from '../coach';
import { pushNow } from '../painel';
import { AgentAvatar } from './AgentPage';
import { useTasks } from './CoachPanel';

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
    const ph = phase('debts');
    pots.push({
      id: 'debts',
      icon: CreditCard,
      title: 'Dívidas',
      ...status(ph?.from),
      amount: ph ? `${formatBRL(ph.amount)} por mês` : null,
      when: plan.stuck ? 'renegociar primeiro' : `livre em ${short(plan.debtFreeMonth)}`,
      progress: null,
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

/** O que fazer neste mês, por objetivo (a mesma conta de sempre): vira linhas dentro do cartão de cada objetivo. */
interface MonthItem {
  what: string;
  amount: string;
  pot: PotId | null;
  icon: LucideIcon;
}

function monthItems(plan: ActionPlan): MonthItem[] {
  const row = plan.schedule[0];
  const items: MonthItem[] = [];
  if (plan.stuck) items.push({ icon: Phone, what: 'Ligar pro banco e pedir pra renegociar', amount: 'agora', pot: 'debts' });
  if (row) {
    for (const p of row.payments) items.push({ icon: CreditCard, what: `Pagar ${p.name}`, amount: formatBRL(p.amount), pot: 'debts' });
    if (row.toReserve >= 1) items.push({ icon: PiggyBank, what: 'Guardar pra emergências', amount: formatBRL(row.toReserve), pot: 'reserve' });
  } else if (plan.monthlyPower > 0 && plan.debts.length === 0) {
    items.push(
      plan.reserve.alreadyDone
        ? { icon: TrendingUp, what: 'Investir', amount: formatBRL(plan.monthlyPower), pot: 'invest' }
        : { icon: PiggyBank, what: 'Guardar pra emergências', amount: formatBRL(plan.monthlyPower), pot: 'reserve' }
    );
  }
  plan.goals.forEach((g, i) => items.push({ icon: Target, what: `Juntar pra ${g.name}`, amount: formatBRL(g.monthly), pot: `goal-${i}` }));
  for (const c of plan.cuts) items.push({ icon: Scissors, what: `No máximo em ${c.label.toLowerCase()}`, amount: formatBRL(c.ceiling), pot: 'gastos' });
  return items;
}

// qual objetivo cada agente vigia (as telas de cálculo dele dizem de que assunto ele cuida)
const POT_OF_TOOL: Partial<Record<ToolId, PotId>> = { debts: 'debts', bills: 'debts', loan: 'debts', tracker: 'reserve', extra: 'reserve', leaks: 'gastos', richdad: 'invest' };

interface Watcher {
  id: string;
  name: string;
  hue: number;
  custom: boolean;
}

function watchersOf(pot: PotId, plan: ActionPlan, mine: string[], custom: CustomAgent[]): Watcher[] {
  const list: Watcher[] = AGENTS.filter((a) => mine.includes(a.id) && POT_OF_TOOL[a.tool] === pot).map((a) => ({ id: a.id, name: a.name, hue: a.hue, custom: false }));
  for (const c of custom) {
    const target: PotId | null = c.kind === 'divida' ? 'debts' : c.kind === 'gasto' ? 'gastos' : (() => {
      const i = plan.goals.findIndex((g) => g.name === c.what);
      return i >= 0 ? (`goal-${i}` as PotId) : null;
    })();
    if (target === pot) list.push({ id: c.id, name: c.name, hue: 45, custom: true });
  }
  return list;
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
  const all = buildPots(plan);
  const [off, setOff] = useState<string[]>(readOff);
  const pots = all.filter((p) => !off.includes(p.id));
  const outPots = all.filter((p) => off.includes(p.id));
  const [openId, setOpenId] = useState<PotId | null>(null);
  const [menuId, setMenuId] = useState<PotId | null>(null);
  const [edit, setEdit] = useState(false);
  const [more, setMore] = useState(false);
  const [how, setHow] = useState(false);
  const [done, setDone] = useState<string[]>(readDone);
  const [mine, setMine] = useState<string[]>(loadChosen);
  const [custom, setCustom] = useState<CustomAgent[]>(loadCustomAgents);
  const general = plan.steps.filter((s) => potOfStep(s, plan) === null);
  useEffect(() => {
    const on = () => {
      setMine(loadChosen());
      setCustom(loadCustomAgents());
    };
    window.addEventListener('gs-agentes', on);
    return () => window.removeEventListener('gs-agentes', on);
  }, []);
  // o menu ⋯ de um cartão fecha ao tocar em qualquer outro lugar
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuId]);

  const setOffList = (next: string[]) => {
    setOff(next);
    writeOff(next);
  };
  const toggleDone = (what: string) => {
    const next = done.includes(what) ? done.filter((d) => d !== what) : [...done, what];
    setDone(next);
    writeDone(next);
  };
  const items = monthItems(plan).filter((it) => !it.pot || !off.includes(it.pot));
  const count = items.filter((it) => done.includes(it.what)).length;
  const allDone = items.length > 0 && count === items.length;
  const month = monthShort(plan.start, 1);

  return (
    <div className="plan">
      <header className="plan-top">
        <div className="plan-top-main">
          <span className="tm-label">Este mês · {month}</span>
          <b className="plan-top-count">
            {items.length === 0 ? 'Sem tarefas' : allDone ? 'Mês cumprido' : `${count} de ${items.length} feitos`}
          </b>
        </div>
        {!locked && (
          <button type="button" className={`menu-dots ${edit ? 'on' : ''}`} aria-label="Editar o plano" aria-expanded={edit} onClick={() => setEdit((v) => !v)}>
            <MoreHorizontal size={20} />
          </button>
        )}
        {items.length > 0 && <span className="plan-top-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, (count / items.length) * 100)}%` }} /></span>}
      </header>

      {edit && !locked && (
        <div className="plan-edit">
          <PlanAgents />
          {outPots.length > 0 && (
            <div className="plan-out">
              <p className="section-label">Fora do plano</p>
              <ul>
                {outPots.map((p) => (
                  <li key={p.id}>
                    <span>{p.title}</span>
                    <button type="button" className="agent-pick" onClick={() => setOffList(off.filter((x) => x !== p.id))}>
                      <Plus size={14} /> Adicionar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="plan-edit-links">
            {general.length > 0 && (
              <button type="button" className="link-btn" aria-expanded={how} onClick={() => setHow((v) => !v)}>Como começar</button>
            )}
            <button type="button" className="link-btn" onClick={() => onOpenTool('tracker')}>
              {allDone ? 'Registrar o mês' : 'Acompanhar mês a mês'} <ArrowRight size={13} />
            </button>
          </div>
          {how && general.map((st, i) => <p key={i} className="step-detail"><b>{st.title}.</b> {st.detail}</p>)}
          <PlanManage />
        </div>
      )}

      {locked ? (
        lockedSlot
      ) : pots.length > 0 ? (
        <ol className="timeline" aria-label="Seus objetivos">
          {pots.map((p) => (
            <PotCard
              key={p.id}
              pot={p}
              rows={items.filter((it) => it.pot === p.id)}
              done={done}
              onCheck={toggleDone}
              watchers={watchersOf(p.id, plan, mine, custom)}
              open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              menuOpen={menuId === p.id}
              onMenu={() => setMenuId(menuId === p.id ? null : p.id)}
              onOpenTool={onOpenTool}
              onRemove={() => {
                setOffList([...off, p.id]);
                setMenuId(null);
              }}
            />
          ))}
        </ol>
      ) : (
        <p className="plan-empty">Nenhum objetivo no plano. Toque nos três pontos para adicionar.</p>
      )}

      {!locked && !more && (
        <button type="button" className="link-btn plan-more-link" onClick={() => setMore(true)}>
          <ChevronDown size={14} /> Mais detalhes
        </button>
      )}
      {more && (
        <>
          <GrowthChart plan={plan} />
          {plan.schedule.length > 0 && <ScheduleTable plan={plan} />}
          <RightsCard plan={plan} onOpenTool={onOpenTool} />
          <Boosters plan={plan} onOpenTool={onOpenTool} />
          <button type="button" className="link-btn plan-more-link" onClick={() => onOpenTool('richdad')}>
            Viver de renda: quanto falta <ArrowRight size={13} />
          </button>
        </>
      )}

      <p className="plan-legal">Estimativa com os seus números. Não é recomendação de investimento.</p>
    </div>
  );
}

/** Um objetivo: título, prazo, a tarefa do mês com caixinha, a barra e quem está de olho. Os botões ficam no menu ⋯. */
function PotCard({
  pot,
  rows,
  done,
  onCheck,
  watchers,
  open,
  onToggle,
  menuOpen,
  onMenu,
  onOpenTool,
  onRemove,
}: {
  pot: Pot;
  rows: MonthItem[];
  done: string[];
  onCheck: (what: string) => void;
  watchers: Watcher[];
  open: boolean;
  onToggle: () => void;
  menuOpen: boolean;
  onMenu: () => void;
  onOpenTool: (id: ToolId) => void;
  onRemove: () => void;
}) {
  const tool = pot.tool ? getTool(pot.tool) : null;
  // com tarefa do mês no cartão, o valor aparece nela; sem tarefa, o valor fica na linha do prazo
  const line = rows.length > 0 ? pot.when ?? '' : [pot.amount?.replace(' por mês', '/mês'), pot.when].filter(Boolean).join(' · ') || pot.statusText;
  return (
    <li id={`pot-${pot.id}`} className={`tl-item ${pot.status} ${open ? 'open' : ''}`}>
      <span className="tl-dot" aria-hidden="true" />
      <div className="tl-card">
        <div className="tl-top">
          <button type="button" className="tl-title" aria-expanded={open} onClick={onToggle}>
            <b>{pot.title}</b>
            {line && <span className="tl-line">{line}</span>}
          </button>
          <div className="tl-menu-wrap">
            <button
              type="button"
              className="menu-dots"
              aria-label={`Opções de ${pot.title}`}
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                onMenu();
              }}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="tl-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                {tool && (
                  <button type="button" role="menuitem" onClick={() => onOpenTool(tool.id)}>
                    Abrir {tool.title}
                  </button>
                )}
                <button type="button" role="menuitem" onClick={onRemove}>Tirar do plano</button>
              </div>
            )}
          </div>
        </div>

        {rows.length > 0 && (
          <ul className="tl-rows">
            {rows.map((r) => {
              const ok = done.includes(r.what);
              return (
                <li key={r.what} className={ok ? 'ok' : ''}>
                  <button type="button" className={`task-check ${ok ? 'on' : ''}`} aria-pressed={ok} aria-label={ok ? `Desmarcar: ${r.what}` : `Marcar como feito: ${r.what}`} onClick={() => onCheck(r.what)}>
                    <Check size={15} />
                  </button>
                  <span className="tl-row-what">{r.what}</span>
                  <b>{r.amount}</b>
                </li>
              );
            })}
          </ul>
        )}

        {pot.progress && <span className="tl-bar" aria-hidden="true"><i style={{ width: `${Math.max(pot.progress.pct, 3)}%` }} /></span>}

        {watchers.length > 0 && (
          <span className="tl-watch">
            <span className="tl-watch-faces">
              {watchers.map((w) => (
                <AgentAvatar key={w.id} id={w.custom ? undefined : w.id} name={w.name} hue={w.hue} size={22} />
              ))}
            </span>
            <small>De olho: {watchers.map((w) => w.name.split(':')[0]).join(', ')}</small>
          </span>
        )}

        {open && (
          <div className="tl-body">
            {pot.steps.length > 0 && (
              <ol className="pot-steps">
                {pot.steps.map((st, i) => (
                  <PotStep key={i} step={st} />
                ))}
              </ol>
            )}
            {pot.extra}
          </div>
        )}
      </div>
    </li>
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
const OFF_KEY = 'gs-plano-fora';
function readOff(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(OFF_KEY) || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function writeOff(list: string[]) {
  try {
    if (list.length === 0) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, JSON.stringify(list));
  } catch {
    // segue sem salvar
  }
}

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

/* ---------- Agentes do plano: adicionar e remover sem sair da aba ---------- */

function loadCustomAgents(): CustomAgent[] {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_AGENTS_KEY) || '[]') as CustomAgent[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function saveCustomAgents(list: CustomAgent[]) {
  try {
    localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('gs-agentes'));
  } catch {
    // segue sem salvar
  }
}

function PlanAgents() {
  const tasks = useTasks();
  const [mine, setMine] = useState<string[]>(loadChosen);
  const [custom, setCustom] = useState<CustomAgent[]>(loadCustomAgents);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ name: string; chosen: string[]; custom: CustomAgent[]; tasks: CoachTask[] } | null>(null);
  const open = (source: string) => tasks.filter((t) => !t.done && t.source === source);
  const mineAgents = AGENTS.filter((a) => mine.includes(a.id));
  const available = AGENTS.filter((a) => !mine.includes(a.id));

  const keep = (name: string) => setUndo({ name, chosen: loadChosen(), custom: loadCustomAgents(), tasks: getTasks() });
  const removeAgent = (id: string, name: string, tool: string) => {
    keep(name);
    const next = mine.filter((x) => x !== id);
    setMine(next);
    saveChosen(next);
    setToolTasks(tool as ToolId, []);
    setAsking(null);
  };
  const removeCustom = (c: CustomAgent) => {
    keep(c.name);
    const next = custom.filter((x) => x.id !== c.id);
    setCustom(next);
    saveCustomAgents(next);
    setToolTasks('goal', []);
    setAsking(null);
  };
  const add = (id: string) => {
    const next = [...mine, id];
    setMine(next);
    saveChosen(next);
  };
  const undoNow = () => {
    if (!undo) return;
    saveChosen(undo.chosen);
    saveCustomAgents(undo.custom);
    restoreTasks(undo.tasks);
    setMine(undo.chosen);
    setCustom(undo.custom);
    setUndo(null);
  };

  const confirmText = (name: string, n: number) => `Remover ${name}${n > 0 ? ` e ${n} ${n === 1 ? 'aviso' : 'avisos'} dele` : ''}?`;
  const askRow = (id: string, name: string, n: number, yes: () => void) => (
    <div className="bill-confirm" role="alertdialog" aria-label={confirmText(name, n)}>
      <p>{confirmText(name, n)}</p>
      <div className="bill-actions">
        <button type="button" className="btn-danger" onClick={yes}>Remover</button>
        <button type="button" className="btn-outline" onClick={() => setAsking(null)}>Manter</button>
      </div>
      <span hidden>{id}</span>
    </div>
  );

  return (
    <section className="plan-agents">
      <div className="block-head">
        <p className="section-label" style={{ margin: 0 }}>Agentes do plano</p>
        <button type="button" className="link-btn" onClick={() => setAdding((v) => !v)}>{adding ? 'Fechar' : '+ Adicionar'}</button>
      </div>

      {undo && (
        <div className="bill-undo" role="status">
          <span><b>{undo.name}</b> foi removido.</span>
          <button type="button" className="link-btn" onClick={undoNow}>Desfazer</button>
        </div>
      )}

      {mineAgents.length === 0 && custom.length === 0 && !adding && <p className="plan-empty">Nenhum agente no plano. Adicione os que vão te avisar no WhatsApp.</p>}

      <ul className="agent-rows">
        {mineAgents.map((a) => {
          const n = open(a.tool).length;
          return (
            <li key={a.id} className="agent-row stack">
              <div className="agent-row-line">
                <span className="agent-row-main static">
                  <AgentAvatar id={a.id} name={a.name} hue={a.hue} size={40} />
                  <span>
                    <b>{a.name}</b>
                    <small>{n > 0 ? `${n} ${n === 1 ? 'aviso' : 'avisos'} ativos` : a.does}</small>
                  </span>
                </span>
                <button type="button" className="agent-pick remove" onClick={() => setAsking(a.id)}>Remover</button>
              </div>
              {asking === a.id && askRow(a.id, a.name, n, () => removeAgent(a.id, a.name, a.tool))}
            </li>
          );
        })}
        {custom.map((c) => {
          const n = open('goal').length;
          return (
            <li key={c.id} className="agent-row stack">
              <div className="agent-row-line">
                <span className="agent-row-main static">
                  <AgentAvatar name={c.name} hue={45} size={40} />
                  <span>
                    <b>{c.name}</b>
                    <small>{customPlan(c).lines[0]}</small>
                  </span>
                </span>
                <button type="button" className="agent-pick remove" onClick={() => setAsking(c.id)}>Remover</button>
              </div>
              {asking === c.id && askRow(c.id, c.name, n, () => removeCustom(c))}
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="plan-add">
          {available.length > 0 ? (
            <ul className="agent-rows">
              {available.map((a) => (
                <li key={a.id} className="agent-row">
                  <span className="agent-row-main static">
                    <AgentAvatar id={a.id} name={a.name} hue={a.hue} size={40} />
                    <span>
                      <b>{a.name}</b>
                      <small>{a.does}</small>
                    </span>
                  </span>
                  <button type="button" className="agent-pick" onClick={() => add(a.id)}>
                    <Plus size={14} /> Adicionar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="plan-empty">Todos os agentes já estão no plano.</p>
          )}
          <Link className="link-btn" to="/conselheiros#criar">Criar o meu agente</Link>
        </div>
      )}
    </section>
  );
}

/* ---------- Cancelar ou recomeçar o plano ---------- */
// Apaga só o plano: diagnóstico, acompanhamento mês a mês, o "feito" do mês e os avisos do plano.
// Ficam os gastos do WhatsApp, as contas a pagar, os agentes e as metas. Dá pra desfazer por alguns minutos.

const RESET_PLAN_KEYS = ['selos-wizard-progress', 'selos-tracking', 'selos-diagnosis-completed', 'gs-mes-feito', OFF_KEY];
export const PLAN_BACKUP_KEY = 'gs-plano-desfazer'; // só neste aparelho, não sincroniza

function PlanManage() {
  const [openMenu, setOpenMenu] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try {
      const keys: Record<string, string> = {};
      for (const k of RESET_PLAN_KEYS) {
        const v = localStorage.getItem(k);
        if (v !== null) keys[k] = v;
      }
      localStorage.setItem(PLAN_BACKUP_KEY, JSON.stringify({ at: Date.now(), keys, tasks: getTasks() }));
      for (const k of RESET_PLAN_KEYS) localStorage.removeItem(k);
      setToolTasks('plano', []);
    } catch {
      // segue: o pior caso é não ter o desfazer
    }
    await pushNow();
    window.location.assign('/plano');
  };
  return (
    <section className="plan-manage">
      <button type="button" className="link-btn muted" aria-expanded={openMenu} onClick={() => setOpenMenu((v) => !v)}>
        Gerenciar plano
      </button>
      {openMenu && !asking && (
        <button type="button" className="manage-row" onClick={() => setAsking(true)}>
          <b>Recomeçar do zero</b>
          <small>Apaga o diagnóstico e os avisos do plano. Seus gastos, contas e agentes ficam.</small>
        </button>
      )}
      {openMenu && asking && (
        <div className="bill-confirm" role="alertdialog" aria-label="Recomeçar o plano?">
          <p>Recomeçar o plano do zero? Você pode desfazer logo depois.</p>
          <div className="bill-actions">
            <button type="button" className="btn-danger" disabled={busy} onClick={() => void reset()}>Recomeçar</button>
            <button type="button" className="btn-outline" onClick={() => setAsking(false)}>Manter</button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Depois de recomeçar: "Plano recomeçado. Desfazer" (10 minutos). */
export function PlanUndo() {
  const [backup, setBackup] = useState<{ at: number; keys: Record<string, string>; tasks: CoachTask[] } | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(PLAN_BACKUP_KEY) || 'null') as { at: number; keys: Record<string, string>; tasks: CoachTask[] } | null;
      if (v && Date.now() - v.at < 10 * 60 * 1000) setBackup(v);
      else localStorage.removeItem(PLAN_BACKUP_KEY);
    } catch {
      // sem desfazer
    }
  }, []);
  if (!backup) return null;
  const undo = async () => {
    try {
      for (const [k, v] of Object.entries(backup.keys)) localStorage.setItem(k, v);
      restoreTasks(backup.tasks);
      localStorage.removeItem(PLAN_BACKUP_KEY);
    } catch {
      // idem
    }
    await pushNow();
    window.location.assign('/plano');
  };
  return (
    <div className="bill-undo" role="status">
      <span>Plano recomeçado.</span>
      <button type="button" className="link-btn" onClick={() => void undo()}>Desfazer</button>
    </div>
  );
}
