// Webhook do assistente de gastos pelo WhatsApp.
// URL na Vercel: https://<seu-site>.vercel.app/api/whatsapp
//
// GET  → verificação do webhook pela Meta (uma vez, ao configurar)
// POST → mensagens recebidas

import { extractTextMessages, isAllowed, normalizeBrPhone, sendText, verifySignature } from '../server/whatsapp/meta.js';
import { handleText } from '../server/whatsapp/bot.js';
import { findUserByPhone, insertExpense, listExpensesSince, deleteLastExpense } from '../server/whatsapp/db.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !(await verifySignature(raw, request.headers.get('x-hub-signature-256'), appSecret))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const { texts, others } = extractTextMessages(payload);

  for (const msg of texts) {
    // Fase de teste: só os números liberados em ALLOWED_NUMBERS usam o assistente. O resto é ignorado em silêncio.
    if (!isAllowed(msg.from, process.env.ALLOWED_NUMBERS)) continue;
    try {
      const reply = await handleText(
        { id: msg.id, phone: normalizeBrPhone(msg.from), text: msg.text },
        {
          findUserByPhone,
          insertExpense,
          listExpensesSince,
          deleteLastExpense,
          signupUrl: process.env.SITE_URL ? `${process.env.SITE_URL.replace(/\/$/, '')}/cadastro` : undefined,
        }
      );
      if (reply) await sendText(msg.from, reply);
    } catch (err) {
      console.error('Erro ao processar mensagem', msg.id, err);
      try {
        await sendText(msg.from, '⚠️ Tive um problema pra registrar agora. Tenta de novo em alguns minutos.');
      } catch {
        // se nem a resposta de erro sai, só fica no log
      }
    }
  }

  for (const msg of others) {
    if (!isAllowed(msg.from, process.env.ALLOWED_NUMBERS)) continue;
    try {
      await sendText(msg.from, 'Por enquanto eu só entendo texto. ✍️ Ex.: "gastei 35 no mercado"');
    } catch (err) {
      console.error('Erro ao responder mensagem não-texto', msg.id, err);
    }
  }

  // Sempre 200: se a Meta receber erro, ela reenvia a mesma mensagem várias vezes.
  return new Response('OK', { status: 200 });
}
