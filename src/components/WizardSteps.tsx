import { useState, useEffect } from 'react';
import { WizardData, DebtItem } from '../types';
import { Diagnosis, formatBRL } from '../calculations';
import { CHECKOUT_URL, PRICE_LABEL, isUnlocked, markDiagnosisCompleted } from '../config';
import { ShareDiagnosisButton } from './SelosAndShare';
import { ArrowRight, Pencil, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CountUp, AnimatedFill } from './motion';
import { TOOLS, ToolId } from '../tools';
import { ToolIcon } from './Layout';

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
  // começa na largura da etapa anterior e anima até a atual
  const [pct, setPct] = useState(((step - 1) / total) * 100);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPct((step / total) * 100));
    return () => cancelAnimationFrame(id);
  }, [step, total]);
  return (
    <div className="wizard-progress">
      <div className="wizard-progress-meta">
        <span>Etapa <b>{step}</b> de {total}</span>
        <span>{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="wizard-progress-track">
        <div className="wizard-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WizardNav({
  onBack,
  onNext,
  canNext = true,
  nextLabel = 'Continuar',
  loading = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  canNext?: boolean;
  nextLabel?: string;
  loading?: boolean;
}) {
  return (
    <div className="wizard-nav">
      {onBack ? (
        <button className="btn-outline" onClick={onBack} type="button" disabled={loading}>
          Voltar
        </button>
      ) : (
        <span />
      )}
      <button className="btn-primary" onClick={onNext} disabled={!canNext || loading} type="button">
        {loading && <span className="btn-spinner" />}
        {loading ? 'Aguarde...' : nextLabel}
        {!loading && <ArrowRight size={16} className="arrow" />}
      </button>
    </div>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
  autoFocus,
  error,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  autoFocus?: boolean;
  error?: string;
}) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="input-prefix">
        <span>R$</span>
        <input
          className="field-input"
          type="number"
          inputMode="decimal"
          min="0"
          max="99999999"
          placeholder="0"
          value={value || ''}
          autoFocus={autoFocus}
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            const clamped = isNaN(raw) ? 0 : Math.min(Math.max(raw, 0), 99999999);
            onChange(clamped);
          }}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
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
      <ProgressDots step={1} total={7} />
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
      <ProgressDots step={2} total={7} />
      <SeloBadge numeral="I" label="pague-se primeiro" />
      <h2 className="wizard-h2">Quanto você guarda hoje, por mês?</h2>
      <p className="wizard-sub">Antes de qualquer gasto — o que já vira poupança ou investimento.</p>
      <CurrencyField
        label="Valor guardado por mês"
        value={data.currentSavings}
        onChange={(v) => update({ currentSavings: v })}
        autoFocus
        error={
          data.monthlyIncome > 0 && data.currentSavings > data.monthlyIncome
            ? 'Esse valor é maior que sua renda mensal — confere aí.'
            : undefined
        }
      />
      <WizardNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

/* ---------- step 3: gastos por categoria ---------- */

export function ExpensesStep({ data, updateExpenses, onNext, onBack }: StepProps) {
  return (
    <div className="wizard-card">
      <ProgressDots step={3} total={7} />
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
      <ProgressDots step={4} total={7} />
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
            min="0"
            max="99999999"
            placeholder="R$ valor"
            value={debt.value || ''}
            onChange={(e) => {
              const raw = parseFloat(e.target.value);
              const clamped = isNaN(raw) ? 0 : Math.min(Math.max(raw, 0), 99999999);
              updateDebt(debt.id, { value: clamped });
            }}
          />
          <input
            className="field-input"
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="% juros a.m."
            value={debt.interestRate || ''}
            onChange={(e) => {
              const raw = parseFloat(e.target.value);
              const clamped = isNaN(raw) ? 0 : Math.min(Math.max(raw, 0), 100);
              updateDebt(debt.id, { interestRate: clamped });
            }}
          />
          <button className="debt-remove" type="button" aria-label="Remover dívida" onClick={() => removeDebt(debt.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      <p className="wizard-sub" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 16 }}>
        A taxa de juros é opcional, mas ajuda no simulador avalanche vs. bola de neve.
      </p>

      <button className="add-debt" type="button" onClick={addDebt}>
        <Plus size={16} /> Adicionar dívida
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
      <ProgressDots step={5} total={7} />
      <SeloBadge numeral="III" label="construa sua reserva" />
      <h2 className="wizard-h2">Quanto você já tem de reserva de emergência?</h2>
      <p className="wizard-sub">Dinheiro guardado, líquido, pra imprevistos.</p>
      <CurrencyField
        label="Reserva de emergência"
        value={data.emergencyFund}
        onChange={(v) => update({ emergencyFund: v })}
        autoFocus
      />
      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Revisar respostas" />
    </div>
  );
}

/* ---------- step 6: revisar respostas ---------- */

export function ReviewStep({
  data,
  onNext,
  onBack,
  goToStep,
}: StepProps & { goToStep: (step: number) => void }) {
  const debtsTotal = data.debts.reduce((sum, d) => sum + (d.value || 0), 0);
  return (
    <div className="wizard-card" style={{ maxWidth: 600 }}>
      <ProgressDots step={6} total={7} />
      <h2 className="wizard-h2">Revisa antes de ver o diagnóstico</h2>
      <p className="wizard-sub">Confere se os números batem — dá pra editar qualquer etapa daqui.</p>

      <div className="review-list stagger">
        <div className="review-row">
          <div>
            <p className="review-label">Renda mensal</p>
            <p className="review-value">{formatBRL(data.monthlyIncome)}</p>
          </div>
          <button className="btn-ghost" type="button" onClick={() => goToStep(1)}><Pencil size={14} /> Editar</button>
        </div>
        <div className="review-row">
          <div>
            <p className="review-label">Guardado por mês</p>
            <p className="review-value">{formatBRL(data.currentSavings)}</p>
          </div>
          <button className="btn-ghost" type="button" onClick={() => goToStep(2)}><Pencil size={14} /> Editar</button>
        </div>
        <div className="review-row">
          <div>
            <p className="review-label">Gastos mensais</p>
            <p className="review-value">
              {formatBRL(data.expenses.moradia + data.expenses.alimentacao + data.expenses.transporte + data.expenses.lazer)}
            </p>
          </div>
          <button className="btn-ghost" type="button" onClick={() => goToStep(3)}><Pencil size={14} /> Editar</button>
        </div>
        <div className="review-row">
          <div>
            <p className="review-label">Dívidas ({data.debts.length})</p>
            <p className="review-value">{formatBRL(debtsTotal)}</p>
          </div>
          <button className="btn-ghost" type="button" onClick={() => goToStep(4)}><Pencil size={14} /> Editar</button>
        </div>
        <div className="review-row">
          <div>
            <p className="review-label">Reserva de emergência</p>
            <p className="review-value">{formatBRL(data.emergencyFund)}</p>
          </div>
          <button className="btn-ghost" type="button" onClick={() => goToStep(5)}><Pencil size={14} /> Editar</button>
        </div>
      </div>

      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Ver diagnóstico" />
    </div>
  );
}

/* ---------- step 7: diagnóstico ---------- */

export function DiagnosisStep({
  data,
  diagnosis,
  onRestart,
  onOpenTool,
}: {
  data: WizardData;
  diagnosis: Diagnosis;
  onRestart: () => void;
  onOpenTool: (id: ToolId) => void;
}) {
  const categories: { key: keyof WizardData['expenses']; label: string }[] = [
    { key: 'moradia', label: 'Moradia' },
    { key: 'alimentacao', label: 'Alimentação' },
    { key: 'transporte', label: 'Transporte' },
    { key: 'lazer', label: 'Lazer' },
  ];
  // escala comum às barras: o maior valor entre gastos reais e tetos ideais
  const maxBar = Math.max(
    ...categories.map((c) => data.expenses[c.key]),
    ...Object.values(diagnosis.idealExpenses)
  ) || 1;

  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    setUnlocked(isUnlocked());
    markDiagnosisCompleted();
  }, []);

  const savingsOk = diagnosis.savingsRate >= diagnosis.savingsGoalRate;
  const emergencyOk = diagnosis.emergencyProgress >= 100;
  const suggested = TOOLS.filter((t) =>
    diagnosis.totalDebt > 0 ? ['debts', 'loan', 'longterm'].includes(t.id) : ['longterm', 'goal', 'checkin'].includes(t.id)
  );

  return (
    <div className="wizard-card" style={{ maxWidth: 680 }}>
      <div className="wizard-kicker"><span className="wedge" />Seu diagnóstico</div>
      <h2 className="wizard-h2">Aqui está o retrato da sua vida financeira</h2>
      <p className="wizard-sub">Lido à luz das leis de <i>O Homem Mais Rico da Babilônia</i>.</p>

      <div className="diag-grid stagger">
        <div className="stat-card">
          <p className="diag-label">Taxa de poupança · Selo I</p>
          <span className={`status-pill ${savingsOk ? 'status-good' : 'status-warn'}`}>
            {savingsOk ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {savingsOk ? 'Na meta' : 'Abaixo da meta'}
          </span>
          <p className="diag-number">
            <CountUp value={diagnosis.savingsRate} format={(n) => `${n.toFixed(0)}%`} />{' '}
            <small>de {diagnosis.savingsGoalRate}% ideal</small>
          </p>
          <div className="progress-track">
            <AnimatedFill className="progress-fill" pct={(diagnosis.savingsRate / diagnosis.savingsGoalRate) * 100} />
          </div>
        </div>

        <div className="stat-card">
          <p className="diag-label">Reserva de emergência · Selo III</p>
          <span className={`status-pill ${emergencyOk ? 'status-good' : 'status-warn'}`}>
            {emergencyOk ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {emergencyOk ? '6 meses garantidos' : `Meta: ${formatBRL(diagnosis.emergencyTarget)}`}
          </span>
          <p className="diag-number">
            <CountUp value={diagnosis.emergencyProgress} format={(n) => `${n.toFixed(0)}%`} /> <small>da meta</small>
          </p>
          <div className="progress-track">
            <AnimatedFill className="progress-fill" pct={diagnosis.emergencyProgress} delay={150} />
          </div>
        </div>

        <div className="stat-card">
          <p className="diag-label">Dívidas · Selo IV</p>
          <span className={`status-pill ${diagnosis.totalDebt > 0 ? 'status-bad' : 'status-good'}`}>
            {diagnosis.totalDebt > 0 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
            {diagnosis.totalDebt > 0 ? `${data.debts.length} em aberto` : 'Sem dívidas'}
          </span>
          <p className="diag-number"><CountUp value={diagnosis.totalDebt} format={(n) => formatBRL(n)} /></p>
        </div>

        <div className="stat-card">
          <p className="diag-label">Projeção em 10 anos</p>
          <span className="status-pill status-good">guardando 10% da renda</span>
          <p className="diag-number"><CountUp value={diagnosis.projection10y} duration={1600} format={(n) => formatBRL(n)} /></p>
        </div>
      </div>

      <div className="diag-section stat-card">
        <p className="diag-label">Gastos por categoria vs. teto ideal · Selo II</p>
        {categories.map((c, i) => {
          const over = data.expenses[c.key] > diagnosis.idealExpenses[c.key];
          return (
            <div className="bar-row" key={c.key} title={`${c.label}: ${formatBRL(data.expenses[c.key])} (teto ${formatBRL(diagnosis.idealExpenses[c.key])})`}>
              <span className="bar-label">{c.label}</span>
              <div className="bar-track">
                <AnimatedFill className={`bar-fill ${over ? 'over' : ''}`} pct={(data.expenses[c.key] / maxBar) * 100} delay={i * 90} />
                <div className="bar-ideal-mark" style={{ left: `${(diagnosis.idealExpenses[c.key] / maxBar) * 100}%` }} />
              </div>
            </div>
          );
        })}
        <p className="field-hint" style={{ marginTop: 4 }}>
          Barra dourada: seu gasto real (terracota quando passa do teto). Linha azul: teto ideal recomendado.
        </p>
      </div>

      <ShareDiagnosisButton diagnosis={diagnosis} />

      <div className="diag-section" style={{ marginTop: 28, marginBottom: 8 }}>
        <p className="diag-label">Seu plano de ação</p>
        {unlocked ? (
          <div className="action-list stagger">
            {diagnosis.actionPlan.map((item, i) => (
              <div className="action-item" key={i}>
                <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </div>
            ))}
            {diagnosis.actionPlan.length === 0 && (
              <p style={{ fontSize: 15, color: 'var(--ink-soft)' }}>
                Você já está em dia com os três princípios — continue assim.
              </p>
            )}
          </div>
        ) : (
          <div className="paywall">
            <div className="paywall-teaser">
              {diagnosis.actionPlan.slice(0, 1).map((item, i) => (
                <div className="action-item" key={i}>
                  <span className="action-num">01</span>
                  <p>{item}</p>
                </div>
              ))}
              <div className="paywall-fade" />
            </div>
            <p className="wizard-sub" style={{ marginBottom: 16, fontSize: 14.5 }}>
              Os próximos passos priorizados pra você ficam completos depois do desbloqueio.
            </p>
            <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary btn-shine">
              Desbloquear meu plano de ação — {PRICE_LABEL}
            </a>
          </div>
        )}
      </div>

      <div className="diag-section" style={{ marginTop: 28 }}>
        <p className="diag-label">Próximo passo: ferramentas pra você</p>
        <div className="stagger" style={{ display: 'grid', gap: 4 }}>
          {suggested.map((t) => (
            <button type="button" className="mega-item" key={t.id} onClick={() => onOpenTool(t.id)} style={{ border: '1px solid var(--hairline-soft)' }}>
              <ToolIcon tool={t} size="sm" />
              <span>
                <b>{t.title}</b>
                <span className="desc">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <WizardNav onNext={onRestart} nextLabel="Refazer diagnóstico" canNext />
    </div>
  );
}
