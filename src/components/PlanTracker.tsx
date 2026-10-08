import { useMemo, useState } from 'react';
import { ArrowRight, Undo2, RotateCcw } from 'lucide-react';
import { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { monthLong, monthShort } from '../plan';
import { Tracking, getTracking, startTracking, trackingView, closeMonth, undoLastMonth } from '../tracking';
import { ToolShell, ToolNavProps } from './Tools';
import { DecimalInput } from './DecimalInput';
import { track } from '../analytics';

/* ---------- Meu plano, mês a mês ---------- */

export function PlanTracker({ data, onStart, ...nav }: { data: WizardData; onStart: () => void } & ToolNavProps) {
  const [tracking, setTracking] = useState<Tracking | null>(() => getTracking());
  const diag = data.monthlyIncome > 0;

  if (!tracking) {
    return (
      <ToolShell id="tracker" {...nav}>
        <p className="wizard-sub">
          Todo mês você diz quanto pagou de cada dívida e quanto guardou. O plano se recalcula com o saldo real: se atrasar, a nova data aparece na hora; se adiantar, também.
        </p>
        {diag ? (
          <button className="btn-primary" type="button" onClick={() => {
            track('plano_seguido');
            setTracking(startTracking(data));
          }}>
            Começar a seguir meu plano <ArrowRight size={16} className="arrow" />
          </button>
        ) : (
          <button className="btn-primary" type="button" onClick={onStart}>
            Fazer diagnóstico pra montar o plano <ArrowRight size={16} className="arrow" />
          </button>
        )}
      </ToolShell>
    );
  }

  return <TrackerBody key={tracking.months.length} tracking={tracking} setTracking={setTracking} data={data} nav={nav} />;
}

function TrackerBody({
  tracking,
  setTracking,
  data,
  nav,
}: {
  tracking: Tracking;
  setTracking: (t: Tracking | null) => void;
  data: WizardData;
  nav: ToolNavProps;
}) {
  const view = useMemo(() => trackingView(tracking), [tracking]);
  const start = new Date(tracking.createdAt);
  const [paid, setPaid] = useState<Record<string, number>>(() =>
    Object.fromEntries(view.tasks.map((t) => [t.id, Math.round(t.suggested * 100) / 100]))
  );
  const suggestedTotal = view.tasks.reduce((s, t) => s + t.suggested, 0);
  const paidTotal = Object.values(paid).reduce((s, v) => s + v, 0);
  const changedNumbers = JSON.stringify(data) !== JSON.stringify(tracking.baseline) && data.monthlyIncome > 0;

  const restart = () => {
    if (window.confirm('Recomeçar o acompanhamento com os números do seu último diagnóstico? O histórico atual será apagado.')) {
      setTracking(startTracking(data));
    }
  };

  const { current, debtShift } = view;
  const status =
    current.stuck
      ? { tone: 'bad', title: 'A dívida ainda não fecha', text: 'O que vai pro plano não cobre os juros. Renegociar é o próximo passo — veja a mensagem pronta no seu diagnóstico.' }
      : debtShift === null
        ? current.debts.length === 0 && tracking.baseline.debts.some((d) => d.value > 0)
          ? { tone: 'good', title: 'Livre de dívidas! 🎉', text: 'Agora o valor do plano vai todo pra reserva e, depois, pros investimentos.' }
          : { tone: 'good', title: 'No caminho', text: current.reserve.alreadyDone ? 'Reserva completa: agora é investir todo mês.' : 'Foco em completar a reserva de emergência.' }
        : debtShift > 0
          ? { tone: 'good', title: `${debtShift} ${debtShift === 1 ? 'mês adiantado' : 'meses adiantado'}`, text: `Você sai das dívidas em ${monthLong(start, view.debtFreeAbs ?? 0)}.` }
          : debtShift < 0
            ? { tone: 'warn', title: `${-debtShift} ${debtShift === -1 ? 'mês atrasado' : 'meses atrasado'}`, text: `O plano já foi ajustado: a nova data pra sair das dívidas é ${monthLong(start, view.debtFreeAbs ?? 0)}. Dá pra recuperar com o 13º ou cortando um vazamento.` }
            : { tone: 'good', title: 'No ritmo combinado', text: `Você sai das dívidas em ${monthLong(start, view.debtFreeAbs ?? 0)}.` };

  return (
    <ToolShell id="tracker" {...nav}>
      <div className={`insight insight-${status.tone}`} style={{ marginBottom: 16 }}>
        <b>{status.title}</b> — {status.text}
      </div>

      <div className="result-card">
        <p className="diag-label">Mês {view.openMonth} do plano · {monthLong(start, view.openMonth)}</p>
        <p className="result-big" style={{ fontSize: 'clamp(24px, 5vw, 32px)' }}>Combinado: {formatBRL(suggestedTotal)}</p>

        {view.tasks.length === 0 ? (
          <p className="field-hint">Nada combinado pra este mês.</p>
        ) : (
          <div className="tracker-tasks">
            {view.tasks.map((t) => (
              <div className="tracker-task" key={t.id}>
                <span>
                  <b>{t.label}</b>
                  <small>combinado {formatBRL(t.suggested)}</small>
                </span>
                <div className="input-prefix">
                  <span>R$</span>
                  <DecimalInput aria-label={`Quanto você pagou: ${t.label}`} value={paid[t.id] ?? 0} onChange={(v) => setPaid({ ...paid, [t.id]: v })} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="tracker-actions">
          <button className="btn-primary" type="button" onClick={() => {
            track('mes_fechado', { cumprido: paidTotal + 0.5 >= suggestedTotal });
            setTracking(closeMonth(tracking, paid));
          }}>
            Fechar {monthShort(start, view.openMonth)}
            {paidTotal + 0.5 < suggestedTotal ? ` (${formatBRL(paidTotal)})` : ''} <ArrowRight size={16} className="arrow" />
          </button>
          <button className="btn-outline" type="button" onClick={() => setPaid(Object.fromEntries(view.tasks.map((t) => [t.id, 0])))}>
            Não consegui pagar
          </button>
        </div>
        <p className="field-hint">Pagou um valor diferente? Ajuste os campos antes de fechar — o plano recalcula a partir do que você pagou de verdade.</p>
      </div>

      <div className="tracker-badges">
        {view.badges.map((b) => (
          <span key={b.id} className={`tracker-badge ${b.earned ? 'earned' : ''}`}>{b.label}</span>
        ))}
      </div>

      {tracking.months.length > 0 && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <p className="diag-label" style={{ marginBottom: 6 }}>
            Histórico{view.streak > 1 ? ` · ${view.streak} meses seguidos cumprindo o plano` : ''}
          </p>
          {tracking.months.map((m, i) => {
            const total = Object.values(m.paid).reduce((s, v) => s + v, 0);
            const ok = total >= view.original.monthlyPower * 0.95;
            return (
              <div className="plan-row" key={i}>
                <span className="plan-row-month">{monthShort(start, i + 1)}</span>
                <span>{formatBRL(total)} <small>de {formatBRL(view.original.monthlyPower)}</small></span>
                <span className={`plan-row-left tone-text-${ok ? 'good' : 'warn'}`}>{ok ? 'cumprido' : 'abaixo'}</span>
              </div>
            );
          })}
          <button type="button" className="plan-more" onClick={() => setTracking(undoLastMonth(tracking))}>
            <Undo2 size={15} /> Desfazer o último mês
          </button>
        </div>
      )}

      {changedNumbers && (
        <button type="button" className="plan-more" onClick={restart} style={{ marginTop: 12 }}>
          <RotateCcw size={15} /> Você refez o diagnóstico — recomeçar com os números novos
        </button>
      )}
    </ToolShell>
  );
}
