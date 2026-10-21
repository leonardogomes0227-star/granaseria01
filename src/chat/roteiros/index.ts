// Os roteiros de cada agente. O onboarding (6.1) vale pra Arkad, Dabasir e Nomasir; cada agente também tem o
// roteiro da missão dele (6.2 a 6.8), e o check-in do mês (6.9) vale pra qualquer agente com missão.

import type { AgenteId, Roteiro } from '../engine';
import { AGENTES_PRINCIPAIS, ONBOARDING, ROTEIRO_ONBOARDING } from './onboarding';
import { ROTEIRO_RESERVA } from './arkad';
import { ROTEIRO_DIVIDAS } from './dabasir';

export type Parametros = Record<string, string>;
type Fabrica = (agente: AgenteId, params: Parametros) => Roteiro | null;

const REGISTRO: Record<string, Fabrica> = {
  [ONBOARDING]: (a) => (AGENTES_PRINCIPAIS.includes(a) ? ROTEIRO_ONBOARDING(a) : null),
  reserva: () => ROTEIRO_RESERVA,
  dividas: () => ROTEIRO_DIVIDAS,
  // Fase 4 em andamento: contas (Bansir), gastos (Nomasir), empréstimo (Mathon), extra (Rodan), investir (Sharru)
  // e o check-in do mês entram aqui. Até lá, esses agentes abrem a página antiga deles.
};

/** O roteiro "da casa" de cada agente (o que abre quando a pessoa toca nele). */
export const ROTEIRO_DO_AGENTE: Partial<Record<AgenteId, string>> = {
  arkad: 'reserva',
  dabasir: 'dividas',
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

export { ONBOARDING, AGENTES_PRINCIPAIS };
