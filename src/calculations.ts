import { useState } from 'react';
import { CheckinEntry } from '../types';
import { formatBRL, checkinActionPlan } from '../calculations';
import { getCheckins, addCheckin } from '../config';

function savingsRateOf(e: CheckinEntry): number {
  return e.monthlyIncome > 0 ? (e.currentSavings / e.monthlyIncome) * 100 : 0;
}

export function CheckInTool({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<CheckinEntry[]>(() => getCheckins());
  const [showForm, setShowForm] = useState(entries.length === 0);

  const [income, setIncome] = useState(entries.at(-1)?.monthlyIncome || 0);
  const [savings, setSavings] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [debt, setDebt] = useState(entries.at(-1)?.totalDebt || 0);

  const submit = () => {
    const entry: CheckinEntry = {
      date: new Date().toISOString(),
      monthlyIncome: income,
      currentSavings: savings,
      totalExpenses: expenses,
      totalDebt: debt,
    };
    addCheckin(entry);
    setEntries((prev) => [...prev, entry]);
    setShowForm(false);
  };

  const last = entries.at(-1);
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
  const rateNow = last ? savingsRateOf(last) : 0;
  const ratePrev = prev ? savingsRateOf(prev) : null;
  const maxRate = Math.max(10, ...entries.map(savingsRateOf));
  const maxDebt = Math.max(1, ...entries.map((e) => e.totalDebt));
  const actionPlan = last ? checkinActionPlan(last) : [];

  return (
    <div className="wizard-wrap">
      <div className="wizard-card" style={{ maxWidth: 600 }}>
        <div className="wizard-kicker"><span className="wedge" />Check-in mensal</div>
        <h2 className="wizard-h2">Como você está esse mês?</h2>

        {!showForm && last && (
          <>
            <p className="wizard-sub">
              Último check-in em {new Date(last.date).toLocaleDateString('pt-BR')}.
            </p>

            <div className="diag-section">
              <p className="diag-label">Taxa de poupança</p>
              <p className="diag-number">
                {rateNow.toFixed(0)}%
                {ratePrev !== null && (
                  <span style={{ fontSize: 14, color: rateNow >= ratePrev ? 'var(--gold-deep)' : 'var(--clay)', marginLeft: 10, fontFamily: "'IBM Plex Sans',sans-serif" }}>
                    {rateNow >= ratePrev ? '▲' : '▼'} {Math.abs(rateNow - ratePrev).toFixed(0)}pp vs. mês anterior
                  </span>
                )}
              </p>
            </div>

            {entries.length > 1 && (
              <div className="diag-section">
                <p className="diag-label">Histórico de poupança</p>
                {entries.map((e, i) => (
                  <div className="bar-row" key={i}>
                    <span className="bar-label">{new Date(e.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(savingsRateOf(e) / maxRate) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {entries.length > 1 && entries.some((e) => e.totalDebt > 0) && (
              <div className="diag-section">
                <p className="diag-label">Histórico de dívida total</p>
                {entries.map((e, i) => (
                  <div className="bar-row" key={i}>
                    <span className="bar-label">{new Date(e.date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(e.totalDebt / maxDebt) * 100}%`, background: 'var(--clay)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="diag-section">
              <p className="diag-label">Seu plano de ação desse mês</p>
              <div className="action-list">
                {actionPlan.map((item, i) => (
                  <div className="action-item" key={i}>
                    <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
                    <p style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn-primary" type="button" onClick={() => setShowForm(true)} style={{ marginTop: 8 }}>
              Fazer novo check-in
            </button>
          </>
        )}

        {showForm && (
          <>
            <p className="wizard-sub">Leva 1 minuto — só os números principais do mês.</p>
            <div className="field-group">
              <label className="field-label">Renda mensal</label>
              <input className="field-input" type="number" min="0" value={income || ''} onChange={(e) => setIncome(Math.max(parseFloat(e.target.value) || 0, 0))} />
            </div>
            <div className="field-group">
              <label className="field-label">Quanto guardou esse mês</label>
              <input className="field-input" type="number" min="0" value={savings || ''} onChange={(e) => setSavings(Math.max(parseFloat(e.target.value) || 0, 0))} />
            </div>
            <div className="field-group">
              <label className="field-label">Total de gastos esse mês</label>
              <input className="field-input" type="number" min="0" value={expenses || ''} onChange={(e) => setExpenses(Math.max(parseFloat(e.target.value) || 0, 0))} />
            </div>
            <div className="field-group">
              <label className="field-label">Total de dívidas hoje</label>
              <input className="field-input" type="number" min="0" value={debt || ''} onChange={(e) => setDebt(Math.max(parseFloat(e.target.value) || 0, 0))} />
            </div>
            <button className="btn-primary" type="button" onClick={submit} disabled={income <= 0}>
              Salvar check-in
            </button>
          </>
        )}

        <div className="wizard-nav">
          <button className="btn-outline" type="button" onClick={onClose}>Voltar</button>
          <span />
        </div>
      </div>
    </div>
  );
}
