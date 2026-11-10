// "Bem-vindo de volta": o que mudou desde a última visita e onde a pessoa parou. Puro, com teste.

import { brl0, diasEntre, hoje as hojeSP, mesDe } from './datas.js';
import { contasDoMes } from './selectores.js';
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
