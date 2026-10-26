// À vista ou parcelado: o juro escondido na parcela. Pura, com teste.

import { arred } from './datas';
import { taxaEfetiva } from './ferramentas';

export interface Parcelado {
  total: number;
  jurosPagos: number;
  taxaMensalPct: number; // % ao mês efetiva
  taxaAnualPct: number;
  semJuros: boolean;
  comDescontoAvista: number; // preço à vista com o desconto
  economiaComDesconto: number;
}

export function analisarParcelado(p: { avista: number; parcelas: number; parcela: number; descontoAvistaPct?: number }): Parcelado {
  const total = arred(p.parcelas * p.parcela);
  const t = taxaEfetiva(p.avista, p.parcelas, p.parcela) ?? 0;
  const desc = p.descontoAvistaPct ?? 7;
  const comDesconto = arred(p.avista * (1 - desc / 100));
  return {
    total,
    jurosPagos: arred(Math.max(0, total - p.avista)),
    taxaMensalPct: Math.round(t * 10000) / 100,
    taxaAnualPct: Math.round((Math.pow(1 + t, 12) - 1) * 100),
    semJuros: total <= p.avista + 0.5,
    comDescontoAvista: comDesconto,
    economiaComDesconto: arred(Math.max(0, total - comDesconto)),
  };
}
