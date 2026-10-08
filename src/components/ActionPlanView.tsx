import { useState } from 'react';
import { Copy, Check, ChevronDown, ShieldAlert } from 'lucide-react';
import { ActionPlan, monthShort } from '../plan';
import { formatBRL } from '../calculations';

/* ---------- Plano de ação: valor mensal, fases, passos, renegociação e calendário ---------- */

export function ActionPlanView({ plan, locked, lockedSlot }: { plan: ActionPlan; locked: boolean; lockedSlot?: React.ReactNode }) {
  const visibleSteps = locked ? plan.steps.slice(0, 1) : plan.steps;

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
      </div>

      {!locked && plan.negotiation && <NegotiationCard negotiation={plan.negotiation} />}
      {!locked && plan.schedule.length > 0 && <ScheduleTable plan={plan} />}

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
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(negotiation.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // clipboard bloqueado: deixa o texto selecionável pra copiar na mão
      setManual(true);
    }
  };

  return (
    <div className="stat-card plan-nego">
      <p className="diag-label" style={{ marginBottom: 4 }}>Mensagem pronta pra renegociar · {negotiation.debtName}</p>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Mande pelo app, chat ou SAC de quem você deve. Também dá pra negociar no Serasa Limpa Nome e reclamar no consumidor.gov.br se não tiver resposta.
      </p>
      <pre className={`plan-nego-text ${manual ? 'manual' : ''}`}>{negotiation.message}</pre>
      <button type="button" className="btn-outline" onClick={copy} style={{ marginTop: 10 }}>
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado!' : 'Copiar mensagem'}
      </button>
      <p className="plan-nego-warn">
        <ShieldAlert size={15} /> Nunca pague taxa antecipada pra "limpar o nome" ou liberar empréstimo — é golpe.
      </p>
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
                <span key={p.name}>
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
