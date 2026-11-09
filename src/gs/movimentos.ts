// Histórico unificado do mês: despesas, receitas, contas fixas pagas, pagamentos de dívida e valores guardados.
// Conta paga é DERIVADA de GastoFixo.pagamentos (nunca um segundo registro), então marcar como paga não duplica despesa.

import { arred, mesDe } from './datas';
import { normalizar } from '../lib/categorias';
import type { Estado } from './tipos';

export type TipoMov = 'despesa' | 'receita' | 'conta' | 'divida' | 'guardado';
export interface Movimento {
  chave: string;
  tipo: TipoMov;
  data: string;
  descricao: string;
  categoria: string;
  valor: number; // sempre positivo; `entrada` diz o sentido
  entrada: boolean;
  editavel: boolean;
  refId: string;
}

export function movimentosDoMes(e: Estado, mes: string): Movimento[] {
  const m: Movimento[] = [];
  for (const l of e.lancamentos) if (mesDe(l.data) === mes) m.push({ chave: `l-${l.id}`, tipo: 'despesa', data: l.data, descricao: l.descricao, categoria: l.categoria, valor: l.valor, entrada: false, editavel: true, refId: l.id });
  for (const r of e.receitas) if (mesDe(r.data) === mes) m.push({ chave: `r-${r.id}`, tipo: 'receita', data: r.data, descricao: r.descricao, categoria: r.tipo === 'salario' ? 'Salário' : 'Receita', valor: r.valor, entrada: true, editavel: true, refId: r.id });
  for (const g of e.gastosFixos) {
    const p = g.pagamentos[mes];
    if (p) m.push({ chave: `c-${g.id}-${mes}`, tipo: 'conta', data: p.pagoEm, descricao: g.nome, categoria: g.categoria, valor: p.valorPago, entrada: false, editavel: false, refId: g.id });
  }
  for (const d of e.dividas) d.pagamentos.forEach((p, i) => mesDe(p.data) === mes && m.push({ chave: `d-${d.id}-${i}`, tipo: 'divida', data: p.data, descricao: `Pagamento: ${d.nome}`, categoria: 'Dívida', valor: p.valor, entrada: false, editavel: false, refId: d.id }));
  for (const a of e.aportes) if (mesDe(a.data) === mes && a.valor !== 0) m.push({ chave: `a-${a.id}`, tipo: 'guardado', data: a.data, descricao: a.valor > 0 ? 'Guardado' : 'Saque da reserva', categoria: 'Reserva', valor: Math.abs(a.valor), entrada: a.valor < 0, editavel: false, refId: a.id });
  return m.sort((a, b) => b.data.localeCompare(a.data) || b.chave.localeCompare(a.chave));
}

export interface FiltroMov {
  tipo: TipoMov | 'todos';
  busca: string;
  categoria: string | '';
}
export const filtrarMovimentos = (ms: Movimento[], f: FiltroMov) => {
  const q = normalizar(f.busca);
  return ms.filter((x) => (f.tipo === 'todos' || x.tipo === f.tipo) && (!f.categoria || x.categoria === f.categoria) && (!q || normalizar(`${x.descricao} ${x.categoria}`).includes(q)));
};
export const totaisMov = (ms: Movimento[]) => {
  const entrou = arred(ms.filter((x) => x.entrada).reduce((t, x) => t + x.valor, 0));
  const saiu = arred(ms.filter((x) => !x.entrada).reduce((t, x) => t + x.valor, 0));
  return { entrou, saiu, saldo: arred(entrou - saiu) };
};
