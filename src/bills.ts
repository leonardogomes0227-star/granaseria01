// Minhas contas e dívidas: cada conta ou parcela com o dia de vencimento; a pessoa marca o que pagou e quando.
// Pagou atrasado: estimativa de multa (2%) + juros de mora (1% ao mês, por dia), o comum em contas no Brasil.
// Pra quem recebe aos poucos no mês: "entrou dinheiro agora" mostra o que pagar primeiro com esse valor.

export interface BillPayment {
  month: string; // AAAA-MM a que o pagamento se refere
  paidOn: string; // AAAA-MM-DD
  amount: number;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number; // 1 a 31
  installments?: number; // parcelas no total (sem isso: conta de todo mês)
  startMonth: string; // AAAA-MM da primeira parcela
  payments: BillPayment[];
}

export const BILLS_KEY = 'gs-contas';
export const LATE_FINE = 0.02;
export const LATE_DAILY = 0.01 / 30;

export const monthOf = (iso: string) => iso.slice(0, 7);
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

export function dueDate(bill: Bill, month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(bill.dueDay, last)).padStart(2, '0')}`;
}

/** Essa conta existe nesse mês? (parcelas acabam; conta de todo mês, não) */
export function activeIn(bill: Bill, month: string): boolean {
  const n = monthsBetween(bill.startMonth, month);
  return n >= 0 && (!bill.installments || n < bill.installments);
}

export const installmentNumber = (bill: Bill, month: string) => monthsBetween(bill.startMonth, month) + 1;
export const paidIn = (bill: Bill, month: string) => bill.payments.filter((p) => p.month === month).reduce((s, p) => s + p.amount, 0);

const days = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/** Multa + juros de um valor pago (ou ainda devido) com atraso. */
export function lateFee(amount: number, due: string, paidOn: string): number {
  const late = days(due, paidOn);
  return late > 0 ? amount * LATE_FINE + amount * LATE_DAILY * late : 0;
}

export interface BillStatus {
  bill: Bill;
  due: string;
  left: number; // quanto falta pagar neste mês
  paid: number;
  state: 'pago' | 'pago-atrasado' | 'atrasado' | 'vence';
  daysToDue: number; // negativo = atrasado
  fee: number; // multa + juros: o que já pagou de atraso, ou o que está correndo
}

export function statusFor(bill: Bill, month: string, today: string): BillStatus {
  const due = dueDate(bill, month);
  const paid = paidIn(bill, month);
  const left = Math.max(0, bill.amount - paid);
  const lastPay = bill.payments.filter((p) => p.month === month).sort((a, b) => b.paidOn.localeCompare(a.paidOn))[0];
  const daysToDue = days(today, due);
  if (left < 0.01) {
    const fee = bill.payments.filter((p) => p.month === month).reduce((s, p) => s + lateFee(p.amount, due, p.paidOn), 0);
    return { bill, due, left: 0, paid, state: lastPay && lastPay.paidOn > due ? 'pago-atrasado' : 'pago', daysToDue, fee };
  }
  return { bill, due, left, paid, state: daysToDue < 0 ? 'atrasado' : 'vence', daysToDue, fee: lateFee(left, due, today) };
}

export function monthStatus(bills: Bill[], month: string, today: string): BillStatus[] {
  return bills
    .filter((b) => activeIn(b, month))
    .map((b) => statusFor(b, month, today))
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** Entrou um dinheiro: o que pagar primeiro (atrasadas, depois as que vencem antes). */
export function splitMoney(statuses: BillStatus[], money: number): { status: BillStatus; pay: number }[] {
  let left = money;
  const out: { status: BillStatus; pay: number }[] = [];
  const open = statuses.filter((s) => s.left > 0).sort((a, b) => a.daysToDue - b.daysToDue);
  for (const s of open) {
    if (left <= 0.009) break;
    const pay = Math.min(left, s.left + s.fee);
    out.push({ status: s, pay: Math.round(pay * 100) / 100 });
    left -= pay;
  }
  return out;
}

export function parseBills(raw: string | null | undefined): Bill[] {
  try {
    const v = raw ? (JSON.parse(raw) as Bill[]) : [];
    return Array.isArray(v) ? v.filter((b) => b && typeof b.name === 'string' && b.amount > 0) : [];
  } catch {
    return [];
  }
}

/* ---------- uso compartilhado (Meu mês, Plano, Início e a tela de contas) ---------- */

export function loadBills(): Bill[] {
  try {
    return parseBills(localStorage.getItem(BILLS_KEY));
  } catch {
    return [];
  }
}

/** Salva as contas e avisa as outras telas abertas (o saldo e os cartões se atualizam na hora). */
export function saveBills(list: Bill[]) {
  try {
    localStorage.setItem(BILLS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('gs-contas'));
  } catch {
    // segue sem salvar
  }
}

/** Quanto saiu pelas contas marcadas como pagas no app neste mês (pela data em que o dinheiro saiu). */
export function paidThisMonth(bills: Bill[], month: string): number {
  let total = 0;
  for (const b of bills) for (const p of b.payments) if (p.paidOn.slice(0, 7) === month) total += p.amount;
  return Math.round(total * 100) / 100;
}

/** Pagamentos do mês, do mais novo pro mais velho: viram linhas nos lançamentos. */
export function paymentsThisMonth(bills: Bill[], month: string): { name: string; amount: number; paidOn: string }[] {
  const rows: { name: string; amount: number; paidOn: string }[] = [];
  for (const b of bills) for (const p of b.payments) if (p.paidOn.slice(0, 7) === month) rows.push({ name: b.name, amount: p.amount, paidOn: p.paidOn });
  return rows.sort((a, b) => b.paidOn.localeCompare(a.paidOn));
}

/* ---------- Pague-se primeiro (Babilônia): separar 10% da renda antes de gastar ---------- */

export const SAVED_KEY = 'gs-guardado';
export const SAVE_SHARE = 0.1;

export interface SavedEntry {
  on: string; // AAAA-MM-DD em que a pessoa guardou
  amount: number;
}

export function loadSaved(): SavedEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as SavedEntry[];
    return Array.isArray(v) ? v.filter((e) => e && typeof e.on === 'string' && e.amount > 0) : [];
  } catch {
    return [];
  }
}

export function saveSaved(list: SavedEntry[]) {
  try {
    if (list.length === 0) localStorage.removeItem(SAVED_KEY);
    else localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(-60)));
    window.dispatchEvent(new Event('gs-contas'));
  } catch {
    // segue sem salvar
  }
}

export const savedThisMonth = (list: SavedEntry[], month: string) => Math.round(list.filter((e) => e.on.slice(0, 7) === month).reduce((t, e) => t + e.amount, 0) * 100) / 100;
