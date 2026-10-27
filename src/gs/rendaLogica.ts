// Viver de renda: quanto o seu patrimônio já rende, o que isso já paga e quanto falta. Pura, com teste.

import { arred } from './datas';
import type { GastoFixo } from './tipos';

/** Quanto o patrimônio rende por mês, a uma taxa % ao mês. */
export const rendimentoMensal = (patrimonio: number, taxaPct: number) => arred(Math.max(0, patrimonio) * (taxaPct / 100));

/** Quanto dos gastos mensais o rendimento já cobre (0 a 100+). */
export const coberturaPct = (rendimento: number, gastoMensal: number) => (gastoMensal > 0 ? (rendimento / gastoMensal) * 100 : 0);

/** Quais contas fixas o rendimento já paga, das menores pras maiores. */
export function contasCobertas(fixas: Pick<GastoFixo, 'nome' | 'valor'>[], rendimento: number): string[] {
  let resta = rendimento;
  const nomes: string[] = [];
  for (const g of [...fixas].sort((a, b) => a.valor - b.valor)) {
    if (g.valor > resta) break;
    resta -= g.valor;
    nomes.push(g.nome);
  }
  return nomes;
}

export function conquistasRenda(pct: number): string[] {
  const m: [number, string][] = [[1, '1% dos gastos cobertos'], [10, '10% dos gastos cobertos'], [25, '25% dos gastos cobertos'], [50, 'Metade dos gastos coberta'], [100, 'Liberdade de renda']];
  return m.filter(([p]) => pct >= p).map(([, t]) => t);
}

/** Meses até o patrimônio chegar na meta, guardando `aporte` por mês a `taxaPct` ao mês. Nulo se passar de 50 anos. */
export function mesesAteMeta(patrimonio: number, meta: number, aporte: number, taxaPct: number): number | null {
  if (patrimonio >= meta) return 0;
  const i = taxaPct / 100;
  let v = patrimonio;
  for (let m = 1; m <= 600; m++) {
    v = v * (1 + i) + aporte;
    if (v >= meta) return m;
  }
  return null;
}
