// Planejamento: o que resolver primeiro, com semáforo. Vermelho: atrasado. Amarelo: atenção. Verde: organizado.
// Junta contas fixas, fatura do cartão e parcelas de dívida em uma só lista. Puro, com teste.

import { brl0, diaCurto, diasEntre, mesDe, vencimentoNoMes } from './datas';
import { contasDoMes } from './selectores';
import { proximaData } from './cartaoLogica';
import { saldoAtual } from './dividas';
import type { Estado } from './tipos';

export type Semaforo = 'vermelho' | 'amarelo' | 'verde';
export interface Prioridade {
  chave: string;
  semaforo: Semaforo;
  titulo: string;
  detalhe: string;
  valor: number;
  data: string;
  rota: string;
}
const ordem: Record<Semaforo, number> = { vermelho: 0, amarelo: 1, verde: 2 };

export function prioridades(e: Estado, hoje: string): Prioridade[] {
  const mes = mesDe(hoje);
  const l: Prioridade[] = [];
  for (const c of contasDoMes(e, mes, hoje)) {
    const s: Semaforo = c.estado === 'paga' ? 'verde' : c.estado === 'atrasada' ? 'vermelho' : c.estado === 'vence-logo' ? 'amarelo' : 'verde';
    l.push({ chave: `c-${c.gasto.id}`, semaforo: s, titulo: c.gasto.nome, detalhe: c.estado === 'paga' ? 'paga' : c.estado === 'atrasada' ? `atrasada há ${-c.dias} ${-c.dias === 1 ? 'dia' : 'dias'}` : `vence ${diaCurto(c.vencimento)}`, valor: c.valor, data: c.vencimento, rota: '/lancamentos?aba=contas' });
  }
  if (e.cartao && e.cartao.limite > 0 && e.cartao.usado > 0) {
    const v = proximaData(e.cartao.venceDia, hoje);
    const uso = (e.cartao.usado / e.cartao.limite) * 100;
    l.push({ chave: 'cartao', semaforo: v.dias <= 2 || uso > 90 ? 'vermelho' : v.dias <= 7 || uso > 70 ? 'amarelo' : 'verde', titulo: 'Fatura do cartão', detalhe: `vence ${diaCurto(v.data)} · ${Math.round(uso)}% do limite`, valor: e.cartao.usado, data: v.data, rota: '/plano/cartao' });
  }
  for (const oc of e.outrosCartoes ?? []) {
    if (oc.usado <= 0) continue;
    const v = proximaData(oc.venceDia, hoje);
    l.push({ chave: `oc-${oc.id}`, semaforo: v.dias <= 2 ? 'vermelho' : v.dias <= 7 ? 'amarelo' : 'verde', titulo: `Fatura ${oc.nome}`, detalhe: `vence ${diaCurto(v.data)}`, valor: oc.usado, data: v.data, rota: '/plano/cartao' });
  }
  for (const d of e.dividas) {
    if (saldoAtual(d) <= 0 || !d.venceDia) continue;
    const data = vencimentoNoMes(mes, d.venceDia);
    const dias = diasEntre(hoje, data);
    const pagoNoMes = d.pagamentos.some((p) => mesDe(p.data) === mes);
    if (pagoNoMes) continue;
    l.push({ chave: `d-${d.id}`, semaforo: dias < 0 ? 'vermelho' : dias <= 5 ? 'amarelo' : 'verde', titulo: `Parcela: ${d.nome}`, detalhe: dias < 0 ? `venceu há ${-dias} dias` : `vence ${diaCurto(data)}`, valor: Math.min(d.parcelaMinima, saldoAtual(d)), data, rota: '/plano/dividas' });
  }
  return l.sort((a, b) => ordem[a.semaforo] - ordem[b.semaforo] || a.data.localeCompare(b.data));
}

export const resumoSemaforo = (p: Prioridade[]) => ({ vermelho: p.filter((x) => x.semaforo === 'vermelho').length, amarelo: p.filter((x) => x.semaforo === 'amarelo').length, verde: p.filter((x) => x.semaforo === 'verde').length });
export const totalAResolver = (p: Prioridade[]) => brl0(p.filter((x) => x.semaforo !== 'verde').reduce((t, x) => t + x.valor, 0));
