// Tudo o que é derivado sai daqui: funções puras sobre o Estado. Nada é guardado duas vezes.

import { arred, diasEntre, diasRestantes, hoje as hojeSP, mesDe, somaMes, vencimentoNoMes } from './datas.js';
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
/** O que saiu do salário do mês pra guardar. Dinheiro extra (13º, bônus) não conta: ele não veio da renda do mês. */
export const guardadoNoMes = (e: Estado, mes: string) => arred(soma(e.aportes.filter((a) => mesDe(a.data) === mes && a.valor > 0 && a.origem !== 'extra').map((a) => a.valor)));
/** Reserva guardada. O que foi guardado para uma meta com nome (agenteId 'meta:…') não conta como reserva de emergência. */
export const patrimonioGuardado = (e: Estado) => arred(soma(e.aportes.filter((a) => !a.agenteId?.startsWith('meta:')).map((a) => a.valor)));

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

/** Fatura do cartão ainda aberta: compra no cartão não vira "gasto" até pagar a fatura (ela é o compromisso), então não duplica. */
export const faturaAberta = (e: Estado) => arred(Math.max(0, e.cartao?.usado ?? 0) + (e.outrosCartoes ?? []).reduce((t, c) => t + Math.max(0, c.usado), 0));

/** O que sai do mês antes do dia a dia: contas fixas, parcelas de dívida, fatura aberta, o que vai pra reserva e pra conta atrasada. */
export const compromissosDoMes = (e: Estado, mes: string) => arred(totalFixos(e, mes) + folgaMensal(e, mes).parcelas + faturaAberta(e) + guardarNoMes(e, mes) + atrasoNoMes(e, mes));

/* ---------- receitas ---------- */
export const receitasDoMes = (e: Estado, mes: string) => e.receitas.filter((r) => mesDe(r.data) === mes);
const somaReceitas = (e: Estado, mes: string, tipo: 'salario' | 'extra') => arred(soma(receitasDoMes(e, mes).filter((r) => r.tipo === tipo).map((r) => r.valor)));
export const receitasRecebidas = (e: Estado, mes: string) => arred(somaReceitas(e, mes, 'salario') + somaReceitas(e, mes, 'extra'));

/** Renda que vale no mês: a declarada, ou o salário registrado se foi maior; mais as receitas extras registradas. */
export const rendaEfetiva = (e: Estado, mes: string) => arred(Math.max(e.config.renda, somaReceitas(e, mes, 'salario')) + somaReceitas(e, mes, 'extra'));
/** A renda do mês já caiu? (há salário registrado) */
export const salarioConfirmado = (e: Estado, mes: string) => somaReceitas(e, mes, 'salario') > 0;

/* ---------- quanto posso gastar (regra em docs/regras-financeiras.md) ---------- */
export type Confianca = 'confirmado' | 'estimado';
export interface LinhaDisponivel {
  id: string;
  rotulo: string;
  valor: number; // sempre positivo; `sinal` diz se soma ou subtrai
  sinal: '+' | '-';
  confianca: Confianca;
  nota?: string;
}
export interface Disponivel {
  modo: 'saldo' | 'renda' | 'incompleto';
  livre: number; // pode ser negativo
  porDia: number;
  diasRestantes: number;
  linhas: LinhaDisponivel[];
  /** O que falta pra o número ser confiável (vazio = nada). */
  avisos: string[];
  /** Verdadeiro se alguma parte do cálculo é estimada (renda declarada ainda não recebida, por exemplo). */
  temEstimativa: boolean;
  /** Renda prevista que ainda não entrou no cálculo (modo saldo). */
  previstoNaoRecebido: number;
}

function saldoDesde(e: Estado, base: { valor: number; data: string }): number {
  const dep = (d: string) => d > base.data;
  const entrou = soma(e.receitas.filter((r) => dep(r.data)).map((r) => r.valor));
  const saiu =
    soma(e.lancamentos.filter((l) => dep(l.data)).map((l) => l.valor)) +
    soma(e.gastosFixos.flatMap((g) => Object.values(g.pagamentos).filter((p) => dep(p.pagoEm)).map((p) => p.valorPago))) +
    soma(e.dividas.flatMap((d) => d.pagamentos.filter((p) => dep(p.data)).map((p) => p.valor))) +
    soma(e.aportes.filter((a) => dep(a.data)).map((a) => a.valor)) + // guardar tira da conta; sacar da reserva devolve (valor < 0)
    soma((e.cartao?.pagas ?? []).filter((p) => dep(p.data)).map((p) => p.valor));
  return arred(base.valor + entrou - saiu);
}

export function detalheDisponivel(e: Estado, mes: string, hojeISO: string = hojeSP()): Disponivel {
  const dias = diasRestantes(mes, hojeISO);
  const linhas: LinhaDisponivel[] = [];
  const avisos: string[] = [];
  const atual = mes === mesDe(hojeISO);
  const guardar = guardarNoMes(e, mes);
  const reservaPendente = arred(Math.max(0, guardar - guardadoNoMes(e, mes)));
  const fatura = faturaAberta(e);
  const sai = (id: string, rotulo: string, valor: number, confianca: Confianca, nota?: string) => valor > 0.004 && linhas.push({ id, rotulo, valor: arred(valor), sinal: '-', confianca, nota });
  const salario = e.config.diaSalario;
  const previstoNaoRecebido = e.config.renda > 0 && !salarioConfirmado(e, mes) ? e.config.renda : 0;

  if (atual && e.config.saldoInformado) {
    const saldo = saldoDesde(e, e.config.saldoInformado);
    linhas.push({ id: 'saldo', rotulo: 'Saldo que você informou', valor: arred(Math.abs(saldo)), sinal: saldo < 0 ? '-' : '+', confianca: 'confirmado', nota: `informado em ${e.config.saldoInformado.data.split('-').reverse().join('/')}, com o que você anotou depois` });
    sai('fixos', 'Contas fixas que faltam pagar', faltaPagar(e, mes), 'confirmado');
    const pagasMes = soma(e.dividas.flatMap((d) => d.pagamentos.filter((p) => mesDe(p.data) === mes).map((p) => p.valor)));
    sai('parcelas', 'Parcelas de dívida do mês', Math.max(0, folgaMensal(e, mes).parcelas - pagasMes), 'estimado', 'o que ainda não foi pago neste mês');
    sai('fatura', 'Fatura do cartão em aberto', fatura, 'confirmado');
    sai('reserva', 'Reserva combinada (pague-se primeiro)', reservaPendente, 'estimado');
    sai('atraso', 'Contas atrasadas (plano)', Math.max(0, atrasoNoMes(e, mes) - (e.atrasos?.saidas?.[mes] ?? 0)), 'estimado');
    if (previstoNaoRecebido > 0) avisos.push(`Seu salário previsto de R$ ${previstoNaoRecebido.toLocaleString('pt-BR')}${salario ? ` (dia ${salario})` : ''} não entra no cálculo até você registrá-lo.`);
    if (diasEntre(e.config.saldoInformado.data, hojeISO) > 14) avisos.push('Seu saldo informado tem mais de 14 dias. Atualize para o número ficar mais confiável.');
    const livre = arred(soma(linhas.map((l) => (l.sinal === '+' ? l.valor : -l.valor))));
    return { modo: 'saldo', livre, porDia: arred(Math.max(0, livre) / dias), diasRestantes: dias, linhas, avisos, temEstimativa: linhas.some((l) => l.confianca === 'estimado'), previstoNaoRecebido };
  }

  const renda = rendaEfetiva(e, mes);
  if (renda <= 0) {
    return { modo: 'incompleto', livre: arred(-(compromissosDoMes(e, mes) + totalVariaveis(e, mes))), porDia: 0, diasRestantes: dias, linhas: [], avisos: ['Informe sua renda mensal ou o saldo que você tem hoje para eu calcular quanto você pode gastar.'], temEstimativa: true, previstoNaoRecebido: 0 };
  }
  const recebida = somaReceitas(e, mes, 'salario') > 0;
  linhas.push({ id: 'renda', rotulo: recebida || e.config.renda <= 0 ? 'Renda recebida no mês' : 'Renda mensal (informada)', valor: renda, sinal: '+', confianca: recebida ? 'confirmado' : 'estimado', nota: recebida ? undefined : 'ainda não registrada como recebida' });
  sai('fixos', 'Contas fixas do mês', totalFixos(e, mes), 'confirmado');
  sai('parcelas', 'Parcelas de dívida', folgaMensal(e, mes).parcelas, 'estimado');
  sai('fatura', 'Fatura do cartão em aberto', fatura, 'confirmado');
  sai('reserva', 'Reserva combinada (pague-se primeiro)', guardar, 'estimado');
  sai('atraso', 'Contas atrasadas (plano)', atrasoNoMes(e, mes), 'estimado');
  sai('gastos', 'Gastos do dia a dia já anotados', totalVariaveis(e, mes), 'confirmado');
  if (!recebida) avisos.push('Estou usando a renda que você informou. Registre o salário quando cair e, se quiser, informe seu saldo atual para um número mais firme.');
  if (!e.lancamentos.some((l) => mesDe(l.data) === mes)) avisos.push('Você ainda não anotou gastos do dia a dia neste mês, então o valor pode estar otimista.');
  const livre = arred(soma(linhas.map((l) => (l.sinal === '+' ? l.valor : -l.valor))));
  return { modo: 'renda', livre, porDia: arred(Math.max(0, livre) / dias), diasRestantes: dias, linhas, avisos, temEstimativa: !recebida || linhas.some((l) => l.confianca === 'estimado'), previstoNaoRecebido };
}

/** Pode ser negativo. Uma só regra pro app inteiro: ver detalheDisponivel. */
export const livreParaGastar = (e: Estado, mes: string, hojeISO: string = hojeSP()) => detalheDisponivel(e, mes, hojeISO).livre;

export const limiteDiario = (e: Estado, mes: string, hojeISO: string) => detalheDisponivel(e, mes, hojeISO).porDia;

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

