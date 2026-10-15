// Painel do dono: números de uso do assistente do WhatsApp. Protegido por ADMIN_SECRET (variável na Vercel).
// Só lê a tabela wa_events (que guarda o hash do telefone, nunca o número).

import { rest } from '../server/whatsapp/db.js';
import { buildStats, type EventRow } from '../server/admin/stats.js';

const PAGE = 1000;
const MAX_ROWS = 100_000;

/** Comparação em tempo constante, pra senha errada não vazar por diferença de tempo. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function loadEvents(): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const res = await rest(
      `wa_events?${new URLSearchParams({ select: 'person,event,note,created_at', order: 'created_at.asc', limit: String(PAGE), offset: String(offset) })}`
    );
    if (!res.ok) throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as EventRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.ADMIN_SECRET;
  const sent = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !sameSecret(sent, secret)) {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    return Response.json(buildStats(await loadEvents()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Painel: erro ao ler as métricas', err);
    return new Response('Erro ao ler as métricas', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
