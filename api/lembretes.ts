// Lembrete do plano pelo WhatsApp. A Vercel chama esta rota todo dia às 9h (horário de Brasília) —
// ver "crons" no vercel.json. Manda pra quem vinculou o WhatsApp e escolheu o dia de hoje.

import { sendTemplate } from '../server/whatsapp/meta.js';
import { readPlanState, tasksInline } from '../server/whatsapp/planbot.js';
import { accountsConfigured, listReminderCandidates, updateUser } from '../server/account/db.js';

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<Response> {
  // a Vercel manda "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!accountsConfigured()) return new Response('Contas desligadas', { status: 200 });

  const template = process.env.WHATSAPP_REMINDER_TEMPLATE || 'lembrete_plano';
  const language = process.env.WHATSAPP_REMINDER_LANGUAGE || 'pt_BR';

  const local = new Date(Date.now() - BRT_OFFSET_MS); // "agora" em Brasília, lido pelos campos UTC
  const today = local.getUTCDate();
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  const todayIso = local.toISOString().slice(0, 10);

  let sent = 0;
  let skipped = 0;
  for (const user of await listReminderCandidates()) {
    const day = user.reminder_day ?? 0;
    // dia 31 em mês de 30 dias: lembra no último dia do mês
    const isToday = day === today || (day > lastDay && today === lastDay);
    if (!isToday || user.last_reminder === todayIso || !user.phone) {
      skipped++;
      continue;
    }
    const { tracking, extraMonthly } = readPlanState(user.state ?? {});
    const tasks = tracking ? tasksInline(tracking, extraMonthly) : null;
    if (!tasks) {
      skipped++;
      continue;
    }
    try {
      await sendTemplate(user.phone, template, language, [tasks]);
      await updateUser(user.user_id, { last_reminder: todayIso });
      sent++;
    } catch (err) {
      console.error('Lembrete não enviado', user.user_id, err);
    }
  }
  return Response.json({ sent, skipped });
}
