// Dinheiro extra: o efeito de cada parte, o histórico e as conquistas. Pura, com teste.

import { arred } from './datas';
import { ordenar, simular, type DividaSim } from './dividas';
import type { Estrategia } from './tipos';

export interface RegistroExtra {
  data: string;
  origem: string;
  valor: number;
  divida: number;
  reserva: number;
  lazer: number;
}

export function lerHistorico(bruto: unknown): RegistroExtra[] {
  try {
    const v = JSON.parse(String(bruto ?? '[]')) as RegistroExtra[];
    return Array.isArray(v) ? v.filter((r) => r && typeof r.data === 'string' && Number(r.valor) > 0).slice(-12) : [];
  } catch {
    return [];
  }
}
export const guardarHistorico = (h: RegistroExtra[], novo: RegistroExtra) => JSON.stringify([...h, novo].slice(-12));
export const totalComDestino = (h: RegistroExtra[]) => arred(h.reduce((t, r) => t + r.valor, 0));

/** O que abater `valor` das dívidas (na ordem da estratégia) muda: meses e juros a menos. */
export function efeitoNaDivida(ds: DividaSim[], pagamento: number, estrategia: Estrategia, valor: number): { meses: number; economia: number } | null {
  if (ds.length === 0 || valor <= 0) return null;
  const antes = simular(ds, pagamento, estrategia);
  let resta = valor;
  const depoisDs = ordenar(ds, estrategia).map((d) => {
    const abate = Math.min(resta, d.saldo);
    resta -= abate;
    return { ...d, saldo: arred(d.saldo - abate) };
  }).filter((d) => d.saldo > 0);
  if (!antes.quita) return null;
  const depois = depoisDs.length ? simular(depoisDs, pagamento, estrategia) : { meses: 0, totalJuros: 0, quita: true };
  if (!depois.quita) return null;
  return { meses: antes.meses - depois.meses, economia: arred(antes.totalJuros - depois.totalJuros) };
}

export const mesesDeProtecao = (valor: number, gastoMensal: number) => (gastoMensal > 0 ? valor / gastoMensal : 0);

export function conquistasExtras(h: RegistroExtra[]): string[] {
  const c: string[] = [];
  if (h.length >= 1) c.push('Primeiro extra com destino');
  if (h.length >= 3) c.push('3 extras com destino');
  if (totalComDestino(h) >= 1000) c.push('R$ 1.000 bem usados');
  return c;
}
