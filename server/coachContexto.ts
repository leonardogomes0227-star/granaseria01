// O que o coach de IA pode saber sobre a pessoa. Montado AQUI, no servidor, a partir do estado salvo
// (nunca do que o navegador manda), só com números agregados: sem nome, telefone, e-mail nem descrições de lançamentos.

import { migrar } from '../src/gs/migracao.js';
import { atrasosAbertos } from '../src/gs/atrasosBase.js';
import { saldoAtual } from '../src/gs/dividas.js';
import { contasDoMes, detalheDisponivel, patrimonioGuardado, receitasRecebidas, reservaMeta, totalVariaveis } from '../src/gs/selectores.js';
import { recomendacoes, situacaoFinanceira } from '../src/gs/coachRegras.js';
import { mesDe, somaMes } from '../src/gs/datas.js';

const STORE_KEY = 'grana-seria:v1';

export interface ContextoCoach {
  texto: string;
  temDados: boolean;
}

function gastosPorCategoria(e: ReturnType<typeof migrar>, mes: string) {
  const m = new Map<string, number>();
  for (const l of e.lancamentos) if (mesDe(l.data) === mes) m.set(l.categoria, (m.get(l.categoria) ?? 0) + l.valor);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Resumo em texto, com os números reais e a confiança de cada um. Sem dados: diz que não há dados. */
export function contextoDoCoach(state: Record<string, string>, hoje: string): ContextoCoach {
  let bruto: unknown = null;
  try {
    bruto = state[STORE_KEY] ? JSON.parse(state[STORE_KEY]) : null;
  } catch {
    bruto = null;
  }
  if (!bruto) return { texto: 'A pessoa ainda não tem dados financeiros salvos no app. Não invente números: pergunte o que ela quer saber e convide a informar renda e gastos.', temDados: false };
  const e = migrar(bruto);
  const mes = mesDe(hoje);
  const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;
  const d = detalheDisponivel(e, mes, hoje);
  const linhas: string[] = [`Data de hoje: ${hoje}. Situação geral: ${situacaoFinanceira(e, hoje)}.`];
  if (d.modo === 'incompleto') linhas.push('Dinheiro disponível: DESCONHECIDO (a pessoa não informou renda nem saldo).');
  else {
    linhas.push(`Dinheiro livre no mês: ${brl(d.livre)} (${d.modo === 'saldo' ? 'baseado no saldo que a pessoa informou' : 'baseado na renda'}${d.temEstimativa ? ', com partes ESTIMADAS' : ', confirmado'}). Pode gastar por dia: ${brl(d.porDia)} (${d.diasRestantes} dias restantes).`);
    linhas.push('Composição: ' + d.linhas.map((l) => `${l.sinal}${brl(l.valor)} ${l.rotulo} [${l.confianca}]`).join('; ') + '.');
    for (const a of d.avisos) linhas.push(`Ressalva: ${a}`);
  }
  linhas.push(`Renda informada: ${e.config.renda > 0 ? brl(e.config.renda) : 'não informada'}. Receitas registradas no mês: ${brl(receitasRecebidas(e, mes))}. Gastos do dia a dia no mês: ${brl(totalVariaveis(e, mes))}.`);
  const top = gastosPorCategoria(e, mes).slice(0, 5);
  const ant = new Map(gastosPorCategoria(e, somaMes(mes, -1)));
  if (top.length) linhas.push('Maiores categorias no mês (mês anterior entre parênteses): ' + top.map(([c, v]) => `${c} ${brl(v)} (${brl(ant.get(c) ?? 0)})`).join('; ') + '.');
  const contas = contasDoMes(e, mes, hoje).filter((c) => c.estado !== 'paga');
  if (contas.length) linhas.push('Contas pendentes: ' + contas.slice(0, 8).map((c) => `${c.gasto.nome} ${brl(c.valor)} vence ${c.vencimento} (${c.estado})`).join('; ') + '.');
  const atras = atrasosAbertos(e, hoje).filter((a) => a.mes < mes);
  if (atras.length) linhas.push(`Contas atrasadas de meses anteriores: ${atras.length}, total estimado ${brl(atras.reduce((t, a) => t + a.total, 0))}.`);
  const dividas = e.dividas.filter((x) => saldoAtual(x) > 0);
  if (dividas.length) linhas.push('Dívidas: ' + dividas.slice(0, 8).map((x) => `${x.nome} saldo ${brl(saldoAtual(x))}, parcela ${brl(x.parcelaMinima)}, juros ${x.jurosMensal}% ao mês`).join('; ') + '.');
  if (e.cartao) linhas.push(`Cartão: fatura aberta ${brl(e.cartao.usado)} de limite ${brl(e.cartao.limite)}, vence dia ${e.cartao.venceDia}.`);
  linhas.push(`Reserva guardada: ${brl(patrimonioGuardado(e))}${reservaMeta(e, mes) > 0 ? ` (meta ${brl(reservaMeta(e, mes))})` : ''}.`);
  if (e.metas.length) linhas.push('Metas: ' + e.metas.map((m) => `${m.nome} ${brl(m.guardados.reduce((t, g) => t + g.valor, 0))} de ${brl(m.alvo)}`).join('; ') + '.');
  if (e.config.objetivo) linhas.push(`Objetivo declarado: ${e.config.objetivo}.`);
  const recs = recomendacoes(e, hoje).slice(0, 3);
  if (recs.length) linhas.push('Sinais que o app já detectou: ' + recs.map((r) => r.titulo).join('; ') + '.');
  return { texto: linhas.join('\n'), temDados: true };
}
