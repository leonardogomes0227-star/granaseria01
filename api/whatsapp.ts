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
import { diagnosisFrom, firstName } from '../server/whatsapp/hubcore.js';
import { askClaude, smartConfigured } from '../server/whatsapp/smart.js';
import { hubStep, wantsNextStep, wantsBalance, wantsHistory, welcomeFromSite, isGreeting, isLiveFlow, SITE_CODE, type History } from '../server/whatsapp/hub.js';
import { PLAN_BUTTON_TEXT } from '../server/whatsapp/coach.js';
import { GASTOS_BUTTON_TEXT } from '../server/whatsapp/hubcore.js';
import { loadShortcuts } from '../server/whatsapp/shortcuts.js';
import { FEEDBACK_ASK, loadFeedbackEvents, shouldAskFeedback } from '../server/whatsapp/feedback.js';
import { bumpUsage, getFlag, setFlag, setLastInbound, takeHandoff, createWebLink, deleteWebLinks, NOTICE_FLAG, clearSession, eraseWhatsAppData, getProfile, getSession, refundUsage, saveProfile, saveSession, trackEvent } from '../server/whatsapp/hubdb.js';
import { analyzeFatura, MAX_BASE64, MEDIA_TYPES, type FaturaResult, type MediaType } from '../server/fatura.js';
import { siteLink, siteNoticeText, SITE_URL } from '../server/whatsapp/site.js';
import { parsePlanCommand, runPlanCommand, PLAN_HELP } from '../server/whatsapp/planbot.js';
import { parseMessage } from '../server/whatsapp/parse.js';
import { comandoApp, rodarApp } from '../server/whatsapp/appbot.js';
import { resetIfOld } from '../src/reset.js';
import { limparMesesFuturos } from '../src/lib/mesesFuturos.js';
import { transcribe, transcribeConfigured } from '../server/transcribe.js';
import { planBudgets } from '../src/plan.js';
import { accountsConfigured, findUserByPhone, linkPhoneByCode, markProcessed, saveState, updateUser, type StateSnapshot, type UserRow } from '../server/account/db.js';


const AI_DAILY_LIMIT = Number(process.env.WHATSAPP_AI_DAILY_LIMIT || 40);
const text = (t: string): Outgoing[] => [{ kind: 'text', text: t }];

/** Conversa em andamento + dados da pessoa. Se as tabelas novas ainda não existem, o hub fica desligado e o resto segue. */
async function loadHub(user: UserRow | null, phone: string): Promise<{ session: Awaited<ReturnType<typeof getSession>>; profile: StateSnapshot } | null> {
  try {
    const [session, loaded] = await Promise.all([getSession(phone), user ? Promise.resolve(user.state ?? {}) : getProfile(phone)]);
    // recomeço do plano (src/reset.ts): o diagnóstico antigo não vale mais nem pros limites do dia a dia
    const reset = resetIfOld(loaded);
    // e nunca mês futuro (src/lib/mesesFuturos.ts): mesma faxina do site
    const clean = limparMesesFuturos(reset.state);
    if (reset.changed || clean.changed) await (user ? saveState(user.user_id, clean.state) : saveProfile(phone, clean.state)).catch(() => undefined);
    const profile = clean.state;
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

/** Guarda o primeiro nome do WhatsApp no perfil (o site usa como sugestão quando pede o nome no login). */
async function rememberName(user: UserRow | null, phone: string, profileName?: string): Promise<void> {
  const name = firstName(profileName ?? null);
  if (!name) return;
  try {
    const hub = await loadHub(user, phone);
    const state = hub?.profile ?? user?.state ?? {};
    if (state['gs-nome']) return;
    await (user ? saveState(user.user_id, { ...state, 'gs-nome': name }) : saveProfile(phone, { ...state, 'gs-nome': name }));
  } catch (err) {
    console.warn('WhatsApp: nome não guardado', err);
  }
}

const LINK_RE = new RegExp(`${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/[\\w\\-/]*)?(?![\\w/?])`, 'g');

/**
 * Todo link do site que o bot manda já vai com o login da pessoa (o site exige login pra usar as ferramentas):
 * quem toca no link do WhatsApp entra direto, sem precisar pedir o acesso.
 */
async function withLoginLinks(out: Outgoing[], phone: string): Promise<Outgoing[]> {
  if (!out.some((o) => 'text' in o && LINK_RE.test(o.text))) return out;
  LINK_RE.lastIndex = 0;
  let token: string;
  try {
    token = await createWebLink(phone);
  } catch {
    return out; // sem token, o link continua funcionando (o site pede o login)
  }
  const fix = (t: string) => t.replace(LINK_RE, (_, path?: string) => `${SITE_URL}${path || '/'}?t=${token}`);
  return out.map((o) => ('text' in o ? { ...o, text: fix(o.text) } : o));
}

/** Quem já usava o bot recebe o aviso das ferramentas no site uma vez, na próxima mensagem que mandar. */
async function siteNotice(phone: string): Promise<Outgoing[]> {
  try {
    if (await getFlag(phone, NOTICE_FLAG)) return [];
    await setFlag(phone, NOTICE_FLAG, true);
    const [profile, recent] = await Promise.all([getProfile(phone).catch(() => ({})), listExpensesSince(phone, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).catch(() => [])]);
    // o link vai sem login aqui: quem manda as mensagens põe o login em todos os links (withLoginLinks)
    return Object.keys(profile).length > 0 || recent.length > 0 ? [{ kind: 'text', text: siteNoticeText(`${SITE_URL}/`) }] : [];
  } catch {
    return [];
  }
}


/** O link pessoal do painel, com o aviso de que é só da pessoa. */
function painelText(token: string): string {
  return [
    '📲 *Seu painel no site:*',
    `${SITE_URL}/painel?t=${token}`,
    '',
    'Lá ficam salvos seu plano de ação, seus gastos e entradas do mês e as ferramentas, tudo junto com o que você anota aqui.',
    '',
    '🔒 O link é só seu, não compartilhe. Pra desconectar, mande *sair do painel*.',
  ].join('\n');
}

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
  await setLastInbound(phone).catch(() => undefined); // janela de 24h da Meta (pro "Avisar todo mundo")

  // painel no site: o WhatsApp é o login. O link é pessoal e liga o navegador a este número.
  const t = parseMessage(incoming).kind === 'unknown' ? incoming.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[!?.]+$/, '') : '';
  if (/^(painel|meu painel|site:painel|meu site|abrir painel|abrir o painel|link do painel|meu link|acessar o site|entrar no site|quero entrar no site|entrar|login|logar|fazer login)$/.test(t)) {
    if (!(await markProcessed(msg.id))) return null;
    await trackEvent(phone, 'painel_link');
    await rememberName(user, phone, msg.profileName);
    return text(painelText(await createWebLink(phone)));
  }
  if (/^(sair do painel|desconectar painel|desconectar o painel|desconectar site)$/.test(t)) {
    if (!(await markProcessed(msg.id))) return null;
    await deleteWebLinks(phone);
    return text('Pronto, desconectei o painel de todos os navegadores. 🔒 Pra conectar de novo, mande *painel*.');
  }

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
    // já manda o link do painel: o site fica ligado a este número e tudo passa a ser salvo nos dois lados
    const link = await createWebLink(phone).catch(() => null);
    return [...welcomeFromSite(merged, new Date(), msg.profileName), ...(link ? text(painelText(link)) : [])];
  }

  // O hub responde o oi, o menu, os links do site e as conversas que restaram (apagar dados, feedback, fatura).
  const hub = await loadHub(user, phone);
  if (hub?.session && !isLiveFlow(hub.session.flow)) {
    // conversa de uma ferramenta que saiu do WhatsApp (diagnóstico, dívidas…): descarta e a mensagem segue como gasto
    await clearSession(phone).catch(() => undefined);
    hub.session = null;
  }
  // contas fixas e dívidas do app novo: "contas", "dívidas", "paguei o aluguel", "paguei 450 no rotativo".
  // Só quando não há conversa em andamento; se o nome não bate com nada cadastrado, a mensagem segue como gasto.
  const doApp = hub && !hub.session ? comandoApp(incoming) : null;
  if (doApp && hub) {
    const r = rodarApp(doApp, hub.profile, new Date());
    if (r) {
      if (!(await markProcessed(msg.id))) return null; // reenvio da Meta: não paga duas vezes
      if (r.perfil) await (user ? saveState(user.user_id, r.perfil) : saveProfile(phone, r.perfil));
      await trackEvent(phone, doApp.kind === 'pagou' ? 'tool:app-pagamento' : `tool:app-${doApp.kind}`);
      return text(r.reply);
    }
  }
  if (hub) {
    const now = new Date();
    // quantos gastos já anotou no mês: só custa uma consulta quando a pessoa pediu o "próximo passo" ou disse oi
    const expensesThisMonth = wantsNextStep(incoming) || isGreeting(incoming) ? (await listExpensesSince(phone, startOfMonthBRT(now)).catch(() => [])).length : undefined;
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
  // os limites do dia a dia são os do plano de ação (com os cortes), os mesmos do painel do site
  const budgets = diag ? planBudgets(diag) : undefined;
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

const RECEIPT_MONTHLY_LIMIT = Number(process.env.RECEIPT_MONTHLY_LIMIT || 60);
const MAX_FILE_BYTES = Math.floor((MAX_BASE64 * 3) / 4); // ~3 MB, o mesmo limite do site

const FATURA_HINT = /fatura|extrato/i;
const FATURA_ON_SITE = () =>
  `🧾 Pra ler a fatura inteira (juros, tarifas, cobranças escondidas), use o leitor do site (o link já abre com a sua conta):\n${siteLink('fatura')}\n\nAqui no WhatsApp eu anoto um gasto por foto: mande a foto do *cupom* ou do *comprovante do pix*.`;

/**
 * Foto ou PDF de cupom, nota ou comprovante: a IA lê e vira um gasto (ou uma entrada, se o pix foi recebido).
 * Fatura e extrato ficam com o leitor do site.
 */
const FATURA_MONTHLY_LIMIT = Number(process.env.FATURA_MONTHLY_LIMIT || 5);
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** O resumo da fatura no chat: total, onde foi o dinheiro, o que dá pra cortar e as parcelas que ainda vêm. */
function faturaText(r: FaturaResult): string {
  const hidden = r.cobrancas.filter((c) => c.tipo !== 'outro');
  const hiddenTotal = hidden.reduce((s, c) => s + c.valor, 0);
  return [
    `🧾 *Sua fatura${r.periodo ? ` (${r.periodo})` : ''}: ${brl(r.total)}*`,
    '',
    ...(r.categorias.length ? ['*Onde foi o dinheiro:*', ...r.categorias.slice(0, 5).map((c) => `• ${c.nome}: ${brl(c.total)}`), ''] : []),
    ...(hidden.length
      ? [`*Dá pra cortar ou contestar (${brl(hiddenTotal)}):*`, ...hidden.slice(0, 6).map((c) => `• ${c.descricao}: ${brl(c.valor)}${c.dica ? `. ${c.dica}` : ''}`), '']
      : ['Não achei assinatura, tarifa ou juros escondidos. 👏', '']),
    ...(r.parcelados.length ? ['*Parcelas que ainda vêm:*', ...r.parcelados.slice(0, 4).map((p) => `• ${p.descricao}: ${brl(p.parcela)} (faltam ${p.parcelas_restantes})`), ''] : []),
    ...r.alertas.slice(0, 2).map((a) => `⚠️ ${a}`),
  ]
    .join('\n')
    .trim();
}

async function readFatura(m: IncomingMedia, phone: string, say: (t: string) => Promise<void>, sayLinked: (t: string) => Promise<void>): Promise<void> {
  if (!smartConfigured()) return sayLinked(FATURA_ON_SITE());
  if (!MEDIA_TYPES.includes(m.mime as MediaType)) return say('Mande a fatura em *PDF* ou em *foto* (JPG ou PNG). 📄');
  const period = `fatura:${new Date().toISOString().slice(0, 7)}`;
  if (!(await bumpUsage(phone, period, FATURA_MONTHLY_LIMIT).catch(() => true))) {
    return say(`Você já mandou ${FATURA_MONTHLY_LIMIT} faturas neste mês. 🙏 Mês que vem eu leio de novo.`);
  }
  await say('📄 Recebi a fatura! Lendo… (leva uns segundos)');
  try {
    const file = await downloadMedia(m.mediaId, MAX_FILE_BYTES);
    const outcome = await analyzeFatura(file.mime as MediaType, file.base64);
    if (!outcome.ok || !outcome.result.e_documento_financeiro) {
      await refundUsage(phone, period).catch(() => undefined);
      return say(outcome.ok ? 'Isso não parece uma fatura ou extrato. 🤔 Mande o PDF da fatura do cartão ou do extrato do banco.' : outcome.error);
    }
    await sayLinked(`${faturaText(outcome.result)}\n\nPra cancelar o que pesa, com a mensagem pronta, abra o *Cortar gastos escondidos* no site:\n${siteLink('vazamentos')}`);
  } catch (err) {
    await refundUsage(phone, period).catch(() => undefined);
    if (err instanceof MediaTooBigError) return say('Arquivo grande demais (máximo 3 MB). 🙏 Tenta um PDF menor ou uma foto.');
    throw err;
  }
}

async function handleMedia(m: IncomingMedia): Promise<void> {
  const phone = normalizeBrPhone(m.from);
  const user = accountsConfigured() ? await findUserByPhone(phone) : null;
  if (!user && !isAllowed(m.from, process.env.ALLOWED_NUMBERS)) return;
  if (!(await markProcessed(m.id))) return; // reenvio da Meta: já estamos lendo

  const say = (t: string) => sendText(m.from, t);
  // o link do leitor de fatura vai com o login da pessoa, como os outros links do bot
  const sayLinked = async (t: string) => {
    const [o] = await withLoginLinks([{ kind: 'text', text: t }], phone);
    return say(o.kind === 'text' ? o.text : t);
  };
  // fatura ou extrato (legenda, ou PDF): a IA lê aqui mesmo e manda o resumo, com o link do painel completo
  if (FATURA_HINT.test(m.caption ?? '') || m.mime === 'application/pdf') return readFatura(m, phone, say, sayLinked);
  if (!smartConfigured()) return say('Ler fotos ainda não foi ativado por aqui. 🙏 Me manda por escrito, ex.: *mercado 45,90 no pix*.');
  if (!MEDIA_TYPES.includes(m.mime as MediaType)) return say('Mande em *foto* (JPG ou PNG) ou em *PDF*. 📸');

  const period = `cupom:${new Date().toISOString().slice(0, 7)}`;
  if (!(await bumpUsage(phone, period, RECEIPT_MONTHLY_LIMIT).catch(() => true))) {
    return say(`Você já mandou ${RECEIPT_MONTHLY_LIMIT} fotos neste mês. Me manda por escrito, ex.: *mercado 45,90 no pix*. 🙂`);
  }
  await say('📸 Recebi! Lendo…');
  try {
    const file = await downloadMedia(m.mediaId, MAX_FILE_BYTES);
    const outcome = await analyzeReceipt(file.mime as MediaType, file.base64);
    if (!outcome.ok || outcome.receipt.tipo === 'outro' || outcome.receipt.tipo === 'fatura_extrato') {
      await refundUsage(phone, period).catch(() => undefined);
      if (!outcome.ok) return say(`${outcome.error} Ou me manda por escrito, ex.: *mercado 45,90 no pix*.`);
      if (outcome.receipt.tipo === 'fatura_extrato') return readFatura(m, phone, say, sayLinked);
      return say('Não achei um pagamento nessa imagem. 🤔 Mande a foto do cupom, da nota ou do comprovante do pix.');
    }
    const hub = await loadHub(user, phone);
    const answer = await recordReceipt(phone, outcome.receipt, m.id, botDeps(phone, hub?.profile ?? user?.state ?? {}), new Date());
    if (answer && answer !== 'not-receipt') await say(answer);
  } catch (err) {
    await refundUsage(phone, period).catch(() => undefined);
    if (err instanceof MediaTooBigError) return say('Arquivo grande demais (máximo 3 MB). Tenta uma foto menor. 🙏');
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

  const { texts, media, others, audios } = extractMessages(payload);

  // áudio: vira texto e segue igual a uma mensagem escrita (o bot repete o que entendeu, pra pessoa conferir)
  for (const a of audios) {
    if (!transcribeConfigured()) {
      others.push({ id: a.id, from: a.from, type: 'audio' });
      continue;
    }
    try {
      const file = await downloadMedia(a.mediaId, 16 * 1024 * 1024);
      const heard = (await transcribe(file.base64, file.mime || a.mime)).slice(0, 500);
      if (!heard) {
        await sendText(a.from, 'Não consegui entender o áudio. 🎧 Pode mandar de novo, ou escrever? Ex.: *gastei 35 no mercado no pix*');
        continue;
      }
      texts.push({ id: a.id, from: a.from, text: heard, profileName: a.profileName, heard: true });
    } catch (err) {
      console.error('Erro ao ouvir o áudio', a.id, err);
      await sendText(a.from, 'Tive um problema pra ouvir esse áudio. 🎧 Tenta de novo, ou me manda por escrito.').catch(() => undefined);
    }
  }

  for (const msg of texts) {
    try {
      const answer = await reply(msg);
      const phoneN = normalizeBrPhone(msg.from);
      // o "oi" já explica a novidade do site: o aviso de uma vez só fica marcado como visto e não vem junto
      const notice = answer ? await siteNotice(phoneN) : [];
      const heardLine: Outgoing[] = msg.heard ? [{ kind: 'text', text: `🎧 Entendi: _"${msg.text}"_` }] : [];
      const out = answer ? await withLoginLinks([...heardLine, ...(isGreeting(msg.text) ? [] : notice), ...answer], phoneN) : null;
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
