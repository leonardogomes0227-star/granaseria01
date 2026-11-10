// Posso comprar isso?: o que você já evitou, o contexto da compra e as conquistas. Pura, com teste.

import { arred, brl0 } from './datas.js';
import { maiorJuroMensal } from './dividas.js';
import { capacidadeDePagamento } from './painelDividas.js';
import { gastoMensalMedio, patrimonioGuardado, reservaMeta } from './selectores.js';
import type { Desejo, Estado } from './tipos.js';

export interface ResumoDesejos {
  economizado: number;
  desistiu: number;
  comprou: number;
  esperando: number;
  pctDesistiu: number; // dos desejos já decididos
}
export function resumoDesejos(ds: Desejo[]): ResumoDesejos {
  const des = ds.filter((d) => d.status === 'desistiu');
  const com = ds.filter((d) => d.status === 'comprou');
  const decididos = des.length + com.length;
  return {
    economizado: arred(des.reduce((t, d) => t + d.valor, 0)),
    desistiu: des.length,
    comprou: com.length,
    esperando: ds.filter((d) => d.status === 'esperando').length,
    pctDesistiu: decididos > 0 ? (des.length / decididos) * 100 : 0,
  };
}

export function conquistasCompra(r: ResumoDesejos): string[] {
  const c: string[] = [];
  if (r.desistiu >= 1) c.push('Primeira compra evitada');
  if (r.desistiu >= 5) c.push('5 compras evitadas');
  if (r.economizado >= 500) c.push('R$ 500 economizados');
  if (r.economizado >= 2000) c.push('R$ 2.000 economizados');
  return c;
}

export interface ContextoCompra {
  mesesParaJuntar: number | null; // quando não cabe no livre do mês
  dividaCara: boolean;
  reservaIncompleta: boolean;
}
export function contextoCompra(e: Estado, valor: number, mes: string, livre: number): ContextoCompra {
  const cap = capacidadeDePagamento(e.config.renda, gastoMensalMedio(e, mes));
  const meta = reservaMeta(e, mes);
  return {
    mesesParaJuntar: valor > Math.max(0, livre) && cap > 0 ? Math.ceil(valor / cap) : null,
    dividaCara: maiorJuroMensal(e.dividas) >= 3,
    reservaIncompleta: meta > 0 && patrimonioGuardado(e) < meta,
  };
}

/* ---------- o que mais dá pra fazer com esse dinheiro, com os números da pessoa ---------- */
export interface Equivalencia {
  id: 'mercado' | 'reserva' | 'divida' | 'investido';
  texto: string;
}
export function equivalencias(e: Estado, valor: number, mes: string): Equivalencia[] {
  if (!(valor > 0)) return [];
  const out: Equivalencia[] = [];
  const ant = [1, 2, 3].map((n) => {
    const [y, m] = mes.split('-').map(Number);
    const t = y * 12 + (m - 1) - n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  });
  const mercadoMeses = ant.map((m) => e.lancamentos.filter((l) => l.data.slice(0, 7) === m && l.categoria === 'Mercado').reduce((t, l) => t + l.valor, 0)).filter((v) => v > 0);
  if (mercadoMeses.length) {
    const porDia = mercadoMeses.reduce((t, v) => t + v, 0) / mercadoMeses.length / 30;
    const dias = Math.round(valor / porDia);
    if (dias >= 1) out.push({ id: 'mercado', texto: `${dias} ${dias === 1 ? 'dia' : 'dias'} de mercado da sua casa` });
  }
  const gasto = gastoMensalMedio(e, mes);
  if (gasto > 0) {
    const dias = Math.round((valor / gasto) * 30);
    if (dias >= 1) out.push({ id: 'reserva', texto: `${dias} ${dias === 1 ? 'dia' : 'dias'} de segurança na reserva, se a renda parar` });
  }
  const juro = maiorJuroMensal(e.dividas);
  if (juro > 0) out.push({ id: 'divida', texto: `${brl0((valor * juro) / 100)} a menos de juros por mês, se for pra dívida` });
  out.push({ id: 'investido', texto: `${brl0(valor * 1.008 ** 60)} se ficar investido por 5 anos (0,8% ao mês)` });
  return out;
}

/* ---------- 3 perguntas de cabeça fria ---------- */
export const PERGUNTAS_COMPRA = [
  { id: 'precisa', texto: 'Você precisa disso, ou só quer?', sim: 'Preciso', nao: 'Só quero' },
  { id: 'usa', texto: 'Ainda vai usar daqui a 3 meses?', sim: 'Vou', nao: 'Talvez não' },
  { id: 'avista', texto: 'Dá pra pagar à vista, sem parcelar?', sim: 'Dá', nao: 'Não dá' },
] as const;
export type Respostas = Partial<Record<(typeof PERGUNTAS_COMPRA)[number]['id'], boolean>>;

/** Junta o veredito do bolso com as respostas: o conselho final, numa frase. */
export function conselho(veredito: 'cabe' | 'aperta' | 'nao-cabe', r: Respostas): { tom: 'ok' | 'aviso' | 'perigo'; texto: string } | null {
  const respondidas = Object.keys(r).length;
  if (respondidas < PERGUNTAS_COMPRA.length) return null;
  const nao = PERGUNTAS_COMPRA.filter((p) => r[p.id] === false).length;
  if (veredito === 'nao-cabe') return { tom: 'perigo', texto: r.precisa ? 'Você precisa, mas não cabe agora. Junte primeiro, ou procure uma opção mais barata.' : 'Não cabe e você não precisa. Melhor deixar passar: a vontade costuma ir embora em poucos dias.' };
  if (nao === 0) return { tom: 'ok', texto: veredito === 'cabe' ? 'Cabe, você precisa, vai usar e paga à vista. Pode comprar sem culpa.' : 'Você precisa e paga à vista, mas aperta o mês. Se der, espere o próximo salário.' };
  if (nao >= 2) return { tom: 'aviso', texto: 'Muito "não" nas respostas. Espere 72 horas: se ainda quiser depois, compre de cabeça fria.' };
  if (r.avista === false) return { tom: 'aviso', texto: 'Parcelar compra que não é necessária come o salário dos próximos meses. Junte e compre à vista.' };
  return { tom: 'aviso', texto: 'Quase lá. Espere 72 horas pra ter certeza: se a vontade continuar, compre.' };
}
