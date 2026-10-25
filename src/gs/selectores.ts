// Tudo o que é derivado sai daqui: funções puras sobre o Estado. Nada é guardado duas vezes.

import { arred, diasEntre, diasRestantes, mesDe, somaMes, vencimentoNoMes } from './datas';
import type { Estado, GastoFixo, Lancamento } from './tipos';

const soma = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

/** Quanto a conta vale neste mês: o que foi pago de fato, ou o previsto. */
export const valorDoMes = (g: GastoFixo, mes: string) => g.pagamentos[mes]?.valorPago ?? g.valor;
export const estaPaga = (g: GastoFixo, mes: string) => Boolean(g.pagamentos[mes]);

export const totalFixos = (e: Estado, mes: string) => arred(soma(e.gastosFixos.map((g) => valorDoMes(g, mes))));
export const fixosPagos = (e: Estado, mes: string) => arred(soma(e.gastosFixos.filter((g) => estaPaga(g, mes)).map((g) => g.pagamentos[mes].valorPago)));
export const faltaPagar = (e: Estado, mes: string) => Math.max(0, arred(totalFixos(e, mes) - fixosPagos(e, mes)));

export const lancamentosDoMes = (e: Estado, mes: string): Lancamento[] => e.lancamentos.filter((l) => mesDe(l.data) === mes);
export const totalVariaveis = (e: Estado, mes: string) => arred(soma(lancamentosDoMes(e, mes).map((l) => l.valor)));
export const guardadoNoMes = (e: Estado, mes: string) => arred(soma(e.aportes.filter((a) => mesDe(a.data) === mes).map((a) => a.valor)));
export const patrimonioGuardado = (e: Estado) => arred(soma(e.aportes.map((a) => a.valor)));

/** Pode ser negativo: a pessoa gastou além da renda. */
export const livreParaGastar = (e: Estado, mes: string) => arred(e.config.renda - totalFixos(e, mes) - totalVariaveis(e, mes) - guardadoNoMes(e, mes));

export const limiteDiario = (e: Estado, mes: string, hojeISO: string) => arred(Math.max(0, livreParaGastar(e, mes)) / diasRestantes(mes, hojeISO));

/** Gasto médio por mês: contas fixas + média dos variáveis dos 3 meses anteriores (ou do mês atual, sem histórico). */
export function gastoMensalMedio(e: Estado, mes: string): number {
  const anteriores = [1, 2, 3].map((n) => totalVariaveis(e, somaMes(mes, -n))).filter((v) => v > 0);
  const variavel = anteriores.length > 0 ? soma(anteriores) / anteriores.length : totalVariaveis(e, mes);
  return arred(totalFixos(e, mes) + variavel);
}
export const reservaMeta = (e: Estado, mes: string) => arred(6 * gastoMensalMedio(e, mes));

export interface Fatia {
  id: 'fixos' | 'livre' | 'guardado';
  rotulo: string;
  valor: number;
  pct: number; // 0 a 100, sobre a renda
}
/** As 3 fatias da rosca (a do livre nunca é negativa). */
export function fatiasDaRenda(e: Estado, mes: string): Fatia[] {
  const renda = e.config.renda;
  const base = [
    { id: 'fixos' as const, rotulo: 'Gastos fixos', valor: totalFixos(e, mes) },
    { id: 'livre' as const, rotulo: 'Livre para gastar', valor: Math.max(0, livreParaGastar(e, mes)) },
    { id: 'guardado' as const, rotulo: 'Guardado', valor: guardadoNoMes(e, mes) },
  ];
  const total = soma(base.map((f) => f.valor));
  const ref = Math.max(renda, total);
  return base.map((f) => ({ ...f, pct: ref > 0 ? (f.valor / ref) * 100 : 0 }));
}

export type EstadoConta = 'paga' | 'atrasada' | 'vence-logo' | 'em-dia';
export interface ContaDoMes {
  gasto: GastoFixo;
  vencimento: string;
  estado: EstadoConta;
  dias: number; // dias até vencer (negativo = atrasada)
  valor: number;
}
export function contasDoMes(e: Estado, mes: string, hojeISO: string): ContaDoMes[] {
  return e.gastosFixos
    .map((gasto) => {
      const vencimento = vencimentoNoMes(mes, gasto.diaVencimento);
      const dias = diasEntre(hojeISO, vencimento);
      const estado: EstadoConta = estaPaga(gasto, mes) ? 'paga' : dias < 0 ? 'atrasada' : dias <= 3 ? 'vence-logo' : 'em-dia';
      return { gasto, vencimento, estado, dias, valor: valorDoMes(gasto, mes) };
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.gasto.nome.localeCompare(b.gasto.nome));
}

/** Dias seguidos (até hoje ou ontem) com pelo menos um lançamento. */
export function sequenciaDeDias(e: Estado, hojeISO: string): number {
  const dias = new Set(e.lancamentos.map((l) => l.data));
  let d = dias.has(hojeISO) ? hojeISO : new Date(Date.parse(`${hojeISO}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  let n = 0;
  while (dias.has(d) && n < 3650) {
    n++;
    d = new Date(Date.parse(`${d}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  }
  return n;
}

/** Quanto falta cortar pra fechar o mês no zero (quando o livre é negativo). */
export const quantoCortar = (e: Estado, mes: string) => Math.max(0, arred(-livreParaGastar(e, mes)));
