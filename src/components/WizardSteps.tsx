import { useState, useEffect, useId, useMemo } from 'react';
import { ContinueOnWhatsApp } from './ContinueWhatsApp';
import { SiteFeedback } from './SiteFeedback';
import { siteEvent } from '../painel';
import { WizardData, DebtItem, DebtKind } from '../types';
import { Diagnosis, formatBRL, calculateHealthScore } from '../calculations';
import { CHECKOUT_URL, CHECKOUT_READY, PRICE_LABEL, isUnlocked, markDiagnosisCompleted } from '../config';
import { ArrowRight, Pencil, Plus, Trash2, CheckCircle2, AlertTriangle, RotateCcw, CalendarCheck, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CountUp, AnimatedFill } from './motion';
import { DecimalInput } from './DecimalInput';
import type { ToolId } from '../tools';
import { ArchetypeShare } from './ArchetypeShare';
import { RichDadCard } from './RichDadCard';
import { getArchetype } from '../archetypes';
import { buildPlan, DEBT_KINDS, effectiveRate, planTasks } from '../plan';
import { ActionPlanView } from './ActionPlanView';
import { leaksMonthlyTotal } from '../leaks';
import { getGoals, setToolTasks } from '../results';

import { getTracking, startTracking } from '../tracking';
import { track } from '../analytics';

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
  submit = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  canNext?: boolean;
  nextLabel?: string;
  loading?: boolean;
  submit?: boolean; // dentro de StepCard: Enter no teclado também avança
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
      <button
        className="btn-primary"
        onClick={submit ? undefined : onNext}
        disabled={!canNext || loading}
        type={submit ? 'submit' : 'button'}
      >
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
  const id = useId();
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="input-prefix">
        <span>R$</span>
        <DecimalInput id={id} placeholder="0,00" autoFocus={autoFocus} value={value} onChange={onChange} />
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** Cartão da etapa como <form>: apertar Enter (ou "Ir" no teclado do celular) avança. */
function StepCard({
  children,
  onSubmit,
  canSubmit = true,
  style,
}: {
  children: React.ReactNode;
  onSubmit: () => void;
  canSubmit?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <form
      className="wizard-card"
      style={style}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      {children}
    </form>
  );
}

function Insight({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: React.ReactNode }) {
  return <div className={`insight insight-${tone}`}>{children}</div>;
}

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

// id local sem depender de crypto.randomUUID (indisponível em navegadores antigos)
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
    <StepCard onSubmit={onNext} canSubmit={data.monthlyIncome > 0}>
      <ProgressDots step={1} total={7} />
      <h2 className="wizard-h2">Qual sua renda mensal?</h2>
      <p className="wizard-sub">Considere o que entra todo mês, depois dos impostos.</p>
      <CurrencyField
        label="Renda mensal"
        value={data.monthlyIncome}
        onChange={(v) => update({ monthlyIncome: v })}
        autoFocus
      />
      <p className="field-hint" style={{ marginTop: -8 }}>Seus números ficam salvos na sua conta. Só você vê.</p>
      <WizardNav onNext={onNext} canNext={data.monthlyIncome > 0} submit />
    </StepCard>
  );
}

/* ---------- step 2: quanto guarda hoje ---------- */

export function SavingsStep({ data, update, onNext, onBack }: StepProps) {
  return (
    <StepCard onSubmit={onNext}>
      <ProgressDots step={2} total={7} />
      <SeloBadge numeral="I" label="pague-se primeiro" />
      <h2 className="wizard-h2">Quanto você consegue guardar por mês?</h2>
      <p className="wizard-sub">O que você separa todo mês ou o que costuma sobrar no fim do mês e fica guardado. Se no fim do mês não sobra nada, deixe 0.</p>
      <CurrencyField
        label="Guardo ou sobra por mês"
        value={data.currentSavings}
        onChange={(v) => update({ currentSavings: v })}
        autoFocus
        error={
          data.monthlyIncome > 0 && data.currentSavings > data.monthlyIncome
            ? 'Esse valor é maior que sua renda mensal — confere aí.'
            : undefined
        }
      />
      {data.currentSavings > 0 && data.currentSavings <= data.monthlyIncome && (
        <Insight tone={pct(data.currentSavings, data.monthlyIncome) >= 10 ? 'good' : 'warn'}>
          Isso é <b>{pct(data.currentSavings, data.monthlyIncome).toFixed(0)}%</b> da sua renda.{' '}
          {pct(data.currentSavings, data.monthlyIncome) >= 10
            ? 'Você já cumpre a primeira lei do livro: guardar pelo menos 10%.'
            : `A meta do livro é 10% (${formatBRL(data.monthlyIncome * 0.1)} por mês).`}
        </Insight>
      )}
      {data.currentSavings === 0 && (
        <p className="field-hint">Não guarda nada hoje? Sem problema — deixe em branco e continue.</p>
      )}
      <WizardNav onBack={onBack} onNext={onNext} submit />
    </StepCard>
  );
}

/* ---------- step 3: gastos por categoria ---------- */

export function ExpensesStep({ data, updateExpenses, onNext, onBack }: StepProps) {
  const total = Object.values(data.expenses).reduce((a, b) => a + b, 0);
  const left = data.monthlyIncome - data.currentSavings - total;
  return (
    <StepCard onSubmit={onNext}>
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
      {total > 0 && (
        <Insight tone={left < 0 ? 'bad' : 'info'}>
          Total: <b>{formatBRL(total)}</b> ({pct(total, data.monthlyIncome).toFixed(0)}% da renda).{' '}
          {left < 0
            ? `Somando com o que você guarda, passa ${formatBRL(-left)} da sua renda — vale conferir.`
            : `Sobram ${formatBRL(left)} pra outros gastos.`}
        </Insight>
      )}
      <WizardNav onBack={onBack} onNext={onNext} submit />
    </StepCard>
  );
}

/* ---------- step 4: dívidas ---------- */

export function DebtsStep({ data, update, onNext, onBack }: StepProps) {
  const addDebt = () => {
    const newDebt: DebtItem = { id: newId(), description: '', value: 0, kind: 'cartao' };
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
    <StepCard onSubmit={onNext}>
      <ProgressDots step={4} total={7} />
      <SeloBadge numeral="IV" label="proteja-se de perdas" />
      <h2 className="wizard-h2">Você tem alguma dívida?</h2>
      <p className="wizard-sub">Cadastre cada uma — cartão, empréstimo, financiamento.</p>

      {data.debts.map((debt, i) => (
        <div className="debt-card" key={debt.id}>
          <div className="debt-card-head">
            Dívida {i + 1}
            <button className="debt-remove" type="button" aria-label={`Remover dívida ${i + 1}`} onClick={() => removeDebt(debt.id)}>
              <Trash2 size={15} />
            </button>
          </div>
          <input
            className="field-input"
            type="text"
            aria-label="Descrição da dívida"
            placeholder="Ex.: cartão Nubank"
            value={debt.description}
            onChange={(e) => updateDebt(debt.id, { description: e.target.value })}
          />
          <select
            className="field-input debt-kind"
            aria-label="Tipo da dívida"
            value={debt.kind ?? ''}
            onChange={(e) => updateDebt(debt.id, { kind: e.target.value as DebtKind })}
          >
            {!debt.kind && <option value="">Tipo da dívida</option>}
            {DEBT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
          <div className="debt-card-grid">
            <span className="debt-mini-label">Quanto falta pagar</span>
            <span className="debt-mini-label">Parcela por mês</span>
            <div className="input-prefix">
              <span>R$</span>
              <DecimalInput
                aria-label="Quanto falta pagar"
                placeholder="0,00"
                value={debt.value}
                onChange={(v) => updateDebt(debt.id, { value: v })}
              />
            </div>
            <div className="input-prefix">
              <span>R$</span>
              <DecimalInput
                aria-label="Parcela por mês"
                placeholder="0,00"
                value={debt.installment || 0}
                onChange={(v) => updateDebt(debt.id, { installment: v })}
              />
            </div>
            <div className="input-suffix" style={{ gridColumn: '1 / -1' }}>
              <DecimalInput
                aria-label="Juros ao mês (%)"
                placeholder={`Juros (típico: ${effectiveRate({ ...debt, interestRate: 0 }).rate.toLocaleString('pt-BR')})`}
                max={100}
                value={debt.interestRate || 0}
                onChange={(v) => updateDebt(debt.id, { interestRate: v })}
              />
              <span>% ao mês</span>
            </div>
          </div>
        </div>
      ))}

      {data.debts.length > 0 && (
        <p className="field-hint" style={{ marginTop: -2, marginBottom: 14 }}>
          Não sabe os juros? Deixe em branco — usamos a taxa típica do tipo de dívida. A parcela é o que você já paga por mês (ou o mínimo da fatura).
        </p>
      )}

      <button className="add-debt" type="button" onClick={addDebt}>
        <Plus size={16} /> {data.debts.length === 0 ? 'Adicionar uma dívida' : 'Adicionar outra dívida'}
      </button>

      {data.debts.length > 0 && total > 0 && (
        <Insight tone={total > data.monthlyIncome * 3 ? 'bad' : 'warn'}>
          Total: <b>{formatBRL(total)}</b> — equivale a {(total / Math.max(data.monthlyIncome, 1)).toFixed(1).replace('.', ',')} mês(es) da sua renda.
        </Insight>
      )}

      <WizardNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={data.debts.length === 0 ? 'Não tenho dívidas' : 'Continuar'}
        submit
      />
    </StepCard>
  );
}

/* ---------- step 5: reserva de emergência ---------- */

export function EmergencyStep({ data, update, onNext, onBack }: StepProps) {
  const expenses = Object.values(data.expenses).reduce((a, b) => a + b, 0);
  const target = expenses * 6;
  return (
    <StepCard onSubmit={onNext}>
      <ProgressDots step={5} total={7} />
      <SeloBadge numeral="III" label="construa sua reserva" />
      <h2 className="wizard-h2">O que você já tem guardado?</h2>
      <p className="wizard-sub">Reserva de emergência é o dinheiro que dá pra sacar na hora, pra imprevistos.</p>
      <CurrencyField
        label="Reserva de emergência"
        value={data.emergencyFund}
        onChange={(v) => update({ emergencyFund: v })}
        autoFocus
      />
      <CurrencyField
        label="Outros investimentos (além da reserva)"
        value={data.investments ?? 0}
        onChange={(v) => update({ investments: v })}
      />
      <p className="field-hint" style={{ marginTop: -8 }}>Ações, fundos, previdência, imóvel alugado… O que põe dinheiro no seu bolso. Não tem? Deixe 0.</p>
      <CurrencyField
        label="Renda que entra sem você trabalhar, por mês"
        value={data.passiveIncome ?? 0}
        onChange={(v) => update({ passiveIncome: v })}
      />
      <p className="field-hint" style={{ marginTop: -8 }}>Aluguel, dividendos, juros dos investimentos. É a renda passiva do <i>Pai Rico, Pai Pobre</i>.</p>
      {target > 0 && (
        <Insight tone={data.emergencyFund >= target ? 'good' : 'info'}>
          O ideal é ter 6 meses de gastos guardados: <b>{formatBRL(target)}</b>.{' '}
          {data.emergencyFund >= target
            ? 'Você já chegou lá!'
            : data.emergencyFund > 0
              ? `Você tem ${Math.round(pct(data.emergencyFund, target))}% disso.`
              : 'Não tem nada ainda? Tudo bem, é só continuar.'}
        </Insight>
      )}
      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Revisar respostas" submit />
    </StepCard>
  );
}

/* ---------- step 6: revisar respostas ---------- */

export function ReviewStep({
  data,
  onNext,
  onBack,
  goToStep,
  update,
}: StepProps & { goToStep: (step: number) => void }) {
  const debtsTotal = data.debts.reduce((sum, d) => sum + (d.value || 0), 0);
  // pela conta, sobra dinheiro mas a pessoa disse que guarda 0: pergunta antes de o plano ignorar esse dinheiro
  const totalExp = Object.values(data.expenses).reduce((a, b) => a + b, 0);
  const installments = data.debts.reduce((x, d) => x + (d.installment || 0), 0);
  const leftover = Math.round(data.monthlyIncome - totalExp - installments - data.currentSavings);
  return (
    <StepCard onSubmit={onNext} style={{ maxWidth: 600 }}>
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
            <p className="review-label">Reserva, investimentos e renda passiva</p>
            <p className="review-value">{formatBRL(data.emergencyFund)} · {formatBRL(data.investments ?? 0)} · {formatBRL(data.passiveIncome ?? 0)}/mês</p>
          </div>
          <button className="btn-ghost" type="button" onClick={() => goToStep(5)}><Pencil size={14} /> Editar</button>
        </div>
      </div>

      {leftover >= Math.max(100, data.monthlyIncome * 0.05) && (
        <Insight tone="info">
          Pela sua conta, sobram <b>{formatBRL(leftover)}</b> por mês que não aparecem em nenhum gasto. Esse dinheiro fica guardado?
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" className="btn-outline" onClick={() => update({ currentSavings: data.currentSavings + leftover })}>
              Sim, fica guardado
            </button>
            <button type="button" className="btn-ghost" onClick={() => goToStep(3)}>Não, gasto com outras coisas</button>
          </span>
        </Insight>
      )}

      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Ver meu diagnóstico" submit />
    </StepCard>
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
    setUnlocked(isUnlocked() || !CHECKOUT_READY);
    markDiagnosisCompleted();
    void siteEvent('tool:site-diagnostico');
    track('diagnostico_concluido', { tem_dividas: data.debts.some((d) => d.value > 0) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por resultado
  }, []);

  const health = calculateHealthScore(data, diagnosis);
  const planForTasks = useMemo(() => buildPlan(data, { extraMonthly: leaksMonthlyTotal(), goals: getGoals() }), [data]);
  useEffect(() => {
    setToolTasks('plano', planTasks(planForTasks));
  }, [planForTasks]);
  const plan = useMemo(() => buildPlan(data, { extraMonthly: leaksMonthlyTotal(), goals: getGoals() }), [data]);
  const archetype = getArchetype(data, diagnosis);
  const savingsOk = diagnosis.savingsRate >= diagnosis.savingsGoalRate;
  const emergencyOk = diagnosis.emergencyProgress >= 100;

  return (
    <div className="wizard-card result" style={{ maxWidth: 720 }}>
      <div className="wizard-kicker"><span className="wedge" />Seu diagnóstico</div>
      <h2 className="wizard-h2">Sua nota e o seu plano</h2>
      <p className="wizard-sub">Primeiro a nota, depois o que fazer. Tudo fica salvo no seu painel.</p>

      <ScoreHero health={health} />

      <RichDadCard data={data} compact />

      <div className="diag-section" id="plano" style={{ marginTop: 28, marginBottom: 8 }}>
        <p className="diag-label">Seu plano de ação</p>
        <h3 className="plan-heading">O que fazer, quanto e até quando</h3>
        <ActionPlanView
          plan={plan}
          locked={!unlocked}
          onOpenTool={onOpenTool}
          lockedSlot={
            <>
              <p className="wizard-sub" style={{ marginBottom: 16, fontSize: 14.5 }}>
                O plano completo traz todos os passos com valores e datas, a mensagem pronta pra renegociar e o calendário mês a mês.
              </p>
              <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn-primary btn-shine" onClick={() => track('checkout_clique')}>
                Desbloquear meu plano de ação — {PRICE_LABEL}
              </a>
            </>
          }
        />
      </div>

      <p className="diag-label result-next">Agora, o dia a dia</p>
      <ContinueOnWhatsApp />

      <Fold title="Entender minha nota" hint="Poupança, reserva, dívidas e gastos por categoria">
        <div className="diag-grid">
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
      </Fold>

      <Fold title={`Seu perfil: ${archetype.name}`} hint="E um cartão bonito pra postar nos stories">
        <ArchetypeShare archetype={archetype} score={health.score} />
      </Fold>

      <div style={{ marginTop: 28 }}>
        <SiteFeedback tool="diagnostico" question="Esse diagnóstico te ajudou?" />
      </div>

      <div className="wizard-nav result-nav">
        <button className="btn-ghost" type="button" onClick={onRestart}>
          <RotateCcw size={15} /> Refazer
        </button>
        <button
          className="btn-outline"
          type="button"
          onClick={() => {
            if (!getTracking()) {
              startTracking(data);
              track('plano_seguido');
            }
            onOpenTool('tracker');
          }}
        >
          <CalendarCheck size={16} /> Seguir mês a mês
        </button>
        <Link className="btn-primary" to="/plano">
          Ver o meu plano <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

/** Uma parte que fica fechada até a pessoa querer ver: deixa o resultado curto e direto. */
function Fold({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`fold ${open ? 'open' : ''}`}>
      <button type="button" className="fold-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>
          <b>{title}</b>
          <small>{hint}</small>
        </span>
        <ChevronDown size={18} />
      </button>
      {open && <div className="fold-body">{children}</div>}
    </div>
  );
}

function ScoreHero({ health }: { health: ReturnType<typeof calculateHealthScore> }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(health.score));
    return () => cancelAnimationFrame(id);
  }, [health.score]);
  const color = health.tone === 'good' ? '#4F7A5A' : health.tone === 'warn' ? '#BD7E1E' : '#9C4C2A';
  return (
    <div className={`score-hero anim-in`}>
      <div className="score-ring" role="img" aria-label={`Nota ${health.score} de 100: ${health.label}`}>
        <svg viewBox="0 0 120 120" width="128" height="128" aria-hidden="true">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--sand-deep)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - shown / 100)}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)' }}
          />
        </svg>
        <div className="score-num">
          <CountUp value={health.score} duration={1400} />
          <small>de 100</small>
        </div>
      </div>
      <div className="score-copy">
        <p className="diag-label" style={{ marginBottom: 2 }}>Sua nota Grana Séria</p>
        <p className={`score-label tone-text-${health.tone}`}>
          {health.tone === 'good' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />} {health.label}
        </p>
        <div className="score-parts">
          {health.parts.map((p) => (
            <span key={p.label}>
              {p.label} <b>{p.points}/{p.max}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
