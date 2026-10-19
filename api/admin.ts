// Painel do dono: números de uso do assistente do WhatsApp. Protegido por ADMIN_SECRET (variável na Vercel).
// Só lê a tabela wa_events (que guarda o hash do telefone, nunca o número).

import { rest } from '../server/whatsapp/db.js';
import { buildStats, type EventRow } from '../server/admin/stats.js';
import { getFlag, listKnownPhones, listProfiles, personHash, setFlag, NOTICE_FLAG } from '../server/whatsapp/hubdb.js';
import { sendTemplate } from '../server/whatsapp/meta.js';

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

function authorized(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  const sent = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return Boolean(secret && sameSecret(sent, secret));
}

export interface Person {
  name: string | null;
  phone: string; // só o final, ex.: (67) •••••-5267
  lastSeen: string | null;
  site: boolean; // já entrou no site
  tools: string[]; // ferramentas que abriu (WhatsApp e site)
}

/** Quem usa: o nome que a pessoa deu ao entrar no site, o final do número e o que ela já usou. */
async function loadPeople(events: EventRow[]): Promise<Person[]> {
  const byPerson = new Map<string, { last: string; tools: Set<string>; site: boolean }>();
  for (const e of events) {
    const p = byPerson.get(e.person) ?? { last: e.created_at, tools: new Set<string>(), site: false };
    if (e.created_at > p.last) p.last = e.created_at;
    if (e.event.startsWith('tool:')) p.tools.add(e.event.slice(5));
    if (e.event.startsWith('tool:site-') || e.event === 'site_login') p.site = true;
    byPerson.set(e.person, p);
  }
  const profiles = await listProfiles().catch(() => []);
  return profiles
    .map((pr) => {
      const ev = byPerson.get(personHash(pr.phone));
      return {
        name: pr.state?.['gs-nome'] ?? null,
        phone: `(${pr.phone.slice(2, 4)}) •••••-${pr.phone.slice(-4)}`,
        lastSeen: ev?.last ?? pr.updated_at,
        site: ev?.site ?? false,
        tools: [...(ev?.tools ?? [])].slice(0, 12),
      };
    })
    .sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const events = await loadEvents();
    return Response.json({ ...buildStats(events), people: await loadPeople(events) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Painel: erro ao ler as métricas', err);
    return new Response('Erro ao ler as métricas', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

/**
 * POST /api/admin?acao=avisar: manda pra todo mundo que já usou o bot o aviso de que as ferramentas estão no site.
 * Fora da janela de 24h só vai modelo aprovado na Meta (WHATSAPP_NEWS_TEMPLATE, padrão "novidade_site", sem variáveis).
 * Cada pessoa recebe uma vez só; quem recebe não vê o aviso de novo no chat.
 */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 });
  if (new URL(request.url).searchParams.get('acao') !== 'avisar') return Response.json({ error: 'ação desconhecida' }, { status: 400 });
  const template = process.env.WHATSAPP_NEWS_TEMPLATE || 'novidade_site';
  const language = process.env.WHATSAPP_REMINDER_LANGUAGE || 'pt_BR';
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const phone of await listKnownPhones()) {
    if (await getFlag(phone, 'aviso:modelo-v1').catch(() => false)) {
      skipped++;
      continue;
    }
    try {
      await sendTemplate(phone, template, language, []);
      await setFlag(phone, 'aviso:modelo-v1', true);
      await setFlag(phone, NOTICE_FLAG, true);
      sent++;
    } catch (err) {
      if (errors.length < 3) errors.push(String(err).slice(0, 200));
    }
  }
  return Response.json({ sent, skipped, failed: errors.length > 0 ? 'veja os erros' : 0, errors });
}
