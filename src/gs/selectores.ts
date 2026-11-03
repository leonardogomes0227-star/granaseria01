// Tudo o que é derivado sai daqui: funções puras sobre o Estado. Nada é guardado duas vezes.

import { arred, diasEntre, diasRestantes, mesDe, somaMes, vencimentoNoMes } from './datas.js';
import { saldoAtual } from './dividas.js';
import { atrasosAbertos, sem } from './atrasosBase.js';
import type { Estado, GastoFixo, Lancamento } from './tipos.js';

const soma = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

/** Quanto a conta vale neste mês: o que foi pago de fato, ou o previsto. */
export const valorDoMes = (g: GastoFixo, mes: string) => g.pagamentos[mes]?.valorPago ?? g.valor;
export const estaPaga = (g: GastoFixo, mes: string) => Boolean(g.pagamentos[mes]);

export const totalFixos = (e: Estado, mes: string) => arred(soma(e.gastosFixos.map((g) => valorDoMes(g, mes))));
export const fixosPagos = (e: Estado, mes: string) => arred(soma(e.gastosFixos.filter((g) => estaPaga(g, mes)).map((g) => g.pagamentos[mes].valorPago)));
export const faltaPagar = (e: Estado, mes: string) => Math.max(0, arred(totalFixos(e, mes) - fixosPagos(e, mes)));

export const lancamentosDoMes = (e: Estado, mes: string): Lancamento[] => e.lancamentos.filter((l) => mesDe(l.data) === mes);
export const totalVariaveis = (e: Estado, mes: string) => arred(soma(lancamentosDoMes(e, mes).map((l) => l.valor)));
export const guardadoNoMes = (e: Estado, mes: string) => arred(soma(e.aportes.filter((a) => mesDe(a.data) === mes && a.valor > 0).map((a) => a.valor)));
export const patrimonioGuardado = (e: Estado) => arred(soma(e.aportes.map((a) => a.valor)));

/** Quanto tirar por mês pro atraso: o que a pessoa escolheu, ou a sobra do orçamento. Sem gasto do dia a dia anotado, 0 (a sobra seria otimista). */
export function porMesAtraso(e: Estado, mes: string): number {
  if (e.atrasos?.porMes !== undefined) return e.atrasos.porMes;
  const f = folgaMensal(e, mes);
  return f.semHistorico ? 0 : Math.max(0, Math.floor(f.folga / 10) * 10);
}

/** Quanto do mês já tem destino no atraso: o que a pessoa vai tirar por mês, ou o que já tirou (se foi mais).
 *  Assim o "pode gastar" não conta com um dinheiro que é da conta atrasada. Sem atraso de mês anterior, só o que já saiu. */
/** Tem conta de mês anterior que ficou pra trás? */
export const temAtrasoAnterior = (e: Estado, mes: string) => atrasosAbertos(e, `${mes}-01`).some((a) => a.mes < mes);

export function atrasoNoMes(e: Estado, mes: string): number {
  const saiu = e.atrasos?.saidas?.[mes] ?? 0;
  return arred(temAtrasoAnterior(e, mes) ? Math.max(saiu, porMesAtraso(e, mes)) : saiu);
}

/** Quanto o mês separa pra reserva: o combinado (10% da renda ou o valor escolhido), ou o que já guardou, se foi mais.
 *  Pausa com conta atrasada (o dinheiro vai pra ela) e quando a reserva já está completa. É o "pague-se primeiro". */
export function guardarNoMes(e: Estado, mes: string): number {
  const ja = guardadoNoMes(e, mes);
  if (e.config.renda <= 0 || temAtrasoAnterior(e, mes)) return ja;
  const meta = reservaMeta(e, mes);
  if (meta > 0 && patrimonioGuardado(e) >= meta) return ja;
  const plano = e.config.reservaMensal && e.config.reservaMensal > 0 ? e.config.reservaMensal : Math.round((e.config.renda * e.config.reservaPct) / 100);
  return arred(Math.max(ja, plano));
}

/** O que sai do mês antes do dia a dia: contas fixas, parcelas de dívida, o que vai pra reserva e pra conta atrasada. */
export const compromissosDoMes = (e: Estado, mes: string) => arred(totalFixos(e, mes) + folgaMensal(e, mes).parcelas + guardarNoMes(e, mes) + atrasoNoMes(e, mes));

/** Pode ser negativo: a pessoa gastou além da renda. Já desconta as contas, as parcelas, a reserva combinada e o atraso. */
export const livreParaGastar = (e: Estado, mes: string) => arred(e.config.renda - compromissosDoMes(e, mes) - totalVariaveis(e, mes));

export const limiteDiario = (e: Estado, mes: string, hojeISO: string) => arred(Math.max(0, livreParaGastar(e, mes)) / diasRestantes(mes, hojeISO));

/** Gasto médio por mês: contas fixas + média dos variáveis dos 3 meses anteriores (ou do mês atual, sem histórico). */
export function gastoMensalMedio(e: Estado, mes: string): number {
  const anteriores = [1, 2, 3].map((n) => totalVariaveis(e, somaMes(mes, -n))).filter((v) => v > 0);
  const variavel = anteriores.length > 0 ? soma(anteriores) / anteriores.length : totalVariaveis(e, mes);
  return arred(totalFixos(e, mes) + variavel);
}
export const reservaMeta = (e: Estado, mes: string) => arred((e.config.reservaMeses ?? 6) * gastoMensalMedio(e, mes));

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

/* ---------- quanto sobra por mês (renda − contas fixas − média do dia a dia − parcelas das dívidas) ---------- */
export interface Folga {
  renda: number;
  gastos: number; // contas fixas + média do dia a dia
  parcelas: number; // parcelas das dívidas que não estão nas contas fixas
  folga: number; // pode ser negativa
  semHistorico: boolean; // nenhum gasto do dia a dia anotado: a folga ignora mercado, transporte… e fica otimista
}
export function folgaMensal(e: Estado, mes: string): Folga {
  const fixos = new Set(e.gastosFixos.map((g) => sem(g.nome.trim())));
  const parcelas = arred(e.dividas.filter((d) => !fixos.has(sem(d.nome.trim()))).reduce((t, d) => t + Math.min(d.parcelaMinima, saldoAtual(d)), 0));
  const gastos = gastoMensalMedio(e, mes);
  const desde = somaMes(mes, -3);
  const semHistorico = !e.lancamentos.some((l) => mesDe(l.data) >= desde && mesDe(l.data) <= mes);
  return { renda: e.config.renda, gastos, parcelas, folga: arred(e.config.renda - gastos - parcelas), semHistorico };
}

