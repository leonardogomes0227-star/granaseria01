// "Anotar por foto" no site: a mesma leitura de cupom e comprovante de pix do WhatsApp (server/receipt.ts).
// O navegador manda a foto, a IA devolve valor, descrição, categoria e data, e a PESSOA confere antes de salvar.
// O arquivo não é guardado. Exige login (link do WhatsApp ou e-mail) e ANTHROPIC_API_KEY; limite por dia.

import { bumpUsage, phoneFromWebLink } from '../server/whatsapp/hubdb.js';
import { accountsConfigured, userIdFromToken } from '../server/account/db.js';
import { analyzeReceipt } from '../server/receipt.js';
import { MAX_BASE64, MEDIA_TYPES, type MediaType } from '../server/fatura.js';
import { todaySP } from '../src/coachChat/months.js';

const DAILY_LIMIT = Number(process.env.COMPROVANTE_DAILY_LIMIT || 20);
const json = (body: unknown, status = 200) => Response.json(body, { status });

async function quem(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!token) return null;
  const phone = await phoneFromWebLink(token).catch(() => null);
  if (phone) return phone;
  if (!accountsConfigured()) return null;
  const id = await userIdFromToken(token).catch(() => null);
  return id ? `user:${id}` : null;
}

export async function GET(): Promise<Response> {
  return json({ ativo: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'A leitura por foto ainda não foi ativada no site. Mande a foto pelo WhatsApp ou anote o valor.' }, 503);
  const chave = await quem(request);
  if (!chave) return json({ error: 'Entre na sua conta para ler a foto.' }, 401);
  let body: { mediaType?: string; data?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Arquivo inválido.' }, 400);
  }
  const mediaType = body.mediaType as MediaType;
  if (!MEDIA_TYPES.includes(mediaType) || typeof body.data !== 'string' || !body.data) return json({ error: 'Mande uma foto (JPG, PNG) ou um PDF.' }, 400);
  if (body.data.length > MAX_BASE64) return json({ error: 'Foto grande demais (máximo 3 MB).' }, 413);
  if (!(await bumpUsage(chave, `comprovante:${todaySP()}`, DAILY_LIMIT).catch(() => true))) return json({ error: 'Por hoje chega de fotos. Amanhã tem mais; por enquanto, anote o valor.' }, 429);
  const r = await analyzeReceipt(mediaType, body.data);
  if (!r.ok) return json({ error: r.error }, 422);
  if (r.receipt.tipo === 'fatura_extrato') return json({ error: 'Isso parece uma fatura com várias compras. Use "Importar fatura" no cartão.', fatura: true }, 422);
  if (r.receipt.tipo === 'outro' || !(r.receipt.valor > 0)) return json({ error: 'Não achei um valor nessa foto. Tente outra mais nítida, ou anote à mão.' }, 422);
  return json({ comprovante: r.receipt });
}
