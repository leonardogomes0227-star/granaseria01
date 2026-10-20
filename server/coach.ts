// Lembretes do coach pelo WhatsApp: todo dia (dentro do cron do resumo, api/resumo.ts) olha os próximos passos de
// cada pessoa (gs-tarefas, src/coach.ts) e lembra o que vence hoje, e os atrasados de 3 em 3 dias.
// Na janela de 24h da Meta vai o texto completo com o link do painel; fora dela, o modelo aprovado (lembrete_plano),
// com os passos numa linha só (parâmetro de modelo não aceita quebra de linha).

import { createWebLink, getFlag, getLastInbound, listProfiles, setFlag } from './whatsapp/hubdb.js';
import { sendTemplate, sendText } from './whatsapp/meta.js';
import { SITE_URL } from './whatsapp/site.js';
import { parseTasks, remindToday, todayBRT, TASKS_KEY } from '../src/coach.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function coachText(texts: string[], link: string, name?: string | null): string {
  return [
    `⏰ *${name ? `${name}, seu` : 'Seu'} coach da Grana Séria*`,
    '',
    'Hoje é dia de:',
    ...texts.map((t) => `• ${t}`),
    '',
    'Fez? Marque como feito no seu painel:',
    link,
  ].join('\n');
}

export async function runCoach(now = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const today = todayBRT(now);
  const template = process.env.WHATSAPP_COACH_TEMPLATE || process.env.WHATSAPP_REMINDER_TEMPLATE || 'lembrete_plano';
  const language = process.env.WHATSAPP_REMINDER_LANGUAGE || 'pt_BR';
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const { phone, state } of await listProfiles()) {
    const due = remindToday(parseTasks(state[TASKS_KEY]), today);
    if (due.length === 0) {
      skipped++;
      continue;
    }
    const flag = `coach:${today}`;
    try {
      if (await getFlag(phone, flag)) {
        skipped++;
        continue;
      }
      const texts = due.slice(0, 5).map((t) => t.text);
      const link = `${SITE_URL}/painel?t=${await createWebLink(phone)}#coach`;
      const last = await getLastInbound(phone).catch(() => null);
      if (last && now.getTime() - last.getTime() < DAY_MS - 10 * 60 * 1000) await sendText(phone, coachText(texts, link, state['gs-nome'] ?? null));
      else await sendTemplate(phone, template, language, [`${texts.join(' · ')}. Marque como feito no seu painel: ${link}`.slice(0, 900)]);
      await setFlag(phone, flag, true);
      sent++;
    } catch (err) {
      console.error('Coach: lembrete não enviado', phone.slice(-4), err);
      failed++;
    }
  }
  return { sent, skipped, failed };
}
