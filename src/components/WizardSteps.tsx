import { useState } from 'react';
import { WizardData, DebtItem } from './types';
import { Diagnosis, formatBRL } from './calculations';

/* ---------- shared bits ---------- */

function SealMini({ numeral }: { numeral: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="14" fill="#C6842A" />
      <circle cx="15" cy="15" r="14" fill="none" stroke="#7A5311" strokeWidth="1" />
      <text x="15" y="20" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="12" fill="#3A2506">
        {numeral}
      </text>
    </svg>
  );
}

function SeloBadge({ numeral, label }: { numeral: string; label: string }) {
  return (
    <div className="selo-badge">
      <SealMini numeral={numeral} />
      <span className="label">Selo {numeral} · {label}</span>
    </div>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="wizard-progress">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`wizard-dot ${i < step - 1 ? 'done' : i === step - 1 ? 'active' : ''}`}
        />
      ))}
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  canNext = true,
  nextLabel = 'Continuar',
}: {
  onBack?: () => void;
  onNext: () => void;
  canNext?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="wizard-nav">
      {onBack ? (
        <button className="btn-outline" onClick={onBack} type="button">
          Voltar
        </button>
      ) : (
        <span />
      )}
      <button className="btn-primary" onClick={onNext} disabled={!canNext} type="button">
        {nextLabel}
      </button>
    </div>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <input
        className="field-input"
        type="number"
        inputMode="decimal"
        placeholder="R$ 0,00"
        value={value || ''}
        autoFocus={autoFocus}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

/* ---------- shared step props ---------- */

interface StepProps {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  updateExpenses: (key: keyof WizardData['expenses'], value: number) => void;
  onNext: () => void;
  onBack: () => void;
  canNext: boolean;
}

/* ---------- step 1: renda ---------- */

export function IncomeStep({ data, update, onNext }: StepProps) {
  return (
    <div className="wizard-card">
      <ProgressDots step={1} total={6} />
      <div className="wizard-kicker"><span className="wedge" />Etapa 1 de 6</div>
      <h2 className="wizard-h2">Qual sua renda mensal?</h2>
      <p className="wizard-sub">Considere o que entra todo mês, depois dos impostos.</p>
      <CurrencyField
        label="Renda mensal"
        value={data.monthlyIncome}
        onChange={(v) => update({ monthlyIncome: v })}
        autoFocus
      />
      <WizardNav onNext={onNext} canNext={data.monthlyIncome > 0} />
    </div>
  );
}

/* ---------- step 2: quanto guarda hoje ---------- */

export function SavingsStep({ data, update, onNext, onBack }: StepProps) {
  return (
    <div className="wizard-card">
      <ProgressDots step={2} total={6} />
      <div className="wizard-kicker"><span className="wedge" />Etapa 2 de 6</div>
      <SeloBadge numeral="I" label="pague-se primeiro" />
      <h2 className="wizard-h2">Quanto você guarda hoje, por mês?</h2>
      <p className="wizard-sub">Antes de qualquer gasto — o que já vira poupança ou investimento.</p>
      <CurrencyField
        label="Valor guardado por mês"
        value={data.currentSavings}
        onChange={(v) => update({ currentSavings: v })}
        autoFocus
      />
      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ---------- step 3: gastos por categoria ---------- */

export function ExpensesStep({ data, updateExpenses, onNext, onBack }: StepProps) {
  return (
    <div className="wizard-card">
      <ProgressDots step={3} total={6} />
      <div className="wizard-kicker"><span className="wedge" />Etapa 3 de 6</div>
      <SeloBadge numeral="II" label="controle os gastos" />
      <h2 className="wizard-h2">Seus gastos mensais, por categoria</h2>
      <p className="wizard-sub">Vale a estimativa — dá pra ajustar depois.</p>
      <CurrencyField
        label="Moradia"
        value={data.expenses.moradia}
        onChange={(v) => updateExpenses('moradia', v)}
        autoFocus
      />
      <CurrencyField
        label="Alimentação"
        value={data.expenses.alimentacao}
        onChange={(v) => updateExpenses('alimentacao', v)}
      />
      <CurrencyField
        label="Transporte"
        value={data.expenses.transporte}
        onChange={(v) => updateExpenses('transporte', v)}
      />
      <CurrencyField
        label="Lazer"
        value={data.expenses.lazer}
        onChange={(v) => updateExpenses('lazer', v)}
      />
      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ---------- step 4: dívidas ---------- */

export function DebtsStep({ data, update, onNext, onBack }: StepProps) {
  const addDebt = () => {
    const newDebt: DebtItem = { id: crypto.randomUUID(), description: '', value: 0 };
    update({ debts: [...data.debts, newDebt] });
  };
  const updateDebt = (id: string, patch: Partial<DebtItem>) => {
    update({ debts: data.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  };
  const removeDebt = (id: string) => {
    update({ debts: data.debts.filter((d) => d.id !== id) });
  };
  const total = data.debts.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="wizard-card">
      <ProgressDots step={4} total={6} />
      <div className="wizard-kicker"><span className="wedge" />Etapa 4 de 6</div>
      <SeloBadge numeral="IV" label="proteja-se de perdas" />
      <h2 className="wizard-h2">Você tem alguma dívida?</h2>
      <p className="wizard-sub">Cadastre cada uma — cartão, empréstimo, financiamento.</p>

      {data.debts.map((debt) => (
        <div className="debt-row" key={debt.id}>
          <input
            className="field-input"
            type="text"
            placeholder="Descrição (ex: cartão de crédito)"
            value={debt.description}
            onChange={(e) => updateDebt(debt.id, { description: e.target.value })}
          />
          <input
            className="field-input"
            type="number"
            placeholder="R$"
            style={{ maxWidth: 120 }}
            value={debt.value || ''}
            onChange={(e) => updateDebt(debt.id, { value: parseFloat(e.target.value) || 0 })}
          />
          <button className="debt-remove" type="button" onClick={() => removeDebt(debt.id)}>
            ×
          </button>
        </div>
      ))}

      <button className="add-debt" type="button" onClick={addDebt}>
        + Adicionar dívida
      </button>

      {data.debts.length > 0 && (
        <p className="wizard-sub" style={{ marginTop: 16, marginBottom: 0 }}>
          Total: <strong>{formatBRL(total)}</strong>
        </p>
      )}

      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ---------- step 5: reserva de emergência ---------- */

export function EmergencyStep({ data, update, onNext, onBack }: StepProps) {
  return (
    <div className="wizard-card">
      <ProgressDots step={5} total={6} />
      <div className="wizard-kicker"><span className="wedge" />Etapa 5 de 6</div>
      <h2 className="wizard-h2">Quanto você já tem de reserva de emergência?</h2>
      <p className="wizard-sub">Dinheiro guardado, líquido, pra imprevistos.</p>
      <CurrencyField
        label="Reserva de emergência"
        value={data.emergencyFund}
        onChange={(v) => update({ emergencyFund: v })}
        autoFocus
      />
      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Ver diagnóstico" />
    </div>
  );
}

/* ---------- step 6: diagnóstico ---------- */

export function DiagnosisStep({
  data,
  diagnosis,
  onRestart,
}: {
  data: WizardData;
  diagnosis: Diagnosis;
  onRestart: () => void;
}) {
  const categories: { key: keyof WizardData['expenses']; label: string }[] = [
    { key: 'moradia', label: 'Moradia' },
    { key: 'alimentacao', label: 'Alimentação' },
    { key: 'transporte', label: 'Transporte' },
    { key: 'lazer', label: 'Lazer' },
  ];
  const maxBar = Math.max(
    diagnosis.totalExpenses,
    ...Object.values(diagnosis.idealExpenses)
  ) || 1;

  return (
    <div className="wizard-card" style={{ maxWidth: 640 }}>
      <div className="wizard-kicker"><span className="wedge" />Seu diagnóstico</div>
      <h2 className="wizard-h2">Aqui está o retrato da sua vida financeira</h2>

      <div className="diag-section">
        <p className="diag-label">Meta de poupança (Selo I — pague-se primeiro)</p>
        <p className="diag-number">
          {diagnosis.savingsRate.toFixed(0)}% <span style={{ fontSize: 15, color: 'var(--ink-faint)', fontFamily: "'IBM Plex Sans',sans-serif" }}>de {diagnosis.savingsGoalRate}% ideal</span>
        </p>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.min((diagnosis.savingsRate / diagnosis.savingsGoalRate) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="diag-section">
        <p className="diag-label">Gastos por categoria vs. ideal (Selo II — controle os gastos)</p>
        {categories.map((c) => (
          <div className="bar-row" key={c.key}>
            <span className="bar-label">{c.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(data.expenses[c.key] / maxBar) * 100}%` }} />
              <div
                className="bar-ideal-mark"
                style={{ left: `${(diagnosis.idealExpenses[c.key] / maxBar) * 100}%` }}
              />
            </div>
          </div>
        ))}
        <p className="wizard-sub" style={{ marginTop: 4, marginBottom: 0, fontSize: 12.5 }}>
          Barra dourada: seu gasto real. Linha azul: teto ideal recomendado.
        </p>
      </div>

      <div className="diag-section">
        <p className="diag-label">Dívidas (Selo IV — proteja-se de perdas)</p>
        <p className="diag-number">{formatBRL(diagnosis.totalDebt)}</p>
      </div>

      <div className="diag-section">
        <p className="diag-label">Reserva de emergência</p>
        <p className="diag-number">{diagnosis.emergencyProgress.toFixed(0)}%</p>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${diagnosis.emergencyProgress}%` }} />
        </div>
      </div>

      <div className="diag-section">
        <p className="diag-label">Projeção em 10 anos, guardando 10% da renda todo mês</p>
        <p className="diag-number">{formatBRL(diagnosis.projection10y)}</p>
      </div>

      <div className="diag-section" style={{ marginBottom: 8 }}>
        <p className="diag-label">Seu plano de ação</p>
        <div className="action-list">
          {diagnosis.actionPlan.map((item, i) => (
            <div className="action-item" key={i}>
              <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
              <p style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>{item}</p>
            </div>
          ))}
          {diagnosis.actionPlan.length === 0 && (
            <p style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>
              Você já está em dia com os três princípios — continue assim.
            </p>
          )}
        </div>
      </div>

      <WizardNav onNext={onRestart} nextLabel="Refazer diagnóstico" canNext />
    </div>
  );
}
