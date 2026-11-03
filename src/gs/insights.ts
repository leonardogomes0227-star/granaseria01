// "Próximas ações" (Início) e "Resumo da semana": funções puras sobre o Estado. Textos com números reais.

import { brl0, diaCurto, diasEntre, mesCurto, mesDe, somaDias } from './datas';
import { situacaoAtrasos } from './atrasosLogica';
import { contasDoMes, faltaPagar, gastoMensalMedio, guardadoNoMes, lancamentosDoMes, limiteDiario, livreParaGastar, patrimonioGuardado, quantoCortar, reservaMeta } from './selectores';
import { maiorJuroMensal, paraSim, passoDoMes, saldoAtual } from './dividas';
import type { Estado } from './tipos';

export const ATIVOS_PADRAO = ['contas', 'gastos', 'dividas', 'reserva', 'assinaturas'];
export const assistenteAtivo = (e: Estado, id: string) => (e.agentes[id] ? e.agentes[id].ativo : ATIVOS_PADRAO.includes(id));

export type TipoAcao = 'dar-baixa' | 'pagar-divida' | 'guardar' | 'ir' | 'revisar-assinaturas';
export interface Insight {
  id: string;
  prioridade: number; // maior = mais urgente
  texto: string;
  acao: { rotulo: string; tipo: TipoAcao; rota?: string; valor?: number; refId?: string };
}

export function getInsights(e: Estado, hoje: string, opts: { cdiMensalPct?: number | null } = {}): Insight[] {
  const mes = mesDe(hoje);
  const lista: Insight[] = [];
  const renda = e.config.renda;
  const salarioCaiu = e.config.diaSalario !== undefined && Number(hoje.slice(8, 10)) >= e.config.diaSalario;
  const atraso = assistenteAtivo(e, 'contas') ? situacaoAtrasos(e, hoje) : null;
  const atrasado = Boolean(atraso && atraso.anteriores.length > 0);

  // contas de meses anteriores: a bola de neve. Com o salário, diz o que pagar ou quanto separar.
  if (atraso && atrasado) {
    const passo = atraso.plano.passos[0];
    const p = passo?.pagar[0];
    const separar = Math.max(0, Math.min(atraso.porMes - atraso.saiuNoMes, (passo?.guardado ?? 0) - atraso.separado));
    const quem = salarioCaiu ? 'Seu salário caiu. ' : '';
    const texto = p
      ? `${quem}Pague primeiro a atrasada ${p.nome} de ${mesCurto(p.mesRef)}: cerca de ${brl0(p.valor)}`
      : separar > 0 && salarioCaiu
        ? `${quem}Separe ${brl0(separar)} pra sair do atraso${atraso.plano.emDiaEm ? `. Em dia em ${mesCurto(atraso.plano.emDiaEm)}` : ''}`
        : `${atraso.anteriores.length === 1 ? `${atraso.anteriores[0].nome} de ${mesCurto(atraso.anteriores[0].mes)} ficou pra trás` : `${atraso.anteriores.length} contas ficaram pra trás`} (${brl0(atraso.anteriores.reduce((t, a) => t + a.total, 0))}). Veja como pôr em dia`;
    lista.push({ id: 'atraso', prioridade: salarioCaiu ? 99 : 88, texto, acao: { rotulo: 'Ver plano', tipo: 'ir', rota: '/plano/atrasos' } });
  }

  if (assistenteAtivo(e, 'contas')) {
    for (const c of contasDoMes(e, mes, hoje)) {
      if (c.estado === 'atrasada') lista.push({ id: `conta-${c.gasto.id}`, prioridade: 100 + Math.min(20, -c.dias), texto: `${c.gasto.nome} está atrasada desde ${diaCurto(c.vencimento)} (${brl0(c.valor)})`, acao: { rotulo: 'Dar baixa', tipo: 'dar-baixa', refId: c.gasto.id, rota: '/mes' } });
      else if (c.estado !== 'paga' && c.dias <= Math.max(3, e.config.avisos.antecedenciaDias)) {
        const quando = c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence em ${c.dias} dias`;
        lista.push({ id: `conta-${c.gasto.id}`, prioridade: 90 - c.dias, texto: `${c.gasto.nome} ${quando} (${brl0(c.valor)})`, acao: { rotulo: 'Dar baixa', tipo: 'dar-baixa', refId: c.gasto.id, rota: '/mes' } });
      }
    }
  }

  if (assistenteAtivo(e, 'dividas') && e.dividas.length > 0) {
    const ds = paraSim(e.dividas);
    const plano = e.planoDividas;
    if (plano && ds.length > 0) {
      const passo = passoDoMes(ds, plano.pagamentoMensal, plano.estrategia);
      if (passo) {
        const pagoNoMes = e.dividas.find((d) => d.id === passo.divida.id)?.pagamentos.filter((p) => mesDe(p.data) === mes).reduce((t, p) => t + p.valor, 0) ?? 0;
        if (pagoNoMes + 0.005 < passo.valor) lista.push({ id: 'divida-mes', prioridade: 80, texto: `Este mês pague ${brl0(passo.valor - pagoNoMes)} na dívida ${passo.divida.nome}`, acao: { rotulo: 'Registrar pagamento', tipo: 'pagar-divida', refId: passo.divida.id, valor: passo.valor - pagoNoMes, rota: '/plano/dividas' } });
      }
    } else if (ds.length > 0) {
      lista.push({ id: 'divida-plano', prioridade: 60, texto: `Você tem ${brl0(ds.reduce((t, d) => t + d.saldo, 0))} em dívidas. Monte o plano pra quitar`, acao: { rotulo: 'Montar plano', tipo: 'ir', rota: '/plano/dividas' } });
    }
    if (opts.cdiMensalPct != null && maiorJuroMensal(e.dividas) > opts.cdiMensalPct)
      lista.push({ id: 'juro-vs-cdi', prioridade: 50, texto: 'Sua dívida cobra mais juros do que qualquer investimento rende: quitar vem antes', acao: { rotulo: 'Ver dívidas', tipo: 'ir', rota: '/plano/dividas' } });
  }

  if (assistenteAtivo(e, 'reserva') && renda > 0) {
    const sugerido = Math.round((renda * e.config.reservaPct) / 100);
    // com conta atrasada, o dinheiro do salário vai primeiro pro atraso (a multa custa mais do que a reserva rende)
    if (salarioCaiu && !atrasado && guardadoNoMes(e, mes) <= 0 && sugerido > 0)
      lista.push({ id: 'reserva-salario', prioridade: 85, texto: `Seu salário caiu. Guarde ${brl0(sugerido)} (${e.config.reservaPct}%) antes de gastar`, acao: { rotulo: 'Guardar agora', tipo: 'guardar', valor: sugerido } });
    const meta = reservaMeta(e, mes);
    const falta = meta - patrimonioGuardado(e);
    if (meta > 0 && falta > 0 && !(salarioCaiu && guardadoNoMes(e, mes) <= 0)) lista.push({ id: 'reserva-meta', prioridade: 40, texto: `Reserva de emergência: faltam ${brl0(falta)}`, acao: { rotulo: 'Guardar', tipo: 'guardar', valor: Math.min(falta, sugerido || falta) } });
  }

  if (assistenteAtivo(e, 'gastos') && renda > 0) {
    const livre = livreParaGastar(e, mes);
    if (livre < 0) lista.push({ id: 'sem-folga', prioridade: 70, texto: `Sem folga este mês. Corte ${brl0(quantoCortar(e, mes))} para fechar no zero`, acao: { rotulo: 'Ver gastos', tipo: 'ir', rota: '/mes?aba=dia' } });
    else lista.push({ id: 'limite-diario', prioridade: 30, texto: `Você pode gastar ${brl0(limiteDiario(e, mes, hoje))} por dia até o fim do mês`, acao: { rotulo: 'Anotar gasto', tipo: 'ir', rota: '/mes?aba=dia' } });
  }

  if (assistenteAtivo(e, 'assinaturas')) {
    const total = e.assinaturas.filter((a) => a.ativa).reduce((t, a) => t + a.valor, 0);
    if (total > 0) lista.push({ id: 'assinaturas', prioridade: 35, texto: `Você paga ${brl0(total)}/mês em assinaturas`, acao: { rotulo: 'Revisar', tipo: 'revisar-assinaturas', rota: '/plano/assinaturas' } });
  }

  return lista.sort((a, b) => b.prioridade - a.prioridade).slice(0, 3);
}

/* ---------- Resumo da semana (segunda a domingo) ---------- */
export const segundaDe = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return somaDias(iso, -((d + 6) % 7));
};
export interface Resumo {
  de: string;
  ate: string;
  gasto: number;
  contasPagas: number;
  valorContasPagas: number;
  guardado: number;
  categoriaTop: { nome: string; valor: number } | null;
  recomendacao: string;
}
export function resumoDaSemana(e: Estado, hoje: string, semanasAtras = 0): Resumo {
  const de = somaDias(segundaDe(hoje), -7 * semanasAtras);
  const ate = somaDias(de, 6);
  const dentro = (d: string) => d >= de && d <= ate;
  const ls = e.lancamentos.filter((l) => dentro(l.data));
  const porCat = new Map<string, number>();
  for (const l of ls) porCat.set(l.categoria, (porCat.get(l.categoria) ?? 0) + l.valor);
  const top = [...porCat.entries()].sort((a, b) => b[1] - a[1])[0];
  const pagos = e.gastosFixos.flatMap((g) => Object.values(g.pagamentos).filter((p) => dentro(p.pagoEm)));
  const gasto = ls.reduce((t, l) => t + l.valor, 0);
  const guardado = e.aportes.filter((a) => dentro(a.data)).reduce((t, a) => t + a.valor, 0);
  const mes = mesDe(hoje);
  let recomendacao = 'Anote os gastos do dia a dia: é assim que o plano fica certo.';
  if (e.config.renda > 0 && livreParaGastar(e, mes) < 0) recomendacao = `Corte ${brl0(quantoCortar(e, mes))} pra fechar o mês no zero.`;
  else if (faltaPagar(e, mes) > 0 && diasEntre(hoje, `${mes}-28`) <= 7) recomendacao = `Ainda faltam ${brl0(faltaPagar(e, mes))} em contas fixas este mês.`;
  else if (situacaoAtrasos(e, hoje).anteriores.length > 0) recomendacao = 'Tem conta de mês anterior atrasada. O que sobrar vai primeiro pra ela, antes de guardar.';
  else if (guardado <= 0 && e.config.renda > 0) recomendacao = `Guarde ${brl0((e.config.renda * e.config.reservaPct) / 100)} antes de gastar o resto.`;
  else if (top) recomendacao = `${top[0]} foi o que mais pesou. Dá pra segurar um pouco na próxima?`;
  return { de, ate, gasto: Math.round(gasto * 100) / 100, contasPagas: pagos.length, valorContasPagas: pagos.reduce((t, p) => t + p.valorPago, 0), guardado, categoriaTop: top ? { nome: top[0], valor: top[1] } : null, recomendacao };
}

export const temDadosDoMes = (e: Estado, mes: string) => lancamentosDoMes(e, mes).length > 0 || e.gastosFixos.length > 0 || e.aportes.length > 0;
export { gastoMensalMedio, saldoAtual };
