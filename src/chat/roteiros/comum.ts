// Peças que os roteiros dos agentes usam: tom de voz, datas curtas, leitura de missões e o passo final.

import { addMonths, monthAbbr } from '../../coachChat/months';
import { andamento, ativas, type Missao } from '../../missoes';
import { comNome, type AgenteId, type Ctx, type Passo } from '../engine';

export const NOMES: Record<AgenteId, string> = { arkad: 'Arkad', bansir: 'Bansir', nomasir: 'Nomasir', dabasir: 'Dabasir', mathon: 'Mathon', rodan: 'Rodan', sharru: 'Sharru Nada' };

/** As falas com {nome}. */
export const falas = (ctx: Ctx, linhas: string[]) => linhas.map((s) => comNome(s, ctx.nome));

/** 'mar/27' a partir de "meses a partir deste" (1 = este mês). */
export const quandoEm = (mesAtual: string, meses: number | null) => (meses === null ? null : monthAbbr(addMonths(mesAtual, Math.max(0, meses - 1))));
export const mesCurto = (mes: string | null) => (mes ? monthAbbr(mes) : 'sem data ainda');

export const missaoAtiva = (ctx: Ctx, tipo: Missao['tipo']) => ativas(ctx.dados.missoes).find((m) => m.tipo === tipo) ?? null;

/** Quantos meses até a reserva completar (pelo andamento da missão), ou null. */
export function mesesAteReserva(ctx: Ctx): number | null {
  const r = ctx.dados.missoes.find((m) => m.tipo === 'reserva' && m.status === 'ativa');
  if (!r) return null;
  const a = andamento(r, ctx.dados.hoje);
  if (!a.previsao) return null;
  let n = 0;
  for (let m = ctx.dados.mes; m < a.previsao && n < 600; m = addMonths(m, 1)) n++;
  return n + 1;
}

/** O passo de fim (só fala). */
export const fim = (id: string, linhas: (ctx: Ctx) => string[]): Passo => ({ id, falas: linhas, resposta: { tipo: 'nenhuma' }, proximo: null });
