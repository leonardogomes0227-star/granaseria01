import { useState, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Info } from 'lucide-react';
import { DebtItem } from '../types';
import { formatBRL, computeProjection, computeRequiredContribution, computeLoanInstallment } from '../calculations';
import { TOOLS, ToolId, getTool } from '../tools';
import { ToolIcon } from './Layout';
import { CountUp } from './motion';

/* ---------- casca comum das ferramentas ---------- */

export interface ToolNavProps {
  onClose: () => void;
  onSwitch: (id: ToolId) => void;
}

export function ToolShell({
  id,
  onClose,
  onSwitch,
  children,
}: ToolNavProps & { id: ToolId; children: ReactNode }) {
  const tool = getTool(id);
  return (
    <div className="wizard-wrap">
      <div className="tool-page">
        <nav className="tool-switcher anim-in" aria-label="Outras ferramentas">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={t.id === id ? 'active' : ''}
                aria-current={t.id === id ? 'page' : undefined}
                onClick={() => t.id !== id && onSwitch(t.id)}
              >
                <Icon size={14} /> {t.short}
              </button>
            );
          })}
        </nav>
        <div className="wizard-card anim-in" key={id} style={{ maxWidth: 'none' }}>
          <div className="tool-head">
            <ToolIcon tool={tool} size="lg" />
            <div>
              <div className="wizard-kicker" style={{ marginBottom: 4 }}>Ferramenta</div>
              <h2 className="wizard-h2">{tool.title}</h2>
            </div>
          </div>
          {children}
          <div className="wizard-nav">
            <button className="btn-outline" type="button" onClick={onClose}>
              <ArrowLeft size={16} /> Voltar ao início
            </button>
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- campos ---------- */

function parsePositive(v: string, fallback = 0): number {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : Math.max(n, 0);
}

export function MoneyField({
  label,
  value,
  onChange,
  autoFocus,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  autoFocus?: boolean;
  hint?: string;
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
          placeholder="0"
          autoFocus={autoFocus}
          value={value || ''}
          onChange={(e) => onChange(Math.min(parsePositive(e.target.value), 99999999))}
        />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  prefix?: string;
}) {
  const pct = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100;
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="range-row">
        <input
          type="range"
          className="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ ['--pct' as string]: `${pct}%` }}
          aria-label={label}
        />
        <div className={prefix ? 'input-prefix' : 'input-suffix'} style={{ width: 130, flexShrink: 0 }}>
          {prefix && <span>{prefix}</span>}
          <input
            className="field-input"
            type="number"
            inputMode="decimal"
            min={min}
            step={step}
            value={value || ''}
            onChange={(e) => onChange(parsePositive(e.target.value))}
            style={{ width: '100%' }}
          />
          {suffix && <span>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

/** Barra de composição: quanto do total veio do seu bolso e quanto veio dos juros. */
function CompositionBar({ own, interest }: { own: number; interest: number }) {
  const total = own + interest;
  if (total <= 0) return null;
  const ownPct = (own / total) * 100;
  const intPct = 100 - ownPct;
  return (
    <div>
      <div className="comp-bar" role="img" aria-label={`Você colocou ${ownPct.toFixed(0)}%, juros ${intPct.toFixed(0)}%`}>
        <div className="comp-seg" style={{ flexGrow: Math.max(ownPct, 0.5), background: 'var(--chart-a)' }}>
          <span className="tip">Você colocou: {formatBRL(own)}</span>
        </div>
        {interest > 0 && (
          <div className="comp-seg" style={{ flexGrow: Math.max(intPct, 0.5), background: 'var(--chart-b)' }}>
            <span className="tip">Juros: {formatBRL(interest)}</span>
          </div>
        )}
      </div>
      <div className="comp-legend">
        <span><i style={{ background: 'var(--chart-a)' }} /> Você colocou · {ownPct.toFixed(0)}%</span>
        {interest > 0 && <span><i style={{ background: 'var(--chart-b)' }} /> Juros · {intPct.toFixed(0)}%</span>}
      </div>
    </div>
  );
}

const brl = (n: number) => formatBRL(n);

/* ---------- Vale a pena comprar isso? ---------- */

export function ImpulseTool({ monthlyIncome, ...nav }: { monthlyIncome: number } & ToolNavProps) {
  const [income, setIncome] = useState(monthlyIncome);
  const [price, setPrice] = useState(0);

  const pctOfIncome = income > 0 ? (price / income) * 100 : 0;
  const daysOfWork = income > 0 ? price / (income / 30) : 0;
  const savingsGoal = income * 0.1;
  const monthsDelay = savingsGoal > 0 ? price / savingsGoal : 0;

  const verdict =
    pctOfIncome >= 30
      ? { cls: 'status-bad', text: 'Compra pesada — pense pelo menos 7 dias antes' }
      : pctOfIncome >= 10
        ? { cls: 'status-warn', text: 'Vale esperar 48h e ver se a vontade continua' }
        : { cls: 'status-good', text: 'Cabe no orçamento, se não sair da poupança' };

  return (
    <ToolShell id="impulse" {...nav}>
      <p className="wizard-sub">Antes de decidir, veja o que essa compra realmente custa em tempo e em meta.</p>

      <MoneyField label="Sua renda mensal" value={income} onChange={setIncome} hint={monthlyIncome > 0 ? 'Puxado do seu diagnóstico.' : undefined} />
      <MoneyField label="Valor da compra" value={price} onChange={setPrice} autoFocus />

      {income > 0 && price > 0 ? (
        <div className="result-card">
          <span className={`status-pill ${verdict.cls}`}>{verdict.text}</span>
          <p className="diag-label">Essa compra custa</p>
          <p className="result-big">
            <CountUp value={daysOfWork} format={(n) => (daysOfWork < 1 ? 'menos de 1 dia' : `${n.toFixed(1)} dias`)} />
          </p>
          <p className="diag-label">do seu trabalho</p>
          <div className="result-split">
            <div className="stat-card">
              <p className="diag-label">Da sua renda mensal</p>
              <p className="diag-number"><CountUp value={pctOfIncome} format={(n) => `${n.toFixed(1)}%`} /></p>
            </div>
            <div className="stat-card">
              <p className="diag-label">Atraso na meta de poupança</p>
              <p className="diag-number">
                <CountUp value={monthsDelay} format={(n) => (monthsDelay < 1 ? '< 1 mês' : `${n.toFixed(1)} meses`)} />
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="result-empty">Preencha a renda e o valor da compra pra ver o custo real.</div>
      )}
    </ToolShell>
  );
}

/* ---------- Avalanche vs. bola de neve ---------- */

function sortAvalanche(debts: DebtItem[]): DebtItem[] {
  return [...debts].sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
}

function sortSnowball(debts: DebtItem[]): DebtItem[] {
  return [...debts].sort((a, b) => a.value - b.value);
}

function DebtOrderList({ title, note, debts }: { title: string; note: string; debts: DebtItem[] }) {
  return (
    <div className="stat-card">
      <p className="field-label" style={{ color: 'var(--ink)', fontWeight: 600, marginBottom: 2 }}>{title}</p>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>{note}</p>
      <div className="action-list stagger">
        {debts.map((d, i) => (
          <div className="action-item" key={d.id}>
            <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
            <p>
              {d.description || 'Dívida sem nome'} — {formatBRL(d.value)}
              {d.interestRate ? ` (${d.interestRate}% a.m.)` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DebtSimulator({ debts, onStart, ...nav }: { debts: DebtItem[]; onStart: () => void } & ToolNavProps) {
  if (debts.length === 0) {
    return (
      <ToolShell id="debts" {...nav}>
        <p className="wizard-sub">
          Esse simulador usa as dívidas que você cadastra no diagnóstico. Faça o diagnóstico primeiro — leva uns 10 minutos.
        </p>
        <button className="btn-primary" type="button" onClick={onStart}>
          Fazer diagnóstico <ArrowRight size={16} className="arrow" />
        </button>
      </ToolShell>
    );
  }

  const hasInterest = debts.some((d) => d.interestRate && d.interestRate > 0);

  return (
    <ToolShell id="debts" {...nav}>
      <p className="wizard-sub">Duas ordens pra decidir qual dívida atacar primeiro, mantendo o mínimo nas outras.</p>

      {!hasInterest && (
        <p className="field-error" style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          Nenhuma dívida tem taxa de juros cadastrada — a ordem avalanche fica igual à ordem que você digitou. Volte no diagnóstico e adicione a taxa pra um resultado mais preciso.
        </p>
      )}

      <div className="loan-grid">
        <DebtOrderList title="Avalanche — maior juros primeiro" note="Economiza mais dinheiro em juros no total." debts={sortAvalanche(debts)} />
        <DebtOrderList title="Bola de neve — menor saldo primeiro" note="Quita dívidas mais rápido e mantém a motivação." debts={sortSnowball(debts)} />
      </div>
    </ToolShell>
  );
}

/* ---------- Simulador de longo prazo / aposentadoria ---------- */

export function LongTermSimulator({ monthlyIncome, ...nav }: { monthlyIncome: number } & ToolNavProps) {
  const [contribution, setContribution] = useState(Math.round(monthlyIncome * 0.1) || 500);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(20);

  const total = computeProjection(contribution, rate, years);
  const totalContributed = contribution * years * 12;
  const totalInterest = Math.max(total - totalContributed, 0);

  return (
    <ToolShell id="longterm" {...nav}>
      <p className="wizard-sub">Ajuste o aporte, a taxa e o prazo pra ver aonde isso te leva.</p>

      <RangeField label="Aporte mensal" prefix="R$" value={contribution} onChange={setContribution} min={0} max={10000} step={50} />
      <RangeField label="Taxa de juros ao ano" suffix="% a.a." value={rate} onChange={setRate} min={0} max={20} step={0.5} />
      <RangeField label="Prazo" suffix="anos" value={years} onChange={(v) => setYears(Math.max(v, 1))} min={1} max={50} />

      {contribution > 0 ? (
        <div className="result-card">
          <p className="diag-label">Em {years} anos, você teria</p>
          <p className="result-big"><CountUp value={total} format={brl} /></p>
          <CompositionBar own={totalContributed} interest={totalInterest} />
          <div className="result-split">
            <div className="stat-card">
              <p className="diag-label">Do seu bolso</p>
              <p className="diag-number"><CountUp value={totalContributed} format={brl} /></p>
            </div>
            <div className="stat-card">
              <p className="diag-label">Rendido só de juros</p>
              <p className="diag-number"><CountUp value={totalInterest} format={brl} /></p>
            </div>
          </div>
        </div>
      ) : (
        <div className="result-empty">Defina um aporte mensal pra ver a projeção.</div>
      )}
    </ToolShell>
  );
}

/* ---------- Calculadora de meta ---------- */

export function GoalCalculator(nav: ToolNavProps) {
  const [target, setTarget] = useState(0);
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(10);

  const required = computeRequiredContribution(target, rate, years);
  const totalContributed = required * years * 12;
  const fromInterest = Math.max(target - totalContributed, 0);

  return (
    <ToolShell id="goal" {...nav}>
      <p className="wizard-sub">Diga aonde você quer chegar, a gente calcula o aporte mensal necessário.</p>

      <MoneyField label="Valor da meta" value={target} onChange={setTarget} autoFocus />
      <RangeField label="Prazo" suffix="anos" value={years} onChange={(v) => setYears(Math.max(v, 1))} min={1} max={40} />
      <RangeField label="Taxa de juros ao ano" suffix="% a.a." value={rate} onChange={setRate} min={0} max={20} step={0.5} />

      {target > 0 ? (
        <div className="result-card">
          <p className="diag-label">Você precisa guardar, por mês</p>
          <p className="result-big"><CountUp value={required} format={brl} /></p>
          <CompositionBar own={totalContributed} interest={fromInterest} />
          <div className="result-split">
            <div className="stat-card">
              <p className="diag-label">Do seu bolso</p>
              <p className="diag-number"><CountUp value={totalContributed} format={brl} /></p>
            </div>
            <div className="stat-card">
              <p className="diag-label">Vem dos juros</p>
              <p className="diag-number"><CountUp value={fromInterest} format={brl} /></p>
            </div>
          </div>
        </div>
      ) : (
        <div className="result-empty">Digite o valor da meta pra calcular quanto guardar por mês.</div>
      )}
    </ToolShell>
  );
}

/* ---------- Comparador de empréstimo/financiamento ---------- */

function LoanColumn({
  label,
  principal,
  setPrincipal,
  rate,
  setRate,
  installmentsCount,
  setInstallmentsCount,
  winner,
}: {
  label: string;
  principal: number;
  setPrincipal: (v: number) => void;
  rate: number;
  setRate: (v: number) => void;
  installmentsCount: number;
  setInstallmentsCount: (v: number) => void;
  winner: boolean;
}) {
  return (
    <div className={`loan-col ${winner ? 'winner' : ''}`}>
      <div className="loan-col-head">
        {label}
        {winner && <span className="winner-badge"><Check size={12} /> Mais barata</span>}
      </div>
      <MoneyField label="Valor financiado" value={principal} onChange={setPrincipal} />
      <div className="field-group">
        <label className="field-label">Taxa</label>
        <div className="input-suffix">
          <input className="field-input" type="number" min="0" step="0.1" value={rate || ''} onChange={(e) => setRate(parsePositive(e.target.value))} />
          <span>% a.m.</span>
        </div>
      </div>
      <div className="field-group" style={{ marginBottom: 0 }}>
        <label className="field-label">Parcelas</label>
        <div className="input-suffix">
          <input className="field-input" type="number" min="1" value={installmentsCount || ''} onChange={(e) => setInstallmentsCount(Math.max(parsePositive(e.target.value, 1), 1))} />
          <span>meses</span>
        </div>
      </div>
    </div>
  );
}

export function LoanComparator(nav: ToolNavProps) {
  const [pA, setPA] = useState(0);
  const [rA, setRA] = useState(0);
  const [nA, setNA] = useState(12);

  const [pB, setPB] = useState(0);
  const [rB, setRB] = useState(0);
  const [nB, setNB] = useState(12);

  const resA = computeLoanInstallment(pA, rA, nA);
  const resB = computeLoanInstallment(pB, rB, nB);
  const bothFilled = pA > 0 && pB > 0;
  const tie = Math.abs(resA.total - resB.total) < 0.5;
  const cheaper = resA.total <= resB.total ? 'A' : 'B';

  return (
    <ToolShell id="loan" {...nav}>
      <p className="wizard-sub">Compare duas propostas antes de assinar.</p>

      <div className="loan-grid">
        <LoanColumn label="Proposta A" principal={pA} setPrincipal={setPA} rate={rA} setRate={setRA} installmentsCount={nA} setInstallmentsCount={setNA} winner={bothFilled && !tie && cheaper === 'A'} />
        <LoanColumn label="Proposta B" principal={pB} setPrincipal={setPB} rate={rB} setRate={setRB} installmentsCount={nB} setInstallmentsCount={setNB} winner={bothFilled && !tie && cheaper === 'B'} />
      </div>

      {bothFilled ? (
        <div className="result-card">
          <div className="result-split" style={{ marginTop: 0 }}>
            <div className="stat-card">
              <p className="diag-label">Parcela A</p>
              <p className="diag-number"><CountUp value={resA.installment} format={brl} /></p>
              <p className="field-hint">Total pago: {formatBRL(resA.total)} · juros {formatBRL(resA.totalInterest)}</p>
            </div>
            <div className="stat-card">
              <p className="diag-label">Parcela B</p>
              <p className="diag-number"><CountUp value={resB.installment} format={brl} /></p>
              <p className="field-hint">Total pago: {formatBRL(resB.total)} · juros {formatBRL(resB.totalInterest)}</p>
            </div>
          </div>
          <p className="wizard-sub" style={{ marginTop: 18, marginBottom: 0 }}>
            {tie ? (
              <strong style={{ color: 'var(--ink)' }}>As duas propostas custam praticamente o mesmo no total.</strong>
            ) : (
              <>
                <strong style={{ color: 'var(--ink)' }}>Proposta {cheaper} sai mais barata</strong> — diferença de{' '}
                {formatBRL(Math.abs(resA.total - resB.total))} no total pago.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="result-empty">Preencha o valor das duas propostas pra comparar.</div>
      )}
    </ToolShell>
  );
}
