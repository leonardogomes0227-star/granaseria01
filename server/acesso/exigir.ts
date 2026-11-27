// Trava de plano no servidor. Só age quando ACESSO_MODO=convite.
// Sem essa variável, o app continua aberto para quem já usa (não corta ninguém por engano).
// Com ela, rota paga e o WhatsApp consultam a tabela `acessos`. O navegador não decide.

import type { AcessoRow } from './db.js';
import { acessoDe } from './db.js';
import { decidirAcesso, type Decisao } from './decisao.js';
import { phoneFromWebLink } from '../whatsapp/hubdb.js';
import { accountsConfigured, findUserById, userIdFromToken } from '../account/db.js';

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export interface Quem {
  phone: string | null;
  email: string | null;
  criadoEm: string | null;
}

export interface ContextoPago {
  modo: string | undefined;
  quem: (token: string) => Promise<Quem | null>;
  buscar: (phone: string | null, email: string | null) => Promise<AcessoRow | null>;
  novosDesde?: string;
  corte?: string;
  agora: number;
}

/** null = pode usar. 401 = sem login. 402 = plano não está ativo. Falha de rede libera, para um pisca do banco não trancar todo mundo. */
export async function respostaSeNaoPago(token: string, ctx: ContextoPago): Promise<Response | null> {
  if (ctx.modo !== 'convite') return null;
  if (!token) return json({ error: 'Entre na sua conta para usar esta parte.' }, 401);
  let eu: Quem | null;
  try {
    eu = await ctx.quem(token);
  } catch {
    return null;
  }
  if (!eu || (!eu.phone && !eu.email)) return json({ error: 'Entre na sua conta para usar esta parte.' }, 401);
  let acesso: AcessoRow | null;
  try {
    acesso = await ctx.buscar(eu.phone, eu.email);
  } catch {
    return null;
  }
  const d: Decisao = decidirAcesso({
    acesso,
    criadoEm: eu.criadoEm,
    novosDesde: ctx.novosDesde,
    corte: ctx.corte,
    agora: ctx.agora,
  });
  if (d.estado === 'bloqueado') return json({ error: 'Esta parte faz parte do plano pago. Veja os planos para continuar.' }, 402);
  return null;
}

async function quemDoToken(token: string): Promise<Quem | null> {
  const porLink = await phoneFromWebLink(token).catch(() => null);
  if (porLink) return { phone: porLink, email: null, criadoEm: null };
  if (!accountsConfigured() || token.split('.').length !== 3) return null;
  const id = await userIdFromToken(token).catch(() => null);
  if (!id) return null;
  const user = await findUserById(id).catch(() => null);
  return { phone: user?.phone ?? null, email: null, criadoEm: null };
}

export async function exigirPlano(request: Request): Promise<Response | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  return respostaSeNaoPago(token, {
    modo: process.env.ACESSO_MODO,
    quem: quemDoToken,
    buscar: (phone, email) => acessoDe(phone, email),
    novosDesde: process.env.ACESSO_NOVOS_DESDE,
    corte: process.env.ACESSO_CORTE,
    agora: Date.now(),
  });
}

/** Mensagem para o WhatsApp quando o modo convite está ligado e a pessoa está bloqueada. null = segue o bot. */
export async function avisoDeBloqueio(phone: string, email: string | null): Promise<string | null> {
  if (process.env.ACESSO_MODO !== 'convite') return null;
  try {
    const acesso = await acessoDe(phone, email);
    const d = decidirAcesso({
      acesso,
      criadoEm: null,
      novosDesde: process.env.ACESSO_NOVOS_DESDE,
      corte: process.env.ACESSO_CORTE,
      agora: Date.now(),
    });
    if (d.estado !== 'bloqueado') return null;
    return 'Seu acesso pago não está ativo. Os planos ficam em https://www.granaseria.com.br/planos . Quando o pagamento for confirmado, é só mandar de novo.';
  } catch {
    return null;
  }
}
