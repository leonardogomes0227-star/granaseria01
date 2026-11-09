// Histórico unificado: despesas, receitas, transferências, contas fixas pagas, pagamentos de dívida e valores guardados.
// Conta paga é DERIVADA de GastoFixo.pagamentos (nunca um segundo registro), então marcar como paga não duplica despesa.
// Transferência entre contas é neutra: não entra nos totais de entrou/saiu.

import { arred, mesDe, somaDias } from './datas';
import { normalizar } from '../lib/categorias';
import type { Estado } from './tipos';

export type TipoMov = 'despesa' | 'receita' | 'transferencia' | 'conta' | 'divida' | 'guardado';
export interface Movimento {
  chave: string;
  tipo: TipoMov;
  data: string;
  descricao: string;
  categoria: string;
  valor: number; // sempre positivo; `entrada` diz o sentido
  entrada: boolean;
  neutro?: boolean; // transferência: não soma nem subtrai
  editavel: boolean;
  refId: string;
  contaId?: string;
}

/** Tudo entre duas datas (inclusive), 'AAAA-MM-DD'. */
export function movimentosNoPeriodo(e: Estado, de: string, ate: string): Movimento[] {
  const dentro = (d: string) => d >= de && d <= ate;
  const nomeConta = (id?: string) => e.contas.find((c) => c.id === id)?.nome ?? 'conta removida';
  const m: Movimento[] = [];
  for (const l of e.lancamentos) if (dentro(l.data)) m.push({ chave: `l-${l.id}`, tipo: 'despesa', data: l.data, descricao: l.descricao, categoria: l.categoria, valor: l.valor, entrada: false, editavel: true, refId: l.id, contaId: l.contaId });
  for (const r of e.receitas) if (dentro(r.data)) m.push({ chave: `r-${r.id}`, tipo: 'receita', data: r.data, descricao: r.descricao, categoria: r.tipo === 'salario' ? 'Salário' : 'Receita', valor: r.valor, entrada: true, editavel: true, refId: r.id, contaId: r.contaId });
  for (const t of e.transferencias) if (dentro(t.data)) m.push({ chave: `t-${t.id}`, tipo: 'transferencia', data: t.data, descricao: t.descricao || `${nomeConta(t.de)} → ${nomeConta(t.para)}`, categoria: 'Transferência', valor: t.valor, entrada: false, neutro: true, editavel: true, refId: t.id, contaId: t.de });
  for (const g of e.gastosFixos)
    for (const [mes, p] of Object.entries(g.pagamentos)) if (dentro(p.pagoEm) && mes) m.push({ chave: `c-${g.id}-${mes}`, tipo: 'conta', data: p.pagoEm, descricao: g.nome, categoria: g.categoria, valor: p.valorPago, entrada: false, editavel: false, refId: g.id });
  for (const d of e.dividas) d.pagamentos.forEach((p, i) => dentro(p.data) && m.push({ chave: `d-${d.id}-${i}`, tipo: 'divida', data: p.data, descricao: `Pagamento: ${d.nome}`, categoria: 'Dívida', valor: p.valor, entrada: false, editavel: false, refId: d.id }));
  for (const a of e.aportes) if (dentro(a.data) && a.valor !== 0) m.push({ chave: `a-${a.id}`, tipo: 'guardado', data: a.data, descricao: a.valor > 0 ? 'Guardado' : 'Saque da reserva', categoria: 'Reserva', valor: Math.abs(a.valor), entrada: a.valor < 0, editavel: false, refId: a.id });
  return m.sort((a, b) => b.data.localeCompare(a.data) || b.chave.localeCompare(a.chave));
}

export const movimentosDoMes = (e: Estado, mes: string) => movimentosNoPeriodo(e, `${mes}-01`, `${mes}-31`).filter((m) => mesDe(m.data) === mes);

export type Ordem = 'recentes' | 'antigos' | 'maior' | 'menor';
export interface FiltroMov {
  tipo: TipoMov | 'todos';
  busca: string;
  categoria: string | '';
  contaId?: string | '';
  ordem?: Ordem;
}
export const filtrarMovimentos = (ms: Movimento[], f: FiltroMov) => {
  const q = normalizar(f.busca);
  const lista = ms.filter((x) => (f.tipo === 'todos' || x.tipo === f.tipo) && (!f.categoria || x.categoria === f.categoria) && (!f.contaId || x.contaId === f.contaId) && (!q || normalizar(`${x.descricao} ${x.categoria}`).includes(q)));
  const o = f.ordem ?? 'recentes';
  if (o === 'antigos') return [...lista].sort((a, b) => a.data.localeCompare(b.data) || a.chave.localeCompare(b.chave));
  if (o === 'maior') return [...lista].sort((a, b) => b.valor - a.valor);
  if (o === 'menor') return [...lista].sort((a, b) => a.valor - b.valor);
  return lista;
};
export const totaisMov = (ms: Movimento[]) => {
  const reais = ms.filter((x) => !x.neutro);
  const entrou = arred(reais.filter((x) => x.entrada).reduce((t, x) => t + x.valor, 0));
  const saiu = arred(reais.filter((x) => !x.entrada).reduce((t, x) => t + x.valor, 0));
  return { entrou, saiu, saldo: arred(entrou - saiu) };
};

/** Atalhos de período do histórico. */
export type Periodo = 'mes' | '7d' | '30d' | 'ano';
export function intervalo(p: Periodo, mes: string, hoje: string): { de: string; ate: string } {
  if (p === '7d') return { de: somaDias(hoje, -6), ate: hoje };
  if (p === '30d') return { de: somaDias(hoje, -29), ate: hoje };
  if (p === 'ano') return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
  return { de: `${mes}-01`, ate: `${mes}-31` };
}
