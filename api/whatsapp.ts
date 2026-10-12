// Webhook do assistente de gastos pelo WhatsApp.
// URL na Vercel: https://<seu-site>.vercel.app/api/whatsapp
//
// GET  → verificação do webhook pela Meta (uma vez, ao configurar)
// POST → mensagens recebidas

import { extractTextMessages, isAllowed, normalizeBrPhone, sendOutgoing, sendText, verifySignature, type Outgoing } from '../server/whatsapp/meta.js';
import { handleText, HELP_TEXT } from '../server/whatsapp/bot.js';
import { insertExpense, listExpensesSince, deleteLastExpense, updateLastExpense } from '../server/whatsapp/db.js';
import { askClaude, smartConfigured } from '../server/whatsapp/smart.js';
import { hubStep } from '../server/whatsapp/hub.js';
import { bumpUsage, clearSession, getProfile, getSession, saveProfile, saveSession } from '../server/whatsapp/hubdb.js';
import { parsePlanCommand, runPlanCommand, PLAN_HELP } from '../server/whatsapp/planbot.js';
import { parseMessage } from '../server/whatsapp/parse.js';
import { accountsConfigured, findUserByPhone, linkPhoneByCode, markProcessed, saveState, updateUser, type StateSnapshot, type UserRow } from '../server/account/db.js';

const SITE_URL = (process.env.SITE_URL || 'https://granaseria.com.br').replace(/\/$/, '');

const AI_DAILY_LIMIT = Number(process.env.WHATSAPP_AI_DAILY_LIMIT || 40);
const text = (t: string): Outgoing[] => [{ kind: 'text', text: t }];

/** Conversa em andamento + dados da pessoa. Se as tabelas novas ainda não existem, o hub fica desligado e o resto segue. */
async function loadHub(user: UserRow | null, phone: string): Promise<{ session: Awaited<ReturnType<typeof getSession>>; profile: StateSnapshot } | null> {
  try {
    const [session, profile] = await Promise.all([getSession(phone), user ? Promise.resolve(user.state ?? {}) : getProfile(phone)]);
    return { session, profile };
  } catch (err) {
    console.error('WhatsApp: ferramentas indisponíveis (rodou o SQL supabase/whatsapp-hub.sql?)', err);
    return null;
  }
}

/** A IA, com limite diário por pessoa pra não estourar o custo. Passou do limite: segue só com as regras. */
function limitedSmart(phone: string): typeof askClaude {
  return async (msgText, ctx) => {
    const day = new Date().toISOString().slice(0, 10);
    const allowed = await bumpUsage(phone, `ai:${day}`, AI_DAILY_LIMIT).catch(() => true);
    return allowed ? askClaude(msgText, ctx) : null;
  };
}

/**
 * Responde uma mensagem. Quem vinculou a conta no site usa tudo (plano + gastos);
 * quem não vinculou só usa se estiver em ALLOWED_NUMBERS (fase de teste) — ou manda "vincular <código>".
 */
async function reply(msg: { id: string; from: string; text: string }): Promise<Outgoing[] | null> {
  const phone = normalizeBrPhone(msg.from);
  const incoming = msg.text === 'menu:plano' ? 'plano' : msg.text; // linha "Meu plano" do menu
  const cmd = parsePlanCommand(incoming);
  const accounts = accountsConfigured();

  if (cmd?.kind === 'link') {
    if (!accounts) return null;
    if (!(await markProcessed(msg.id))) return null;
    const ok = await linkPhoneByCode(cmd.code, phone);
    return text(
      ok
        ? `✅ WhatsApp vinculado à sua conta Grana Séria!\n\nEscolha no site o dia do lembrete (o dia em que seu salário cai) ou mande, por exemplo, *lembrete 5*.\n${PLAN_HELP}`
        : `Esse código não vale mais (ele dura 30 minutos). Gere um novo em ${SITE_URL}/conta.`
    );
  }

  const user = accounts ? await findUserByPhone(phone) : null;
  if (!user && !isAllowed(msg.from, process.env.ALLOWED_NUMBERS)) {
    console.warn(`WhatsApp: mensagem ignorada, número final ${phone.slice(-4)} não vinculado e fora de ALLOWED_NUMBERS`);
    return null;
  }

  // Ferramentas do site em conversa (menu, diagnóstico, 13º, vazamentos, direitos). Tem prioridade:
  // no meio de um diagnóstico, "3000" é resposta, não gasto.
  const hub = await loadHub(user, phone);
  if (hub) {
    const step = hubStep({ text: incoming, session: hub.session, profile: hub.profile, now: new Date() });
    if (step) {
      if (!(await markProcessed(msg.id))) return null; // reenvio da Meta: não avança a conversa duas vezes
      if (step.session) await saveSession(phone, step.session);
      else if (hub.session) await clearSession(phone);
      if (step.profile) await (user ? saveState(user.user_id, step.profile) : saveProfile(phone, step.profile));
      return step.out;
    }
  }

  if (cmd) {
    if (!(await markProcessed(msg.id))) return null; // reenvio da Meta: não fecha o mês duas vezes
    if (cmd.kind === 'reminderDay' || cmd.kind === 'remindersOff' || cmd.kind === 'remindersOn') {
      if (!user) return text(`Os lembretes precisam da conta no site. Vincule seu WhatsApp em ${SITE_URL}/conta.`);
      if (cmd.kind === 'reminderDay') {
        await updateUser(user.user_id, { reminder_day: cmd.day, reminders: true });
        return text(`🔔 Combinado: lembrete todo dia ${cmd.day}.`);
      }
      if (cmd.kind === 'remindersOff') {
        await updateUser(user.user_id, { reminders: false });
        return text('🔕 Lembretes desligados. Pra voltar, mande *voltar lembretes*.');
      }
      await updateUser(user.user_id, { reminders: true });
      return text(user.reminder_day ? `🔔 Lembretes ligados: todo dia ${user.reminder_day}.` : '🔔 Lembretes ligados. Qual dia? Mande, por exemplo, *lembrete 5*.');
    }
    // plano, paguei, não paguei: funciona com ou sem conta (sem conta, o plano fica guardado pelo número)
    const state = hub?.profile ?? user?.state ?? {};
    const result = runPlanCommand(cmd, state);
    if (result.newState) await (user ? saveState(user.user_id, result.newState) : saveProfile(phone, result.newState));
    return text(result.reply);
  }

  // ajuda mostra também os comandos do plano pra quem tem conta
  if (user && parseMessage(msg.text).kind === 'help') return text(HELP_TEXT + '\n' + PLAN_HELP);

  const answer = await handleText(
    { id: msg.id, phone, text: msg.text },
    { insertExpense, listExpensesSince, deleteLastExpense, updateLastExpense, smart: smartConfigured() ? limitedSmart(phone) : undefined }
  );
  return answer ? text(answer) : null;
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
      const out = await reply(msg);
      if (out) {
        for (const o of out) await sendOutgoing(msg.from, o);
        console.log(`WhatsApp: ${out.length} resposta(s) enviada(s) para o número final ${msg.from.slice(-4)}`);
      } else {
        console.log(`WhatsApp: sem resposta para a mensagem ${msg.id}`);
      }
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
