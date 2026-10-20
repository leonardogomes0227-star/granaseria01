import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check } from 'lucide-react';
import { formatBRL } from '../calculations';
import { BILLS_KEY, installmentNumber, monthOf, monthStatus, parseBills, splitMoney, type Bill, type BillStatus } from '../bills';
import { todayBRT } from '../coach';
import { ToolShell, ToolNavProps, MoneyField, useSaveResult, useToolTasks } from './Tools';
import { DecimalInput } from './DecimalInput';

/* ---------- Minhas contas e dívidas ---------- */

function load(): Bill[] {
  try {
    return parseBills(localStorage.getItem(BILLS_KEY));
  } catch {
    return [];
  }
}
function store(b: Bill[]) {
  try {
    localStorage.setItem(BILLS_KEY, JSON.stringify(b));
  } catch {
    // segue sem salvar
  }
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
const shiftMonth = (m: string, n: number) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function BillsTool(nav: ToolNavProps) {
  const today = todayBRT();
  const [bills, setBillsState] = useState<Bill[]>(load);
  const [month, setMonth] = useState(monthOf(today));
  const setBills = (b: Bill[]) => {
    setBillsState(b);
    store(b);
  };
  const statuses = useMemo(() => monthStatus(bills, month, today), [bills, month, today]);
  const total = statuses.reduce((s, x) => s + x.bill.amount, 0);
  const paid = statuses.reduce((s, x) => s + Math.min(x.paid, x.bill.amount), 0);
  const fees = statuses.reduce((s, x) => s + x.fee, 0);
  const late = statuses.filter((s) => s.state === 'atrasado');

  // formulário de nova conta
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [dueDay, setDueDay] = useState(10);
  const [parcelado, setParcelado] = useState(false);
  const [left, setLeft] = useState(1);
  const add = () => {
    if (!name.trim() || amount <= 0) return;
    setBills([
      ...bills,
      { id: `b-${Date.now()}`, name: name.trim(), amount, dueDay: Math.min(31, Math.max(1, Math.round(dueDay))), startMonth: month, payments: [], ...(parcelado ? { installments: Math.max(1, Math.round(left)) } : {}) },
    ]);
    setName('');
    setAmount(0);
  };

  // pagar uma conta (com a data de verdade, pra calcular o atraso)
  const [paying, setPaying] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(today);
  const [payValue, setPayValue] = useState(0);
  const openPay = (s: BillStatus) => {
    setPaying(s.bill.id);
    setPayDate(today);
    setPayValue(Math.round(s.left * 100) / 100);
  };
  const pay = (id: string, value: number, on: string) =>
    bills.map((b) => (b.id === id ? { ...b, payments: [...b.payments, { month, paidOn: on, amount: value }] } : b));

  // dinheiro picado: entrou agora, o que pagar primeiro
  const [money, setMoney] = useState(0);
  const split = money > 0 ? splitMoney(statuses, money) : [];
  const leftover = money - split.reduce((s, x) => s + x.pay, 0);

  const open = statuses.filter((s) => s.left > 0);
  useToolTasks(
    'bills',
    month === monthOf(today) && bills.length > 0
      ? open.map((s) => ({ text: `Pagar ${s.bill.name}: ${formatBRL(s.left)} (vence ${ddmm(s.due)})`, inDays: Math.max(0, s.daysToDue - 1) }))
      : null
  );
  useSaveResult(
    'bills',
    month === monthOf(today) && statuses.length > 0 ? `${monthName(month)}: pagou ${formatBRL(paid)} de ${formatBRL(total)}` : null,
    {
      label: `Contas de ${monthName(month)}`,
      big: open.length === 0 ? 'Tudo pago' : `Faltam ${formatBRL(total - paid)}`,
      rows: [
        ['Já pagou', `${formatBRL(paid)} de ${formatBRL(total)}`],
        ['Atrasadas', late.length > 0 ? `${late.length} (${late.map((s) => s.bill.name).join(', ')})` : 'nenhuma'],
        ['Multa e juros do mês', formatBRL(fees)],
        ...(open[0] ? ([['Próxima', `${open[0].bill.name}, dia ${ddmm(open[0].due)}`]] as [string, string][]) : []),
      ],
    }
  );

  return (
    <ToolShell id="bills" {...nav}>
      <div className="bills-month">
        <button type="button" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
        <b>{monthName(month)}</b>
        <button type="button" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
      </div>

      {statuses.length > 0 && (
        <div className="bills-summary">
          <span><small>Já pagou</small><b>{formatBRL(paid)}</b></span>
          <span><small>Falta</small><b>{formatBRL(total - paid)}</b></span>
          <span className={fees > 0 ? 'bad' : ''}><small>Multa e juros</small><b>{formatBRL(fees)}</b></span>
        </div>
      )}

      {open.length > 0 && (
        <div className="bills-money">
          <p className="bills-money-q">Entrou dinheiro agora? Diga quanto e eu digo o que pagar primeiro.</p>
          <MoneyField label="Quanto entrou" value={money} onChange={setMoney} />
          {split.length > 0 && (
            <>
              <ul>
                {split.map(({ status: s, pay: v }) => (
                  <li key={s.bill.id}>
                    <span><i className={`dot ${s.state === 'atrasado' ? 'bad' : ''}`} /> {s.bill.name} <small>{s.state === 'atrasado' ? `atrasada ${-s.daysToDue} dias` : `vence ${ddmm(s.due)}`}</small></span>
                    <b>{formatBRL(v)}{v + 0.01 < s.left ? ' (parte)' : ''}</b>
                  </li>
                ))}
              </ul>
              {leftover > 0.009 && <p className="field-hint">Sobram {formatBRL(leftover)}: guarde pra próxima conta ou pra emergência.</p>}
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  let next = bills;
                  for (const { status: s, pay: v } of split) next = next.map((b) => (b.id === s.bill.id ? { ...b, payments: [...b.payments, { month, paidOn: today, amount: Math.min(v, s.left) }] } : b));
                  setBills(next);
                  setMoney(0);
                }}
              >
                <Check size={16} /> Paguei assim
              </button>
            </>
          )}
        </div>
      )}

      {statuses.length === 0 ? (
        <div className="result-empty">Cadastre suas contas e parcelas abaixo: luz, água, aluguel, cartão, empréstimo…</div>
      ) : (
        <ul className="bills-list">
          {statuses.map((s) => (
            <li key={s.bill.id} className={`bill-${s.state}`}>
              <div className="bill-row">
                <span className="bill-copy">
                  <b>{s.bill.name}</b>
                  <small>
                    {s.bill.installments ? `parcela ${installmentNumber(s.bill, month)} de ${s.bill.installments} · ` : 'todo mês · '}
                    vence {ddmm(s.due)}
                  </small>
                </span>
                <span className="bill-amount">{formatBRL(s.bill.amount)}</span>
              </div>
              <p className="bill-state">
                {s.state === 'pago' && 'Paga em dia'}
                {s.state === 'pago-atrasado' && `Paga com atraso: uns ${formatBRL(s.fee)} de multa e juros`}
                {s.state === 'atrasado' && `Atrasada ${-s.daysToDue} ${s.daysToDue === -1 ? 'dia' : 'dias'}: já corre uns ${formatBRL(s.fee)} de multa e juros`}
                {s.state === 'vence' && (s.daysToDue === 0 ? 'Vence hoje' : s.daysToDue === 1 ? 'Vence amanhã' : `Vence em ${s.daysToDue} dias`)}
                {s.paid > 0 && s.left > 0 && ` · já pagou ${formatBRL(s.paid)}, falta ${formatBRL(s.left)}`}
              </p>
              {s.left > 0 && paying !== s.bill.id && (
                <div className="bill-actions">
                  <button type="button" className="btn-outline" onClick={() => openPay(s)}><Check size={15} /> Paguei</button>
                  <button type="button" className="plan-more danger" onClick={() => window.confirm(`Apagar ${s.bill.name}?`) && setBills(bills.filter((b) => b.id !== s.bill.id))}>
                    <Trash2 size={14} /> apagar
                  </button>
                </div>
              )}
              {paying === s.bill.id && (
                <div className="bill-pay">
                  <MoneyField label="Quanto pagou" value={payValue} onChange={setPayValue} />
                  <div className="field-group">
                    <label className="field-label" htmlFor={`pd-${s.bill.id}`}>Em que dia pagou</label>
                    <input id={`pd-${s.bill.id}`} type="date" className="field-input" value={payDate} max={today} onChange={(e) => setPayDate(e.target.value || today)} />
                  </div>
                  <div className="bill-actions">
                    <button type="button" className="btn-primary" disabled={payValue <= 0} onClick={() => { setBills(pay(s.bill.id, payValue, payDate)); setPaying(null); }}>
                      Salvar pagamento
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setPaying(null)}>Cancelar</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="stat-card bills-add">
        <p className="field-label" style={{ color: 'var(--ink)', fontWeight: 700 }}>Nova conta ou dívida</p>
        <div className="field-group">
          <label className="field-label" htmlFor="bill-name">Nome</label>
          <input id="bill-name" className="field-input" placeholder="Ex.: luz, aluguel, cartão Nubank" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>
        <MoneyField label="Valor" value={amount} onChange={setAmount} />
        <div className="field-group">
          <label className="field-label" htmlFor="bill-day">Dia do vencimento</label>
          <DecimalInput id="bill-day" decimals={0} max={31} value={dueDay} onChange={setDueDay} />
        </div>
        <div className="seg" role="tablist" aria-label="Tipo" style={{ marginBottom: 12 }}>
          <button type="button" className={!parcelado ? 'active' : ''} onClick={() => setParcelado(false)}>Todo mês</button>
          <button type="button" className={parcelado ? 'active' : ''} onClick={() => setParcelado(true)}>Parcelado</button>
        </div>
        {parcelado && (
          <div className="field-group">
            <label className="field-label" htmlFor="bill-left">Quantas parcelas faltam (contando esta)?</label>
            <DecimalInput id="bill-left" decimals={0} max={480} value={left} onChange={setLeft} />
          </div>
        )}
        <button type="button" className="btn-primary" onClick={add} disabled={!name.trim() || amount <= 0}>
          <Plus size={16} /> Adicionar
        </button>
      </div>
      <p className="field-hint" style={{ marginTop: 12 }}>
        Multa e juros são estimativa: 2% de multa + 1% ao mês de juros, o comum em contas. Cartão e empréstimo costumam cobrar mais: confira no boleto.
      </p>
    </ToolShell>
  );
}
