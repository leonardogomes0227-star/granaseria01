// Sequência (spec v2, seção 9): meses seguidos com pelo menos um "guardei" (reserva ou investimento).
// O mês atual conta se já tem; se ainda não tem, a sequência vem até o mês passado (o mês ainda está aberto).

import { addMonths, monthOf } from '../coachChat/months.js';

interface ComRegistros {
  tipo: string;
  registros: { mes: string; valor: number }[];
  deletedAt?: string | null;
}

/** Os meses ('AAAA-MM') em que a pessoa guardou alguma coisa. */
export function mesesGuardados(missoes: ComRegistros[], guardado: { on: string; amount: number }[] = []): Set<string> {
  const s = new Set<string>();
  for (const m of missoes) {
    if (m.deletedAt || (m.tipo !== 'reserva' && m.tipo !== 'investir')) continue;
    for (const r of m.registros) if (r.valor > 0) s.add(r.mes);
  }
  for (const g of guardado) if (g.amount > 0) s.add(monthOf(g.on));
  return s;
}

export function sequencia(meses: Set<string>, hoje: string): number {
  let m = monthOf(hoje);
  if (!meses.has(m)) m = addMonths(m, -1);
  let n = 0;
  while (meses.has(m) && n < 600) {
    n++;
    m = addMonths(m, -1);
  }
  return n;
}
