import { useMemo, useState } from 'react';
import type { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { buildPlan } from '../plan';
import { richDad, passiveFrom } from '../richdad';
import { ToolShell, ToolNavProps, MoneyField, useSaveResult } from './Tools';
import { RichDadCard } from './RichDadCard';

/* ---------- Placar Pai Rico, Pai Pobre ---------- */
// Com diagnóstico, já vem preenchido. Mostra o placar e quanto tempo falta, investindo todo mês, pra renda passiva
// pagar um quarto, metade e todos os gastos.

const MONTHLY_RETURN = Math.pow(1.1, 1 / 12) - 1; // uns 10% ao ano

function monthsTo(targetPassive: number, start: number, monthly: number): number | null {
  let balance = start;
  for (let m = 0; m <= 600; m++) {
    if (passiveFrom(balance) >= targetPassive) return m;
    balance = balance * (1 + MONTHLY_RETURN) + monthly;
  }
  return null;
}

const inYears = (m: number | null) =>
  m === null ? 'mais de 50 anos' : m === 0 ? 'já chegou' : m < 12 ? `${m} ${m === 1 ? 'mês' : 'meses'}` : `${Math.round(m / 12)} ${Math.round(m / 12) === 1 ? 'ano' : 'anos'}`;

export function RichDadTool({ data, onStart, ...nav }: { data: WizardData; onStart: () => void } & ToolNavProps) {
  const diag = data.monthlyIncome > 0;
  const plan = useMemo(() => (diag ? buildPlan(data) : null), [data, diag]);
  const totalExp = Object.values(data.expenses).reduce((a, b) => a + b, 0) + data.debts.reduce((s, d) => s + (d.installment || 0), 0);
  const [income, setIncome] = useState(data.monthlyIncome);
  const [costs, setCosts] = useState(totalExp);
  const [debt, setDebt] = useState(data.debts.reduce((s, d) => s + d.value, 0));
  const [reserve, setReserve] = useState(data.emergencyFund);
  const [invested, setInvested] = useState(data.investments ?? 0);
  const [passive, setPassive] = useState(data.passiveIncome ?? 0);
  const [monthly, setMonthly] = useState(plan?.monthlyPower ?? 0);

  // o placar usa os números desta tela (a pessoa pode testar outros valores sem mexer no diagnóstico)
  const sim: WizardData = {
    monthlyIncome: income,
    currentSavings: 0,
    expenses: { moradia: costs, alimentacao: 0, transporte: 0, lazer: 0 },
    debts: debt > 0 ? [{ id: 'd', description: 'Dívidas', value: debt }] : [],
    emergencyFund: reserve,
    investments: invested,
    passiveIncome: passive,
  };
  const r = richDad(sim);
  // o que já gera renda passiva: o investido ou, se a renda declarada for maior, o equivalente a ela
  const startPassive = Math.max(invested, passive / 0.005);
  const goals = [25, 50, 100].map((pct) => ({ pct, months: costs > 0 ? monthsTo((costs * pct) / 100, startPassive, monthly) : null }));
  useSaveResult('richdad', costs > 0 ? `${r.level.label}: o dinheiro rendendo paga ${r.freedomPct.toFixed(0)}% das contas; vive ${r.monthsFree.toFixed(1).replace('.', ',')} meses sem trabalhar` : null, {
    label: 'Você está',
    big: r.level.label,
    rows: [
      ['Sobra no mês', formatBRL(r.cashflow)],
      ['O que tem − o que deve', formatBRL(r.netWorth)],
      ['Se parar de trabalhar, dá pra viver', `${r.monthsFree.toFixed(1).replace('.', ',')} meses`],
      ['Dinheiro rendendo paga', `${r.freedomPct.toFixed(0)}% das contas`],
      ['Liberdade (100% das contas)', inYears(goals[2].months)],
    ],
  });

  return (
    <ToolShell id="richdad" {...nav}>
      <p className="wizard-sub">
        O livro <i>Pai Rico, Pai Pobre</i> ensina: rico não é quem ganha muito, é quem tem dinheiro entrando sem precisar trabalhar.
        Aqui você vê quanto falta pra isso.
      </p>
      {!diag && (
        <p className="field-hint" style={{ marginBottom: 12 }}>
          Dica: com o <button type="button" className="plan-more" onClick={onStart}>diagnóstico</button> estes campos já vêm preenchidos.
        </p>
      )}

      <div className="loan-grid">
        <div>
          <MoneyField label="Renda mensal" value={income} onChange={setIncome} />
          <MoneyField label="Gastos + parcelas por mês" value={costs} onChange={setCosts} />
          <MoneyField label="Quanto você deve, no total" value={debt} onChange={setDebt} />
        </div>
        <div>
          <MoneyField label="Reserva de emergência" value={reserve} onChange={setReserve} />
          <MoneyField label="Dinheiro investido (fora a reserva)" value={invested} onChange={setInvested} />
          <MoneyField label="Dinheiro que entra sem trabalhar, por mês" value={passive} onChange={setPassive} hint="Aluguel, rendimento de investimento…" />
        </div>
      </div>

      <RichDadCard data={sim} />

      <div className="result-card" style={{ marginTop: 16 }}>
        <p className="diag-label">Quanto tempo falta</p>
        <MoneyField label="Quanto você vai investir por mês" value={monthly} onChange={setMonthly} hint={plan ? 'Vem do seu plano de ação.' : undefined} />
        <div className="richdad-goals">
          {goals.map((g) => (
            <div key={g.pct}>
              <small>Pagar {g.pct}% das suas contas sem trabalhar</small>
              <b>{inYears(g.months)}</b>
              <span>{formatBRL((costs * g.pct) / 100)} por mês</span>
            </div>
          ))}
        </div>
        <p className="field-hint" style={{ marginTop: 10 }}>
          É uma conta aproximada: o dinheiro rendendo uns 10% ao ano. Não é promessa.
        </p>
      </div>
    </ToolShell>
  );
}
