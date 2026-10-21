// "Posso comprar isso?" (spec v2, 7.2) com o Nomasir: o preço e se é à vista ou parcelado viram "Cabe: sobram R$ X
// por dia depois." ou "Não cabe este mês. Se guardar R$ Y por semana, dá em {data}.". Usa o mesmo número do card da
// Início (quantoPossoGastarHoje, src/lib/financas.ts), montado do mesmo jeito. Puro: testado em possoComprar.test.ts.

import { diasRestantes, porDia, type Hoje, type quantoPossoGastarHoje } from '../../lib/financas';
import { monthOf, monthStatus, paidThisMonth, savedThisMonth, type Bill, type SavedEntry } from '../../bills';
import { ativas, type Missao } from '../../missoes';
import { addDays, daysBetween } from '../../coach';
import { dayAbbr, monthAbbr, monthShort } from '../../coachChat/months';
import { formatBRL } from '../../calculations';
import { GUARDADO } from '../../lib/categorias';
import { brlCentavos } from './mes';

export type EntradaConta = Parameters<typeof quantoPossoGastarHoje>[0];

const soma = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);

/**
 * A entrada da conta do mês, igual à do card da Início (HomePage, useContaDoMes): com renda declarada, reserva as
 * contas do mês e o que vai pras missões; o que foi anotado como "Guardado" não conta como gasto.
 */
export function montarConta(d: {
  hoje: string;
  renda: number; // a renda declarada (gs-eu)
  entradas: number; // o que entrou anotado no mês
  saidas: { amount: number; category: string }[]; // os gastos anotados no mês
  bills: Bill[];
  saved: SavedEntry[];
  missoes: Missao[];
}): EntradaConta {
  const mes = monthOf(d.hoje);
  const andando = ativas(d.missoes);
  return {
    hoje: d.hoje,
    rendaDeclarada: d.renda,
    entradasAnotadas: d.entradas,
    gastosAnotados: soma(d.saidas.filter((e) => e.category !== GUARDADO)),
    guardadoAnotado: soma(d.saidas.filter((e) => e.category === GUARDADO)),
    contasDoMes: monthStatus(d.bills, mes, d.hoje).reduce((t, s) => t + Math.max(s.bill.amount, s.paid), 0),
    contasPagas: paidThisMonth(d.bills, mes),
    guardadoNoApp: savedThisMonth(d.saved, mes),
    aportesPlanejados: andando.filter((m) => m.tipo === 'reserva' || m.tipo === 'investir').reduce((t, m) => t + m.valorMensal, 0),
    parcelasPlanejadas: andando.filter((m) => m.tipo === 'divida').reduce((t, m) => t + m.valorMensal, 0),
  };
}

export interface Compra {
  preco: number;
  parcelas: number; // 1 = à vista
}

export type Veredito =
  | { tipo: 'sem-dados' }
  | { tipo: 'cabe'; custoAgora: number; parcela: number | null; porDiaDepois: number; sobraDepois: number }
  | { tipo: 'nao-cabe'; custoAgora: number; parcela: number | null; porSemana: number; semanas: number; quando: string };

const SEMANAS_NO_MES = 52 / 12;
const PRAZO_SEMANAS = 8; // a sugestão mira uns dois meses
const PARTE_DO_MES = 0.25; // e nunca mais que 1/4 do dinheiro de gastar do mês por semana
const acima = (n: number, passo: number) => Math.ceil(n / passo) * passo;

/**
 * Cabe? À vista, pesa o preço todo neste mês; parcelado, só a parcela deste mês. Não cabendo, a sugestão é juntar
 * antes e comprar à vista: um valor por semana (múltiplo de R$ 10) e a data em que chega lá.
 * gastosDoMes: o que já foi gasto no mês (com o que sobra, dá o dinheiro de gastar do mês inteiro).
 */
export function possoComprar(conta: Hoje, compra: Compra, p: { hoje: string; gastosDoMes: number; semDados?: boolean }): Veredito {
  if (p.semDados) return { tipo: 'sem-dados' };
  const preco = Math.max(0, Math.round(compra.preco * 100) / 100);
  const n = Math.max(1, Math.round(compra.parcelas));
  const parcela = n > 1 ? Math.round((preco / n) * 100) / 100 : null;
  const custoAgora = parcela ?? preco;
  if (custoAgora <= conta.disponivel) {
    const sobraDepois = Math.round((conta.disponivel - custoAgora) * 100) / 100;
    return { tipo: 'cabe', custoAgora, parcela, sobraDepois, porDiaDepois: porDia(sobraDepois, diasRestantes(p.hoje)) };
  }
  const doMes = Math.max(0, conta.disponivel) + Math.max(0, p.gastosDoMes);
  const teto = doMes > 0 ? (doMes * PARTE_DO_MES) / SEMANAS_NO_MES : Infinity;
  let porSemana = Math.max(10, acima(Math.min(preco / PRAZO_SEMANAS, teto), 10));
  if (porSemana > preco) porSemana = Math.max(1, Math.ceil(preco));
  const semanas = Math.max(1, Math.ceil(preco / porSemana));
  return { tipo: 'nao-cabe', custoAgora, parcela, porSemana, semanas, quando: addDays(p.hoje, semanas * 7) };
}

/** "22 dez" até uns 10 meses; mais longe, "jul/28"; a mais de 10 anos, "jul/2040" (o ano curto confundiria). */
export function dataCurta(dia: string, hoje: string): string {
  const dias = daysBetween(hoje, dia);
  if (dias <= 300) return dayAbbr(dia);
  return dias <= 3650 ? monthAbbr(monthOf(dia)) : monthShort(monthOf(dia));
}

/** As falas do Nomasir com a resposta (1 a 3 balões). */
export function falasDaResposta(v: Veredito, hoje: string): string[] {
  if (v.tipo === 'sem-dados') return ['Pra eu responder, preciso saber o que entrou este mês.', 'Anote o seu salário (ou o que entrou) e me pergunte de novo.'];
  if (v.tipo === 'cabe') {
    const falas = [`Cabe: sobram ${formatBRL(v.porDiaDepois)} por dia depois.`];
    if (v.parcela !== null) falas.push(`São parcelas de ${brlCentavos(v.parcela)}. As próximas entram nos meses que vêm.`);
    if (v.porDiaDepois < 20) falas.push('Fica apertado até o fim do mês. Se puder esperar, melhor.');
    return falas;
  }
  const falas = [`Não cabe este mês. Se guardar ${formatBRL(v.porSemana)} por semana, dá em ${dataCurta(v.quando, hoje)}.`];
  if (v.parcela !== null) falas.push('Juntando antes, você paga à vista e foge dos juros.');
  if (v.semanas > 156) falas.push('É bastante tempo. Vale procurar uma opção mais em conta.');
  return falas;
}
