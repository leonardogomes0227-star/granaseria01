// Empréstimos: qual cabe no bolso, quanto compensa contra as suas dívidas e o que virar dívida ao contratar. Pura, com teste.

import { arred } from './datas.js';
import { custoDaOferta, type CustoOferta } from './ferramentas.js';

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

/* ---------- quanto custa: valor + prazo + (parcela ou taxa) ---------- */
/** Parcela fixa (tabela Price) pra um valor, prazo e taxa ao mês. */
export function parcelaPorTaxa(valor: number, n: number, taxaMensalPct: number): number {
  if (!(valor > 0) || !(n > 0)) return 0;
  const i = Math.max(0, taxaMensalPct) / 100;
  return arred(i === 0 ? valor / n : (valor * i) / (1 - (1 + i) ** -n));
}
/** Taxa ao ano equivalente (juro sobre juro): 4% ao mês viram 60% ao ano, não 48%. */
export const taxaAnualDeMensal = (mensalPct: number) => ((1 + mensalPct / 100) ** 12 - 1) * 100;

export interface Custo {
  valor: number;
  parcelas: number;
  parcela: number;
  total: number;
  juros: number;
  taxaMensal: number | null;
  taxaAnual: number | null;
  pctJuros: number; // juros sobre o valor recebido, em %
}
export function custoDoEmprestimo(p: { valor: number; parcelas: number; parcela?: number; taxaMensalPct?: number }): Custo | null {
  const n = Math.round(p.parcelas);
  if (!(p.valor > 0) || !(n > 0)) return null;
  const parcela = p.parcela && p.parcela > 0 ? arred(p.parcela) : p.taxaMensalPct !== undefined && p.taxaMensalPct >= 0 ? parcelaPorTaxa(p.valor, n, p.taxaMensalPct) : 0;
  if (!(parcela > 0)) return null;
  const c = custoDaOferta({ valor: p.valor, parcelas: n, parcela });
  return { valor: c.valor, parcelas: n, parcela, total: c.total, juros: c.juros, taxaMensal: c.taxaMensal, taxaAnual: c.taxaMensal === null ? null : Math.round(taxaAnualDeMensal(c.taxaMensal) * 10) / 10, pctJuros: Math.round((c.juros / p.valor) * 1000) / 10 };
}

/** O mesmo empréstimo em outros prazos: quanto mais longo, mais juro. */
export function porPrazo(valor: number, taxaMensalPct: number, prazos = [6, 12, 18, 24, 36, 48]): { parcelas: number; parcela: number; juros: number }[] {
  return prazos.map((n) => {
    const parcela = parcelaPorTaxa(valor, n, taxaMensalPct);
    return { parcelas: n, parcela, juros: arred(parcela * n - valor) };
  });
}

/** Taxas típicas por tipo, só como ponto de partida (cada banco cobra a sua: confira o CET). */
export const TAXAS_TIPICAS: { nome: string; taxa: number }[] = [
  { nome: 'Consignado', taxa: 1.8 },
  { nome: 'Pessoal', taxa: 4 },
  { nome: 'Loja / crediário', taxa: 5 },
  { nome: 'Cheque especial', taxa: 8 },
];
