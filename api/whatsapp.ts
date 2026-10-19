// Webhook do assistente de gastos pelo WhatsApp.
// URL na Vercel: https://<seu-site>.vercel.app/api/whatsapp
//
// GET  → verificação do webhook pela Meta (uma vez, ao configurar)
// POST → mensagens recebidas

import { downloadMedia, extractMessages, isAllowed, MediaTooBigError, normalizeBrPhone, sendOutgoing, sendText, verifySignature, type IncomingMedia, type Outgoing } from '../server/whatsapp/meta.js';
import { handleText, recordReceipt, HELP_TEXT, type BotDeps } from '../server/whatsapp/bot.js';
import { analyzeReceipt } from '../server/receipt.js';
import { insertExpense, listExpensesSince, deleteLastExpense, updateLastExpense, insertIncome, listIncomesSince, deleteLastIncome } from '../server/whatsapp/db.js';
import { startOfMonthBRT } from '../server/whatsapp/bot.js';
import { diagnosisFrom } from '../server/whatsapp/hubcore.js';
import { askClaude, smartConfigured } from '../server/whatsapp/smart.js';
import { hubStep, wantsNextStep, wantsBalance, wantsHistory, welcomeFromSite, SITE_CODE, type History } from '../server/whatsapp/hub.js';
import { PLAN_BUTTON_TEXT } from '../server/whatsapp/coach.js';
import { GASTOS_BUTTON_TEXT } from '../server/whatsapp/hubcore.js';
import { loadShortcuts } from '../server/whatsapp/shortcuts.js';
import { FEEDBACK_ASK, loadFeedbackEvents, shouldAskFeedback } from '../server/whatsapp/feedback.js';
import { bumpUsage, getFlag, setFlag, takeHandoff, clearSession, eraseWhatsAppData, getProfile, getSession, refundUsage, saveProfile, saveSession, trackEvent } from '../server/whatsapp/hubdb.js';
import { analyzeFatura, MAX_BASE64, MEDIA_TYPES, type MediaType } from '../server/fatura.js';
import { faturaOut } from '../server/whatsapp/tools.js';
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

/** Entradas e gastos dos últimos 30 dias, pra pré-preencher o diagnóstico. Qualquer falha: segue sem (perguntas normais). */
async function loadHistory(phone: string, now: Date): Promise<History | undefined> {
  try {
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [incomes, expenses] = await Promise.all([listIncomesSince(phone, since), listExpensesSince(phone, since)]);
    const first = Math.min(...[...incomes, ...expenses].map((r) => new Date(r.created_at).getTime()));
    if (!Number.isFinite(first)) return undefined;
    const byCategory: Record<string, number> = {};
    for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    return {
      income: incomes.reduce((t, r) => t + r.amount, 0),
      spent: expenses.reduce((t, r) => t + r.amount, 0),
      byCategory,
      days: Math.min(30, Math.max(1, Math.ceil((now.getTime() - first) / (24 * 60 * 60 * 1000)))),
    };
  } catch {
    return undefined;
  }
}

const SUMMARY_FLAG = 'resumo'; // wa_usage: quem pediu o resumo semanal

/** Cada tipo de oferta só uma vez por mês por pessoa (usa o mesmo contador dos limites de uso). */
const offerOnce = (phone: string, key: string) => bumpUsage(phone, `offer:${key}:${new Date().toISOString().slice(0, 7)}`, 1);

/** Entradas e gastos do mês. Sem entradas anotadas (ou sem a tabela), devolve undefined e a ferramenta pergunta a renda. */
async function loadBalance(phone: string, now: Date): Promise<{ income: number; spent: number } | undefined> {
  try {
    const since = startOfMonthBRT(now);
    const [incomes, expenses] = await Promise.all([listIncomesSince(phone, since), listExpensesSince(phone, since)]);
    const income = incomes.reduce((t, r) => t + r.amount, 0);
    return income > 0 ? { income, spent: expenses.reduce((t, r) => t + r.amount, 0) } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Responde uma mensagem. Quem vinculou a conta no site usa tudo (plano + gastos);
 * quem não vinculou só usa se estiver em ALLOWED_NUMBERS (fase de teste) — ou manda "vincular <código>".
 */
async function reply(msg: { id: string; from: string; text: string; profileName?: string }): Promise<Outgoing[] | null> {
  const phone = normalizeBrPhone(msg.from);
  // linha "Meu plano" do menu e botões "Já fiz" / "Não consegui" valem como os comandos de sempre
  // botões e linhas de lista viram os comandos de sempre ("gastos:hoje" → "hoje")
  const incoming = msg.text === 'menu:plano' ? 'plano' : (PLAN_BUTTON_TEXT[msg.text] ?? GASTOS_BUTTON_TEXT[msg.text] ?? msg.text);
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

  await trackEvent(phone, 'msg'); // alimenta o painel (pessoas ativas, dias de uso); falha em silêncio

  // veio do site com "Código: GS-XXXXXX": importa o diagnóstico pro número, sem cadastro
  const siteCode = incoming.match(SITE_CODE)?.[1]?.toUpperCase();
  if (siteCode) {
    if (!(await markProcessed(msg.id))) return null;
    const state = await takeHandoff(siteCode);
    if (!state) return text('Esse código não vale mais (ele dura 24 horas e só funciona uma vez). 🙏 Volte no site e toque de novo em *Continuar no WhatsApp*, ou mande *diagnóstico* que a gente faz por aqui.');
    const hub = await loadHub(user, phone);
    const merged = { ...(hub?.profile ?? user?.state ?? {}), ...state };
    await (user ? saveState(user.user_id, merged) : saveProfile(phone, merged));
    if (hub?.session) await clearSession(phone);
    await trackEvent(phone, 'site_handoff');
    return welcomeFromSite(merged, new Date(), msg.profileName);
  }

  // Ferramentas do site em conversa (menu, diagnóstico, 13º, vazamentos, direitos). Tem prioridade:
  // no meio de um diagnóstico, "3000" é resposta, não gasto.
  const hub = await loadHub(user, phone);
  if (hub) {
    const now = new Date();
    // quantos gastos já anotou no mês: só custa uma consulta quando a pessoa pediu o "próximo passo" ou disse oi
    const expensesThisMonth = wantsNextStep(incoming) ? (await listExpensesSince(phone, startOfMonthBRT(now)).catch(() => [])).length : undefined;
    const shortcuts = wantsNextStep(incoming) && !hub.session ? await loadShortcuts(phone, smartConfigured()).catch(() => []) : undefined;
    // "posso comprar 300?" usa o saldo real do mês (entradas e gastos que a pessoa já anotou)
    const balance = wantsBalance(incoming) ? await loadBalance(phone, now) : undefined;
    // diagnóstico e começo rápido já vêm preenchidos com o que a pessoa anotou nos últimos 30 dias
    const history = wantsHistory(incoming) && !hub.session ? await loadHistory(phone, now) : undefined;
    const step = hubStep({ text: incoming, session: hub.session, profile: hub.profile, now, faturaEnabled: smartConfigured(), name: msg.profileName, expensesThisMonth, shortcuts, balance, history });
    if (step) {
      if (!(await markProcessed(msg.id))) return null; // reenvio da Meta: não avança a conversa duas vezes
      if (step.erase) {
        await eraseWhatsAppData(phone); // apaga gastos, perfil, conversa, contadores e métricas deste número
        return step.out;
      }
      if (step.session) await saveSession(phone, step.session);
      else if (hub.session) await clearSession(phone);
      if (step.profile) await (user ? saveState(user.user_id, step.profile) : saveProfile(phone, step.profile));
      if (step.event) await trackEvent(phone, step.event, step.note);
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
  if (user && parseMessage(incoming).kind === 'help') return text(HELP_TEXT + '\n' + PLAN_HELP);

  const answer = await handleText({ id: msg.id, phone, text: incoming }, botDeps(phone, hub?.profile ?? user?.state ?? {}));
  return answer ? text(answer) : null;
}

/** As funções de banco do registro de gastos, com o orçamento do diagnóstico (se tiver) e a IA (se ligada). */
function botDeps(phone: string, profile: StateSnapshot): BotDeps {
  const diag = diagnosisFrom(profile);
  const budgets = diag ? { Moradia: diag.expenses.moradia, Alimentação: diag.expenses.alimentacao, Transporte: diag.expenses.transporte, Lazer: diag.expenses.lazer } : undefined;
  return {
    insertExpense,
    listExpensesSince,
    deleteLastExpense,
    updateLastExpense,
    insertIncome,
    listIncomesSince,
    deleteLastIncome,
    offerOnce,
    setSummary: (p, on) => setFlag(p, SUMMARY_FLAG, on),
    summaryOn: (p) => getFlag(p, SUMMARY_FLAG),
    budgets,
    smart: smartConfigured() ? limitedSmart(phone) : undefined,
  };
}

/**
 * Depois de a pessoa já ter usado o bot de verdade, pergunta como está sendo (uma ou duas vezes no total).
 * Fica de fora quando ela está no meio de uma conversa, quando a resposta já trouxe o "isso te ajudou?"
 * ou quando acabou de dar um feedback. Qualquer falha aqui só vai pro log: nunca atrapalha a conversa.
 */
async function maybeAskFeedback(from: string, sent: Outgoing[]): Promise<void> {
  try {
    if (sent.some((o) => o.kind === 'buttons' && o.buttons.some((b) => b.id.startsWith('fb:')))) return;
    const phone = normalizeBrPhone(from);
    if (!shouldAskFeedback(await loadFeedbackEvents(phone))) return;
    if (await getSession(phone)) return;
    await sendOutgoing(from, FEEDBACK_ASK);
    await trackEvent(phone, 'fb_ask');
  } catch (err) {
    console.warn('WhatsApp: pedido de feedback não enviado', err);
  }
}

const FATURA_MONTHLY_LIMIT = Number(process.env.FATURA_MONTHLY_LIMIT || 5);
const RECEIPT_MONTHLY_LIMIT = Number(process.env.RECEIPT_MONTHLY_LIMIT || 60);
const MAX_FILE_BYTES = Math.floor((MAX_BASE64 * 3) / 4); // ~3 MB, o mesmo limite do site

const FATURA_HINT = /fatura|extrato/i;
const RECEIPT_HINT = /cupom|comprovante|nota|recibo|pix|paguei|gastei/i;

/**
 * PDF ou foto. Foto (ou PDF com legenda "comprovante") é lida como cupom/comprovante e vira um gasto.
 * Fatura e extrato (PDF, legenda "fatura", ou uma foto que a leitura reconhece como fatura) vão pro leitor de fatura.
 */
async function handleMedia(m: IncomingMedia): Promise<void> {
  const phone = normalizeBrPhone(m.from);
  const user = accountsConfigured() ? await findUserByPhone(phone) : null;
  if (!user && !isAllowed(m.from, process.env.ALLOWED_NUMBERS)) return;
  if (!(await markProcessed(m.id))) return; // reenvio da Meta: já estamos lendo

  const say = (t: string) => sendText(m.from, t);
  if (!smartConfigured()) return say('Ler fotos ainda não foi ativado por aqui. 🙏 Me manda por escrito, ex.: *mercado 45,90 no pix*.');
  if (!MEDIA_TYPES.includes(m.mime as MediaType)) return say('Mande em *foto* (JPG ou PNG) ou em *PDF*. 📸');

  const caption = m.caption ?? '';
  const asReceipt = !FATURA_HINT.test(caption) && (m.mime !== 'application/pdf' || RECEIPT_HINT.test(caption));
  let file: { mime: string; base64: string } | null = null;
  const download = async () => (file ??= await downloadMedia(m.mediaId, MAX_FILE_BYTES));

  try {
    if (asReceipt) {
      const period = `cupom:${new Date().toISOString().slice(0, 7)}`;
      if (!(await bumpUsage(phone, period, RECEIPT_MONTHLY_LIMIT).catch(() => true))) {
        return say(`Você já mandou ${RECEIPT_MONTHLY_LIMIT} fotos neste mês. Me manda por escrito, ex.: *mercado 45,90 no pix*. 🙂`);
      }
      await say('📸 Recebi! Lendo…');
      const f = await download();
      const outcome = await analyzeReceipt(f.mime as MediaType, f.base64);
      if (!outcome.ok) {
        await refundUsage(phone, period).catch(() => undefined);
        return say(`${outcome.error} Ou me manda por escrito, ex.: *mercado 45,90 no pix*.`);
      }
      if (outcome.receipt.tipo === 'outro') {
        await refundUsage(phone, period).catch(() => undefined);
        return say('Não achei um pagamento nessa imagem. 🤔 Mande a foto do cupom, da nota ou do comprovante do pix (ou a fatura do cartão).');
      }
      if (outcome.receipt.tipo !== 'fatura_extrato') {
        const hub = await loadHub(user, phone);
        const answer = await recordReceipt(phone, outcome.receipt, m.id, botDeps(phone, hub?.profile ?? user?.state ?? {}), new Date());
        if (answer && answer !== 'not-receipt') await say(answer);
        return;
      }
      await refundUsage(phone, period).catch(() => undefined); // era fatura: conta no limite da fatura
    }
    await readFatura(m, phone, user, download, say);
  } catch (err) {
    if (err instanceof MediaTooBigError) return say('Arquivo grande demais (máximo 3 MB). Tenta uma foto menor ou só as páginas dos lançamentos. 🙏');
    throw err;
  }
}

/** Fatura ou extrato: procura assinaturas, tarifas e juros escondidos. */
async function readFatura(
  m: IncomingMedia,
  phone: string,
  user: Awaited<ReturnType<typeof findUserByPhone>>,
  download: () => Promise<{ mime: string; base64: string }>,
  say: (t: string) => Promise<void>
): Promise<void> {
  const period = `fatura:${new Date().toISOString().slice(0, 7)}`;
  if (!(await bumpUsage(phone, period, FATURA_MONTHLY_LIMIT).catch(() => true))) {
    return say(`Você já usou as ${FATURA_MONTHLY_LIMIT} leituras de fatura deste mês. Volta no mês que vem! 🙂`);
  }
  await say('🧾 Estou lendo sua fatura… leva uns 30 segundos.');
  try {
    const file = await download();
    const outcome = await analyzeFatura(file.mime as MediaType, file.base64);
    if ('error' in outcome) {
      await refundUsage(phone, period).catch(() => undefined);
      return say(`${outcome.error} Pode mandar de novo.`);
    }
    const hub = await loadHub(user, phone);
    const { out, session } = faturaOut(outcome.result, hub?.profile ?? user?.state ?? {});
    if (hub) {
      if (session) await saveSession(phone, session);
      else if (hub.session) await clearSession(phone);
    }
    for (const o of out) await sendOutgoing(m.from, o);
  } catch (err) {
    await refundUsage(phone, period).catch(() => undefined);
    throw err;
  }
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

  const { texts, media, others } = extractMessages(payload);

  for (const msg of texts) {
    try {
      const out = await reply(msg);
      if (out) {
        for (const o of out) await sendOutgoing(msg.from, o);
        console.log(`WhatsApp: ${out.length} resposta(s) enviada(s) para o número final ${msg.from.slice(-4)}`);
        await maybeAskFeedback(msg.from, out);
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

  for (const m of media) {
    try {
      await handleMedia(m);
    } catch (err) {
      console.error('Erro ao ler o arquivo', m.id, err);
      try {
        await sendText(m.from, '⚠️ Tive um problema pra ler esse arquivo. Tenta de novo em alguns minutos.');
      } catch {
        // só fica no log
      }
    }
  }

  for (const msg of others) {
    const linked = accountsConfigured() ? await findUserByPhone(normalizeBrPhone(msg.from)).catch(() => null) : null;
    if (!linked && !isAllowed(msg.from, process.env.ALLOWED_NUMBERS)) continue;
    try {
      await sendText(
        msg.from,
        msg.type === 'audio'
          ? '🎧 Ainda não consigo ouvir áudio. Me manda por escrito (ex.: *gastei 35 no mercado no pix*) ou a *foto do cupom* que eu anoto.'
          : 'Por enquanto eu entendo texto e foto. ✍️ Ex.: *gastei 35 no mercado no pix*, ou mande a foto do cupom.'
      );
    } catch (err) {
      console.error('Erro ao responder mensagem não-texto', msg.id, err);
    }
  }

  // Sempre 200: se a Meta receber erro, ela reenvia a mesma mensagem várias vezes.
  return new Response('OK', { status: 200 });
}
