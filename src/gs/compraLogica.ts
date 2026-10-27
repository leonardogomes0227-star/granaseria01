// Posso comprar isso?: o que você já evitou, o contexto da compra e as conquistas. Pura, com teste.

import { arred } from './datas';
import { maiorJuroMensal } from './dividas';
import { capacidadeDePagamento } from './painelDividas';
import { gastoMensalMedio, patrimonioGuardado, reservaMeta } from './selectores';
import type { Desejo, Estado } from './tipos';

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
