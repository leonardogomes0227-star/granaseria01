// Lógica do painel de dívidas: progresso, sequência, economia, a ação da semana e quanto o orçamento aguenta. Pura, com teste.

import { arred, diasEntre, vencimentoNoMes } from './datas';
import { saldoAtual, simular, type DividaSim } from './dividas';
import { brl0 } from './datas';
import type { Divida, Estrategia } from './tipos';

export const pagoNoMes = (ds: Divida[], mes: string) => arred(ds.reduce((t, d) => t + d.pagamentos.filter((p) => p.data.slice(0, 7) === mes).reduce((s, p) => s + p.valor, 0), 0));
export const pagoNaDivida = (d: Divida, mes: string) => arred(d.pagamentos.filter((p) => p.data.slice(0, 7) === mes).reduce((s, p) => s + p.valor, 0));

const mesAnterior = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};

/** Meses seguidos pagando pelo menos o mínimo. O mês atual ainda em aberto não quebra a sequência. */
export function mesesSeguidos(ds: Divida[], mes: string, limiar: number): number {
  const bateu = (m: string) => pagoNoMes(ds, m) >= Math.max(1, limiar);
  let m = bateu(mes) ? mes : mesAnterior(mes);
  let n = 0;
  while (n < 120 && bateu(m)) {
    n++;
    m = mesAnterior(m);
  }
  return n;
}

/** Quanto de juros o plano poupa em comparação a pagar só o mínimo. Nulo quando o mínimo nem zera a dívida. */
export function economiaDoPlano(ds: DividaSim[], pagamento: number, estrategia: Estrategia): { economia: number; semPlano: boolean } | null {
  const minimo = ds.reduce((t, d) => t + Math.min(d.parcelaMinima, d.saldo), 0);
  if (minimo <= 0) return null;
  const com = simular(ds, pagamento, estrategia);
  const base = simular(ds, minimo, estrategia);
  if (!com.quita) return null;
  if (!base.quita) return { economia: 0, semPlano: true };
  return { economia: Math.max(0, arred(base.totalJuros - com.totalJuros)), semPlano: false };
}

export interface Acao {
  tipo: 'vence' | 'comeco' | 'faltam' | 'cumprida';
  texto: string;
  divida?: Divida;
  falta: number;
}

/** O que fazer agora: parcela perto de vencer, começar o mês, completar a meta ou comemorar. */
export function proximaAcao(abertas: Divida[], meta: number, hoje: string): Acao {
  const mes = hoje.slice(0, 7);
  const pago = pagoNoMes(abertas, mes);
  const falta = Math.max(0, arred(meta - pago));
  const candidatas = abertas
    .filter((d) => d.venceDia && pagoNaDivida(d, mes) < Math.min(d.parcelaMinima || 1, saldoAtual(d)))
    .map((d) => {
      const v = vencimentoNoMes(mes, d.venceDia!);
      return { d, v, dias: diasEntre(hoje, v) };
    })
    .filter((x) => x.dias <= 3)
    .sort((a, b) => a.dias - b.dias);
  if (candidatas[0]) {
    const { d, v, dias } = candidatas[0];
    const dia = Number(v.slice(8, 10));
    const texto = dias < 0 ? `A parcela de ${d.nome} venceu dia ${dia}. Pague hoje pra parar de render juros.` : dias === 0 ? `A parcela de ${d.nome} vence hoje.` : `A parcela de ${d.nome} vence ${dias === 1 ? 'amanhã' : `em ${dias} dias`} (dia ${dia}).`;
    return { tipo: 'vence', texto, divida: d, falta };
  }
  if (meta > 0 && pago >= meta - 0.005) return { tipo: 'cumprida', texto: `Meta do mês cumprida: você pagou ${brl0(pago)}. Só continuar.`, falta: 0 };
  if (pago <= 0) return { tipo: 'comeco', texto: `Você ainda não pagou nada este mês. A meta é ${brl0(meta)}.`, falta };
  return { tipo: 'faltam', texto: `Faltam ${brl0(falta)} pra bater a meta do mês.`, falta };
}

export interface Conquista {
  id: string;
  nome: string;
  feita: boolean;
}
export function conquistas(p: { pct: number; quitadas: number; pagamentos: number; sequencia: number }): Conquista[] {
  return [
    { id: 'p1', nome: 'Primeiro pagamento', feita: p.pagamentos >= 1 },
    { id: 'q1', nome: 'Primeira dívida quitada', feita: p.quitadas >= 1 },
    { id: 'm25', nome: '25% pago', feita: p.pct >= 25 },
    { id: 'm50', nome: 'Metade paga', feita: p.pct >= 50 },
    { id: 'm75', nome: '75% pago', feita: p.pct >= 75 },
    { id: 's3', nome: '3 meses seguidos', feita: p.sequencia >= 3 },
    { id: 's6', nome: '6 meses seguidos', feita: p.sequencia >= 6 },
  ];
}

/** Quanto o orçamento aguenta: renda menos o gasto médio. Zero se não souber a renda. */
export const capacidadeDePagamento = (renda: number, gastoMedio: number) => (renda > 0 ? Math.max(0, arred(renda - gastoMedio)) : 0);

/** Pagamento mensal inicial: dentro do que aguenta, nunca abaixo do mínimo. */
export function pagamentoSugerido(minimo: number, capacidade: number, total: number): number {
  if (capacidade > minimo) return Math.min(capacidade, Math.max(minimo, Math.round((capacidade * 0.6) / 50) * 50 || minimo));
  if (minimo > 0) return minimo;
  return Math.max(50, Math.ceil(total / 6 / 50) * 50);
}
