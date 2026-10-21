// Contas centrais do Grana Séria (spec v2, seção 4). Funções puras: sem DOM, sem localStorage, "hoje" sempre por
// parâmetro. Os imports usam .js porque o servidor (WhatsApp, api/) também usa este arquivo.
//
// Regra de ouro: estas funções não mudam nenhum número que a pessoa já vê. As telas antigas continuam com as contas
// delas; quem usa daqui são as telas e os chats novos (e as antigas, aos poucos, só quando o número for o mesmo).

import { addMonths, monthOf } from '../coachChat/months.js';

/* ---------- básicos ---------- */

/** "De cada dez moedas que entram, uma fica com você." */
export const PARTE_GUARDAR = 0.1;
/** Dabasir: do que sobra depois das contas fixas, 7 partes pra viver, 2 pra dívidas e 1 pra guardar. */
export const DABASIR = { viver: 0.7, dividas: 0.2, guardar: 0.1 } as const;
/** Quantos meses de gastos essenciais a reserva cobre. */
export const MESES_RESERVA = 6;

const reais = (n: number) => (Number.isFinite(n) ? n : 0);
const arred2 = (n: number) => Math.round(n * 100) / 100;

/** Soma dos gastos fixos (contas que se repetem todo mês). */
export function custoEssencial(contas: { valor: number }[]): number {
  return arred2(contas.reduce((t, c) => t + Math.max(0, reais(c.valor)), 0));
}

/** Meta da reserva: 6x o custo essencial, arredondada pra cima na centena (melhor sobrar do que faltar). */
export function metaReserva(custo: number): number {
  const bruto = MESES_RESERVA * Math.max(0, reais(custo));
  return bruto <= 0 ? 0 : Math.ceil(bruto / 100) * 100;
}

/** Quanto sobraria no mês pela conta: renda - fixos - parcelas das dívidas (pode dar negativo). */
export function sobraTeorica(renda: number, custo: number, parcelas: number): number {
  return arred2(reais(renda) - reais(custo) - reais(parcelas));
}

/**
 * Quanto guardar por mês, pelo livro: 10% da renda. Com dívida, 10% do que sobra depois dos fixos (a parte do
 * Dabasir), pra a pessoa não guardar o que precisa pra pagar quem deve. Nunca negativo.
 */
export function aporteSugerido(renda: number, opts: { temDivida?: boolean; sobraDepoisDosFixos?: number } = {}): number {
  if (opts.temDivida && opts.sobraDepoisDosFixos !== undefined) return Math.max(0, Math.round(opts.sobraDepoisDosFixos * DABASIR.guardar));
  return Math.max(0, Math.round(reais(renda) * PARTE_GUARDAR));
}

/** O método do Dabasir aplicado ao que sobra depois das contas fixas. */
export function divisaoDabasir(renda: number, custo: number): { sobra: number; viver: number; dividas: number; guardar: number } {
  const sobra = Math.max(0, reais(renda) - reais(custo));
  return {
    sobra: arred2(sobra),
    viver: Math.round(sobra * DABASIR.viver),
    dividas: Math.round(sobra * DABASIR.dividas),
    guardar: Math.round(sobra * DABASIR.guardar),
  };
}

/* ---------- dívidas ---------- */

export interface DividaCalc {
  id: string;
  nome: string;
  saldo: number;
  parcela: number; // mínimo por mês
  jurosMes?: number | null; // % ao mês; null/undefined = a pessoa não sabe
}

export type MetodoDivida = 'juros' | 'menor';

/**
 * Em que ordem pagar. 'juros': maior juros primeiro (economiza mais); quem não tem juros informado vai pro fim, do
 * menor saldo pro maior. 'menor': menor saldo primeiro (dá ânimo ver uma acabar logo).
 */
export function ordemDividas(dividas: DividaCalc[], metodo: MetodoDivida): DividaCalc[] {
  const abertas = dividas.filter((d) => d.saldo > 0);
  if (metodo === 'menor') return [...abertas].sort((a, b) => a.saldo - b.saldo || a.nome.localeCompare(b.nome));
  const comJuros = abertas.filter((d) => typeof d.jurosMes === 'number' && d.jurosMes > 0).sort((a, b) => (b.jurosMes ?? 0) - (a.jurosMes ?? 0) || a.saldo - b.saldo);
  const semJuros = abertas.filter((d) => !(typeof d.jurosMes === 'number' && d.jurosMes > 0)).sort((a, b) => a.saldo - b.saldo);
  return [...comJuros, ...semJuros];
}

/** O método padrão quando a pessoa não escolheu: juros se ao menos uma dívida tem juros informado, senão menor saldo. */
export const metodoPadrao = (dividas: DividaCalc[]): MetodoDivida => (dividas.some((d) => typeof d.jurosMes === 'number' && d.jurosMes > 0) ? 'juros' : 'menor');

export interface Quitacao {
  meses: number | null; // meses até quitar tudo (null: com esse valor não acaba)
  porDivida: { id: string; mes: number | null }[]; // em que mês (1, 2, …) cada uma acaba
  totalJuros: number;
  travou: boolean; // o valor não cobre nem os juros
}

/**
 * Previsão de quitação, mês a mês. Todo mês: entram os juros, paga-se o mínimo de cada uma e o que sobrar do valor
 * mensal vai pra primeira da fila. Quando uma acaba, a parcela dela rola pra próxima (o valor mensal não diminui).
 * Se o valor mensal for menor que a soma das parcelas, usa a soma das parcelas (o mínimo tem que ser pago).
 */
export function simularQuitacao(dividas: DividaCalc[], valorMensal: number, metodo: MetodoDivida, maxMeses = 600): Quitacao {
  const fila = ordemDividas(dividas, metodo).map((d) => ({ ...d, saldo: d.saldo }));
  const porDivida = new Map<string, number | null>(fila.map((d) => [d.id, null]));
  if (fila.length === 0) return { meses: 0, porDivida: [], totalJuros: 0, travou: false };
  const minimo = fila.reduce((t, d) => t + Math.max(0, d.parcela), 0);
  const orcamento = Math.max(reais(valorMensal), minimo);
  let totalJuros = 0;
  let saldoHaUmAno = fila.reduce((t, d) => t + d.saldo, 0);
  for (let mes = 1; mes <= maxMeses; mes++) {
    let jurosDoMes = 0;
    for (const d of fila) {
      if (d.saldo <= 0) continue;
      const j = d.saldo * Math.max(0, d.jurosMes ?? 0) / 100;
      d.saldo += j;
      jurosDoMes += j;
    }
    totalJuros += jurosDoMes;
    let resta = orcamento;
    // mínimos primeiro
    for (const d of fila) {
      if (d.saldo <= 0) continue;
      const paga = Math.min(d.saldo, Math.max(0, d.parcela), resta);
      d.saldo -= paga;
      resta -= paga;
    }
    // o resto vai pra primeira da fila que ainda deve (e rola pra próxima se acabar)
    for (const d of fila) {
      if (resta <= 0) break;
      if (d.saldo <= 0) continue;
      const paga = Math.min(d.saldo, resta);
      d.saldo -= paga;
      resta -= paga;
    }
    for (const d of fila) {
      if (d.saldo < 0.5) d.saldo = 0;
      if (d.saldo === 0 && porDivida.get(d.id) === null) porDivida.set(d.id, mes);
    }
    if (fila.every((d) => d.saldo === 0)) {
      return { meses: mes, porDivida: fila.map((d) => ({ id: d.id, mes: porDivida.get(d.id) ?? null })), totalJuros: arred2(totalJuros), travou: false };
    }
    // não cobre nem os juros (a dívida só cresce), ou em um ano o total quase não caiu: precisa renegociar
    const saldo = fila.reduce((t, d) => t + d.saldo, 0);
    if (mes === 1 && orcamento <= jurosDoMes) {
      return { meses: null, porDivida: fila.map((d) => ({ id: d.id, mes: null })), totalJuros: arred2(totalJuros), travou: true };
    }
    if (mes % 12 === 0) {
      if (saldo >= saldoHaUmAno * 0.97) return { meses: null, porDivida: fila.map((d) => ({ id: d.id, mes: porDivida.get(d.id) ?? null })), totalJuros: arred2(totalJuros), travou: true };
      saldoHaUmAno = saldo;
    }
  }
  return { meses: null, porDivida: fila.map((d) => ({ id: d.id, mes: porDivida.get(d.id) ?? null })), totalJuros: arred2(totalJuros), travou: true };
}

/* ---------- quanto posso gastar hoje ---------- */

/** Dias até o fim do mês, contando hoje. hoje = 'AAAA-MM-DD' (já no fuso de Brasília). */
export function diasRestantes(hoje: string): number {
  const [y, m, d] = hoje.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.max(1, ultimo - d + 1);
}

/** Quanto dá por dia: nunca negativo (o "estourou" é mostrado à parte). */
export function porDia(disponivel: number, dias: number): number {
  return disponivel > 0 ? Math.floor(disponivel / Math.max(1, dias)) : 0;
}

/**
 * O disponível do mês pela spec (planejado): renda - contas fixas do mês - o que vai guardar - parcelas - gastos já
 * feitos. Pode dar negativo: aí a tela mostra que estourou.
 */
export function disponivelMes(p: { renda: number; contasFixasDoMes: number; aportesPlanejados: number; parcelasDoMes: number; gastosVariaveis: number }): number {
  return arred2(reais(p.renda) - reais(p.contasFixasDoMes) - reais(p.aportesPlanejados) - reais(p.parcelasDoMes) - reais(p.gastosVariaveis));
}

/**
 * O saldo real que a Início e o Meu mês mostram hoje: o que entrou (anotado) - o que saiu - as contas fixas já pagas
 * no app - o que já foi guardado. É a conta atual das telas, sem nenhuma mudança.
 */
export function saldoReal(p: { entradas: number; saidas: number; contasPagas: number; guardado: number }): number {
  return reais(p.entradas) - reais(p.saidas) - reais(p.contasPagas) - reais(p.guardado);
}

export interface Estouro {
  estourou: boolean;
  passou: number; // quanto passou do limite (0 se não passou)
}
export const estouro = (disponivel: number): Estouro => ({ estourou: disponivel < 0, passou: disponivel < 0 ? arred2(-disponivel) : 0 });

/* ---------- metas e previsões ---------- */

/** Meses até chegar na meta guardando valorMensal. null se não chega (valor zero). 0 se já chegou. */
export function mesesRestantes(meta: number, atual: number, valorMensal: number): number | null {
  const falta = reais(meta) - reais(atual);
  if (falta <= 0) return 0;
  if (!(valorMensal > 0)) return null;
  return Math.ceil(falta / valorMensal);
}

/**
 * Mês previsto ('AAAA-MM'): contando que o valor deste mês ainda vai entrar, a meta fecha no mês atual + meses - 1.
 * (1 mês restante = termina este mês.)
 */
export function previsaoMes(mesAtual: string, meses: number | null): string | null {
  if (meses === null) return null;
  return addMonths(mesAtual, Math.max(0, meses - 1));
}

/** Progresso de 0 a 100 (barra com 0% fica vazia). */
export function progresso(atual: number, meta: number): number {
  if (!(meta > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((reais(atual) / meta) * 100)));
}

/* ---------- coerência (usada nos chats) ---------- */

export interface Coerencia {
  fixosPassamDaRenda: boolean;
  /** A diferença entre o que a pessoa disse que sobra e o que sobraria pela conta, se passar de R$ 100. */
  diferenca: number | null;
}

export function coerencia(p: { renda: number; custo: number; parcelas?: number; sobraInformada?: number }): Coerencia {
  const fixosPassamDaRenda = reais(p.custo) + reais(p.parcelas ?? 0) > reais(p.renda);
  let diferenca: number | null = null;
  if (p.sobraInformada !== undefined) {
    const teorica = sobraTeorica(p.renda, p.custo, p.parcelas ?? 0);
    const d = teorica - reais(p.sobraInformada);
    if (Math.abs(d) > 100) diferenca = arred2(d);
  }
  return { fixosPassamDaRenda, diferenca };
}

/* ---------- prioridade das missões ---------- */

export type TipoMissao = 'divida' | 'contas' | 'reserva' | 'gastos' | 'investir' | 'extra';
export const PRIORIDADE: Record<TipoMissao, number> = { divida: 1, contas: 2, reserva: 3, gastos: 4, investir: 5, extra: 6 };

/** Investir só começa com a reserva completa (ou se a pessoa forçar, com aviso). */
export const podeInvestir = (reservaAtual: number, reservaMeta: number, forcar = false) => forcar || (reservaMeta > 0 && reservaAtual >= reservaMeta);

/* ---------- empréstimo (Mathon) ---------- */

/** Taxa mensal efetiva aproximada (%) de um empréstimo de valor, pago em n parcelas iguais. Busca por bisseção. */
export function taxaEmprestimo(valor: number, parcelas: number, parcela: number): number | null {
  if (!(valor > 0 && parcelas > 0 && parcela > 0)) return null;
  if (parcela * parcelas <= valor) return 0;
  const pv = (i: number) => (i === 0 ? parcela * parcelas : (parcela * (1 - Math.pow(1 + i, -parcelas))) / i);
  let lo = 0;
  let hi = 1; // 100% ao mês
  if (pv(hi) > valor) return null; // fora do razoável
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > valor) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10000) / 100;
}

/** Parcela de um empréstimo a uma taxa mensal (%), pela tabela Price. */
export function parcelaPrice(valor: number, parcelas: number, taxaMes: number): number {
  if (!(valor > 0 && parcelas > 0)) return 0;
  const i = taxaMes / 100;
  if (i === 0) return arred2(valor / parcelas);
  return arred2((valor * i) / (1 - Math.pow(1 + i, -parcelas)));
}

/* ---------- viver de renda (Sharru Nada) ---------- */

/** Rendimento mensal conservador pra conta de "viver de renda". */
export const RENDA_PASSIVA_MES = 0.005;

/** Quanto precisaria investido pra tirar custo/mês, a 0,5% ao mês (custo × 12 / 6%). */
export const patrimonioParaViverDeRenda = (custoMensal: number) => Math.round((reais(custoMensal) * 12) / (RENDA_PASSIVA_MES * 12));

/** Projeção de quanto teria depois de n meses guardando mensal, rendendo taxaMes (fração) ao mês. */
export function projecaoInvestimento(inicial: number, mensal: number, meses: number, taxaMes = RENDA_PASSIVA_MES): number {
  let v = Math.max(0, reais(inicial));
  for (let i = 0; i < meses; i++) v = v * (1 + taxaMes) + Math.max(0, reais(mensal));
  return Math.round(v);
}

/* ---------- dinheiro extra (Rodan) ---------- */

/**
 * Sugestão de destino pro dinheiro extra, pela prioridade: dívida > reserva > investir, e 10% pra pessoa aproveitar.
 * Devolve valores que somam exatamente o total.
 */
export function divisaoExtra(total: number, p: { temDivida: boolean; reservaCompleta: boolean }): { divida: number; reserva: number; investir: number; voce: number } {
  const t = Math.max(0, Math.round(reais(total)));
  const voce = Math.round(t * 0.1);
  const resto = t - voce;
  if (p.temDivida) {
    const divida = p.reservaCompleta ? resto : Math.round(resto * 0.7);
    return { divida, reserva: resto - divida, investir: 0, voce };
  }
  if (!p.reservaCompleta) return { divida: 0, reserva: resto, investir: 0, voce };
  return { divida: 0, reserva: 0, investir: resto, voce };
}

/* ---------- datas do mês ---------- */

/** O mês ('AAAA-MM') de uma data ISO completa ou 'AAAA-MM-DD'. */
export const mesDe = (iso: string) => monthOf(iso);
