// O perfil da pessoa (spec v2, 7.7 e entidade "profiles"): renda, dia do salário, agente principal e se o
// onboarding já foi feito. Fica no estado sincronizado (chave 'gs-eu'), junto com o resto do plano.

import { gravarJSON, lerJSON } from './lib/armazem';
import type { AgenteId } from './chat/engine';

export const EU_KEY = 'gs-eu';

export interface Eu {
  renda?: number; // renda mensal declarada (no onboarding ou no perfil)
  rendaVariavel?: boolean; // a renda varia bastante (o plano usa um mês fraco como base)
  custoEssencial?: number; // os gastos fixos que a pessoa disse no onboarding (quando ainda não cadastrou as contas)
  diaSalario?: number; // 1 a 31
  agentePrincipal?: AgenteId;
  onboardingConcluido?: boolean;
  lembretes?: Partial<Record<AgenteId, boolean>>; // false = sem lembrete desse agente
  atualizadoEm?: string;
}

export const lerEu = (): Eu => {
  const v = lerJSON<Eu>(EU_KEY, {});
  return v && typeof v === 'object' ? v : {};
};

export function gravarEu(patch: Partial<Eu>): Eu {
  const next = { ...lerEu(), ...patch, atualizadoEm: new Date().toISOString() };
  gravarJSON(EU_KEY, next);
  return next;
}

/** Primeiro nome, com só a primeira letra maiúscula ("LEONARDO gomes" → "Leonardo"). */
export function primeiroNome(nome: string | null | undefined): string {
  const p = (nome ?? '').trim().split(/\s+/)[0] ?? '';
  if (!p) return '';
  return p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR');
}
