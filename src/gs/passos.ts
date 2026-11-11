// Os passos do mês: uma lista só, em ordem, sem aviso repetido. Junta o que estava espalhado em
// insights, prioridades, sugestões, regras do coach e missões. Puro e testado; a tela só mostra.

import { brl, brl0, diaCurto, mesCurto, mesDe } from './datas.js';
import { atrasosAbertos, NIVEIS } from './atrasosBase.js';
import { proximaData } from './cartaoLogica.js';
import { paraSim } from './dividas.js';
import { pagoNaDivida, planoDoMes } from './painelDividas.js';
import { planoMensalReserva } from './reservaLogica.js';
import { contasDoMes, detalheDisponivel, guardadoNoMes, patrimonioGuardado, reservaMeta, temAtrasoAnterior } from './selectores.js';
import { calcularCaminho, metaPrincipal, planoDeQuitacao } from './caminho.js';
import type { Estado } from './tipos.js';

export type OrigemPasso = 'atraso' | 'conta' | 'guardar' | 'limite' | 'fatura' | 'divida' | 'plano' | 'meta' | 'comecar';
/** atual: o próximo a fazer · pendente · feito · segurado: espera outro passo · continuo: vale o mês todo · oculto */
export type StatusPasso = 'atual' | 'pendente' | 'feito' | 'segurado' | 'continuo' | 'oculto';
export type Handler = 'baixa' | 'guardar' | 'adicionar' | 'pagar-divida' | 'renda' | 'guardar-meta' | 'concluir';

export interface Passo {
  id: string; // estável: não muda de um dia para o outro
  titulo: string; // começa com verbo
  detalhe: string; // número real + porquê
  acao: { rotulo: string; rota?: string; handler?: Handler; refId?: string; valor?: number };
  origem: OrigemPasso;
  status: StatusPasso;
  manual?: boolean; // colocado por uma ferramenta ou pelo Coach: pode ser apagado
}

const MAX_ATRASOS = 3;

export function passosDoMes(e: Estado, hoje: string, opts: { comOcultos?: boolean } = {}): Passo[] {
  const mes = mesDe(hoje);
  const lista: Omit<Passo, 'status'>[] = [];
  const estado = new Map<string, StatusPasso>();
  const add = (p: Omit<Passo, 'status'>, s: StatusPasso = 'pendente') => {
    if (estado.has(p.id)) return; // nunca o mesmo aviso duas vezes
    lista.push(p);
    estado.set(p.id, s);
  };

  if (e.config.renda <= 0 && !e.config.saldoInformado) {
    add({ id: 'comecar:renda', titulo: 'Contar quanto você ganha por mês', detalhe: 'É o primeiro número do seu caminho. Com ele eu calculo quanto dá para gastar por dia.', acao: { rotulo: 'Informar renda', handler: 'renda' }, origem: 'comecar' });
  }
  if (e.gastosFixos.length === 0) {
    add({ id: 'comecar:contas', titulo: 'Cadastrar as contas do mês', detalhe: 'Aluguel, luz, internet… Com elas eu aviso antes de vencer e digo o que pagar primeiro.', acao: { rotulo: 'Cadastrar contas', rota: '/lancamentos?aba=contas' }, origem: 'comecar' });
  }

  /* 1. contas atrasadas, na ordem de pagar (moradia, luz/água, financiamento, outras, cartão) */
  const atrasos = atrasosAbertos(e, hoje);
  const dividasComAtraso = new Set<string>();
  atrasos.forEach((a, i) => {
    if (a.fonte === 'divida') dividasComAtraso.add(a.refId);
    if (i >= MAX_ATRASOS) return;
    const doMes = a.fonte === 'conta' && a.mes === mes;
    const resto = i === MAX_ATRASOS - 1 && atrasos.length > MAX_ATRASOS ? ` Depois dela ainda há ${atrasos.length - MAX_ATRASOS}.` : '';
    add({
      id: `atraso:${a.chave}`,
      titulo: `Pagar ${a.nome}${a.mes < mes ? ` de ${mesCurto(a.mes)}` : ''}`,
      detalhe: `${brl0(a.total)}${a.encargos > 0 ? ' com multa e juros estimados' : ''} · atrasada há ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}. ${NIVEIS[a.nivel]?.motivo ?? ''}${resto}`.trim(),
      acao: doMes ? { rotulo: 'Pagar agora', handler: 'baixa', refId: a.refId, valor: a.valor } : { rotulo: 'Ver como pagar', rota: '/plano/atrasos' },
      origem: 'atraso',
    });
  });

  /* 2. contas que vencem em até 3 dias */
  for (const c of contasDoMes(e, mes, hoje)) {
    if (c.estado !== 'vence-logo') continue;
    const quando = c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence em ${c.dias} dias (${diaCurto(c.vencimento)})`;
    add({ id: `conta:${c.gasto.id}:${mes}`, titulo: `Pagar ${c.gasto.nome}`, detalhe: `${brl(c.valor)} · ${quando}. Pagando no dia, não tem multa.`, acao: { rotulo: 'Dar baixa', handler: 'baixa', refId: c.gasto.id, valor: c.valor }, origem: 'conta' });
  }

  /* 3. pagar-se primeiro (o décimo), segurado enquanto houver conta atrasada de mês anterior */
  const disp = detalheDisponivel(e, mes, hoje);
  const meta = reservaMeta(e, mes);
  const reservaPronta = meta > 0 && patrimonioGuardado(e) >= meta;
  const combinado = planoMensalReserva(e);
  if (e.config.renda > 0 && combinado > 0 && !reservaPronta) {
    const ja = guardadoNoMes(e, mes);
    const id = `guardar:${mes}`;
    if (disp.modo !== 'incompleto' && disp.livre < 0) add({ id, titulo: `Guardar ${brl0(combinado)} deste mês`, detalhe: 'Em espera: com o mês no vermelho, primeiro fechar as contas. Guardar volta quando sobrar.', acao: { rotulo: 'Ver onde cortar', rota: '/plano/cortar' }, origem: 'guardar' }, 'segurado');
    else if (temAtrasoAnterior(e, mes)) add({ id, titulo: `Guardar ${brl0(combinado)} deste mês`, detalhe: 'Segurado por enquanto: primeiro as contas atrasadas, porque a multa custa mais do que a reserva rende.', acao: { rotulo: 'Ver o atraso', rota: '/plano/atrasos' }, origem: 'guardar' }, 'segurado');
    else if (ja >= combinado - 0.005) add({ id, titulo: `Guardar ${brl0(combinado)} deste mês`, detalhe: `Feito: você guardou ${brl0(ja)}. É pagar a si mesmo antes de pagar os outros.`, acao: { rotulo: 'Ver a reserva', rota: '/plano/reserva' }, origem: 'guardar' }, 'feito');
    else add({ id, titulo: `Guardar ${brl0(combinado - ja)} antes de gastar`, detalhe: `${ja > 0 ? `Já foram ${brl0(ja)} de ${brl0(combinado)}. ` : ''}É a parte de tudo que você ganha que fica com você (${e.config.reservaMensal ? 'o valor que você escolheu' : `${e.config.reservaPct}% da renda`}).`, acao: { rotulo: 'Guardar agora', handler: 'guardar', valor: combinado - ja }, origem: 'guardar' });
  }

  /* 4. o limite do dia (vale o mês inteiro) */
  if (disp.modo !== 'incompleto') {
    if (disp.livre < 0) add({ id: `limite:${mes}`, titulo: `Cortar ${brl0(-disp.livre)} para fechar o mês`, detalhe: 'Seus compromissos passam do que entra neste mês. Veja onde dá para reduzir primeiro.', acao: { rotulo: 'Ver onde cortar', rota: '/plano/cortar' }, origem: 'limite' });
    else add({ id: `limite:${mes}`, titulo: `Gastar até ${brl(disp.porDia)} por dia`, detalhe: `Sobram ${brl0(disp.livre)} para ${disp.diasRestantes} ${disp.diasRestantes === 1 ? 'dia' : 'dias'}, já com contas e reserva separadas. Anote os gastos para o número ficar certo.`, acao: { rotulo: 'Anotar gasto', handler: 'adicionar' }, origem: 'limite' }, 'continuo');
  }

  /* 5. a fatura do cartão inteira até o vencimento */
  if (e.cartao && e.cartao.usado > 0) {
    const v = proximaData(e.cartao.venceDia, hoje);
    add({ id: `fatura:principal:${v.data}`, titulo: `Pagar a fatura inteira até ${diaCurto(v.data)}`, detalhe: `${brl(e.cartao.usado)}. Pagando o total você foge do rotativo (os juros do cartão quando não se paga tudo).`, acao: { rotulo: 'Abrir o cartão', rota: '/plano/cartao' }, origem: 'fatura' });
  }
  for (const oc of e.outrosCartoes ?? []) {
    if (oc.usado <= 0) continue;
    const v = proximaData(oc.venceDia, hoje);
    add({ id: `fatura:${oc.id}:${v.data}`, titulo: `Pagar a fatura ${oc.nome} até ${diaCurto(v.data)}`, detalhe: `${brl(oc.usado)}, inteira, para não pagar juros.`, acao: { rotulo: 'Abrir o cartão', rota: '/plano/cartao' }, origem: 'fatura' });
  }

  /* 6. as parcelas do plano de quitação */
  const ds = paraSim(e.dividas);
  if (ds.length > 0) {
    const { pagamento, estrategia, sugerido } = planoDeQuitacao(e, mes);
    if (sugerido && !e.planoDividas) add({ id: 'divida:plano', titulo: 'Escolher como quitar as dívidas', detalhe: `Você deve ${brl0(ds.reduce((t, d) => t + d.saldo, 0))}. Em 2 minutos eu mostro a ordem e a data em que você fica livre.`, acao: { rotulo: 'Montar o plano', rota: '/plano/dividas' }, origem: 'divida' });
    const partes = planoDoMes(ds, pagamento, estrategia).filter((p) => p.valor > 0.005);
    partes.forEach((p, i) => {
      if (dividasComAtraso.has(p.id)) return; // já está no passo do atraso
      const d = e.dividas.find((x) => x.id === p.id)!;
      const pago = pagoNaDivida(d, mes);
      const id = `divida:${p.id}:${mes}`;
      const extra = i === 0 && p.valor > Math.min(d.parcelaMinima, p.valor) + 0.005 ? ' É a da vez: recebe a parcela e o que sobra do plano.' : '';
      if (pago >= p.valor - 0.005) add({ id, titulo: `Pagar ${brl0(p.valor)} em ${p.nome}`, detalhe: `Feito: ${brl0(pago)} pagos neste mês.`, acao: { rotulo: 'Ver dívidas', rota: '/plano/dividas' }, origem: 'divida' }, 'feito');
      else add({ id, titulo: `Pagar ${brl0(p.valor - pago)} em ${p.nome}`, detalhe: `${pago > 0 ? `Já foram ${brl0(pago)} de ${brl0(p.valor)}. ` : ''}Parcela do seu plano de quitação.${extra}`, acao: { rotulo: 'Registrar pagamento', handler: 'pagar-divida', refId: p.id, valor: p.valor - pago }, origem: 'divida' });
    });
  }

  /* 7. o que as ferramentas e o Coach colocaram no plano */
  for (const p of e.caminho?.passos ?? []) {
    if (p.feitoEm && mesDe(p.feitoEm) !== mes) continue; // feito em outro mês: sai da lista
    add({ id: `plano:${p.id}`, titulo: p.titulo, detalhe: p.detalhe, acao: p.rota ? { rotulo: 'Abrir', rota: p.rota } : { rotulo: 'Marcar como feito', handler: 'concluir', refId: p.id }, origem: 'plano', manual: true }, p.feitoEm ? 'feito' : 'pendente');
  }

  /* 8. a meta do mês: guardar para o objetivo */
  const alvo = metaPrincipal(e);
  if (alvo) {
    const marco = calcularCaminho(e, hoje).find((m) => m.id === 'objetivo');
    const porMes = marco?.porMes ?? 0;
    const noMes = alvo.guardados.filter((g) => mesDe(g.data) === mes).reduce((t, g) => t + g.valor, 0);
    // meta sem prazo espera a reserva ficar completa: é o mesmo dinheiro, e ele não pode ser contado duas vezes
    const naVez = Boolean(alvo.prazo && alvo.prazo > hoje) || reservaPronta || meta <= 0;
    if (porMes > 0 && naVez) {
      const id = `meta:${alvo.id}:${mes}`;
      if (noMes >= porMes - 0.005) add({ id, titulo: `Guardar ${brl0(porMes)} para ${alvo.nome}`, detalhe: `Feito: ${brl0(noMes)} guardados neste mês.`, acao: { rotulo: 'Ver a meta', rota: '/guardar#metas' }, origem: 'meta' }, 'feito');
      else add({ id, titulo: `Guardar ${brl0(porMes - noMes)} para ${alvo.nome}`, detalhe: `Faltam ${brl0(marco?.faltaValor ?? 0)} para chegar lá. Nesse ritmo você mantém a data.`, acao: { rotulo: 'Guardar na meta', handler: 'guardar-meta', refId: alvo.id, valor: porMes - noMes }, origem: 'meta' });
    }
  }

  const ocultos = e.caminho?.ocultos ?? {};
  let achouAtual = false;
  const out: Passo[] = [];
  for (const p of lista) {
    let status = estado.get(p.id)!;
    if (ocultos[p.id] === mes && status !== 'feito') status = 'oculto';
    if (status === 'pendente' && !achouAtual) {
      status = 'atual';
      achouAtual = true;
    }
    if (status === 'oculto' && !opts.comOcultos) continue;
    out.push({ ...p, status });
  }
  return out;
}

/** O passo em destaque: o próximo a fazer. */
export const passoAtual = (ps: Passo[]) => ps.find((p) => p.status === 'atual') ?? null;
/** "2 de 5 feitos": só conta o que tem começo e fim (o limite do dia vale o mês todo). */
export function resumoDosPassos(ps: Passo[]): { feitos: number; total: number } {
  const contam = ps.filter((p) => p.status !== 'continuo' && p.status !== 'oculto');
  return { feitos: contam.filter((p) => p.status === 'feito').length, total: contam.length };
}
