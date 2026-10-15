// Pedido de feedback automático: depois de alguns dias de uso, o bot pergunta como está sendo.
// Regra (pura, em shouldAskFeedback): só pergunta quem já usou de verdade, no máximo 3 vezes por pessoa,
// com 14 dias entre elas, e nunca logo depois de a pessoa ter dado um feedback.

import { rest } from './db.js';
import { personHash } from './hubdb.js';
import { buttons } from './hubcore.js';
import type { Outgoing } from './meta.js';

export interface FeedbackEvent {
  event: string;
  created_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const MIN_MESSAGES = 6; // com 2 dias de uso diferentes…
const MIN_MESSAGES_ONE_DAY = 12; // …ou, se foi tudo num dia só, mais mensagens
const REASK_AFTER_DAYS = 14;
const MAX_ASKS = 3;
const QUIET_AFTER_FEEDBACK_DAYS = 2;

const dayOf = (ms: number) => new Date(ms - BRT_OFFSET_MS).toISOString().slice(0, 10);

export function shouldAskFeedback(events: FeedbackEvent[], now = Date.now()): boolean {
  const msgTimes: number[] = [];
  const asks: number[] = [];
  let lastFeedback = 0;
  for (const e of events) {
    const t = new Date(e.created_at).getTime();
    if (e.event === 'msg') msgTimes.push(t);
    else if (e.event === 'fb_ask') asks.push(t);
    else if (e.event.startsWith('feedback:')) lastFeedback = Math.max(lastFeedback, t);
  }
  if (now - lastFeedback < QUIET_AFTER_FEEDBACK_DAYS * DAY_MS) return false; // acabou de avaliar (ou de responder o pedido)
  if (asks.length >= MAX_ASKS) return false;
  const lastAsk = asks.length ? Math.max(...asks) : 0;
  if (asks.length && now - lastAsk < REASK_AFTER_DAYS * DAY_MS) return false;

  // só conta o uso depois do último pedido: na segunda vez, a pessoa precisa ter voltado a usar
  const since = msgTimes.filter((t) => t > lastAsk);
  const days = new Set(since.map(dayOf)).size;
  return (days >= 2 && since.length >= MIN_MESSAGES) || since.length >= MIN_MESSAGES_ONE_DAY;
}

export const FEEDBACK_ASK: Outgoing = buttons(
  'Faz uns dias que a gente conversa. 🙂 Queria saber de você, de coração: como está sendo usar a Grana Séria?',
  [
    ['fb:up:geral', '😀 Está ajudando'],
    ['fb:down:geral', '😕 Falta algo'],
  ]
);

/** Eventos do uso e dos pedidos de feedback desta pessoa (a tabela pode nem existir ainda: aí devolve vazio). */
export async function loadFeedbackEvents(phone: string): Promise<FeedbackEvent[]> {
  const res = await rest(
    `wa_events?${new URLSearchParams({
      person: `eq.${personHash(phone)}`,
      or: '(event.eq.msg,event.eq.fb_ask,event.like.feedback:*)',
      select: 'event,created_at',
      order: 'created_at.asc',
      limit: '5000',
    })}`
  );
  if (!res.ok) return [];
  return (await res.json()) as FeedbackEvent[];
}
