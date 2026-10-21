// Os roteiros de cada agente. O onboarding (6.1) vale pra Arkad, Dabasir e Nomasir; cada agente também tem o
// roteiro da missão dele (Fase 4: 6.2 a 6.9).

import type { AgenteId, Roteiro } from '../engine';
import { AGENTES_PRINCIPAIS, ONBOARDING, ROTEIRO_ONBOARDING } from './onboarding';

type Fabrica = (agente: AgenteId) => Roteiro;

const REGISTRO: Record<string, Fabrica> = {
  [ONBOARDING]: ROTEIRO_ONBOARDING,
};

/** O roteiro "da casa" de cada agente (o que abre quando a pessoa toca nele). */
export const ROTEIRO_DO_AGENTE: Partial<Record<AgenteId, string>> = {};

export function registrarRoteiro(id: string, f: Fabrica, agentes: AgenteId[] = []) {
  REGISTRO[id] = f;
  for (const a of agentes) ROTEIRO_DO_AGENTE[a] = id;
}

/** O roteiro pedido; sem pedido, o do agente; sem roteiro próprio, o onboarding (se ele for um dos principais). */
export function roteiroPara(agente: AgenteId, pedido?: string | null): Roteiro | null {
  const id = pedido && REGISTRO[pedido] ? pedido : ROTEIRO_DO_AGENTE[agente] ?? (AGENTES_PRINCIPAIS.includes(agente) ? ONBOARDING : null);
  if (!id) return null;
  if (id === ONBOARDING && !AGENTES_PRINCIPAIS.includes(agente)) return null;
  return REGISTRO[id](agente);
}

export { ONBOARDING, AGENTES_PRINCIPAIS };
