// "Bem-vindo de volta": o que mudou desde a última visita e onde a pessoa parou. Puro, com teste.

import { brl0, diasEntre, hoje as hojeSP, mesDe } from './datas.js';
import { contasDoMes } from './selectores.js';
import { calcularCaminho, destino, mesesEntre } from './caminho.js';
import { somaDias } from './datas.js';
import type { Estado } from './tipos.js';

export const HORAS_PARA_VOLTA = 24;
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export interface Volta {
  desde: string; // "quinta", "ontem", "dia 3"
  mudancas: string[];
}

/** Nulo quando não é hora de mostrar: primeira visita, menos de 24h, ou a pessoa já fechou o cartão. */
export function resumoDaVolta(e: Estado, agora: Date): Volta | null {
  const ultima = e.caminho?.ultimaVisita;
  if (!ultima) return null;
  const horas = (agora.getTime() - Date.parse(ultima)) / 3600_000;
  if (!(horas >= HORAS_PARA_VOLTA)) return null;
  const hoje = hojeSP(agora);
  const dia = hojeSP(new Date(ultima));
  const dias = diasEntre(dia, hoje);
  const desde = dias <= 1 ? 'ontem' : dias < 7 ? DIAS[new Date(`${dia}T12:00:00Z`).getUTCDay()] : `o dia ${Number(dia.slice(8, 10))}/${dia.slice(5, 7)}`;
  const mudancas: string[] = [];

  const venceram = contasDoMes(e, mesDe(hoje), hoje).filter((c) => c.estado === 'atrasada' && c.vencimento >= dia);
  if (venceram.length === 1) mudancas.push(`${venceram[0].gasto.nome} venceu`);
  else if (venceram.length > 1) mudancas.push(`${venceram.length} contas venceram`);

  const doZap = e.receitas.filter((r) => r.serverId !== undefined && r.data > dia);
  if (doZap.length) mudancas.push(`${doZap.length === 1 ? 'caiu' : 'caíram'} ${brl0(doZap.reduce((t, r) => t + r.valor, 0))} de ${doZap.some((r) => r.tipo === 'salario') ? 'salário' : 'entrada'} pelo WhatsApp`);
  const gastosZap = e.lancamentos.filter((l) => l.serverId !== undefined && l.data > dia);
  if (gastosZap.length) mudancas.push(`${gastosZap.length} ${gastosZap.length === 1 ? 'gasto anotado' : 'gastos anotados'} pelo WhatsApp (${brl0(gastosZap.reduce((t, l) => t + l.valor, 0))})`);

  const ultimoGasto = e.lancamentos.reduce((m, l) => (l.data > m ? l.data : m), '');
  const semAnotar = diasEntre(ultimoGasto > dia ? ultimoGasto : dia, hoje);
  if (semAnotar >= 2 && e.config.renda > 0) mudancas.push(`você ficou ${semAnotar} dias sem anotar`);

  if (mudancas.length === 0) mudancas.push('nada venceu e nada mudou no seu plano');
  return { desde, mudancas };
}

/* ---------- a semana no caminho: o que foi feito e o que isso mudou na data do destino ---------- */

/** O estado como estava numa data: tira o que foi registrado depois dela (gastos, pagamentos, guardados). */
export function estadoEm(e: Estado, data: string): Estado {
  const ate = (d: string) => d <= data;
  return {
    ...e,
    lancamentos: e.lancamentos.filter((l) => ate(l.data)),
    receitas: e.receitas.filter((r) => ate(r.data)),
    aportes: e.aportes.filter((a) => ate(a.data)),
    gastosFixos: e.gastosFixos.map((g) => ({ ...g, pagamentos: Object.fromEntries(Object.entries(g.pagamentos).filter(([, p]) => ate(p.pagoEm))) })),
    dividas: e.dividas.map((d) => ({ ...d, pagamentos: d.pagamentos.filter((p) => ate(p.data)) })),
    metas: e.metas.map((m) => ({ ...m, guardados: m.guardados.filter((g) => ate(g.data)) })),
  };
}

export interface SemanaNoCaminho {
  pagou: number;
  guardou: number;
  marco: string | null;
  mesesMaisPerto: number; // positivo = ficou mais perto; negativo = ficou mais longe
  frase: string;
}
/** Os últimos 7 dias: quanto foi pago e guardado e o que mudou no destino. Nulo se nada aconteceu. */
export function semanaNoCaminho(e: Estado, hoje: string): SemanaNoCaminho | null {
  const de = somaDias(hoje, -7);
  const na = (d: string) => d > de && d <= hoje;
  const pagou = e.gastosFixos.flatMap((g) => Object.values(g.pagamentos)).filter((p) => na(p.pagoEm)).reduce((t, p) => t + p.valorPago, 0) + e.dividas.flatMap((d) => d.pagamentos).filter((p) => na(p.data)).reduce((t, p) => t + p.valor, 0);
  const guardou = e.aportes.filter((a) => na(a.data) && a.valor > 0).reduce((t, a) => t + a.valor, 0);
  if (pagou <= 0 && guardou <= 0) return null;
  const agora = destino(calcularCaminho(e, hoje));
  const antes = calcularCaminho(estadoEm(e, de), hoje).find((m) => m.id === agora?.id);
  const mesesMaisPerto = agora?.dataPrevista && antes?.dataPrevista ? mesesEntre(agora.dataPrevista, antes.dataPrevista) : 0;
  const fez = [pagou > 0 ? `pagou ${brl0(pagou)}` : '', guardou > 0 ? `guardou ${brl0(guardou)}` : ''].filter(Boolean).join(' e ');
  const efeito = !agora ? '' : mesesMaisPerto > 0 ? ` Com isso, "${agora.titulo.toLowerCase()}" ficou ${mesesMaisPerto} ${mesesMaisPerto === 1 ? 'mês' : 'meses'} mais perto.` : mesesMaisPerto < 0 ? ` Sem drama: "${agora.titulo.toLowerCase()}" foi ${-mesesMaisPerto} ${mesesMaisPerto === -1 ? 'mês' : 'meses'} para frente, e eu já recalculei.` : ' Seu destino segue no prazo.';
  return { pagou, guardou, marco: agora?.id ?? null, mesesMaisPerto, frase: `Nesta semana você ${fez}.${efeito}` };
}
