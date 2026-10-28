// Amortização: a parte da parcela que abate a dívida (o resto é juro). Tabela, extra e comparação. Pura, com teste.

import { arred } from './datas';

export interface LinhaAmort {
  mes: number;
  parcela: number;
  juros: number;
  amort: number;
  saldo: number;
}

/** Tabela mês a mês com parcela fixa. Nulo se a parcela não cobre nem os juros do primeiro mês. */
export function tabelaAmortizacao(saldo: number, jurosPct: number, parcela: number, limite = 600): LinhaAmort[] | null {
  if (!(saldo > 0) || !(parcela > 0)) return null;
  const i = jurosPct / 100;
  if (saldo * i >= parcela) return null;
  const rows: LinhaAmort[] = [];
  let s = saldo;
  for (let m = 1; m <= limite && s > 0.005; m++) {
    const j = arred(s * i);
    const ultima = s + j <= parcela + 0.005;
    const p = ultima ? arred(s + j) : parcela;
    const a = arred(p - j);
    s = ultima ? 0 : arred(s - a);
    rows.push({ mes: m, parcela: p, juros: j, amort: a, saldo: s });
  }
  return s > 0.005 ? null : rows;
}

export const totalJurosTabela = (t: LinhaAmort[]) => arred(t.reduce((s, r) => s + r.juros, 0));

/** Mês em que o abatimento passa a ser maior que o juro (nulo se já começa maior ou nunca). */
export const mesDaVirada = (t: LinhaAmort[]) => {
  if (t.length === 0 || t[0].amort >= t[0].juros) return null;
  const r = t.find((x) => x.amort >= x.juros);
  return r ? r.mes : null;
};

export interface ExtraAmort {
  prazo: { meses: number; mesesAntes: number; economia: number } | null;
  parcela: { nova: number; economia: number } | null;
}
/** Amortização extra de uma vez: reduzir o prazo (mesma parcela) ou reduzir a parcela (mesmo prazo). */
export function amortizacaoExtra(saldo: number, jurosPct: number, parcela: number, extra: number): ExtraAmort | null {
  const base = tabelaAmortizacao(saldo, jurosPct, parcela);
  if (!base || !(extra > 0)) return null;
  const novoSaldo = Math.max(0, saldo - extra);
  const jBase = totalJurosTabela(base);
  if (novoSaldo <= 0.005) return { prazo: { meses: 0, mesesAntes: base.length, economia: jBase }, parcela: { nova: 0, economia: jBase } };
  const t = tabelaAmortizacao(novoSaldo, jurosPct, parcela);
  const prazo = t ? { meses: t.length, mesesAntes: base.length - t.length, economia: arred(jBase - totalJurosTabela(t)) } : null;
  const i = jurosPct / 100;
  const n = base.length;
  const nova = i === 0 ? novoSaldo / n : (novoSaldo * i) / (1 - (1 + i) ** -n);
  const par = { nova: arred(nova), economia: arred(jBase - (nova * n - novoSaldo)) };
  return { prazo, parcela: par };
}
