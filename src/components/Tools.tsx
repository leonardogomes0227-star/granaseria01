import { useState } from 'react';
import { WizardData, DebtItem } from '../types';
import { formatBRL, computeProjection, computeRequiredContribution, computeLoanInstallment } from '../calculations';

function ToolShell({
  title,
  kicker,
  onClose,
  children,
}: {
  title: string;
  kicker: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="wizard-wrap">
      <div className="wizard-card" style={{ maxWidth: 560 }}>
        <div className="wizard-kicker"><span className="wedge" />{kicker}</div>
        <h2 className="wizard-h2">{title}</h2>
        {children}
        <div className="wizard-nav">
          <button className="btn-outline" type="button" onClick={onClose}>
            Voltar
          </button>
          <span />
        </div>
      </div>
    </div>
  );
}

/* ---------- Vale a pena comprar isso? ---------- */

export function ImpulseTool({
  monthlyIncome,
  onClose,
}: {
  monthlyIncome: number;
  onClose: () => void;
}) {
  const [income, setIncome] = useState(monthlyIncome);
  const [price, setPrice] = useState(0);

  const pctOfIncome = income > 0 ? (price / income) * 100 : 0;
  const daysOfWork = income > 0 ? price / (income / 30) : 0;
  const savingsGoal = income * 0.1;
  const monthsDelay = savingsGoal > 0 ? price / savingsGoal : 0;

  return (
    <ToolShell title="Vale a pena comprar isso?" kicker="Freio de impulso" onClose={onClose}>
      <p className="wizard-sub">Antes de decidir, veja o que essa compra realmente custa em tempo e em meta.</p>

      {monthlyIncome <= 0 && (
        <div className="field-group">
          <label className="field-label">Sua renda mensal</label>
          <input
            className="field-input"
            type="number"
            min="0"
            placeholder="R$ 0,00"
            value={income || ''}
            onChange={(e) => setIncome(Math.max(parseFloat(e.target.value) || 0, 0))}
          />
        </div>
      )}

      <div className="field-group">
        <label className="field-label">Valor da compra</label>
        <input
          className="field-input"
          type="number"
          min="0"
          placeholder="R$ 0,00"
          autoFocus
          value={price || ''}
          onChange={(e) => setPrice(Math.max(parseFloat(e.target.value) || 0, 0))}
        />
      </div>

      {income > 0 && price > 0 && (
        <div className="diag-section" style={{ marginTop: 28 }}>
          <p className="diag-label">Isso representa</p>
          <p className="diag-number">{pctOfIncome.toFixed(1)}% da sua renda mensal</p>

          <p className="diag-label">Em tempo de trabalho</p>
          <p className="diag-number">
            {daysOfWork < 1 ? 'menos de 1 dia' : `${daysOfWork.toFixed(1)} dias`}
          </p>

          {monthsDelay >= 0.3 && (
            <>
              <p className="diag-label">Atraso na sua meta de poupança (10% da renda)</p>
              <p className="diag-number">
                {monthsDelay < 1 ? 'menos de 1 mês' : `${monthsDelay.toFixed(1)} meses`}
              </p>
            </>
          )}
        </div>
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
    <div>
      <p className="diag-label" style={{ marginBottom: 4 }}>{title}</p>
      <p className="wizard-sub" style={{ fontSize: 12.5, marginBottom: 14 }}>{note}</p>
      <div className="action-list">
        {debts.map((d, i) => (
          <div className="action-item" key={d.id}>
            <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
            <p style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>
              {d.description || 'Dívida sem nome'} — {formatBRL(d.value)}
              {d.interestRate ? ` (${d.interestRate}% a.m.)` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DebtSimulator({ debts, onClose }: { debts: DebtItem[]; onClose: () => void }) {
  if (debts.length === 0) {
    return (
      <ToolShell title="Avalanche vs. bola de neve" kicker="Estratégia de quitação" onClose={onClose}>
        <p className="wizard-sub">
          Você ainda não cadastrou nenhuma dívida no diagnóstico. Faça o diagnóstico primeiro pra usar esse simulador.
        </p>
      </ToolShell>
    );
  }

  const hasInterest = debts.some((d) => d.interestRate && d.interestRate > 0);

  return (
    <ToolShell title="Avalanche vs. bola de neve" kicker="Estratégia de quitação" onClose={onClose}>
      <p className="wizard-sub">
        Duas ordens pra decidir qual dívida atacar primeiro, mantendo o mínimo nas outras.
      </p>

      {!hasInterest && (
        <p className="field-error" style={{ marginBottom: 20 }}>
          Nenhuma dívida tem taxa de juros cadastrada — a ordem avalanche fica igual à ordem que você digitou. Volte no diagnóstico e adicione a taxa pra um resultado mais preciso.
        </p>
      )}

      <div className="diag-section">
        <DebtOrderList
          title="Avalanche — maior juros primeiro"
          note="Economiza mais dinheiro em juros no total."
          debts={sortAvalanche(debts)}
        />
      </div>

      <div className="diag-section">
        <DebtOrderList
          title="Bola de neve — menor saldo primeiro"
          note="Quita dívidas mais rápido, o que ajuda a manter a motivação."
          debts={sortSnowball(debts)}
        />
      </div>
    </ToolShell>
  );
}

/* ---------- Simulador de longo prazo / aposentadoria ---------- */

export function LongTermSimulator({
  monthlyIncome,
  onClose,
}: {
  monthlyIncome: number;
  onClose: () => void;
}) {
  const [contribution, setContribution] = useState(Math.round(monthlyIncome * 0.1));
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(20);

  const total = computeProjection(contribution, rate, years);
  const totalContributed = contribution * years * 12;
  const totalInterest = total - totalContributed;

  return (
    <ToolShell title="Simulador de longo prazo" kicker="Aposentadoria e metas longas" onClose={onClose}>
      <p className="wizard-sub">Ajuste o aporte, a taxa e o prazo pra ver aonde isso te leva.</p>

      <div className="field-group">
        <label className="field-label">Aporte mensal</label>
        <input
          className="field-input"
          type="number"
          min="0"
          value={contribution || ''}
          onChange={(e) => setContribution(Math.max(parseFloat(e.target.value) || 0, 0))}
        />
      </div>

      <div className="field-group">
        <label className="field-label">Taxa de juros (% ao ano)</label>
        <input
          className="field-input"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={rate || ''}
          onChange={(e) => setRate(Math.max(parseFloat(e.target.value) || 0, 0))}
        />
      </div>

      <div className="field-group">
        <label className="field-label">Prazo (anos)</label>
        <input
          className="field-input"
          type="number"
          min="1"
          max="60"
          value={years || ''}
          onChange={(e) => setYears(Math.max(parseFloat(e.target.value) || 1, 1))}
        />
      </div>

      {contribution > 0 && (
        <div className="diag-section" style={{ marginTop: 28 }}>
          <p className="diag-label">Em {years} anos, você teria</p>
          <p className="diag-number">{formatBRL(total)}</p>

          <p className="diag-label" style={{ marginTop: 20 }}>Do que você mesmo colocou</p>
          <p className="diag-number">{formatBRL(totalContributed)}</p>

          <p className="diag-label" style={{ marginTop: 20 }}>Rendido só de juros</p>
          <p className="diag-number">{formatBRL(Math.max(totalInterest, 0))}</p>
        </div>
      )}
    </ToolShell>
  );
}

/* ---------- Calculadora de meta ---------- */

export function GoalCalculator({ onClose }: { onClose: () => void }) {
  const [target, setTarget] = useState(0);
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(10);

  const required = computeRequiredContribution(target, rate, years);
  const totalContributed = required * years * 12;
  const fromInterest = target - totalContributed;

  return (
    <ToolShell title="Calculadora de meta" kicker="Quanto guardar por mês" onClose={onClose}>
      <p className="wizard-sub">Diz aonde você quer chegar, a gente calcula o aporte mensal necessário.</p>

      <div className="field-group">
        <label className="field-label">Valor da meta</label>
        <input
          className="field-input"
          type="number"
          min="0"
          placeholder="R$ 0,00"
          autoFocus
          value={target || ''}
          onChange={(e) => setTarget(Math.max(parseFloat(e.target.value) || 0, 0))}
        />
      </div>

      <div className="field-group">
        <label className="field-label">Prazo (anos)</label>
        <input
          className="field-input"
          type="number"
          min="1"
          max="60"
          value={years || ''}
          onChange={(e) => setYears(Math.max(parseFloat(e.target.value) || 1, 1))}
        />
      </div>

      <div className="field-group">
        <label className="field-label">Taxa de juros (% ao ano)</label>
        <input
          className="field-input"
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={rate || ''}
          onChange={(e) => setRate(Math.max(parseFloat(e.target.value) || 0, 0))}
        />
      </div>

      {target > 0 && (
        <div className="diag-section" style={{ marginTop: 28 }}>
          <p className="diag-label">Você precisa guardar, por mês</p>
          <p className="diag-number">{formatBRL(required)}</p>

          <p className="diag-label" style={{ marginTop: 20 }}>Do total, vem de juros</p>
          <p className="diag-number">{formatBRL(Math.max(fromInterest, 0))}</p>
        </div>
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
}: {
  label: string;
  principal: number;
  setPrincipal: (v: number) => void;
  rate: number;
  setRate: (v: number) => void;
  installmentsCount: number;
  setInstallmentsCount: (v: number) => void;
}) {
  return (
    <div>
      <p className="diag-label" style={{ marginBottom: 10 }}>{label}</p>
      <div className="field-group">
        <label className="field-label">Valor financiado</label>
        <input className="field-input" type="number" min="0" value={principal || ''} onChange={(e) => setPrincipal(Math.max(parseFloat(e.target.value) || 0, 0))} />
      </div>
      <div className="field-group">
        <label className="field-label">Taxa (% ao mês)</label>
        <input className="field-input" type="number" min="0" step="0.1" value={rate || ''} onChange={(e) => setRate(Math.max(parseFloat(e.target.value) || 0, 0))} />
      </div>
      <div className="field-group">
        <label className="field-label">Parcelas</label>
        <input className="field-input" type="number" min="1" value={installmentsCount || ''} onChange={(e) => setInstallmentsCount(Math.max(parseFloat(e.target.value) || 1, 1))} />
      </div>
    </div>
  );
}

export function LoanComparator({ onClose }: { onClose: () => void }) {
  const [pA, setPA] = useState(0);
  const [rA, setRA] = useState(0);
  const [nA, setNA] = useState(12);

  const [pB, setPB] = useState(0);
  const [rB, setRB] = useState(0);
  const [nB, setNB] = useState(12);

  const resA = computeLoanInstallment(pA, rA, nA);
  const resB = computeLoanInstallment(pB, rB, nB);
  const bothFilled = pA > 0 && pB > 0;
  const cheaper = resA.total <= resB.total ? 'A' : 'B';

  return (
    <ToolShell title="Comparador de empréstimo" kicker="Antes de contratar" onClose={onClose}>
      <p className="wizard-sub">Compare duas propostas antes de assinar.</p>

      <div className="loan-grid">
        <LoanColumn label="Proposta A" principal={pA} setPrincipal={setPA} rate={rA} setRate={setRA} installmentsCount={nA} setInstallmentsCount={setNA} />
        <LoanColumn label="Proposta B" principal={pB} setPrincipal={setPB} rate={rB} setRate={setRB} installmentsCount={nB} setInstallmentsCount={setNB} />
      </div>

      {bothFilled && (
        <div className="diag-section" style={{ marginTop: 20 }}>
          <div className="loan-grid">
            <div>
              <p className="diag-label">Parcela A</p>
              <p className="diag-number" style={{ fontSize: 22 }}>{formatBRL(resA.installment)}</p>
              <p className="wizard-sub" style={{ fontSize: 12.5, marginBottom: 0 }}>Total: {formatBRL(resA.total)}</p>
            </div>
            <div>
              <p className="diag-label">Parcela B</p>
              <p className="diag-number" style={{ fontSize: 22 }}>{formatBRL(resB.installment)}</p>
              <p className="wizard-sub" style={{ fontSize: 12.5, marginBottom: 0 }}>Total: {formatBRL(resB.total)}</p>
            </div>
          </div>
          <p className="wizard-sub" style={{ marginTop: 20, marginBottom: 0 }}>
            <strong style={{ color: 'var(--ink)' }}>Proposta {cheaper} sai mais barata</strong> — diferença de {formatBRL(Math.abs(resA.total - resB.total))} no total pago.
          </p>
        </div>
      )}
    </ToolShell>
  );
}
