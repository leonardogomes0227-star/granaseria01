// À vista ou parcelado: o juro escondido na parcela. Pura, com teste.

import { arred, brl0 } from './datas.js';
import { taxaEfetiva } from './ferramentas.js';

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

/* ---------- o duelo: quem ganha, contando o desconto à vista e o que o dinheiro renderia guardado ---------- */
export interface Duelo {
  vencedor: 'avista' | 'parcelado' | 'empate';
  taxaContraDesconto: number; // % ao mês que o parcelado cobra em cima do preço à vista com desconto
  diferenca: number; // quanto o parcelado custa a mais que o à vista com desconto (pode ser negativo)
  motivo: string;
}
/** Parcelar só ganha quando o juro em cima do preço com desconto é menor do que o dinheiro renderia guardado. */
export function duelo(p: { avista: number; parcelas: number; parcela: number; descontoAvistaPct: number; rendeMensalPct: number }): Duelo {
  const comDesconto = arred(p.avista * (1 - p.descontoAvistaPct / 100));
  const total = arred(p.parcelas * p.parcela);
  const diferenca = arred(total - comDesconto);
  const t = (taxaEfetiva(comDesconto, p.parcelas, p.parcela) ?? 0) * 100;
  const taxa = Math.round(t * 100) / 100;
  if (Math.abs(diferenca) < 1) return { vencedor: 'empate', taxaContraDesconto: 0, diferenca, motivo: 'O preço é o mesmo: parcele e deixe o dinheiro rendendo até cada parcela.' };
  if (diferenca < 0) return { vencedor: 'parcelado', taxaContraDesconto: 0, diferenca, motivo: 'O parcelado sai mais barato que o à vista. Parcele (e confira se não tem taxa escondida).' };
  if (taxa <= p.rendeMensalPct) return { vencedor: 'parcelado', taxaContraDesconto: taxa, diferenca, motivo: `O juro do parcelado (${taxa.toLocaleString('pt-BR')}% ao mês) é menor que o rendimento do dinheiro guardado (${p.rendeMensalPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ao mês). Se o dinheiro já está guardado e rendendo, parcelar compensa.` };
  return { vencedor: 'avista', taxaContraDesconto: taxa, diferenca, motivo: `Pagando à vista você economiza ${brl0(diferenca)}. O parcelado cobra ${taxa.toLocaleString('pt-BR')}% ao mês, mais do que o dinheiro renderia guardado.` };
}
