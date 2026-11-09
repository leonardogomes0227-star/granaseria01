// Cartão de crédito: vencimento, fecho, compras (à vista e parceladas), faturas futuras e o que fazer agora. Pura, com teste.

import { arred, brl0, diasEntre, vencimentoNoMes } from './datas.js';
import type { Cartao, ParceladoCartao } from './tipos.js';

const somaMes = (mes: string, n: number) => {
  const [a, m] = mes.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

/** Próxima data de um dia fixo do mês (hoje conta). */
export function proximaData(dia: number, hoje: string): { data: string; dias: number } {
  const mes = hoje.slice(0, 7);
  let data = vencimentoNoMes(mes, dia);
  if (data < hoje) data = vencimentoNoMes(somaMes(mes, 1), dia);
  return { data, dias: diasEntre(hoje, data) };
}

export const usoDoLimite = (c: Cartao) => (c.limite > 0 ? (c.usado / c.limite) * 100 : 0);
export const comprometidoTotal = (c: Cartao) => arred((c.parcelados ?? []).reduce((t, p) => t + p.parcela * p.restantes, 0));

/** Quanto das parcelas já combinadas cai em cada uma das próximas faturas. */
export function proximasFaturas(c: Cartao, meses = 6): number[] {
  return Array.from({ length: meses }, (_, i) => arred((c.parcelados ?? []).filter((p) => p.restantes > i).reduce((t, p) => t + p.parcela, 0)));
}

/** Uma compra no cartão: à vista soma na fatura; parcelada soma a 1ª parcela e guarda as demais. */
export function aplicarCompra(c: Cartao, compra: { descricao: string; valor: number; parcelas: number }, id: string): Cartao {
  const n = Math.max(1, Math.round(compra.parcelas));
  if (n === 1) return { ...c, usado: arred(c.usado + compra.valor) };
  const parcela = arred(compra.valor / n);
  const novo: ParceladoCartao = { id, descricao: compra.descricao.trim().slice(0, 40) || 'Compra', parcela, restantes: n - 1 };
  return { ...c, usado: arred(c.usado + parcela), parcelados: [...(c.parcelados ?? []), novo] };
}

/** Pagou a fatura: guarda no histórico e abre a próxima já com as parcelas que caem nela. */
export function aplicarPagamento(c: Cartao, hoje: string): Cartao {
  const parcelados = (c.parcelados ?? []).map((p) => ({ ...p }));
  const proxima = arred(parcelados.reduce((t, p) => t + p.parcela, 0));
  return {
    ...c,
    usado: proxima,
    parcelados: parcelados.map((p) => ({ ...p, restantes: p.restantes - 1 })).filter((p) => p.restantes > 0),
    pagas: [...(c.pagas ?? []), { data: hoje, valor: c.usado }].slice(-24),
  };
}

export interface AcaoCartao {
  tom: 'ok' | 'aviso' | 'perigo';
  texto: string;
  pagar: boolean; // mostra o botão "Paguei a fatura"
}
export function acaoCartao(c: Cartao, hoje: string): AcaoCartao {
  const v = proximaData(c.venceDia, hoje);
  const f = proximaData(c.fechaDia, hoje);
  const uso = usoDoLimite(c);
  if (c.usado > 0 && v.dias <= 3) return { tom: v.dias === 0 ? 'perigo' : 'aviso', texto: `A fatura de ${brl0(c.usado)} vence ${v.dias === 0 ? 'hoje' : v.dias === 1 ? 'amanhã' : `em ${v.dias} dias`}. Pague o total pra não cair no rotativo.`, pagar: true };
  if (uso > 80) return { tom: 'perigo', texto: `Você usou ${Math.round(uso)}% do limite. Segure novas compras até a fatura virar.`, pagar: c.usado > 0 };
  if (uso > 30) return { tom: 'aviso', texto: `Você usou ${Math.round(uso)}% do limite. O ideal é ficar abaixo de 30%.`, pagar: c.usado > 0 };
  const fechou = diasEntre(vencimentoNoMes(hoje.slice(0, 7), c.fechaDia), hoje);
  if (fechou >= 0 && fechou <= 3) return { tom: 'ok', texto: 'A fatura acabou de fechar. Compras novas só entram na próxima: ótimo momento pra comprar.', pagar: c.usado > 0 };
  return { tom: 'ok', texto: `Tudo em ordem. A fatura fecha em ${f.dias} ${f.dias === 1 ? 'dia' : 'dias'} e vence dia ${c.venceDia}.`, pagar: c.usado > 0 };
}

export function conquistasCartao(c: Cartao): string[] {
  const pagas = c.pagas?.length ?? 0;
  const l: string[] = [];
  if (pagas >= 1) l.push('Primeira fatura paga');
  if (pagas >= 3) l.push('3 faturas pagas');
  if (pagas >= 6) l.push('6 faturas pagas');
  if (usoDoLimite(c) <= 30 && c.usado >= 0) l.push('Uso abaixo de 30%');
  return l;
}
