// Calendário: contas fixas, parcelas de dívidas e fatura do cartão num lugar só. Pura, com teste.

import { diasEntre, somaMes, vencimentoNoMes } from './datas.js';
import { contasDoMes, estaPaga } from './selectores.js';
import { pagoNaDivida } from './painelDividas.js';
import { saldoAtual } from './dividas.js';
import { proximaData } from './cartaoLogica.js';
import type { Estado } from './tipos.js';

export interface Evento {
  id: string;
  tipo: 'conta' | 'divida' | 'cartao';
  nome: string;
  data: string;
  dias: number; // até vencer; negativo = atrasado
  valor: number;
  paga: boolean;
  rota?: string;
}

export function eventosDoMes(e: Estado, mes: string, hoje: string): Evento[] {
  const out: Evento[] = contasDoMes(e, mes, hoje).map((c) => ({ id: `c-${c.gasto.id}`, tipo: 'conta' as const, nome: c.gasto.nome, data: c.vencimento, dias: c.dias, valor: c.valor, paga: c.estado === 'paga' }));
  for (const d of e.dividas) {
    if (!d.venceDia || saldoAtual(d) <= 0) continue;
    const data = vencimentoNoMes(mes, d.venceDia);
    out.push({ id: `d-${d.id}`, tipo: 'divida', nome: d.nome, data, dias: diasEntre(hoje, data), valor: d.parcelaMinima || 0, paga: pagoNaDivida(d, mes) >= Math.min(d.parcelaMinima || 1, saldoAtual(d)), rota: '/plano/dividas' });
  }
  const c = e.cartao;
  if (c && c.usado > 0) {
    const data = mes === hoje.slice(0, 7) ? proximaData(c.venceDia, hoje).data : vencimentoNoMes(mes, c.venceDia);
    if (data.slice(0, 7) === mes) out.push({ id: 'cartao', tipo: 'cartao', nome: 'Fatura do cartão', data, dias: diasEntre(hoje, data), valor: c.usado, paga: false, rota: '/plano/cartao' });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome));
}

export const faltaDoMes = (ev: Evento[]) => ev.filter((x) => !x.paga).reduce((t, x) => t + x.valor, 0);

export interface AcaoCalendario {
  tom: 'ok' | 'aviso' | 'perigo';
  texto: string;
  evento?: Evento;
}
export function acaoCalendario(ev: Evento[], livre: number): AcaoCalendario {
  const abertos = ev.filter((x) => !x.paga);
  const atrasado = abertos.filter((x) => x.dias < 0).sort((a, b) => a.dias - b.dias)[0];
  if (atrasado) return { tom: 'perigo', texto: `${atrasado.nome} está atrasada há ${-atrasado.dias} ${-atrasado.dias === 1 ? 'dia' : 'dias'}. Pague hoje pra parar de render multa e juros.`, evento: atrasado };
  const prox = abertos[0];
  if (!prox) return { tom: 'ok', texto: ev.length ? 'Tudo pago neste mês. Respire.' : 'Nada pra pagar por enquanto.' };
  const sete = abertos.filter((x) => x.dias <= 7);
  const total7 = sete.reduce((t, x) => t + x.valor, 0);
  if (prox.dias <= 3) return { tom: 'aviso', texto: `${prox.nome} vence ${prox.dias === 0 ? 'hoje' : prox.dias === 1 ? 'amanhã' : `em ${prox.dias} dias`}.`, evento: prox };
  if (total7 > livre && livre >= 0) return { tom: 'aviso', texto: `Nos próximos 7 dias vencem ${sete.length} contas (${Math.round(total7)} reais) e só restam ${Math.max(0, Math.round(livre))} livres. Separe o dinheiro.`, evento: prox };
  return { tom: 'ok', texto: `Próxima: ${prox.nome}, em ${prox.dias} dias.`, evento: prox };
}

/** Meses anteriores seguidos com todas as contas fixas pagas. */
export function mesesEmDia(e: Estado, mes: string): number {
  const ant = (m: string) => {
    const [a, n] = m.split('-').map(Number);
    return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, '0')}`;
  };
  let n = 0;
  let m = ant(mes);
  while (n < 24 && e.gastosFixos.length > 0 && e.gastosFixos.every((g) => estaPaga(g, m)) ) {
    n++;
    m = ant(m);
  }
  return n;
}

/* ---------- de salário a salário: o que vence nesse intervalo e quanto sobra depois de cada conta ---------- */
export interface Ciclo {
  inicio: string; // dia em que o salário caiu (o último, até hoje)
  proximo: string; // o próximo salário
}
/** O ciclo atual: do último salário (incluindo hoje) até o próximo. Dia 29 a 31 em mês curto vira o último dia. */
export function cicloDoSalario(diaSalario: number, hoje: string): Ciclo {
  const mes = hoje.slice(0, 7);
  const desteMes = vencimentoNoMes(mes, diaSalario);
  const inicio = desteMes <= hoje ? desteMes : vencimentoNoMes(somaMes(mes, -1), diaSalario);
  return { inicio, proximo: vencimentoNoMes(somaMes(inicio.slice(0, 7), 1), diaSalario) };
}

export interface PassoDoCiclo extends Evento {
  sobra: number; // quanto do salário sobra depois desta conta (pagas e a pagar, na ordem)
}
export interface LinhaDoCiclo {
  ciclo: Ciclo;
  renda: number;
  passos: PassoDoCiclo[];
  total: number;
  pago: number;
  falta: number;
  sobra: number; // renda − contas do ciclo
}
export function linhaDoCiclo(e: Estado, hoje: string): LinhaDoCiclo | null {
  const dia = e.config.diaSalario;
  if (!dia) return null;
  const ciclo = cicloDoSalario(dia, hoje);
  const meses = [...new Set([ciclo.inicio.slice(0, 7), ciclo.proximo.slice(0, 7)])];
  const vistos = new Set<string>();
  const eventos = meses
    .flatMap((m) => eventosDoMes(e, m, hoje))
    .filter((x) => x.data >= ciclo.inicio && x.data < ciclo.proximo && !vistos.has(x.id + x.data) && vistos.add(x.id + x.data))
    .sort((a, b) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome));
  let saldo = e.config.renda;
  const passos = eventos.map((x) => {
    saldo -= x.valor;
    return { ...x, sobra: Math.round(saldo * 100) / 100 };
  });
  const total = eventos.reduce((t, x) => t + x.valor, 0);
  const pago = eventos.filter((x) => x.paga).reduce((t, x) => t + x.valor, 0);
  return { ciclo, renda: e.config.renda, passos, total, pago, falta: Math.round((total - pago) * 100) / 100, sobra: Math.round((e.config.renda - total) * 100) / 100 };
}

/** Contas fixas que vencem antes do salário cair: apertam todo mês. Sugere um dia logo depois do salário. */
export function vencemAntesDoSalario(e: Estado): { id: string; nome: string; dia: number; sugerido: number; valor: number }[] {
  const s = e.config.diaSalario;
  if (!s) return [];
  const sugerido = Math.min(28, s + 2);
  return e.gastosFixos
    .filter((g) => g.diaVencimento < s)
    .map((g) => ({ id: g.id, nome: g.nome, dia: g.diaVencimento, sugerido, valor: g.valor }))
    .sort((a, b) => a.dia - b.dia);
}

export const pedidoDeVencimento = (nome: string, dia: number) =>
  `Olá, tudo bem? Quero mudar a data de vencimento da minha conta (${nome}) para o dia ${dia}, que fica logo depois de eu receber o salário. É possível? Obrigado.`;
