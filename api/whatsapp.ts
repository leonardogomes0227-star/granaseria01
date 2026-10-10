// Webhook do assistente de gastos pelo WhatsApp.
// URL na Vercel: https://<seu-site>.vercel.app/api/whatsapp
//
// GET  → verificação do webhook pela Meta (uma vez, ao configurar)
// POST → mensagens recebidas

import { extractTextMessages, isAllowed, normalizeBrPhone, sendText, verifySignature } from '../server/whatsapp/meta.js';
import { handleText, HELP_TEXT } from '../server/whatsapp/bot.js';
import { insertExpense, listExpensesSince, deleteLastExpense } from '../server/whatsapp/db.js';
import { parsePlanCommand, runPlanCommand, PLAN_HELP } from '../server/whatsapp/planbot.js';
import { parseMessage } from '../server/whatsapp/parse.js';
import { accountsConfigured, findUserByPhone, linkPhoneByCode, markProcessed, saveState, updateUser } from '../server/account/db.js';

const SITE_URL = (process.env.SITE_URL || 'https://granaseria.com.br').replace(/\/$/, '');

/**
 * Responde uma mensagem de texto. Quem vinculou a conta no site usa tudo (plano + gastos);
 * quem não vinculou só usa se estiver em ALLOWED_NUMBERS (fase de teste) — ou manda "vincular <código>".
 */
async function reply(msg: { id: string; from: string; text: string }): Promise<string | null> {
  const phone = normalizeBrPhone(msg.from);
  const cmd = parsePlanCommand(msg.text);
  const accounts = accountsConfigured();

  if (cmd?.kind === 'link') {
    if (!accounts) return null;
    if (!(await markProcessed(msg.id))) return null;
    const ok = await linkPhoneByCode(cmd.code, phone);
    return ok
      ? `✅ WhatsApp vinculado à sua conta Grana Séria!\n\nEscolha no site o dia do lembrete (o dia em que seu salário cai) ou mande, por exemplo, *lembrete 5*.\n${PLAN_HELP}`
      : `Esse código não vale mais (ele dura 30 minutos). Gere um novo em ${SITE_URL}/conta.`;
  }

  const user = accounts ? await findUserByPhone(phone) : null;
  if (!user && !isAllowed(msg.from, process.env.ALLOWED_NUMBERS)) return null;

  if (cmd) {
    if (!user) return `Pra usar o plano por aqui, vincule seu WhatsApp em ${SITE_URL}/conta.`;
    if (!(await markProcessed(msg.id))) return null; // reenvio da Meta: não fecha o mês duas vezes
    switch (cmd.kind) {
      case 'reminderDay':
        await updateUser(user.user_id, { reminder_day: cmd.day, reminders: true });
        return `🔔 Combinado: lembrete todo dia ${cmd.day}.`;
      case 'remindersOff':
        await updateUser(user.user_id, { reminders: false });
        return '🔕 Lembretes desligados. Pra voltar, mande *voltar lembretes*.';
      case 'remindersOn':
        await updateUser(user.user_id, { reminders: true });
        return user.reminder_day ? `🔔 Lembretes ligados: todo dia ${user.reminder_day}.` : '🔔 Lembretes ligados. Qual dia? Mande, por exemplo, *lembrete 5*.';
      default: {
        const result = runPlanCommand(cmd, user.state ?? {});
        if (result.newState) await saveState(user.user_id, result.newState);
        return result.reply;
      }
    }
  }

  // ajuda mostra também os comandos do plano pra quem tem conta
  if (user && parseMessage(msg.text).kind === 'help') return HELP_TEXT + '\n' + PLAN_HELP;

  return handleText({ id: msg.id, phone, text: msg.text }, { insertExpense, listExpensesSince, deleteLastExpense });
}

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
    try {
      const text = await reply(msg);
      if (text) await sendText(msg.from, text);
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
    const linked = accountsConfigured() ? await findUserByPhone(normalizeBrPhone(msg.from)).catch(() => null) : null;
    if (!linked && !isAllowed(msg.from, process.env.ALLOWED_NUMBERS)) continue;
    try {
      await sendText(msg.from, 'Por enquanto eu só entendo texto. ✍️ Ex.: "gastei 35 no mercado"');
    } catch (err) {
      console.error('Erro ao responder mensagem não-texto', msg.id, err);
    }
  }

  // Sempre 200: se a Meta receber erro, ela reenvia a mesma mensagem várias vezes.
  return new Response('OK', { status: 200 });
}
