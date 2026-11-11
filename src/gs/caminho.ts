// O Caminho: a linha do tempo da vida financeira da pessoa, com a data prevista de cada marco.
// Puro e testado. Nenhuma conta nova: cada data sai das lógicas que já existem (atrasos, dívidas, reserva, metas, renda).
// Os marcos correm em sequência, na mesma ordem do "Dinheiro extra" e do caminho de Investir.

import { arred, brl0, mesDe, nomeMes, somaMes, vencimentoNoMes } from './datas.js';
import { cfgAtrasos, atrasosAbertos } from './atrasosBase.js';
import { planoDeRecuperacao } from './atrasosLogica.js';
import { paraSim, simular, totalDividas, type DividaSim } from './dividas.js';
import { capacidadeDePagamento, pagamentoSugerido } from './painelDividas.js';
import { mesesParaMeta, planoMensalReserva } from './reservaLogica.js';
import { planoDaMeta, patrimonioParaRenda, TAXA_RENDA_PADRAO } from './ferramentas.js';
import { mesesAteMeta } from './rendaLogica.js';
import { folgaMensal, gastoMensalMedio, patrimonioGuardado, reservaMeta } from './selectores.js';
import type { Estado, Estrategia, Meta } from './tipos.js';

/** Juro ao mês a partir do qual a dívida é "cara": cobra mais do que a renda fixa rende (mesmo corte do Dinheiro extra). */
export const JURO_CARO = 1.5;

export type MarcoId = 'em-dia' | 'dividas-caras' | 'dividas' | 'reserva' | 'objetivo' | 'investir' | 'renda';
export type StatusMarco = 'feito' | 'atual' | 'futuro' | 'nao-se-aplica';

export interface Marco {
  id: MarcoId;
  n: number; // posição na lista do que se aplica (1, 2, 3…)
  titulo: string;
  selo: string;
  status: StatusMarco;
  dataPrevista: string | null; // 'AAAA-MM'
  faltaValor: number;
  faltaMeses: number | null;
  porMes: number;
  progresso: number; // 0 a 100
  premissas: string[];
  ferramentaRota: string;
  /** Por que não há data, quando não há (o que a pessoa precisa informar). */
  pendencia?: string;
}

/** Ajuste hipotético, para o "e se": dinheiro de uma vez (positivo entra, negativo sai) e valor por mês a mais ou a menos. */
export interface Ajuste {
  deUmaVez?: number;
  porMes?: number;
}

export const mesesEntre = (de: string, ate: string) => {
  const [a, b] = [de, ate].map((m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)));
  return b - a;
};
const maisTarde = (a: string, b: string) => (a > b ? a : b);

export const SELOS: Record<MarcoId, string> = {
  'em-dia': 'Selo da Ordem',
  'dividas-caras': 'Selo da Saída',
  dividas: 'Selo da Liberdade',
  reserva: 'Selo do Escudo',
  objetivo: 'Selo da Conquista',
  investir: 'Selo da Semente',
  renda: 'Selo do Futuro',
};

/** A meta que representa o objetivo da pessoa: a que ainda não foi batida e vence primeiro (ou a mais antiga). */
export function metaPrincipal(e: Estado): Meta | null {
  const abertas = e.metas.filter((m) => m.guardados.reduce((t, g) => t + g.valor, 0) < m.alvo - 0.005);
  if (abertas.length === 0) return null;
  return [...abertas].sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.criadaEm.localeCompare(b.criadaEm))[0];
}

/** Quanto a pessoa paga por mês nas dívidas e em que ordem: o plano dela, ou uma sugestão dentro do que o orçamento aguenta. */
export function planoDeQuitacao(e: Estado, mes: string): { pagamento: number; estrategia: Estrategia; sugerido: boolean } {
  const ds = paraSim(e.dividas);
  const estrategia = e.planoDividas?.estrategia ?? e.caminho?.metodoQuitacao ?? 'bola-de-neve';
  if (e.planoDividas && e.planoDividas.pagamentoMensal > 0) return { pagamento: e.planoDividas.pagamentoMensal, estrategia, sugerido: false };
  const minimo = arred(ds.reduce((t, d) => t + Math.min(d.parcelaMinima, d.saldo), 0));
  const cap = capacidadeDePagamento(e.config.renda, gastoMensalMedio(e, mes));
  return { pagamento: pagamentoSugerido(minimo, cap, totalDividas(e.dividas)), estrategia, sugerido: true };
}

const semDados = (e: Estado) => e.config.renda <= 0 && !e.config.saldoInformado && e.gastosFixos.length === 0 && e.lancamentos.length === 0 && e.dividas.length === 0 && e.receitas.length === 0 && !(e.atrasos?.manuais?.length);

export function calcularCaminho(e: Estado, hoje: string, ajuste: Ajuste = {}): Marco[] {
  const mes = mesDe(hoje);
  const vazio = semDados(e);
  let bolso = ajuste.deUmaVez ?? 0; // dinheiro de uma vez que ainda não achou destino
  let maisPorMes = ajuste.porMes ?? 0; // vale para o primeiro marco em aberto
  const brutos: Omit<Marco, 'n' | 'status'>[] = [];
  const estados: ('feito' | 'aberto' | 'fora')[] = [];
  const add = (m: Omit<Marco, 'n' | 'status' | 'selo'>, estado: 'feito' | 'aberto' | 'fora') => {
    brutos.push({ ...m, selo: SELOS[m.id] });
    estados.push(estado);
  };
  const usaMensal = () => {
    const v = maisPorMes;
    maisPorMes = 0;
    return v;
  };

  /* 1. Em dia com as contas */
  const atrasos = atrasosAbertos(e, hoje);
  let fimEmDia: string | null = mes;
  if (vazio) {
    fimEmDia = null;
    add({ id: 'em-dia', titulo: 'Em dia com as contas', dataPrevista: null, faltaValor: 0, faltaMeses: null, porMes: 0, progresso: 0, premissas: [], ferramentaRota: '/pagar', pendencia: 'Conte sua renda e suas contas do mês para eu montar o seu caminho.' }, 'aberto');
  } else if (atrasos.length === 0) {
    add({ id: 'em-dia', titulo: 'Em dia com as contas', dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: 0, progresso: 100, premissas: [], ferramentaRota: '/plano/atrasos' }, 'feito');
  } else {
    const cfg = cfgAtrasos(e);
    const folga = folgaMensal(e, mes);
    const sugerido = Math.max(0, Math.floor(folga.folga / 10) * 10);
    const porMes = Math.max(0, (cfg.porMes ?? sugerido) + usaMensal());
    const total = arred(atrasos.reduce((t, a) => t + a.total, 0));
    const entra = Math.max(0, bolso);
    const sai = Math.max(0, -bolso);
    bolso = Math.max(0, arred(entra - total));
    // uma compra (dinheiro que sai) entra na frente da fila: o plano só anda depois de repor esse valor
    const fila = sai > 0 ? [{ chave: 'sim', fonte: 'manual' as const, refId: 'sim', nome: 'compra', mes: somaMes(mes, -1), vencimento: hoje, valor: sai, dias: -99999, encargos: 0, total: sai, nivel: 0 }, ...atrasos] : atrasos;
    const plano = planoDeRecuperacao(fila, { porMes, separado: cfg.separado + entra, jaSaiuNoMes: Math.max(0, cfg.saidas[mes] ?? 0), hoje });
    fimEmDia = plano.emDiaEm;
    const premissas = [`se você separar ${brl0(porMes)} por mês para as contas atrasadas`, 'multa de 2% e juros de 1% ao mês são estimativas', 'sem deixar novas contas atrasarem'];
    if (cfg.porMes === undefined && folga.semHistorico) premissas.unshift('sem gastos do dia a dia anotados, o valor que sobra pode estar otimista');
    add({ id: 'em-dia', titulo: 'Em dia com as contas', dataPrevista: fimEmDia, faltaValor: total, faltaMeses: fimEmDia ? mesesEntre(mes, fimEmDia) : null, porMes, progresso: 0, premissas, ferramentaRota: '/plano/atrasos', pendencia: fimEmDia ? undefined : porMes <= 0 ? 'Me diga quanto dá para separar por mês e eu calculo a data.' : 'Com esse valor por mês não fecha em 2 anos. Vale negociar ou separar um pouco mais.' }, 'aberto');
  }

  /* 2 e 3. Dívidas caras e todas as dívidas */
  const todas = paraSim(e.dividas);
  const original = arred(e.dividas.reduce((t, d) => t + d.saldo, 0));
  let fimCaras: string | null = mes;
  let fimDividas: string | null = mes;
  if (e.dividas.length === 0) {
    add({ id: 'dividas-caras', titulo: 'Livre das dívidas caras', dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: 0, progresso: 100, premissas: [], ferramentaRota: '/plano/dividas' }, 'fora');
    add({ id: 'dividas', titulo: 'Livre de todas as dívidas', dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: 0, progresso: 100, premissas: [], ferramentaRota: '/plano/dividas' }, 'fora');
  } else {
    const { pagamento: base, estrategia, sugerido } = planoDeQuitacao(e, mes);
    const pagamento = Math.max(0, base + (todas.length ? usaMensal() : 0));
    // dinheiro de uma vez: abate na ordem do plano; compra: vira uma conta sem juros que passa na frente
    let ds: DividaSim[] = todas;
    if (bolso > 0 && ds.length) {
      let resta = bolso;
      const ordem = [...ds].sort((a, b) => (estrategia === 'bola-de-neve' ? a.saldo - b.saldo : b.jurosMensal - a.jurosMensal));
      const novo = new Map(ordem.map((d) => { const ab = Math.min(resta, d.saldo); resta = arred(resta - ab); return [d.id, arred(d.saldo - ab)] as const; }));
      ds = ds.map((d) => ({ ...d, saldo: novo.get(d.id) ?? d.saldo }));
      bolso = resta;
    } else if (bolso < 0 && ds.length) {
      ds = [{ id: '~compra', nome: 'compra', saldo: -bolso, jurosMensal: 0, parcelaMinima: -bolso }, ...ds];
      bolso = 0;
    }
    const abertas = ds.filter((d) => d.saldo > 0.005);
    const sim = simular(abertas, pagamento, estrategia, mes);
    const idsCaras = new Set(e.dividas.filter((d) => d.jurosMensal >= JURO_CARO).map((d) => d.id));
    const carasAbertas = abertas.filter((d) => idsCaras.has(d.id));
    const totalAberto = arred(abertas.filter((d) => d.id !== '~compra').reduce((t, d) => t + d.saldo, 0));
    const premissas = [`se você pagar ${brl0(pagamento)} por mês nas dívidas${sugerido ? ' (valor sugerido: ajuste em Quitar dívidas)' : ''}`, 'sem fazer novas dívidas', estrategia === 'bola-de-neve' ? 'pagando primeiro a menor (bola de neve)' : 'pagando primeiro a de maior juro'];
    const pendencia = sim.insuficiente || !sim.quita ? `Com ${brl0(pagamento)} por mês os juros ganham. Precisa de pelo menos ${brl0(sim.minimoNecessario)}.` : undefined;
    const prog = original > 0 ? Math.min(100, Math.max(0, ((original - totalAberto) / original) * 100)) : 100;

    if (idsCaras.size === 0) add({ id: 'dividas-caras', titulo: 'Livre das dívidas caras', dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: 0, progresso: 100, premissas: [], ferramentaRota: '/plano/dividas' }, 'fora');
    else if (carasAbertas.length === 0) add({ id: 'dividas-caras', titulo: 'Livre das dívidas caras', dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: 0, progresso: 100, premissas: [], ferramentaRota: '/plano/dividas' }, 'feito');
    else {
      const n = sim.quita ? Math.max(...carasAbertas.map((d) => sim.quitaEm[d.id] ?? 0)) : 0;
      fimCaras = sim.quita && n > 0 ? somaMes(mes, n) : null;
      const falta = arred(carasAbertas.reduce((t, d) => t + d.saldo, 0));
      add({ id: 'dividas-caras', titulo: 'Livre das dívidas caras', dataPrevista: fimCaras, faltaValor: falta, faltaMeses: fimCaras ? n : null, porMes: pagamento, progresso: prog, premissas: [...premissas, `"cara" é a dívida com juro a partir de ${String(JURO_CARO).replace('.', ',')}% ao mês (cartão, cheque especial)`], ferramentaRota: '/plano/dividas', pendencia }, 'aberto');
    }

    if (abertas.filter((d) => d.id !== '~compra').length === 0 && !abertas.length) add({ id: 'dividas', titulo: 'Livre de todas as dívidas', dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: 0, progresso: 100, premissas: [], ferramentaRota: '/plano/dividas' }, 'feito');
    else {
      fimDividas = sim.quita && sim.dataFinal ? sim.dataFinal : null;
      add({ id: 'dividas', titulo: 'Livre de todas as dívidas', dataPrevista: fimDividas, faltaValor: totalAberto, faltaMeses: fimDividas ? sim.meses : null, porMes: pagamento, progresso: prog, premissas, ferramentaRota: '/plano/dividas', pendencia }, 'aberto');
    }
  }

  /* 4. Reserva de emergência completa (o "pague-se primeiro" pausa enquanto houver conta atrasada) */
  const meta = reservaMeta(e, mes);
  const guardadoBase = Math.max(0, patrimonioGuardado(e));
  const livreDeDivida = e.dividas.length === 0 || todas.length === 0;
  const porMesReserva = Math.max(0, planoMensalReserva(e) + (livreDeDivida ? usaMensal() : 0));
  let fimReserva: string | null = mes;
  let guardado = guardadoBase;
  if (meta <= 0) {
    fimReserva = null;
    add({ id: 'reserva', titulo: 'Reserva de emergência completa', dataPrevista: null, faltaValor: 0, faltaMeses: null, porMes: porMesReserva, progresso: 0, premissas: [], ferramentaRota: '/plano/reserva', pendencia: 'Cadastre suas contas fixas e anote gastos: com eles eu calculo o tamanho da sua reserva.' }, 'aberto');
  } else {
    const falta0 = Math.max(0, arred(meta - guardadoBase));
    const usa = bolso > 0 ? Math.min(bolso, falta0) : bolso; // negativo: a compra sai da reserva que seria formada
    guardado = arred(guardadoBase + usa);
    bolso = bolso > 0 ? arred(bolso - usa) : 0;
    const falta = Math.max(0, arred(meta - guardado));
    if (falta <= 0.005) add({ id: 'reserva', titulo: 'Reserva de emergência completa', dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: porMesReserva, progresso: 100, premissas: [], ferramentaRota: '/plano/reserva' }, 'feito');
    else {
      const n = mesesParaMeta(falta, porMesReserva);
      fimReserva = n === null || fimEmDia === null ? null : somaMes(fimEmDia, n);
      const meses = e.config.reservaMeses ?? 6;
      add({ id: 'reserva', titulo: 'Reserva de emergência completa', dataPrevista: fimReserva, faltaValor: falta, faltaMeses: fimReserva ? mesesEntre(mes, fimReserva) : null, porMes: porMesReserva, progresso: Math.min(100, (guardado / meta) * 100), premissas: [`se você guardar ${brl0(porMesReserva)} por mês`, `meta de ${meses} meses do seu gasto (${brl0(meta)})`, ...(atrasos.length ? ['começa a contar depois de pôr as contas em dia'] : []), 'sem precisar sacar da reserva'], ferramentaRota: '/plano/reserva', pendencia: fimReserva ? undefined : porMesReserva <= 0 ? 'Informe sua renda ou quanto quer guardar por mês.' : 'Depende de pôr as contas em dia primeiro.' }, 'aberto');
    }
  }

  /* 5. O objetivo da pessoa */
  const alvoMeta = metaPrincipal(e);
  const tituloObj = alvoMeta ? alvoMeta.nome : e.config.objetivo ? e.config.objetivo : 'Seu objetivo';
  let fimObjetivo: string | null = fimReserva;
  if (!alvoMeta) {
    const batidas = e.metas.length > 0;
    if (batidas) add({ id: 'objetivo', titulo: tituloObj, dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: 0, progresso: 100, premissas: [], ferramentaRota: '/guardar#metas' }, 'feito');
    else add({ id: 'objetivo', titulo: tituloObj, dataPrevista: null, faltaValor: 0, faltaMeses: null, porMes: 0, progresso: 0, premissas: [], ferramentaRota: '/guardar#metas', pendencia: 'Crie uma meta com valor e eu digo quando você chega lá.' }, 'aberto');
  } else {
    const ja = arred(alvoMeta.guardados.reduce((t, g) => t + g.valor, 0) + Math.max(0, bolso));
    bolso = Math.min(0, bolso);
    const falta = Math.max(0, arred(alvoMeta.alvo - ja));
    const prog = Math.min(100, (ja / alvoMeta.alvo) * 100);
    const comPrazo = alvoMeta.prazo && alvoMeta.prazo > hoje ? planoDaMeta({ alvo: alvoMeta.alvo, jaGuardado: ja, prazo: alvoMeta.prazo, hoje }) : null;
    if (comPrazo) {
      fimObjetivo = mesDe(alvoMeta.prazo!);
      add({ id: 'objetivo', titulo: tituloObj, dataPrevista: fimObjetivo, faltaValor: falta, faltaMeses: mesesEntre(mes, fimObjetivo), porMes: comPrazo.porMes, progresso: prog, premissas: [`se você guardar ${brl0(comPrazo.porMes)} por mês para esta meta`, 'no prazo que você escolheu'], ferramentaRota: '/guardar#metas' }, 'aberto');
    } else {
      const porMes = Math.max(0, planoMensalReserva(e) + usaMensal());
      const n = mesesParaMeta(falta, porMes);
      fimObjetivo = n === null || fimReserva === null ? null : somaMes(maisTarde(fimReserva, mes), n);
      add({ id: 'objetivo', titulo: tituloObj, dataPrevista: fimObjetivo, faltaValor: falta, faltaMeses: fimObjetivo ? mesesEntre(mes, fimObjetivo) : null, porMes, progresso: prog, premissas: [`guardando ${brl0(porMes)} por mês`, 'depois que a reserva estiver completa', ...(alvoMeta.prazo && alvoMeta.prazo <= hoje ? ['o prazo que você tinha escolhido passou: sem drama, recalculei'] : [])], ferramentaRota: '/guardar#metas', pendencia: fimObjetivo ? undefined : 'Depende de completar a reserva primeiro.' }, 'aberto');
    }
  }

  /* 6. Dinheiro trabalhando: o primeiro investimento, logo depois da reserva */
  const investiu = e.aportes.some((a) => a.origem === 'investimento' && a.valor > 0);
  add({ id: 'investir', titulo: 'Dinheiro trabalhando', dataPrevista: investiu ? null : fimReserva, faltaValor: 0, faltaMeses: investiu ? 0 : fimReserva ? mesesEntre(mes, fimReserva) : null, porMes: e.investir.aporteMensalPlanejado ?? porMesReserva, progresso: investiu ? 100 : 0, premissas: ['o primeiro investimento vem logo depois da reserva completa', 'sem promessa de retorno: quanto rende depende de onde você aplicar'], ferramentaRota: '/investir', pendencia: investiu || fimReserva ? undefined : 'Depende de completar a reserva primeiro.' }, investiu ? 'feito' : 'aberto');

  /* 7. Viver de renda (horizonte longo) */
  const gasto = gastoMensalMedio(e, mes);
  const alvoRenda = e.config.rendaAlvo ?? gasto;
  const patrimonioAlvo = patrimonioParaRenda(alvoRenda, TAXA_RENDA_PADRAO);
  const aporte = Math.max(0, (e.investir.aporteMensalPlanejado ?? planoMensalReserva(e)) + usaMensal());
  const tudo = arred(Math.max(0, e.aportes.reduce((t, a) => t + a.valor, 0)) + bolso);
  if (!(patrimonioAlvo > 0)) add({ id: 'renda', titulo: 'Viver de renda', dataPrevista: null, faltaValor: 0, faltaMeses: null, porMes: aporte, progresso: 0, premissas: [], ferramentaRota: '/plano/renda', pendencia: 'Com suas contas e gastos anotados eu calculo quanto você precisa juntar.' }, 'aberto');
  else if (tudo >= patrimonioAlvo) add({ id: 'renda', titulo: 'Viver de renda', dataPrevista: null, faltaValor: 0, faltaMeses: 0, porMes: aporte, progresso: 100, premissas: [], ferramentaRota: '/plano/renda' }, 'feito');
  else {
    const n = mesesAteMeta(Math.max(0, tudo), patrimonioAlvo, aporte, TAXA_RENDA_PADRAO);
    const data = n === null || aporte <= 0 ? null : somaMes(mes, n);
    add({ id: 'renda', titulo: 'Viver de renda', dataPrevista: data, faltaValor: arred(patrimonioAlvo - tudo), faltaMeses: data ? n : null, porMes: aporte, progresso: Math.min(100, (Math.max(0, tudo) / patrimonioAlvo) * 100), premissas: [`guardando ${brl0(aporte)} por mês, todo mês`, `rendendo ${String(TAXA_RENDA_PADRAO).replace('.', ',')}% ao mês (é uma hipótese, não uma promessa)`, `para render ${brl0(alvoRenda)} por mês, em reais de hoje`], ferramentaRota: '/plano/renda', pendencia: data ? undefined : aporte <= 0 ? 'Informe quanto dá para guardar por mês.' : 'No ritmo de hoje passa de 50 anos. Aumentar o valor mensal muda tudo.' }, 'aberto');
  }

  // status e numeração: o primeiro em aberto é o atual; o que não se aplica some da numeração
  let achouAtual = false;
  let n = 0;
  return brutos.map((m, i) => {
    const est = estados[i];
    const status: StatusMarco = est === 'fora' ? 'nao-se-aplica' : est === 'feito' ? 'feito' : achouAtual ? 'futuro' : 'atual';
    if (status === 'atual') achouAtual = true;
    if (status !== 'nao-se-aplica') n++;
    return { ...m, n: status === 'nao-se-aplica' ? 0 : n, status };
  });
}

/** Os marcos que aparecem (o que não se aplica some). */
export const marcosVisiveis = (ms: Marco[]) => ms.filter((m) => m.status !== 'nao-se-aplica');
/** O destino: o marco em que a pessoa está agora. */
export const destino = (ms: Marco[]): Marco | null => ms.find((m) => m.status === 'atual') ?? null;

/** "Livre de todas as dívidas em agosto de 2027" (ou, sem data, o que falta informar). O marco de renda mostra só o ano. */
export function fraseDoMarco(m: Marco): { antes: string; data: string | null } {
  if (m.status === 'feito') return { antes: `${m.titulo}: feito`, data: null };
  if (!m.dataPrevista) return { antes: m.titulo, data: null };
  return { antes: `${m.titulo} em`, data: m.id === 'renda' ? m.dataPrevista.slice(0, 4) : nomeMes(m.dataPrevista) };
}

/* ---------- "e se": o que uma decisão muda na data do destino ---------- */
export type Mudanca =
  | { tipo: 'compra'; valor: number; parcelas?: number } // à vista (ou parcelada: vira 'parcela')
  | { tipo: 'parcela'; valor: number; meses: number } // compromisso novo por N meses (parcelado, empréstimo)
  | { tipo: 'corte'; porMes: number } // gastar menos todo mês
  | { tipo: 'extra'; valor: number }; // dinheiro que entrou de uma vez (13º, bônus)

export interface Impacto {
  marcoId: MarcoId;
  titulo: string;
  dataAntes: string;
  dataDepois: string | null; // null: com a mudança, deixa de ter data
  meses: number; // positivo = atrasa; negativo = adianta
  frase: string;
}

function ajusteDe(mud: Mudanca, alvo: Marco | null): Ajuste {
  if (mud.tipo === 'extra') return { deUmaVez: Math.max(0, mud.valor) };
  if (mud.tipo === 'corte') return { porMes: Math.max(0, mud.porMes) };
  const p = mud.tipo === 'compra' ? (mud.parcelas && mud.parcelas > 1 ? { valor: mud.valor / mud.parcelas, meses: mud.parcelas } : null) : { valor: mud.valor, meses: mud.meses };
  if (!p) return { deUmaVez: -Math.max(0, (mud as { valor: number }).valor) };
  // parcela que dura mais que o caminho até o marco pesa todo mês; a que acaba antes pesa pelo total;
  // se o marco é para este mês, só a primeira parcela entra na conta dele
  const falta = alvo?.faltaMeses ?? 0;
  if (falta <= 0) return { deUmaVez: -Math.max(0, p.valor) };
  return p.meses >= falta ? { porMes: -Math.max(0, p.valor) } : { deUmaVez: -Math.max(0, arred(p.valor * p.meses)) };
}

export function simularImpacto(e: Estado, hoje: string, mud: Mudanca): Impacto | null {
  const antes = calcularCaminho(e, hoje);
  const iAtual = antes.findIndex((m) => m.status === 'atual');
  if (iAtual < 0) return null;
  // o destino é o marco atual; se a decisão não mexe na data dele (ex.: uma conta pequena que fecha neste mês),
  // mostra o próximo marco em que ela pesa. "Dinheiro trabalhando" acompanha a reserva, então não entra na comparação.
  const candidatos = antes.slice(iAtual).filter((m) => m.status !== 'nao-se-aplica' && m.dataPrevista && m.id !== 'investir');
  let primeiro: Impacto | null = null;
  for (const alvo of candidatos) {
    const depois = calcularCaminho(e, hoje, ajusteDe(mud, alvo)).find((m) => m.id === alvo.id);
    const dataDepois = depois?.status === 'feito' ? mesDe(hoje) : depois?.dataPrevista ?? null;
    const meses = dataDepois ? mesesEntre(alvo.dataPrevista!, dataDepois) : 0;
    const nome = alvo.titulo.charAt(0).toLowerCase() + alvo.titulo.slice(1);
    const qtd = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;
    const quando = (m: string) => (alvo.id === 'renda' ? m.slice(0, 4) : nomeMes(m));
    const frase = !dataDepois
      ? `Com isso, "${nome}" fica sem data: o que sobra por mês deixa de cobrir o plano.`
      : meses === 0
        ? `Não muda a data: "${nome}" continua em ${quando(alvo.dataPrevista!)}.`
        : meses > 0
          ? `"${alvo.titulo}" atrasa ${qtd(meses)}: de ${quando(alvo.dataPrevista!)} para ${quando(dataDepois)}.`
          : `Você chega ${qtd(-meses)} antes: "${nome}" passa de ${quando(alvo.dataPrevista!)} para ${quando(dataDepois)}.`;
    const imp: Impacto = { marcoId: alvo.id, titulo: alvo.titulo, dataAntes: alvo.dataPrevista!, dataDepois, meses, frase };
    if (meses !== 0 || !dataDepois) return imp;
    primeiro ??= imp;
  }
  return primeiro;
}

/** Marcos que ficaram prontos e ainda não foram comemorados (a festa acontece uma vez). Quem nunca teve o problema não ganha festa por ele. */
export function marcosAComemorar(e: Estado, ms: Marco[]): Marco[] {
  const ja = new Set(e.caminho?.marcosFeitos ?? []);
  // pôs em dia uma conta que tinha atrasado: pagou depois do vencimento
  const pagouAtrasada = e.gastosFixos.some((g) => Object.entries(g.pagamentos).some(([m, p]) => p.pagoEm > vencimentoNoMes(m, g.diaVencimento)));
  const teveAtraso = pagouAtrasada || Object.keys(e.atrasos?.saidas ?? {}).length > 0 || (e.atrasos?.manuais?.length ?? 0) > 0;
  return ms.filter((m) => m.status === 'feito' && !ja.has(m.id) && (m.id !== 'em-dia' || teveAtraso));
}
