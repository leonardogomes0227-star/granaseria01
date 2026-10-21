// Datas do coach, sempre no fuso de Brasília (America/Sao_Paulo). Sem DOM: o servidor usa o mesmo arquivo.

const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Hoje em Brasília, 'AAAA-MM-DD'. */
export function todaySP(now: Date = new Date()): string {
  return FMT.format(now);
}
export const monthOf = (iso: string) => iso.slice(0, 7);
export const currentMonth = (now?: Date) => monthOf(todaySP(now));

/** Soma (ou subtrai) meses a um 'AAAA-MM'. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
export const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

const NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const monthName = (month: string) => NAMES[Number(month.slice(5, 7)) - 1];
/** 'nov/2027' */
export const monthShort = (month: string) => `${NAMES[Number(month.slice(5, 7)) - 1].slice(0, 3)}/${month.slice(0, 4)}`;

/**
 * Os meses em que dá pra fazer o check-in: o atual e, nos 10 primeiros dias, o anterior.
 * Nunca meses futuros, nunca meses antes de o plano existir.
 */
export function checkinMonths(planMonth: string, now: Date = new Date()): string[] {
  const today = todaySP(now);
  const cur = monthOf(today);
  const out: string[] = [];
  if (Number(today.slice(8, 10)) <= 10) out.push(addMonths(cur, -1));
  out.push(cur);
  return out.filter((m) => m >= planMonth);
}

/** 'mar/27' (spec v2, seção 11: datas curtas). */
export const monthAbbr = (month: string) => `${NAMES[Number(month.slice(5, 7)) - 1].slice(0, 3)}/${month.slice(2, 4)}`;
/** '22 out' a partir de 'AAAA-MM-DD'. */
export const dayAbbr = (day: string) => `${Number(day.slice(8, 10))} ${NAMES[Number(day.slice(5, 7)) - 1].slice(0, 3)}`;
/** Quantos dias tem o mês 'AAAA-MM'. */
export const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
