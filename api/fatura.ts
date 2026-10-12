// Leitor de fatura/extrato com IA. Recebe o PDF ou a foto, devolve os gastos organizados e os
// "vazamentos" encontrados (assinaturas, seguros, tarifas, anuidade, juros e multas).
// O arquivo não é guardado: vai pra API do Claude, a resposta volta pro navegador e pronto.
//
// Exige login (o limite de uso por mês fica na conta) e ANTHROPIC_API_KEY na Vercel.

import { accountsConfigured, findUserById, updateUser, userIdFromToken } from '../server/account/db.js';
import { analyzeFatura, MAX_BASE64, MEDIA_TYPES, type MediaType } from '../server/fatura.js';

const MONTHLY_LIMIT = Number(process.env.FATURA_MONTHLY_LIMIT || 5);

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY || !accountsConfigured()) return json({ error: 'O leitor de fatura ainda não foi ativado.' }, 503);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const userId = token ? await userIdFromToken(token) : null;
  if (!userId) return json({ error: 'Entre na sua conta pra usar o leitor de fatura.' }, 401);

  let body: { mediaType?: string; data?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Arquivo inválido.' }, 400);
  }
  const mediaType = body.mediaType as MediaType;
  if (!MEDIA_TYPES.includes(mediaType) || typeof body.data !== 'string' || body.data.length === 0) {
    return json({ error: 'Mande um PDF ou uma foto (JPG, PNG).' }, 400);
  }
  if (body.data.length > MAX_BASE64) return json({ error: 'Arquivo grande demais (máximo 3 MB).' }, 413);

  // limite por mês, contado no servidor
  const month = new Date().toISOString().slice(0, 7);
  const user = await findUserById(userId);
  if (!user) return json({ error: 'Abra a página da sua conta uma vez antes de usar o leitor.' }, 409);
  const used = user.fatura_month === month ? user.fatura_count : 0;
  if (used >= MONTHLY_LIMIT) return json({ error: `Você já usou as ${MONTHLY_LIMIT} leituras deste mês. Volta no mês que vem!` }, 429);

  const outcome = await analyzeFatura(mediaType, body.data);
  if ('error' in outcome) return json({ error: outcome.error }, outcome.status);

  await updateUser(userId, { fatura_month: month, fatura_count: used + 1 });
  return json({ result: outcome.result, remaining: MONTHLY_LIMIT - used - 1 });
}
