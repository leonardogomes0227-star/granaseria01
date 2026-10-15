// Atalhos: quem já sabe o que quer não precisa passar pelo menu toda vez.
//  1. Ao abrir uma ferramenta pelo menu, o bot ensina a palavra que abre direto (ver TIP_WORD).
//  2. Quando a pessoa volta ("oi"), mostra as ferramentas que ela mais usa, em botões (topShortcuts).

import { rest } from './db.js';
import { personHash } from './hubdb.js';

/** id da linha/botão do menu → palavra que abre a mesma ferramenta digitando. */
export const TIP_WORD: Record<string, string> = {
  'menu:gastos': 'gastos',
  'menu:diag': 'diagnóstico',
  'menu:rapido': 'rápido',
  'menu:13o': '13º',
  'menu:vazamentos': 'vazamentos',
  'menu:direitos': 'direitos',
  'menu:checkin': 'check-in',
  'mais:selos': 'selos',
  'mais:frase': 'frase',
  'calc:compra': 'vale a pena comprar',
  'calc:meta': 'meta',
  'calc:longo': 'longo prazo',
  'calc:emprestimo': 'empréstimo',
  'calc:dividas': 'dívidas',
};

// evento de uso → botão (id, título até 20 caracteres)
const BY_EVENT: Record<string, [string, string]> = {
  'tool:gastos': ['menu:gastos', '💸 Gastos'],
  'tool:extra': ['menu:13o', '🎁 13º e extra'],
  'tool:leaks': ['menu:vazamentos', '🔎 Dinheiro perdido'],
  'tool:rights': ['menu:direitos', '⚖️ Meus direitos'],
  'tool:checkin': ['menu:checkin', '📅 Check-in'],
  'tool:selos': ['mais:selos', '🏅 Meus selos'],
  'tool:frase': ['mais:frase', '✨ Frase do dia'],
  'tool:compra': ['calc:compra', '🛍️ Vale comprar?'],
  'tool:meta': ['calc:meta', '🎯 Meta'],
  'tool:longo': ['calc:longo', '📈 Longo prazo'],
  'tool:emprestimo': ['calc:emprestimo', '💳 Empréstimos'],
  'tool:dividas': ['calc:dividas', '❄️ Dívidas'],
  'tool:fatura': ['menu:fatura', '🧾 Ler fatura'],
};

// o objetivo escolhido conta como uso da ferramenta que ele abre
const GOAL_TO_EVENT: Record<string, string> = {
  'goal:divida': 'tool:dividas',
  'goal:guardar': 'tool:meta',
  'goal:gastos': 'tool:gastos',
  'goal:sobra': 'tool:leaks',
  'goal:extra': 'tool:extra',
  'goal:comprar': 'tool:compra',
  'goal:emprestimo': 'tool:emprestimo',
  'goal:direitos': 'tool:rights',
};

/** As ferramentas que a pessoa mais usa (até 3), mais usadas primeiro. */
export function topShortcuts(events: { event: string }[], faturaEnabled = false, max = 3): [string, string][] {
  const counts = new Map<string, number>();
  for (const { event } of events) {
    const key = GOAL_TO_EVENT[event] ?? event;
    if (!BY_EVENT[key] || (key === 'tool:fatura' && !faturaEnabled)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([key]) => BY_EVENT[key]);
}

/** Atalhos desta pessoa a partir do que ela já abriu (a tabela de métricas pode nem existir ainda: aí volta vazio). */
export async function loadShortcuts(phone: string, faturaEnabled: boolean): Promise<[string, string][]> {
  const res = await rest(
    `wa_events?${new URLSearchParams({ person: `eq.${personHash(phone)}`, or: '(event.like.tool:*,event.like.goal:*)', select: 'event', limit: '2000' })}`
  );
  if (!res.ok) return [];
  return topShortcuts((await res.json()) as { event: string }[], faturaEnabled);
}
