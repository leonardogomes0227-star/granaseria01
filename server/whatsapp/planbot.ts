// Comandos do plano pelo WhatsApp, pra quem vinculou a conta no site.
// A lógica do plano é a mesma do site (src/plan.ts e src/tracking.ts): o que o bot responde
// bate com o que a pessoa vê na tela.

import { trackingView, type Tracking } from '../../src/tracking.js';
import { leaksMonthlyTotal, type LeakSelection } from '../../src/leaks.js';
import { monthLong, monthShort } from '../../src/plan.js';
import type { StateSnapshot } from '../account/db.js';

export type PlanCommand =
  | { kind: 'link'; code: string }
  | { kind: 'plan' }
  | { kind: 'paid' }
  | { kind: 'notPaid' }
  | { kind: 'reminderDay'; day: number }
  | { kind: 'remindersOff' }
  | { kind: 'remindersOn' };

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[!?.]+$/, '').trim();
}

/** Só frases exatas: "paguei 500 no mercado" continua sendo um gasto, não fecha o mês. */
export function parsePlanCommand(input: string): PlanCommand | null {
  const t = normalize(input);
  const link = t.match(/^vincular\s+(\d{6})$/);
  if (link) return { kind: 'link', code: link[1] };
  if (/^(plano|meu plano|plano do mes|o que pagar)$/.test(t)) return { kind: 'plan' };
  if (/^(paguei|sim|paguei tudo|ja paguei|pago|feito)$/.test(t)) return { kind: 'paid' };
  if (/^(nao paguei|nao consegui|nao consegui pagar|nao)$/.test(t)) return { kind: 'notPaid' };
  const day = t.match(/^lembrete\s+(?:dia\s+)?(\d{1,2})$/);
  if (day && Number(day[1]) >= 1 && Number(day[1]) <= 31) return { kind: 'reminderDay', day: Number(day[1]) };
  if (/^(parar lembretes?|pare|parar|sem lembretes?)$/.test(t)) return { kind: 'remindersOff' };
  if (/^(voltar lembretes?|ligar lembretes?)$/.test(t)) return { kind: 'remindersOn' };
  return null;
}

function parseJson<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readPlanState(state: StateSnapshot) {
  const tracking = parseJson<Tracking>(state['selos-tracking']);
  const leaks = parseJson<LeakSelection>(state['selos-leaks']) ?? {};
  return { tracking, extraMonthly: leaksMonthlyTotal(leaks) };
}

const NOT_STARTED =
  'Você ainda não começou a seguir um plano. 📋\nNo site, faça o diagnóstico e toque em *Seguir meu plano mês a mês* — depois é só mandar *plano* aqui.';

/** Texto curto do que pagar no mês em aberto — usado no lembrete (sem quebras de linha, regra do modelo da Meta). */
export function tasksInline(tracking: Tracking, extraMonthly: number): string | null {
  const view = trackingView(tracking, extraMonthly);
  if (view.tasks.length === 0) return null;
  const parts = view.tasks.map((t) => (t.id === 'reserve' ? `${brl(t.suggested)} na reserva` : `${brl(t.suggested)} em ${t.label.replace(/^Pagar /, '')}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0];
}

export function planStatusText(tracking: Tracking, extraMonthly: number): string {
  const view = trackingView(tracking, extraMonthly);
  const start = new Date(tracking.createdAt);
  const lines = [`📋 *Mês ${view.openMonth} do seu plano* (${monthShort(start, view.openMonth)})`, ''];
  if (view.tasks.length === 0) lines.push('Nada combinado pra este mês.');
  else {
    lines.push('Combinado:');
    for (const t of view.tasks) lines.push(`• ${brl(t.suggested)} — ${t.label}`);
  }
  lines.push('');
  if (view.current.stuck) lines.push('⚠️ O valor do plano ainda não cobre os juros. Renegociar é o próximo passo (a mensagem pronta está no site).');
  else if (view.debtFreeAbs !== null && view.original.debts.length > 0 && view.current.debts.length > 0) {
    const shift = view.debtShift ?? 0;
    const when = monthLong(start, view.debtFreeAbs);
    lines.push(
      shift > 0
        ? `🚀 ${shift} ${shift === 1 ? 'mês adiantado' : 'meses adiantado'}: livre das dívidas em ${when}.`
        : shift < 0
          ? `⏳ ${-shift} ${shift === -1 ? 'mês atrasado' : 'meses atrasado'}: nova data pra sair das dívidas é ${when}.`
          : `✅ No ritmo: livre das dívidas em ${when}.`
    );
  } else if (view.original.debts.length > 0 && view.current.debts.length === 0) lines.push('🎉 Você está livre das dívidas! Agora é reserva e investimento.');
  if (view.streak > 1) lines.push(`🔥 ${view.streak} meses seguidos cumprindo o plano.`);
  lines.push('', 'Quando pagar, responda *paguei*. Se não deu, *não paguei* — eu recalculo.');
  return lines.join('\n');
}

/** Executa um comando que mexe no plano. Devolve o texto da resposta e, se mudou, o estado novo pra salvar. */
export function runPlanCommand(
  cmd: Extract<PlanCommand, { kind: 'plan' | 'paid' | 'notPaid' }>,
  state: StateSnapshot
): { reply: string; newState?: StateSnapshot } {
  const { tracking, extraMonthly } = readPlanState(state);
  if (!tracking) return { reply: NOT_STARTED };
  if (cmd.kind === 'plan') return { reply: planStatusText(tracking, extraMonthly) };

  const view = trackingView(tracking, extraMonthly);
  const paid = Object.fromEntries(view.tasks.map((t) => [t.id, cmd.kind === 'paid' ? Math.round(t.suggested * 100) / 100 : 0]));
  const next: Tracking = { ...tracking, months: [...tracking.months, { paid }] };
  const head =
    cmd.kind === 'paid'
      ? `✅ Fechei ${monthShort(new Date(tracking.createdAt), view.openMonth)} como combinado. Mandou bem!`
      : `Anotado: ${monthShort(new Date(tracking.createdAt), view.openMonth)} sem pagamento. Sem culpa — já recalculei o plano.`;
  return {
    reply: `${head}\n\n${planStatusText(next, extraMonthly)}`,
    newState: { ...state, 'selos-tracking': JSON.stringify(next) },
  };
}

export const PLAN_HELP = [
  '',
  'Seu plano:',
  '• *plano* — o que pagar este mês',
  '• *paguei* — fecha o mês como combinado',
  '• *não paguei* — recalcula o plano',
  '• *lembrete 5* — muda o dia do lembrete',
  '• *parar lembretes* — desliga o lembrete',
].join('\n');
