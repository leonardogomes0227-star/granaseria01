import { useState } from 'react';
import { ChevronDown, ShieldAlert } from 'lucide-react';
import { CopyMessage } from './CopyMessage';
import { ActionPlan, monthShort } from '../plan';
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
  // os 3 primeiros passos aparecem; o resto e os extras (mensagem pra renegociar, direitos, calendário) ficam a um toque
  const [allSteps, setAllSteps] = useState(false);
  const [extras, setExtras] = useState(false);
  const visibleSteps = locked ? plan.steps.slice(0, 1) : allSteps ? plan.steps : plan.steps.slice(0, FIRST_STEPS);
  const hiddenSteps = locked ? 0 : plan.steps.length - visibleSteps.length;
  const hasRights = relevantRights(plan).length > 0;
  const hasExtras = !locked && (Boolean(plan.negotiation) || plan.schedule.length > 0 || hasRights);

  return (
    <div className="plan">
      <PowerStrip plan={plan} />

      {plan.phases.length > 0 && <PhaseTimeline plan={plan} />}

      <div className={locked ? 'paywall' : undefined}>
        <div className={locked ? 'paywall-teaser' : 'action-list stagger'}>
          {visibleSteps.map((s, i) => (
            <div className="action-item" key={i}>
              <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className={`plan-step-title tone-text-${s.tone}`}>{s.title}</p>
                <p>{s.detail}</p>
              </div>
            </div>
          ))}
          {locked && <div className="paywall-fade" />}
        </div>
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
        individual de investimento — confira as taxas do seu contrato.
      </p>
    </div>
  );
}

function PowerStrip({ plan }: { plan: ActionPlan }) {
  const parts = [
    { label: 'o que você já guarda', value: plan.sources.savings },
    { label: 'cortes nos gastos', value: plan.sources.cuts },
    { label: 'parcelas que já paga', value: plan.sources.installments },
    { label: 'vazamentos achados', value: plan.sources.leaks },
  ].filter((p) => p.value > 0);

  return (
    <div className="plan-power stat-card">
      <p className="diag-label" style={{ marginBottom: 4 }}>Quanto vai pro plano todo mês</p>
      <p className="diag-number">{formatBRL(plan.monthlyPower)}</p>
      {plan.powerAssumed ? (
        <p className="field-hint" style={{ marginTop: 4 }}>10% da sua renda — o mínimo do livro, já que hoje não sobra nada declarado.</p>
      ) : (
        <div className="plan-chips">
          {parts.map((p) => (
            <span key={p.label}>
              <b>{formatBRL(p.value)}</b> {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseTimeline({ plan }: { plan: ActionPlan }) {
  return (
    <ol className="plan-phases">
      {plan.phases.map((ph, i) => (
        <li key={ph.id} className={`plan-phase phase-${ph.id}`}>
          <span className="plan-phase-dot">{i + 1}</span>
          <div>
            <p className="plan-phase-when">
              {monthShort(plan.start, ph.from)}
              {ph.to === null ? (ph.id === 'invest' ? ' em diante' : ' → sem data') : ph.to > ph.from ? ` → ${monthShort(plan.start, ph.to)}` : ''}
            </p>
            <p className="plan-phase-title">{ph.title}</p>
            <p className="plan-phase-note">{ph.note}</p>
          </div>
        </li>
      ))}
    </ol>
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
