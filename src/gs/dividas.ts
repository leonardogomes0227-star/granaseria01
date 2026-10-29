// Quitação de dívidas: simulação mês a mês em função pura (sem tela), com a estratégia escolhida.

import { arred, mesAtual, somaMes } from './datas.js';
import type { Divida, Estrategia } from './tipos.js';

export const LIMITE_MESES = 600;

export const saldoAtual = (d: Divida) => Math.max(0, arred(d.saldo - d.pagamentos.reduce((t, p) => t + p.valor, 0)));
export const totalDividas = (ds: Divida[]) => arred(ds.reduce((t, d) => t + saldoAtual(d), 0));
export const maiorJuroMensal = (ds: Divida[]) => ds.filter((d) => saldoAtual(d) > 0).reduce((m, d) => Math.max(m, d.jurosMensal), 0);

export interface DividaSim {
  id: string;
  nome: string;
  saldo: number;
  jurosMensal: number;
  parcelaMinima: number;
}

/** A ordem de pagamento: bola de neve = menor saldo primeiro; maior juro = maior taxa primeiro. */
export function ordenar<T extends DividaSim>(ds: T[], estrategia: Estrategia): T[] {
  const v = ds.filter((d) => d.saldo > 0);
  return [...v].sort((a, b) => (estrategia === 'bola-de-neve' ? a.saldo - b.saldo || b.jurosMensal - a.jurosMensal : b.jurosMensal - a.jurosMensal || a.saldo - b.saldo));
}

export interface MesSim {
  mes: number; // 1, 2, 3...
  pago: number;
  juros: number;
  saldoTotal: number;
  alvo: string | null; // nome da dívida que recebeu o extra
  quitadas: string[];
}
export interface Simulacao {
  meses: number; // meses até quitar (LIMITE_MESES se não quita)
  quita: boolean;
  dataFinal: string | null; // 'AAAA-MM'
  totalJuros: number;
  totalPago: number;
  ordem: string[]; // nomes, na ordem escolhida
  cronograma: MesSim[];
  insuficiente: boolean; // o valor mensal não cobre as mínimas ou os juros
  minimoNecessario: number;
  quitaEm: Record<string, number>; // id -> mês em que quita
}

export function simular(dividas: DividaSim[], pagamentoMensal: number, estrategia: Estrategia, inicio = mesAtual()): Simulacao {
  const ord = ordenar(dividas, estrategia);
  const saldos = new Map(ord.map((d) => [d.id, d.saldo]));
  const somaMin = arred(ord.reduce((t, d) => t + Math.min(d.parcelaMinima, d.saldo), 0));
  const jurosMes1 = arred(ord.reduce((t, d) => t + d.saldo * (d.jurosMensal / 100), 0));
  const minimoNecessario = Math.ceil(Math.max(somaMin, jurosMes1 > 0 ? jurosMes1 + 1 : 0));
  const insuficiente = ord.length > 0 && pagamentoMensal < minimoNecessario;
  const cronograma: MesSim[] = [];
  const quitaEm: Record<string, number> = {};
  let totalJuros = 0;
  let totalPago = 0;
  let mes = 0;
  while ([...saldos.values()].some((s) => s > 0.005) && mes < LIMITE_MESES && pagamentoMensal > 0) {
    mes++;
    let juros = 0;
    for (const d of ord) {
      const s = saldos.get(d.id)!;
      if (s <= 0.005) continue;
      const j = s * (d.jurosMensal / 100);
      juros += j;
      saldos.set(d.id, s + j);
    }
    totalJuros += juros;
    let sobra = pagamentoMensal;
    let pago = 0;
    // 1) as mínimas de todas as abertas
    for (const d of ord) {
      const s = saldos.get(d.id)!;
      if (s <= 0.005) continue;
      const p = Math.min(s, d.parcelaMinima, sobra);
      saldos.set(d.id, s - p);
      sobra -= p;
      pago += p;
    }
    // 2) o que sobra vai pra da vez; ao quitar, o valor liberado cai na próxima
    let alvo: string | null = null;
    for (const d of ord) {
      if (sobra <= 0.005) break;
      const s = saldos.get(d.id)!;
      if (s <= 0.005) continue;
      alvo ??= d.nome;
      const p = Math.min(s, sobra);
      saldos.set(d.id, s - p);
      sobra -= p;
      pago += p;
    }
    totalPago += pago;
    const quitadas: string[] = [];
    for (const d of ord) {
      if (!(d.id in quitaEm) && (saldos.get(d.id) ?? 0) <= 0.005) {
        quitaEm[d.id] = mes;
        quitadas.push(d.nome);
      }
    }
    cronograma.push({ mes, pago: arred(pago), juros: arred(juros), saldoTotal: arred([...saldos.values()].reduce((t, s) => t + Math.max(0, s), 0)), alvo, quitadas });
  }
  const quita = ord.length > 0 && [...saldos.values()].every((s) => s <= 0.005);
  return {
    meses: ord.length === 0 ? 0 : quita ? mes : LIMITE_MESES,
    quita: ord.length === 0 || quita,
    dataFinal: ord.length > 0 && quita ? somaMes(inicio, mes) : null,
    totalJuros: arred(totalJuros),
    totalPago: arred(totalPago),
    ordem: ord.map((d) => d.nome),
    cronograma,
    insuficiente,
    minimoNecessario,
    quitaEm,
  };
}

export const paraSim = (ds: Divida[]): DividaSim[] => ds.map((d) => ({ id: d.id, nome: d.nome, saldo: saldoAtual(d), jurosMensal: d.jurosMensal, parcelaMinima: d.parcelaMinima })).filter((d) => d.saldo > 0);

export interface Comparacao {
  bola: Simulacao;
  juro: Simulacao;
  melhor: Estrategia;
  economia: number; // quanto a melhor economiza em juros
}
export function compararEstrategias(ds: DividaSim[], pagamentoMensal: number, inicio?: string): Comparacao {
  const bola = simular(ds, pagamentoMensal, 'bola-de-neve', inicio);
  const juro = simular(ds, pagamentoMensal, 'maior-juro', inicio);
  const melhor: Estrategia = juro.totalJuros < bola.totalJuros - 0.005 ? 'maior-juro' : 'bola-de-neve';
  return { bola, juro, melhor, economia: arred(Math.abs(bola.totalJuros - juro.totalJuros)) };
}

/** Este mês: em qual dívida pagar e quanto (mínima + o extra, se for a da vez). */
export function passoDoMes(ds: DividaSim[], pagamentoMensal: number, estrategia: Estrategia): { divida: DividaSim; valor: number } | null {
  const ord = ordenar(ds, estrategia);
  if (ord.length === 0) return null;
  const somaMin = ord.reduce((t, d) => t + Math.min(d.parcelaMinima, d.saldo), 0);
  const extra = Math.max(0, pagamentoMensal - somaMin);
  const alvo = ord[0];
  return { divida: alvo, valor: arred(Math.min(alvo.saldo, Math.min(alvo.parcelaMinima, alvo.saldo) + extra)) };
}

export type Pedido = 'desconto' | 'parcelar' | 'juros';
export const PEDIDOS: { id: Pedido; nome: string }[] = [
  { id: 'desconto', nome: 'Desconto à vista' },
  { id: 'parcelar', nome: 'Parcelar' },
  { id: 'juros', nome: 'Reduzir juros' },
];

/** Texto pronto pro banco. Campos opcionais ficam de fora. */
export function mensagemParaOBanco(p: { nome?: string; credor?: string; protocolo?: string; saldo: number; entrada: number; parcela: number; pedido?: Pedido }): string {
  const f = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const quem = p.nome?.trim() ? `Meu nome é ${p.nome.trim()}. ` : '';
  const ref = p.protocolo?.trim() ? ` (referência ${p.protocolo.trim()})` : '';
  const onde = p.credor?.trim() ? `com ${p.credor.trim()}` : 'com vocês';
  const base = `Olá, tudo bem? ${quem}Tenho uma dívida de ${f(p.saldo)} ${onde}${ref} e quero quitar.`;
  if (p.pedido === 'desconto') return `${base} Consigo pagar ${f(p.entrada)} à vista. Qual desconto vocês conseguem me dar pra quitar tudo de uma vez? Podem me enviar a proposta por escrito? Obrigado.`;
  if (p.pedido === 'parcelar') return `${base} Consigo pagar ${f(p.parcela)} por mês. Podem me mandar uma proposta de parcelamento com o total e o juro de cada parcela, por escrito? Obrigado.`;
  if (p.pedido === 'juros') return `${base} Os juros estão muito altos pra mim. Podem reduzir a taxa e me mandar o novo valor de ${f(p.parcela)} por mês, com o cálculo? Obrigado.`;
  return `${base} Consigo pagar ${f(p.entrada)} à vista ou ${f(p.parcela)} por mês. Podem me enviar uma proposta com desconto nos juros? Obrigado.`;
}

/** Quanto as dívidas custam de juros por dia parado. */
export const custoPorDia = (ds: DividaSim[]) => arred(ds.reduce((t, d) => t + (d.saldo * d.jurosMensal) / 100 / 30, 0));

/** Quanto as dívidas cobram de juros só neste mês, se ninguém pagar nada. */
export const jurosDoMes = (ds: DividaSim[]) => arred(ds.reduce((t, d) => t + (d.saldo * d.jurosMensal) / 100, 0));

/** Trocar a dívida de juro mais alto por uma taxa nova: quanto muda no total. */
export function valeTrocar(ds: DividaSim[], pagamentoMensal: number, estrategia: Estrategia, taxaNovaPct: number): { nome: string; economia: number; meses: number } | null {
  if (ds.length === 0) return null;
  const alvo = ds.reduce((m, d) => (d.jurosMensal > m.jurosMensal ? d : m), ds[0]);
  const antes = simular(ds, pagamentoMensal, estrategia);
  const depois = simular(ds.map((d) => (d.id === alvo.id ? { ...d, jurosMensal: taxaNovaPct } : d)), pagamentoMensal, estrategia);
  if (!antes.quita || !depois.quita) return null;
  return { nome: alvo.nome, economia: arred(antes.totalJuros - depois.totalJuros), meses: antes.meses - depois.meses };
}

/** Cortar um valor por mês e jogar na dívida: quanto adianta. */
export function cortarPagando(ds: DividaSim[], pagamentoMensal: number, estrategia: Estrategia, corte: number): { meses: number; economia: number } | null {
  const antes = simular(ds, pagamentoMensal, estrategia);
  const depois = simular(ds, pagamentoMensal + corte, estrategia);
  if (!antes.quita || !depois.quita) return null;
  return { meses: antes.meses - depois.meses, economia: arred(antes.totalJuros - depois.totalJuros) };
}

export const linkWhatsApp = (texto: string, numero?: string) => `https://wa.me/${(numero ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
