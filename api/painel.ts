// Painel no site, com o WhatsApp como login. O navegador manda o token do link pessoal
// ("Authorization: Bearer <token>") e recebe o que está guardado pelo número: diagnóstico, plano e vazamentos (o mesmo
// estado que o bot usa) e os gastos e entradas do mês. O que a pessoa muda no site volta por aqui (PUT).

import { phoneFromWebLink, getProfileWithDate, saveProfile, trackEvent, eraseWhatsAppData, clearWhatsAppData, HANDOFF_KEYS, sessaoDuravel, bumpUsage } from '../server/whatsapp/hubdb.js';
import { listExpensesSince, listIncomesSince } from '../server/whatsapp/db.js';
import { startOfMonthBRT } from '../server/whatsapp/bot.js';
import { accountsConfigured, definirCodigoDeVinculo, findUserByPhone, saveState, userIdFromToken, type StateSnapshot } from '../server/account/db.js';
import { novoCodigoVinculo } from '../server/linkEntrada.js';
import { contarLimite, excedeuLimite, ipDoCliente } from '../server/rede.js';
import { PLAN_KEYS, RESET_ID, RESET_KEY, resetIfOld } from '../src/reset.js';
import { limparMesesFuturos } from '../src/lib/mesesFuturos.js';
import { foiMantido, listarCopias, protegerEstado } from '../server/protegerEstado.js';
import { pesoDoEstado } from '../src/gs/pesoEstado.js';

const MAX_BYTES = 500_000; // o estado do app novo cresce com lançamentos e conversa de investimentos
const PRIVADO = { 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: PRIVADO });

async function auth(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  return token ? phoneFromWebLink(token).catch(() => null) : null;
}

/** Quem vinculou a conta do site guarda o estado na conta; quem não vinculou, no perfil do número. */
async function loadState(phone: string): Promise<{ state: StateSnapshot; updatedAt: string | null; userId: string | null }> {
  const user = accountsConfigured() ? await findUserByPhone(phone).catch(() => null) : null;
  const loaded = user
    ? { state: user.state ?? {}, updatedAt: user.updated_at, userId: user.user_id }
    : await getProfileWithDate(phone).then((p) => ({ state: p.state, updatedAt: p.updated_at, userId: null }));
  // recomeço do plano (src/reset.ts): uma vez por pessoa, o plano antigo sai
  const reset = resetIfOld(loaded.state);
  // e nunca mês futuro (src/lib/mesesFuturos.ts): o que foi fechado antes da hora sai, com backup no próprio estado
  const clean = limparMesesFuturos(reset.state);
  if (!reset.changed && !clean.changed) return loaded;
  await (loaded.userId ? saveState(loaded.userId, clean.state) : saveProfile(phone, clean.state));
  return { state: clean.state, updatedAt: new Date().toISOString(), userId: loaded.userId };
}

const masked = (phone: string) => `(${phone.slice(2, 4)}) •••••-${phone.slice(-4)}`;

/** Código de vínculo do WhatsApp. O navegador manda o token da sessão de e-mail; o código nasce aqui, com entropia de verdade. */
async function criarVinculo(request: Request): Promise<Response> {
  if (!accountsConfigured()) return json({ error: 'Conta indisponível.' }, 503);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const ip = ipDoCliente(request);
  if (excedeuLimite(`vinculo-ip:${ip}`, 30, 60 * 60 * 1000)) return json({ error: 'Muitas tentativas. Espere um pouco.' }, 429);
  const userId = token ? await userIdFromToken(token).catch(() => null) : null;
  if (!userId) {
    contarLimite(`vinculo-ip:${ip}`, 60 * 60 * 1000);
    return json({ error: 'Entre na sua conta para vincular o WhatsApp.' }, 401);
  }
  try {
    if (!(await bumpUsage(`user:${userId}`, `novocodigo:${new Date().toISOString().slice(0, 13)}`, 5))) {
      return json({ error: 'Você já gerou vários códigos. Espere um pouco e tente de novo.' }, 429);
    }
  } catch {
    return json({ error: 'Não consegui gerar o código agora.' }, 503);
  }
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  for (let i = 0; i < 3; i++) {
    try {
      const code = novoCodigoVinculo();
      await definirCodigoDeVinculo(userId, code, expires);
      return json({ code, expires });
    } catch (err) {
      if (i === 2 || !String(err).includes('código em uso')) {
        console.error('vínculo: não gravei o código');
        return json({ error: 'Não consegui gerar o código agora.' }, 502);
      }
    }
  }
  return json({ error: 'Não consegui gerar o código agora.' }, 502);
}

export async function GET(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'link inválido ou expirado' }, 401);
  const url = new URL(request.url);
  // ?copias=1: as cópias de segurança guardadas, para a tela "Recuperar dados" (Meus dados)
  if (url.searchParams.get('copias') === '1') return json({ copias: listarCopias((await loadState(phone)).state) });
  // ?entrada=1: o ?t= da mensagem era de uso curto. Devolve o token longo, que só fica no navegador.
  const bruto = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const duravel = url.searchParams.get('entrada') === '1' ? await sessaoDuravel(bruto).catch(() => null) : null;
  const now = new Date();
  const since = startOfMonthBRT(now);
  const [{ state, updatedAt }, expenses, incomes] = await Promise.all([
    loadState(phone),
    listExpensesSince(phone, since),
    listIncomesSince(phone, since).catch(() => []),
  ]);
  // o id vai junto pra o site poder editar e apagar (api/lancamentos.ts)
  const pick = (r: { id: number; amount: number; created_at: string; description: string }) => ({ id: r.id, amount: r.amount, created_at: r.created_at, description: r.description });
  // estado do app em branco no servidor: não se apresenta como "mais novo", para nenhum aparelho com dados (nem
  // uma aba aberta com uma versão antiga do site) trocar os seus dados por ele; o aparelho então manda os dados de volta
  const vazio = pesoDoEstado(state['grana-seria:v1']) === 0;
  return json({
    phone: masked(phone),
    state: vazio ? Object.fromEntries(Object.entries(state).filter(([k]) => k !== 'grana-seria:v1' && !k.startsWith('grana-seria:v1:backup'))) : Object.fromEntries(Object.entries(state).filter(([k]) => !k.startsWith('grana-seria:v1:backup'))),
    updatedAt: vazio ? null : updatedAt,
    month: {
      expenses: expenses.map((e) => ({ ...pick(e), category: e.category, method: e.payment_method ?? null })),
      incomes: incomes.map((i) => ({ ...pick(i), source: i.source, method: i.method ?? null })),
    },
    ...(duravel ? { token: duravel } : {}),
  });
}

export async function PUT(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'link inválido ou expirado' }, 401);
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return json({ error: 'grande demais' }, 413);
  let body: { state?: Record<string, unknown>; permitirReducao?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const { state, userId } = await loadState(phone);
  // só as chaves do site, só texto; o resto do perfil (coisas do bot) fica como está
  const next: StateSnapshot = { ...state };
  // navegador que ainda não passou pelo recomeço não devolve o plano antigo
  const stale = body.state?.[RESET_KEY] !== RESET_ID;
  for (const k of HANDOFF_KEYS) {
    if (stale && (PLAN_KEYS.includes(k) || k === RESET_KEY)) continue;
    const v = body.state?.[k];
    if (typeof v === 'string') next[k] = v;
    else if (v === null) delete next[k];
  }
  // proteção: um estado em branco não apaga um com dados, e o anterior fica guardado como cópia de segurança
  const protegido = protegerEstado(state, next, new Date(), body.permitirReducao === true);
  await (userId ? saveState(userId, protegido) : saveProfile(phone, protegido));
  // mantido: o servidor não aceitou trocar os dados por um estado bem menor; o aparelho busca o da conta em vez de insistir
  return json({ updatedAt: new Date().toISOString(), mantido: foiMantido(state, next, protegido) });
}

/**
 * O que a pessoa faz no site, pro painel do dono (mesma tabela de eventos do WhatsApp, só com o hash do número):
 * { event: "tool:site-debts" } quando abre uma ferramenta, e { feedback: { tool, kind: "up"|"down", note? } }.
 */
export async function POST(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.get('acao') === 'vincular') return criarVinculo(request);
  const phone = await auth(request);
  if (!phone) return json({ error: 'link inválido ou expirado' }, 401);
  let body: { event?: unknown; feedback?: { tool?: unknown; kind?: unknown; note?: unknown } };
  try {
    body = JSON.parse((await request.text()).slice(0, 4000));
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const safe = (v: unknown) => (typeof v === 'string' && /^[a-z0-9:_-]{1,48}$/.test(v) ? v : null);
  const event = safe(body.event);
  if (event) await trackEvent(phone, event);
  const fb = body.feedback;
  const tool = safe(fb?.tool);
  if (tool && (fb?.kind === 'up' || fb?.kind === 'down')) {
    const note = typeof fb.note === 'string' && fb.note.trim() ? fb.note.trim().slice(0, 600) : undefined;
    await trackEvent(phone, `feedback:${fb.kind}:site-${tool}`, note);
  }
  return json({ ok: true });
}

/** "Limpar tudo" (?manter=1) e "Apagar conta e desconectar" do site (Meus dados): remove a cópia guardada pelo número (LGPD) e esvazia o estado da conta vinculada, se houver. */
export async function DELETE(request: Request): Promise<Response> {
  const phone = await auth(request);
  if (!phone) return json({ error: 'link inválido ou expirado' }, 401);
  try {
    const user = accountsConfigured() ? await findUserByPhone(phone) : null;
    if (user) await saveState(user.user_id, {});
    // ?manter=1 ("Limpar tudo"): esvazia os dados e mantém o acesso (link do painel e conta). Sem isso: apaga também o acesso.
    if (new URL(request.url).searchParams.get('manter') === '1') await clearWhatsAppData(phone);
    else await eraseWhatsAppData(phone);
  } catch (err) {
    console.error('painel: não consegui apagar', err);
    return json({ error: 'não consegui apagar agora' }, 502);
  }
  return new Response(null, { status: 204 });
}
