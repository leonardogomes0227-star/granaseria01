// Empréstimos: qual cabe no bolso, quanto compensa contra as suas dívidas e o que virar dívida ao contratar. Pura, com teste.

import { arred } from './datas';
import type { CustoOferta } from './ferramentas';

export interface AvaliacaoOferta {
  pesoRenda: number | null; // % da renda que a parcela ocupa
  cabe: boolean | null; // parcela <= livre mensal estimado (renda - gastos)
  trocaCompensa: boolean | null; // juro menor que o da dívida mais cara
  juroDeTrabalho: number | null; // horas de trabalho que o juro custa
}

export function avaliarOferta(c: CustoOferta, p: { renda: number; capacidade: number; horasMes: number; maiorJuroDivida: number }): AvaliacaoOferta {
  return {
    pesoRenda: p.renda > 0 ? (c.parcela / p.renda) * 100 : null,
    cabe: p.capacidade > 0 ? c.parcela <= p.capacidade : null,
    trocaCompensa: p.maiorJuroDivida > 0 && c.taxaMensal !== null ? c.taxaMensal < p.maiorJuroDivida : null,
    juroDeTrabalho: p.renda > 0 && p.horasMes > 0 ? Math.round(c.juros / (p.renda / p.horasMes)) : null,
  };
}

/** A oferta vira dívida ao ser contratada: saldo = o que recebeu, juro e parcela da oferta. */
export const ofertaComoDivida = (c: CustoOferta, nome: string) => ({ nome, saldo: arred(c.valor), jurosMensal: c.taxaMensal ?? 0, parcelaMinima: arred(c.parcela) });
