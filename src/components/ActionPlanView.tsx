import { useState } from 'react';
import { ArrowRight, ChevronDown, ShieldAlert } from 'lucide-react';
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
            {step.amount && <span>💰 {step.amount}</span>}
            {step.when && <span>📅 {step.when}</span>}
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
