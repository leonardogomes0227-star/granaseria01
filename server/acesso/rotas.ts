// As três rotas de acesso, atrás de um único arquivo em api/ (a Vercel só aceita 12 funções). Os endereços de fora não mudam:
// /api/fila, /api/cakto e /api/acesso viram /api/admin?rota=... pelas regras de reescrita do vercel.json.
//  - fila:   cadastro público (nome + WhatsApp), posição, validação de convite e, para o dono, chamar os próximos.
//  - cakto:  aviso de pagamento (webhook), protegido por CAKTO_WEBHOOK_SECRET.
//  - acesso: o app pergunta se a pessoa está liberada, assinando, no prazo ou sem acesso. Na dúvida, libera.

import { acessoDe, convidarProximos, conviteValido, entrarNaFila, gravarAcesso, normalizarFone, situacaoDe, totalNaFila } from './db.js';
import { interpretarAviso } from './cakto.js';
import { decidirAcesso } from './decisao.js';
import { accountsConfigured, findUserById } from '../account/db.js';
import { phoneFromWebLink } from '../whatsapp/hubdb.js';
import { mesmoSegredo } from '../segredo.js';
import { contarLimite, excedeuLimite, ipDoCliente } from '../rede.js';
import { rest } from '../whatsapp/db.js';

const jsonFila = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const CODIGO = /^[A-Z0-9]{6}$/;
const MAX_BYTES = 2_000;

const ehDono = (request: Request) => mesmoSegredo(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '', process.env.ADMIN_SECRET);

function indisponivel(erro: unknown): Response {
  console.error('fila:', erro instanceof Error ? erro.message : erro);
  return jsonFila({ error: 'A fila está fora do ar por um instante. Tente de novo em alguns minutos.' }, 503);
}

export async function rotaFilaGet(request: Request): Promise<Response> {
  if (!accountsConfigured()) return jsonFila({ error: 'A fila ainda não está ligada.' }, 503);
  const q = new URL(request.url).searchParams;
  try {
    const consulta = q.get('codigo') || q.get('convite');
    if (consulta) {
      // consultar códigos um a um para descobrir os que valem: no máximo 60 por hora por pessoa
      const ip = ipDoCliente(request);
      if (excedeuLimite(`filaget:${ip}`, 60, 60 * 60 * 1000)) return jsonFila({ error: 'Muitas consultas. Espere um pouco.' }, 429);
      contarLimite(`filaget:${ip}`, 60 * 60 * 1000);
    }
    const codigo = (q.get('codigo') ?? '').toUpperCase();
    if (codigo) {
      if (!CODIGO.test(codigo)) return jsonFila({ error: 'Código inválido.' }, 400);
      const s = await situacaoDe(codigo);
      return s ? jsonFila(s) : jsonFila({ error: 'Não achei esse código.' }, 404);
    }
    const convite = (q.get('convite') ?? '').toUpperCase();
    if (convite) return CODIGO.test(convite) ? jsonFila(await conviteValido(convite)) : jsonFila({ valido: false, ate: null });
    if (q.get('total')) return jsonFila({ total: await totalNaFila() });
    if (q.get('lista')) {
      if (!ehDono(request)) return jsonFila({ error: 'Não autorizado.' }, 401);
      const res = await rest(`fila_espera?${new URLSearchParams({ select: 'nome,whatsapp,codigo,status,convite_ate,criado_em,indicado_por', order: 'id.asc', limit: '5000' })}`);
      return jsonFila(await res.json());
    }
    return jsonFila({ error: 'Pedido inválido.' }, 400);
  } catch (e) {
    return indisponivel(e);
  }
}

export async function rotaFilaPost(request: Request): Promise<Response> {
  if (!accountsConfigured()) return jsonFila({ error: 'A fila ainda não está ligada.' }, 503);
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return jsonFila({ error: 'Pedido grande demais.' }, 413);
  let body: { acao?: string; nome?: string; whatsapp?: string; ref?: string; quantidade?: number; dias?: number };
  try { body = JSON.parse(raw); } catch { return jsonFila({ error: 'Não entendi o pedido.' }, 400); }

  try {
    if (body.acao === 'convidar') {
      if (!ehDono(request)) return jsonFila({ error: 'Não autorizado.' }, 401);
      const quantidade = Math.min(500, Math.max(1, Math.floor(Number(body.quantidade) || 50)));
      const dias = Math.min(30, Math.max(1, Math.floor(Number(body.dias) || 7)));
      const chamados = await convidarProximos(quantidade, dias);
      return jsonFila({ chamados: chamados.map((c) => ({ nome: c.nome, whatsapp: c.whatsapp, codigo: c.codigo, ate: c.convite_ate })), total: chamados.length });
    }

    const ip = ipDoCliente(request);
    if (excedeuLimite(`fila:${ip}`, 8, 60 * 60 * 1000)) return jsonFila({ error: 'Muitas tentativas. Espere um pouco.' }, 429);
    contarLimite(`fila:${ip}`, 60 * 60 * 1000);
    const nome = (body.nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const fone = normalizarFone(body.whatsapp ?? '');
    if (nome.length < 2) return jsonFila({ error: 'Diga seu nome.' }, 400);
    if (!fone) return jsonFila({ error: 'Esse WhatsApp não parece certo. Use o DDD e o número, por exemplo (67) 99999-9999.' }, 400);
    const ref = (body.ref ?? '').toUpperCase();
    const { row, novo } = await entrarNaFila(nome, fone, CODIGO.test(ref) ? ref : undefined);
    const s = await situacaoDe(row.codigo);
    return jsonFila({ codigo: row.codigo, novo, ...(s ?? {}) });
  } catch (e) {
    return indisponivel(e);
  }
}


const ok = (extra: Record<string, unknown> = {}) => Response.json({ ok: true, ...extra }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export async function rotaCakto(request: Request): Promise<Response> {
  if (!process.env.CAKTO_WEBHOOK_SECRET) return Response.json({ error: 'Webhook não configurado.' }, { status: 503 });
  if (!accountsConfigured()) return Response.json({ error: 'Contas não configuradas.' }, { status: 503 });
  const ip = ipDoCliente(request);
  if (excedeuLimite(`cakto:${ip}`, 120, 60 * 60 * 1000)) return Response.json({ error: 'Muitas chamadas.' }, { status: 429 });
  contarLimite(`cakto:${ip}`, 60 * 60 * 1000);

  const raw = await request.text();
  if (raw.length > 200_000) return Response.json({ error: 'Grande demais.' }, { status: 413 });
  let corpo: Obj;
  try { corpo = obj(JSON.parse(raw)); } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const doCorpo = txt(corpo.secret);
  const doCabecalho = request.headers.get('x-cakto-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const enviado = doCorpo || doCabecalho;
  if (!mesmoSegredo(enviado, process.env.CAKTO_WEBHOOK_SECRET)) {
    // só o lugar e o tamanho do que chegou, nunca a chave: aparece na janela de teste da Cakto e ajuda a achar a diferença
    const lugar = doCorpo ? 'corpo' : doCabecalho ? 'cabecalho' : 'nenhum';
    console.warn('cakto: segredo não bateu', lugar, enviado.length);
    return Response.json({ error: 'Não autorizado.', recebido: { lugar, caracteres: enviado.length }, campos_do_aviso: Object.keys(corpo).slice(0, 12) }, { status: 401 });
  }

  const av = interpretarAviso(corpo);
  console.log('cakto:', av.evento || '(sem evento)', av.plano, av.fundador ? 'fundador' : 'normal', av.aprovado ? 'ativa' : av.encerrado ? 'encerra' : 'ignorado');
  if (!av.aprovado && !av.encerrado) return ok({ ignorado: true });
  if (!av.email && !av.fone) return ok({ ignorado: true, motivo: 'sem telefone nem e-mail' });
  try {
    await gravarAcesso({ whatsapp: av.fone, email: av.email, plano: av.plano, fundador: av.fundador, status: av.aprovado ? 'ativo' : 'cancelado', validoAte: av.validoAte, ref: av.ref });
  } catch (e) {
    console.error('cakto: erro ao gravar', e instanceof Error ? e.message : e);
    return Response.json({ error: 'Não consegui gravar.' }, { status: 500 }); // a Cakto tenta de novo
  }
  return ok();
}

const jsonAcesso = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function quemE(token: string): Promise<{ phone: string | null; email: string | null; criadoEm: string | null } | null> {
  const porLink = await phoneFromWebLink(token).catch(() => null);
  if (porLink) return { phone: porLink, email: null, criadoEm: null };
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave || token.split('.').length !== 3) return null;
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: chave, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; email?: string | null; phone?: string | null; created_at?: string };
  let phone = u.phone ? u.phone.replace(/\D/g, '') : null;
  if (!phone && u.id) phone = (await findUserById(u.id).catch(() => null))?.phone ?? null;
  return { phone, email: u.email ?? null, criadoEm: u.created_at ?? null };
}

export async function rotaAcesso(request: Request): Promise<Response> {
  if (process.env.ACESSO_MODO !== 'convite') return jsonAcesso({ estado: 'liberado' });
  if (!accountsConfigured()) return jsonAcesso({ estado: 'liberado' });
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!token) return jsonAcesso({ estado: 'liberado' });
  try {
    const eu = await quemE(token);
    if (!eu || (!eu.phone && !eu.email)) return jsonAcesso({ estado: 'liberado' });
    const a = await acessoDe(eu.phone, eu.email);
    return jsonAcesso(decidirAcesso({ acesso: a, criadoEm: eu.criadoEm, novosDesde: process.env.ACESSO_NOVOS_DESDE, corte: process.env.ACESSO_CORTE, agora: Date.now() }));
  } catch (e) {
    console.error('acesso:', e instanceof Error ? e.message : e);
    return jsonAcesso({ estado: 'liberado' });
  }
}
