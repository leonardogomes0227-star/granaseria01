// Os roteiros de cada agente. O onboarding (6.1) vale pra Arkad, Dabasir e Nomasir; cada agente também tem o
// roteiro da missão dele (6.2 a 6.8), e o check-in do mês (6.9) vale pra qualquer agente com missão.

import type { AgenteId, Roteiro } from '../engine';
import { AGENTES_PRINCIPAIS, ONBOARDING, ROTEIRO_ONBOARDING } from './onboarding';
import { ROTEIRO_RESERVA } from './arkad';
import { ROTEIRO_DIVIDAS } from './dabasir';
import { ROTEIRO_CONTAS } from './bansir';
import { ROTEIRO_GASTOS } from './nomasir';
import { ROTEIRO_EMPRESTIMO } from './mathon';
import { ROTEIRO_EXTRA } from './rodan';
import { ROTEIRO_INVESTIR } from './sharru';
import { CHECKIN, ROTEIRO_CHECKIN } from './checkin';

export type Parametros = Record<string, string>;
type Fabrica = (agente: AgenteId, params: Parametros) => Roteiro | null;

const REGISTRO: Record<string, Fabrica> = {
  [ONBOARDING]: (a) => (AGENTES_PRINCIPAIS.includes(a) ? ROTEIRO_ONBOARDING(a) : null),
  reserva: () => ROTEIRO_RESERVA,
  dividas: () => ROTEIRO_DIVIDAS,
  contas: () => ROTEIRO_CONTAS,
  gastos: () => ROTEIRO_GASTOS,
  emprestimo: () => ROTEIRO_EMPRESTIMO,
  extra: () => ROTEIRO_EXTRA,
  investir: () => ROTEIRO_INVESTIR,
  [CHECKIN]: (a, p) => ROTEIRO_CHECKIN(a, p.missao ?? '', p.mes ?? ''),
};

/** O roteiro "da casa" de cada agente (o que abre quando a pessoa toca nele). */
export const ROTEIRO_DO_AGENTE: Partial<Record<AgenteId, string>> = {
  arkad: 'reserva',
  dabasir: 'dividas',
  bansir: 'contas',
  nomasir: 'gastos',
  mathon: 'emprestimo',
  rodan: 'extra',
  sharru: 'investir',
};

/** O roteiro pedido (se ele vale pra esse agente); sem pedido, o do agente. */
export function roteiroPara(agente: AgenteId, pedido?: string | null, params: Parametros = {}): Roteiro | null {
  const id = pedido && REGISTRO[pedido] ? pedido : ROTEIRO_DO_AGENTE[agente] ?? (AGENTES_PRINCIPAIS.includes(agente) ? ONBOARDING : null);
  if (!id) return null;
  const r = REGISTRO[id]?.(agente, params) ?? null;
  // um roteiro de outro agente não abre aqui (o onboarding vale pros três principais; o check-in, pra qualquer um)
  if (r && r.agente !== agente) return null;
  return r;
}

export { ONBOARDING, AGENTES_PRINCIPAIS, CHECKIN };
