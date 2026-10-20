import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Undo2, RotateCcw } from 'lucide-react';
import { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { monthLong, monthShort } from '../plan';
import { Tracking, getTracking, startTracking, trackingView, closeMonth, undoLastMonth } from '../tracking';
import { ToolShell, ToolNavProps } from './Tools';
import { DecimalInput } from './DecimalInput';
import { track } from '../analytics';
import { saveResult } from '../results';
import { fetchPainel, painelToken } from '../painel';

/* ---------- Meu plano, mês a mês ---------- */

export function PlanTracker({ data, onStart, ...nav }: { data: WizardData; onStart: () => void } & ToolNavProps) {
  const [tracking, setTracking] = useState<Tracking | null>(() => getTracking());
  const diag = data.monthlyIncome > 0;

  if (!tracking) {
    return (
      <ToolShell id="tracker" {...nav}>
        <p className="wizard-sub">
          Uma vez por mês você responde uma pergunta: fez o combinado? O plano ajusta as datas sozinho.
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

type Choice = 'all' | 'part' | 'none';

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
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [part, setPart] = useState<Record<string, number>>({});
  const changedNumbers = JSON.stringify(data) !== JSON.stringify(tracking.baseline) && data.monthlyIncome > 0;
  const { current, debtShift, original } = view;
  const month = monthLong(start, view.openMonth);
  const allChosen = view.tasks.every((t) => choice[t.id]);

  // o que a pessoa anotou como "guardei" no WhatsApp neste mês já serve de resposta pra reserva
  const [guardado, setGuardado] = useState(0);
  useEffect(() => {
    if (!painelToken()) return;
    void fetchPainel()
      .then((d) => setGuardado((d?.month.expenses ?? []).filter((e) => e.category === 'Guardado').reduce((x, e) => x + e.amount, 0)))
      .catch(() => undefined);
  }, []);
  const reserveTask = view.tasks.find((t) => t.id === 'reserve');
  const useGuardado = () => {
    if (!reserveTask) return;
    if (guardado + 0.5 >= reserveTask.suggested) setChoice({ ...choice, reserve: 'all' });
    else {
      setChoice({ ...choice, reserve: 'part' });
      setPart({ ...part, reserve: Math.round(guardado * 100) / 100 });
    }
  };

  const restart = () => {
    if (window.confirm('Recomeçar o acompanhamento com os números do seu último diagnóstico? O histórico atual será apagado.')) {
      setTracking(startTracking(data));
    }
  };
  const save = () => {
    const paid = Object.fromEntries(
      view.tasks.map((t) => [t.id, choice[t.id] === 'all' ? Math.round(t.suggested * 100) / 100 : choice[t.id] === 'part' ? part[t.id] ?? 0 : 0])
    );
    const total = Object.values(paid).reduce((x, v) => x + v, 0);
    const combined = view.tasks.reduce((x, t) => x + t.suggested, 0);
    track('mes_fechado', { cumprido: total + 0.5 >= combined });
    saveResult('tracker', `${month}: ${total + 0.5 >= combined ? 'fez o combinado' : `guardou/pagou ${formatBRL(total)} de ${formatBRL(combined)}`}`, {
      label: `Último mês fechado: ${month}`,
      big: total + 0.5 >= combined ? 'Fez o combinado ✅' : `${formatBRL(total)} de ${formatBRL(combined)}`,
      rows: [
        ...view.tasks.map((t) => [t.label, `${formatBRL(paid[t.id] ?? 0)} de ${formatBRL(t.suggested)}`] as [string, string]),
        ['Meses fechados', String(tracking.months.length + 1)],
      ],
    });
    setTracking(closeMonth(tracking, paid));
  };

  // uma frase só sobre como está o plano, e a próxima meta com data
  const reserveDate = current.reserve.doneMonth !== null && !current.reserve.alreadyDone ? monthLong(current.start, current.reserve.doneMonth) : null;
  // sem dívida, o que mexe é a data da reserva: compara com a do plano original (meses contados desde o começo)
  const reserveAbs = current.reserve.doneMonth !== null ? tracking.months.length + current.reserve.doneMonth : null;
  const reserveShift = original.debts.length === 0 && original.reserve.doneMonth !== null && reserveAbs !== null ? original.reserve.doneMonth - reserveAbs : 0;
  const status = current.stuck
    ? { tone: 'bad', text: 'Com o valor de hoje, a dívida não fecha. O próximo passo é renegociar (veja "Seus direitos com o banco").' }
    : debtShift !== null && debtShift < 0
      ? { tone: 'warn', text: `Você está ${-debtShift} ${debtShift === -1 ? 'mês' : 'meses'} atrasado. Sem problema: a nova data pra sair das dívidas é ${monthLong(start, view.debtFreeAbs ?? 0)}.` }
      : debtShift !== null && debtShift > 0
        ? { tone: 'good', text: `Você está ${debtShift} ${debtShift === 1 ? 'mês' : 'meses'} adiantado! Sai das dívidas em ${monthLong(start, view.debtFreeAbs ?? 0)}.` }
        : reserveShift < 0 && reserveDate
          ? { tone: 'warn', text: `Você está ${-reserveShift} ${reserveShift === -1 ? 'mês' : 'meses'} atrás do combinado. Sem problema: sua reserva agora fica pronta em ${reserveDate}.` }
          : reserveShift > 0 && reserveDate
            ? { tone: 'good', text: `Você está ${reserveShift} ${reserveShift === 1 ? 'mês' : 'meses'} adiantado! Sua reserva fica pronta em ${reserveDate}.` }
        : current.debts.length > 0 && view.debtFreeAbs !== null
          ? { tone: 'good', text: `Você está em dia. Sai das dívidas em ${monthLong(start, view.debtFreeAbs)}.` }
          : reserveDate
            ? { tone: 'good', text: `Você está em dia. Sua reserva de emergência fica pronta em ${reserveDate}.` }
            : { tone: 'good', text: 'Você está em dia. Reserva pronta: agora o dinheiro vai pros investimentos.' };

  // o último mês fechado ficou abaixo do combinado: diz quanto faltou, mesmo quando a data final não muda
  const lastMonth = tracking.months[tracking.months.length - 1];
  const lastPaid = lastMonth ? Object.values(lastMonth.paid).reduce((x, v) => x + v, 0) : 0;
  const lastShort = lastMonth ? Math.round(view.original.monthlyPower - lastPaid) : 0;
  if (lastShort > view.original.monthlyPower * 0.05 && status.tone === 'good' && status.text.startsWith('Você está em dia')) {
    status.tone = 'warn';
    status.text = `No último mês faltaram ${formatBRL(lastShort)}. ${status.text.replace('Você está em dia. ', '')} Se der, complete este mês.`;
  }

  const from = [
    current.sources.savings > 0 && `${formatBRL(current.sources.savings)} que você já guarda`,
    current.sources.cuts > 0 && `${formatBRL(current.sources.cuts)} cortando gastos`,
    current.sources.installments > 0 && `${formatBRL(current.sources.installments)} das parcelas que você já paga`,
    current.sources.leaks > 0 && `${formatBRL(current.sources.leaks)} de vazamentos`,
  ].filter(Boolean);
  const earned = view.badges.filter((b) => b.earned);

  return (
    <ToolShell id="tracker" {...nav}>
      <div className={`tk-status tk-${status.tone}`}>{status.text}</div>

      <div className="tk-month">
        <p className="tk-q">{month.charAt(0).toUpperCase() + month.slice(1)}: você fez o combinado?</p>
        {from.length > 0 && <p className="tk-from">O valor vem do seu plano de ação: {from.join(' + ')}.</p>}

        {reserveTask && guardado > 0 && (
          <div className="tk-wa">
            💬 Pelo WhatsApp, você anotou <b>{formatBRL(guardado)}</b> como guardado neste mês.
            <button type="button" className="btn-outline" onClick={useGuardado}>Usar esse valor</button>
          </div>
        )}
        {reserveTask && guardado === 0 && painelToken() && (
          <p className="field-hint" style={{ marginBottom: 10 }}>Dica: mande <i>guardei 500</i> no WhatsApp quando separar o dinheiro, e ele já aparece aqui.</p>
        )}

        {view.tasks.length === 0 ? (
          <p className="field-hint">Nada combinado pra este mês.</p>
        ) : (
          view.tasks.map((t) => (
            <div className="tk-task" key={t.id}>
              <p className="tk-task-head">
                <b>{t.label}</b>
                <span>{formatBRL(t.suggested)}</span>
              </p>
              <div className="tk-choices" role="radiogroup" aria-label={t.label}>
                {([
                  ['all', '✅ Fiz tudo'],
                  ['part', '🤏 Fiz uma parte'],
                  ['none', '❌ Não deu'],
                ] as [Choice, string][]).map(([c, label]) => (
                  <button key={c} type="button" role="radio" aria-checked={choice[t.id] === c} className={choice[t.id] === c ? 'on' : ''} onClick={() => setChoice({ ...choice, [t.id]: c })}>
                    {label}
                  </button>
                ))}
              </div>
              {choice[t.id] === 'part' && (
                <div className="tk-part">
                  <label className="field-label" htmlFor={`tk-${t.id}`}>Quanto você conseguiu?</label>
                  <div className="input-prefix">
                    <span>R$</span>
                    <DecimalInput id={`tk-${t.id}`} value={part[t.id] ?? 0} onChange={(v) => setPart({ ...part, [t.id]: v })} />
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {view.tasks.length > 0 && (
          <button className="btn-primary tk-save" type="button" disabled={!allChosen} onClick={save}>
            Salvar {month} <ArrowRight size={16} className="arrow" />
          </button>
        )}
        <p className="field-hint">Se não deu, tudo bem: o plano recalcula as datas sozinho.</p>
      </div>

      {earned.length > 0 && (
        <div className="tracker-badges">
          {earned.map((b) => (
            <span key={b.id} className="tracker-badge earned">🏅 {b.label}</span>
          ))}
        </div>
      )}

      {tracking.months.length > 0 && (
        <div className="stat-card" style={{ marginTop: 16 }}>
          <p className="diag-label" style={{ marginBottom: 6 }}>Meses que você já fechou</p>
          {tracking.months.map((m, i) => {
            const total = Object.values(m.paid).reduce((x, v) => x + v, 0);
            const ok = total >= view.original.monthlyPower * 0.95;
            return (
              <div className="plan-row" key={i}>
                <span className="plan-row-month">{monthShort(start, i + 1)}</span>
                <span>{formatBRL(total)}</span>
                <span className={`plan-row-left tone-text-${ok ? 'good' : 'warn'}`}>{ok ? '✅ fez' : 'parte'}</span>
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
          <RotateCcw size={15} /> Você refez o diagnóstico: recomeçar com os números novos
        </button>
      )}
    </ToolShell>
  );
}
