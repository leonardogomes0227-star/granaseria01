// Nunca registrar nem "fechar" mês que ainda não chegou (spec v2, regra 0.6), sempre no fuso de Brasília.
// Funções puras, usadas no navegador (ao abrir o site) e no servidor (painel e WhatsApp), no estilo do resetIfOld.
//
// Onde mês futuro aparecia:
// - selos-tracking (Acompanhar meu plano): dava pra fechar o mês 2, 3, 4… do plano no mesmo dia. O mês N do plano
//   é pago durante o mês de calendário (início + N - 1) — a mesma folga de um mês que o WhatsApp já usa.
// - gs-guardado (Pague-se primeiro) e pagamentos de gs-contas com data depois de hoje.
// O que sair daqui não some: vai pra 'gs-futuros-removidos', pra dar pra recuperar se precisar.

import { addMonths, currentMonth, monthOf, todaySP } from '../coachChat/months.js';

export const BACKUP_KEY = 'gs-futuros-removidos';

interface TrackingLike {
  createdAt: string;
  months: unknown[];
}

/** O mês de calendário ('AAAA-MM') em que o mês N do plano é pago. */
export function mesDoPlano(createdAt: string, n: number): string {
  const inicio = monthOf(todaySP(new Date(createdAt)));
  return addMonths(inicio, n - 1);
}

/** Dá pra fechar o mês em aberto do plano agora? (Só quando o mês de calendário dele já chegou.) */
export function podeFecharMes(t: TrackingLike, now: Date = new Date()): boolean {
  return mesDoPlano(t.createdAt, t.months.length + 1) <= currentMonth(now);
}

/** Quando o mês em aberto do plano pode ser fechado ('AAAA-MM'). */
export const quandoPodeFechar = (t: TrackingLike) => mesDoPlano(t.createdAt, t.months.length + 1);

/** Tira os meses do plano fechados antes da hora. Devolve o que ficou e o que saiu. */
export function limparTracking<T extends TrackingLike>(t: T, now: Date = new Date()): { tracking: T; removidos: unknown[] } {
  const atual = currentMonth(now);
  const fica = t.months.filter((_, i) => mesDoPlano(t.createdAt, i + 1) <= atual);
  // os meses são uma fila: se um saiu, os seguintes também saem
  const n = t.months.findIndex((_, i) => mesDoPlano(t.createdAt, i + 1) > atual);
  if (n === -1) return { tracking: t, removidos: [] };
  return { tracking: { ...t, months: fica.slice(0, n) }, removidos: t.months.slice(n) };
}

interface SavedLike {
  on: string;
  amount: number;
}

/** Guardado com data depois de hoje sai. */
export function limparGuardado<T extends SavedLike>(list: T[], now: Date = new Date()): { list: T[]; removidos: T[] } {
  const hoje = todaySP(now);
  return { list: list.filter((e) => e.on <= hoje), removidos: list.filter((e) => e.on > hoje) };
}

interface BillLike {
  id: string;
  name?: string;
  payments: { month: string; paidOn: string; amount: number }[];
}

/**
 * Pagamento de conta com data depois de hoje sai. Pagar adiantado a conta do mês que vem (paidOn hoje) continua
 * valendo: o pagamento aconteceu hoje.
 */
export function limparContas<T extends BillLike>(bills: T[], now: Date = new Date()): { bills: T[]; removidos: { bill: string; payment: BillLike['payments'][number] }[] } {
  const hoje = todaySP(now);
  const removidos: { bill: string; payment: BillLike['payments'][number] }[] = [];
  const out = bills.map((b) => {
    const futuros = b.payments.filter((p) => p.paidOn > hoje);
    if (futuros.length === 0) return b;
    for (const p of futuros) removidos.push({ bill: b.name ?? b.id, payment: p });
    return { ...b, payments: b.payments.filter((p) => p.paidOn <= hoje) };
  });
  return { bills: removidos.length ? out : bills, removidos };
}

/** Um pagamento novo de conta pode ser registrado pra esse mês? (Mês futuro não.) */
export const podePagarMes = (month: string, now: Date = new Date()) => month <= currentMonth(now);

function parse<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Faxina do estado salvo (o mesmo JSON do site e do WhatsApp). Devolve o estado novo e se mudou.
 * O que sai vai pra BACKUP_KEY, com a data da faxina.
 */
export function limparMesesFuturos<S extends Record<string, string>>(state: S, now: Date = new Date()): { state: S; changed: boolean } {
  const next: Record<string, string> = { ...state };
  const removed: Record<string, unknown> = {};

  const tracking = parse<TrackingLike>(state['selos-tracking']);
  if (tracking && Array.isArray(tracking.months) && typeof tracking.createdAt === 'string') {
    const r = limparTracking(tracking, now);
    if (r.removidos.length) {
      next['selos-tracking'] = JSON.stringify(r.tracking);
      removed['selos-tracking'] = r.removidos;
    }
  }

  const saved = parse<SavedLike[]>(state['gs-guardado']);
  if (Array.isArray(saved)) {
    const r = limparGuardado(saved.filter((e) => e && typeof e.on === 'string'), now);
    if (r.removidos.length) {
      next['gs-guardado'] = JSON.stringify(r.list);
      removed['gs-guardado'] = r.removidos;
    }
  }

  const bills = parse<BillLike[]>(state['gs-contas']);
  if (Array.isArray(bills)) {
    const r = limparContas(bills.filter((b) => b && Array.isArray(b.payments)), now);
    if (r.removidos.length) {
      next['gs-contas'] = JSON.stringify(r.bills);
      removed['gs-contas'] = r.removidos;
    }
  }

  if (Object.keys(removed).length === 0) return { state, changed: false };
  const backup = parse<unknown[]>(state[BACKUP_KEY]) ?? [];
  next[BACKUP_KEY] = JSON.stringify([...backup, { em: todaySP(now), removido: removed }].slice(-20));
  return { state: next as S, changed: true };
}
