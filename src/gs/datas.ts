// Datas e dinheiro do app novo: sempre no fuso de São Paulo, mês como 'AAAA-MM'.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** R$ 1.225,50 (com centavos). */
export const brl = (n: number) => BRL.format(Number.isFinite(n) ? n : 0).replace(/\u00a0/g, ' ');
/** R$ 1.225 (sem centavos, pra resumos). */
export const brl0 = (n: number) => BRL0.format(Number.isFinite(n) ? Math.round(n) : 0).replace(/\u00a0/g, ' ');
export const pct = (n: number, casas = 0) => `${(Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export const arred = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Hoje em São Paulo, 'AAAA-MM-DD'. `agora` existe pra teste. */
export function hoje(agora: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  return p;
}
export const mesDe = (iso: string) => iso.slice(0, 7);
export const mesAtual = (agora?: Date) => mesDe(hoje(agora));

export function somaMes(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
export const diasNoMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/** Vencimento 29 a 31 em mês curto vira o último dia do mês. */
export const vencimentoNoMes = (mes: string, dia: number) => `${mes}-${String(Math.min(Math.max(1, dia), diasNoMes(mes))).padStart(2, '0')}`;

/** Dias que faltam no mês, contando hoje (mínimo 1). Mês passado = 1; mês futuro = dias do mês. */
export function diasRestantes(mes: string, hojeISO: string): number {
  const atual = mesDe(hojeISO);
  if (mes < atual) return 1;
  if (mes > atual) return diasNoMes(mes);
  return Math.max(1, diasNoMes(mes) - Number(hojeISO.slice(8, 10)) + 1);
}

export const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);
export const somaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const nomeMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
export const mesCurto = (mes: string) => `${MESES3[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
/** "22 out" */
export const diaCurto = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES3[Number(iso.slice(5, 7)) - 1]}`;
/** "hoje", "amanhã", "ontem" ou "22 out". */
export function diaRelativo(iso: string, hojeISO: string): string {
  const d = diasEntre(hojeISO, iso);
  return d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d === -1 ? 'ontem' : diaCurto(iso);
}
export const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export const novoId = (p = 'x') => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Número positivo e finito, ou 0. */
export const positivo = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
