// Contas pequenas do Meu mês e da folha de anotar, puras (testadas em mes.test.ts): o teclado do valor, os dias da
// lista ("Hoje", "Ontem", "18 out") e os meses que dá pra escolher (o atual e os que passaram, nunca o futuro).

import { addDays } from '../../coach';
import { addMonths, dayAbbr, monthName, todaySP } from '../../coachChat/months';

/* ---------- valores ---------- */

/** "R$ 42,50": lançamentos mostram os centavos. */
export const brlCentavos = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- teclado do valor (1–9, ",", 0, ⌫) ---------- */

export type Tecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'apagar';

const MAX_INTEIRO = 7; // até R$ 9.999.999,99 (o servidor aceita até 10 milhões)

/** O que fica digitado depois de uma tecla. O texto é só dígitos e no máximo uma vírgula ("1234,5"). */
export function digitar(texto: string, tecla: Tecla): string {
  if (tecla === 'apagar') return texto.slice(0, -1);
  const [inteiro, dec] = texto.split(',');
  if (tecla === ',') {
    if (texto.includes(',')) return texto;
    return `${inteiro || '0'},`;
  }
  if (dec !== undefined) return dec.length >= 2 ? texto : texto + tecla;
  if (inteiro === '0') return tecla; // "0" e "5" vira "5"
  if (inteiro.length >= MAX_INTEIRO) return texto;
  return inteiro + tecla;
}

/** O número digitado ("12,5" → 12.5). */
export function valorDoTexto(texto: string): number {
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** O texto do teclado pra um valor já anotado (42.5 → "42,50"; 80 → "80"). */
export function textoDoValor(valor: number): string {
  if (!(valor > 0)) return '';
  const cent = Math.round(valor * 100) % 100;
  const inteiro = String(Math.floor(Math.round(valor * 100) / 100));
  return cent ? `${inteiro},${String(cent).padStart(2, '0')}` : inteiro;
}

/** Como mostrar o que está digitado: "1234,5" → { inteiro: "1.234", decimais: ",5" }. */
export function partesDoTexto(texto: string): { inteiro: string; decimais: string } {
  const [inteiro, dec] = texto.split(',');
  const n = Number(inteiro || '0');
  return { inteiro: n.toLocaleString('pt-BR'), decimais: dec === undefined ? '' : `,${dec}` };
}

/** A tecla do teclado físico (ou null). Ponto vira vírgula. */
export function teclaDoTeclado(key: string): Tecla | null {
  if (/^[0-9]$/.test(key)) return key as Tecla;
  if (key === ',' || key === '.' || key === 'Decimal') return ',';
  if (key === 'Backspace' || key === 'Delete') return 'apagar';
  return null;
}

/* ---------- dias ---------- */

/** O dia ('AAAA-MM-DD', em Brasília) de um instante ISO. */
export const diaDe = (iso: string) => todaySP(new Date(iso));

/** "Hoje", "Ontem" ou "18 out". */
export function tituloDia(dia: string, hoje: string): string {
  if (dia === hoje) return 'Hoje';
  if (dia === addDays(hoje, -1)) return 'Ontem';
  return dayAbbr(dia);
}

/** Agrupa por dia, do mais novo pro mais velho (a lista já vem nessa ordem; a ordem dentro do dia fica). */
export function agruparPorDia<T extends { dia: string }>(itens: T[], hoje: string): { dia: string; titulo: string; itens: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const it of [...itens].sort((a, b) => b.dia.localeCompare(a.dia))) {
    const g = grupos.get(it.dia);
    if (g) g.push(it);
    else grupos.set(it.dia, [it]);
  }
  return [...grupos.entries()].map(([dia, lista]) => ({ dia, titulo: tituloDia(dia, hoje), itens: lista }));
}

/* ---------- meses ---------- */

/** O mês atual e os que passaram (até 12 pra trás). Nunca o futuro. */
export function mesesParaEscolher(atual: string, quantos = 12): string[] {
  return Array.from({ length: quantos + 1 }, (_, i) => addMonths(atual, -i));
}

/** Um mês que dá pra abrir: o atual quando vier futuro ou estranho. */
export function mesValido(mes: string | null | undefined, atual: string, quantos = 12): string {
  return mes && mesesParaEscolher(atual, quantos).includes(mes) ? mes : atual;
}

/** "outubro de 2026" (com o ano só quando não é o ano de agora). */
export function nomeDoMes(mes: string, atual: string): string {
  return mes.slice(0, 4) === atual.slice(0, 4) ? monthName(mes) : `${monthName(mes)} de ${mes.slice(0, 4)}`;
}

/** O dia mais antigo que dá pra anotar (o servidor aceita até 13 meses pra trás). */
export const diaMinimo = (hoje: string) => `${addMonths(hoje.slice(0, 7), -12)}-01`;
