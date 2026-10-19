// Resumo automático pelo WhatsApp. A Vercel chama esta rota todo dia às 10h (horário de Brasília) — ver
// "crons" no vercel.json. No domingo manda o resumo da semana; no dia 1, o do mês que fechou.
// Só pra quem pediu ("resumo semanal") e só se tiver algo anotado no período.
// Fora da janela de 24h a Meta só entrega modelos aprovados: ver docs/whatsapp-assistente.md (resumo_semanal, resumo_mensal).

import { sendTemplate } from '../server/whatsapp/meta.js';
import { listExpensesSince, listIncomesSince } from '../server/whatsapp/db.js';
import { bumpUsage, listFlagged } from '../server/whatsapp/hubdb.js';
import { monthlySummary, weeklySummary } from '../server/whatsapp/summary.js';
import { startOfMonthBRT } from '../server/whatsapp/bot.js';

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<Response> {
  // a Vercel manda "Authorization: Bearer <CRON_SECRET>" nas chamadas do cron
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const local = new Date(now.getTime() - BRT_OFFSET_MS); // "agora" em Brasília, lido pelos campos UTC
  const url = new URL(request.url);
  // ?tipo=semana / ?tipo=mes forçam um envio (pra testar); sem isso, decide pelo dia
  const forced = url.searchParams.get('tipo');
  const weekly = forced ? forced === 'semana' : local.getUTCDay() === 0;
  const monthly = forced ? forced === 'mes' : local.getUTCDate() === 1;
  if (!weekly && !monthly) return Response.json({ sent: 0, skipped: 0, reason: 'hoje não é domingo nem dia 1' });

  const language = process.env.WHATSAPP_REMINDER_LANGUAGE || 'pt_BR';
  const weeklyTemplate = process.env.WHATSAPP_WEEKLY_TEMPLATE || 'resumo_semanal';
  const monthlyTemplate = process.env.WHATSAPP_MONTHLY_TEMPLATE || 'resumo_mensal';
  const todayIso = local.toISOString().slice(0, 10);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const phone of await listFlagged('resumo')) {
    try {
      // uma vez por dia por pessoa, mesmo se o cron rodar de novo
      if (!(await bumpUsage(phone, `resumo:enviado:${todayIso}`, 1))) {
        skipped++;
        continue;
      }
      const monthStart = startOfMonthBRT(now);
      if (monthly) {
        // o mês que fechou: do dia 1 do mês passado até o dia 1 deste
        const prevStart = startOfMonthBRT(new Date(monthStart.getTime() - DAY_MS));
        const [expenses, incomes] = await Promise.all([listExpensesSince(phone, prevStart), listIncomesSince(phone, prevStart).catch(() => [])]);
        const inMonth = <T extends { created_at: string }>(rows: T[]) => rows.filter((r) => new Date(r.created_at).getTime() < monthStart.getTime());
        const summary = monthlySummary({ expenses: inMonth(expenses), incomes: inMonth(incomes), monthIndex: new Date(prevStart.getTime() - BRT_OFFSET_MS + DAY_MS).getUTCMonth() });
        if (summary) {
          await sendTemplate(phone, monthlyTemplate, language, summary.params);
          sent++;
        } else skipped++;
      }
      if (weekly) {
        const since = new Date(now.getTime() - 14 * DAY_MS);
        const [recent, monthExpenses, monthIncomes] = await Promise.all([
          listExpensesSince(phone, since < monthStart ? since : monthStart),
          listExpensesSince(phone, monthStart),
          listIncomesSince(phone, monthStart).catch(() => []),
        ]);
        const summary = weeklySummary({ recent, monthExpenses, monthIncomes, now });
        if (summary) {
          await sendTemplate(phone, weeklyTemplate, language, summary.params);
          sent++;
        } else skipped++;
      }
    } catch (err) {
      failed++;
      console.error('Resumo não enviado, número final', phone.slice(-4), err);
    }
  }
  return Response.json({ sent, skipped, failed });
}
