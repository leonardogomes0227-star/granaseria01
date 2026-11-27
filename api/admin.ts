// Painel do dono: números de uso do assistente do WhatsApp. Protegido por ADMIN_SECRET (variável na Vercel).
// Só lê a tabela wa_events (que guarda o hash do telefone, nunca o número).

import { rest } from '../server/whatsapp/db.js';
import { buildStats, type EventRow } from '../server/admin/stats.js';
import { createEntryLink, getFlag, getLastInbound, getProfile, listKnownPhones, listProfiles, personHash, setFlag, NOTICE_FLAG } from '../server/whatsapp/hubdb.js';
import { sendTemplate, sendText } from '../server/whatsapp/meta.js';
import { siteNoticeText, SITE_URL } from '../server/whatsapp/site.js';
import { diagnosisFrom } from '../server/whatsapp/hubcore.js';
import { saveProfile } from '../server/whatsapp/hubdb.js';
import { accountsConfigured, listUsers, saveState } from '../server/account/db.js';
import { auditarDados, restaurarMaiorCopia, type ContaGuardada } from '../server/admin/dados.js';
import { mesmoSegredo } from '../server/segredo.js';
import { resumoErro } from '../server/logSeguro.js';
import { contarLimite, excedeuLimite, ipDoCliente } from '../server/rede.js';
import { rotaAcesso, rotaCakto, rotaFilaGet, rotaFilaPost } from '../server/acesso/rotas.js';

const PAGE = 1000;
const MAX_ROWS = 100_000;

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

function acesso(request: Request): number {
  const ip = ipDoCliente(request);
  if (excedeuLimite(`admin:${ip}`, 20, 60 * 60 * 1000)) return 429;
  const sent = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!mesmoSegredo(sent, process.env.ADMIN_SECRET)) {
    contarLimite(`admin:${ip}`, 60 * 60 * 1000);
    return 401;
  }
  return 200;
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

const mascara = (phone: string) => `(${phone.slice(2, 4)}) •••••-${phone.slice(-4)}`;

/** Todos os estados guardados: os do número (wa_profiles) e os das contas de e-mail (user_state). O id não carrega o telefone. */
async function contasGuardadas(): Promise<(ContaGuardada & { gravar: (state: Record<string, string>) => Promise<void> })[]> {
  const perfis = await listProfiles();
  const usuarios = accountsConfigured() ? await listUsers().catch(() => []) : [];
  return [
    ...perfis.map((p) => ({ id: `w:${personHash(p.phone)}`, onde: 'whatsapp' as const, nome: p.state?.['gs-nome'] ?? null, rotulo: mascara(p.phone), state: p.state ?? {}, atualizadoEm: p.updated_at, gravar: (st: Record<string, string>) => saveProfile(p.phone, st) })),
    ...usuarios.map((u) => ({ id: `c:${u.user_id}`, onde: 'conta' as const, nome: u.state?.['gs-nome'] ?? null, rotulo: u.phone ? `conta · ${mascara(u.phone)}` : 'conta de e-mail', state: u.state ?? {}, atualizadoEm: u.updated_at, gravar: (st: Record<string, string>) => saveState(u.user_id, st) })),
  ];
}

export async function GET(request: Request): Promise<Response> {
  // rotas públicas de acesso (/api/fila e /api/acesso): têm a própria proteção; ver server/acesso/rotas.ts
  const rotaPublica = new URL(request.url).searchParams.get('rota');
  if (rotaPublica === 'fila') return rotaFilaGet(request);
  if (rotaPublica === 'acesso') return rotaAcesso(request);
  const status = acesso(request);
  if (status !== 200) {
    return new Response(status === 429 ? 'Muitas tentativas' : 'Unauthorized', { status, headers: { 'Cache-Control': 'no-store' } });
  }
  // ?acao=dados: alguém perdeu dados? (compara o estado de cada conta com a maior cópia de segurança guardada)
  if (new URL(request.url).searchParams.get('acao') === 'dados') {
    try {
      return Response.json(auditarDados(await contasGuardadas()), { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
      console.error('Painel: erro ao conferir os dados', err);
      return new Response('Erro ao conferir os dados', { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
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
 * POST /api/admin?acao=avisar: avisa todo mundo que já usou o bot que as ferramentas agora ficam no site, cada um com o
 * seu link de acesso (já logado). Quem mandou mensagem nas últimas 24h recebe o texto completo direto (a Meta deixa);
 * os outros, o modelo aprovado WHATSAPP_NEWS_TEMPLATE (padrão "novidade_site", com o link em {{1}}).
 * Cada pessoa recebe uma vez só; quem recebe não vê o aviso de novo no chat.
 */
export async function POST(request: Request): Promise<Response> {
  const rotaPublica = new URL(request.url).searchParams.get('rota');
  if (rotaPublica === 'fila') return rotaFilaPost(request);
  if (rotaPublica === 'cakto') return rotaCakto(request);
  const status = acesso(request);
  if (status !== 200) return new Response(status === 429 ? 'Muitas tentativas' : 'Unauthorized', { status });
  // ?acao=restaurar: devolve a maior cópia para quem perdeu dados (todas, ou só os ids do corpo). O estado de agora vira cópia.
  if (new URL(request.url).searchParams.get('acao') === 'restaurar') {
    const corpo = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const so = Array.isArray(corpo.ids) ? new Set(corpo.ids.filter((x): x is string => typeof x === 'string')) : null;
    let restauradas = 0;
    const erros: string[] = [];
    for (const c of await contasGuardadas()) {
      if (so && !so.has(c.id)) continue;
      const novo = restaurarMaiorCopia(c.state);
      if (!novo) continue;
      try { await c.gravar(novo); restauradas++; } catch (err) { if (erros.length < 3) erros.push(resumoErro(err)); }
    }
    return Response.json({ restauradas, erros });
  }
  if (new URL(request.url).searchParams.get('acao') !== 'avisar') return Response.json({ error: 'Ação desconhecida.' }, { status: 400 });
  const template = process.env.WHATSAPP_NEWS_TEMPLATE || 'novidade_site';
  const language = process.env.WHATSAPP_REMINDER_LANGUAGE || 'pt_BR';
  let direct = 0;
  let viaTemplate = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const phone of await listKnownPhones()) {
    if (await getFlag(phone, 'aviso:modelo-v1').catch(() => false)) {
      skipped++;
      continue;
    }
    try {
      const profile = await getProfile(phone).catch(() => ({}) as Record<string, string>);
      const link = `${SITE_URL}/${diagnosisFrom(profile) ? 'painel' : ''}?t=${await createEntryLink(phone)}&entrada=1`;
      const last = await getLastInbound(phone).catch(() => null);
      if (last && Date.now() - last.getTime() < 23 * 60 * 60 * 1000) {
        await sendText(phone, siteNoticeText(link, profile['gs-nome'] ?? null));
        direct++;
      } else {
        await sendTemplate(phone, template, language, [link]);
        viaTemplate++;
      }
      await setFlag(phone, 'aviso:modelo-v1', true);
      await setFlag(phone, NOTICE_FLAG, true);
    } catch (err) {
      if (errors.length < 3) errors.push(resumoErro(err));
    }
  }
  return Response.json({ sent: direct + viaTemplate, direct, viaTemplate, skipped, errors });
}
