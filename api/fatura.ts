// Leitor de fatura/extrato com IA. Recebe o PDF ou a foto, devolve os gastos organizados e os
// "vazamentos" encontrados (assinaturas, seguros, tarifas, anuidade, juros e multas).
// O arquivo não é guardado: vai pra API do Claude, a resposta volta pro navegador e pronto.
//
// Exige login (o limite de uso por mês fica na conta) e ANTHROPIC_API_KEY na Vercel.
//
// Também faz o "Anotar por foto" do botão + (POST com { tipo: 'comprovante' }): a mesma leitura de cupom e pix do
// WhatsApp (server/receipt.ts). Fica neste arquivo, e não num novo, porque o plano da Vercel aceita no máximo 12 funções.

import { accountsConfigured, findUserById, updateUser, userIdFromToken } from '../server/account/db.js';
import { analyzeFatura, MAX_BASE64, MEDIA_TYPES, type MediaType } from '../server/fatura.js';
import { bumpUsage, phoneFromWebLink } from '../server/whatsapp/hubdb.js';
import { analyzeReceipt } from '../server/receipt.js';
import { todaySP } from '../src/coachChat/months.js';

const MONTHLY_LIMIT = Number(process.env.FATURA_MONTHLY_LIMIT || 5);
const COMPROVANTE_DAILY_LIMIT = Number(process.env.COMPROVANTE_DAILY_LIMIT || 20);

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** O site pergunta se o leitor está ligado: sem a chave da IA, a ferramenta nem aparece na lista. */
export async function GET(): Promise<Response> {
  return json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY) && accountsConfigured(), comprovante: Boolean(process.env.ANTHROPIC_API_KEY) }, 200);
}

/** Quem manda a foto: pelo link do WhatsApp (telefone) ou pelo login de e-mail. */
async function quem(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!token) return null;
  const phone = await phoneFromWebLink(token).catch(() => null);
  if (phone) return phone;
  if (!accountsConfigured()) return null;
  const id = await userIdFromToken(token).catch(() => null);
  return id ? `user:${id}` : null;
}

/** "Anotar por foto": UM pagamento (cupom, nota, pix). A pessoa confere no app antes de salvar; o arquivo não é guardado. */
async function comprovante(request: Request, body: { mediaType?: string; data?: string }): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'A leitura por foto ainda não foi ativada no site. Mande a foto pelo WhatsApp ou anote o valor.' }, 503);
  const chave = await quem(request);
  if (!chave) return json({ error: 'Entre na sua conta para ler a foto.' }, 401);
  const mediaType = body.mediaType as MediaType;
  if (!MEDIA_TYPES.includes(mediaType) || typeof body.data !== 'string' || !body.data) return json({ error: 'Mande uma foto (JPG, PNG) ou um PDF.' }, 400);
  if (body.data.length > MAX_BASE64) return json({ error: 'Foto grande demais (máximo 3 MB).' }, 413);
  if (!(await bumpUsage(chave, `comprovante:${todaySP()}`, COMPROVANTE_DAILY_LIMIT).catch(() => true))) return json({ error: 'Por hoje chega de fotos. Amanhã tem mais; por enquanto, anote o valor.' }, 429);
  const r = await analyzeReceipt(mediaType, body.data);
  if (!r.ok) return json({ error: r.error }, 422);
  if (r.receipt.tipo === 'fatura_extrato') return json({ error: 'Isso parece uma fatura com várias compras. Use "Importar fatura" no cartão.', fatura: true }, 422);
  if (r.receipt.tipo === 'outro' || !(r.receipt.valor > 0)) return json({ error: 'Não achei um valor nessa foto. Tente outra mais nítida, ou anote à mão.' }, 422);
  return json({ comprovante: r.receipt });
}

export async function POST(request: Request): Promise<Response> {
  let body: { mediaType?: string; data?: string; tipo?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Arquivo inválido.' }, 400);
  }
  if (body.tipo === 'comprovante') return comprovante(request, body);
  if (!process.env.ANTHROPIC_API_KEY || !accountsConfigured()) return json({ error: 'O leitor de fatura ainda não foi ativado.' }, 503);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const userId = token ? await userIdFromToken(token) : null;
  if (!userId) return json({ error: 'Entre na sua conta pra usar o leitor de fatura.' }, 401);
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
