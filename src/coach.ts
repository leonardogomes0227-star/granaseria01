import type { ToolId } from './tools';

// O coach: cada ferramenta usada vira compromissos com data ("cancelar a assinatura X", "separar R$ 400 pra viagem").
// Ficam salvos na conta (gs-tarefas), aparecem no painel pra marcar como feito e o WhatsApp lembra no dia
// (api/resumo.ts chama server/coach.ts todo dia às 10h). Funções puras aqui; o navegador usa src/results.ts.

export type TaskSource = ToolId | 'plano';

export interface CoachTask {
  id: string;
  source: TaskSource;
  text: string;
  due: string; // AAAA-MM-DD, horário de Brasília
  repeat?: 'monthly'; // ao marcar como feito, volta pro mês seguinte
  done?: string; // AAAA-MM-DD em que marcou
}

export interface NewTask {
  text: string;
  inDays: number;
  repeat?: 'monthly';
}

export const TASKS_KEY = 'gs-tarefas';
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const todayBRT = (now = new Date()) => new Date(now.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
function addMonth(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function parseTasks(raw: string | undefined | null): CoachTask[] {
  try {
    const v = raw ? (JSON.parse(raw) as CoachTask[]) : [];
    return Array.isArray(v) ? v.filter((t) => t && typeof t.text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due)) : [];
  } catch {
    return [];
  }
}

/** Troca os compromissos ainda abertos de uma ferramenta pelos novos (os já feitos ficam no histórico). */
export function replaceTasks(all: CoachTask[], source: TaskSource, fresh: NewTask[], today = todayBRT()): CoachTask[] {
  const kept = all.filter((t) => t.source !== source || t.done);
  const made = fresh.map((n, i) => ({
    id: `${source}-${today}-${i}-${n.text.length}`,
    source,
    text: n.text,
    due: addDays(today, n.inDays),
    ...(n.repeat ? { repeat: n.repeat } : {}),
  }));
  // histórico curto: só os 30 últimos feitos
  const done = kept.filter((t) => t.done).slice(-30);
  return [...kept.filter((t) => !t.done), ...done, ...made];
}

/** Marca como feito; o que é todo mês ganha a próxima data em vez de sumir. */
export function completeTask(all: CoachTask[], id: string, today = todayBRT()): CoachTask[] {
  const t = all.find((x) => x.id === id);
  if (!t) return all;
  const rest = all.filter((x) => x.id !== id);
  const done = { ...t, done: today };
  if (t.repeat === 'monthly') return [...rest, done, { ...t, id: `${t.id}-r${today}`, due: addMonth(t.due < today ? today : t.due), done: undefined }];
  return [...rest, done];
}

export const undoTask = (all: CoachTask[], id: string): CoachTask[] => all.map((t) => (t.id === id ? { ...t, done: undefined } : t));

/** O que o lembrete do dia manda: vence hoje, ou está atrasado (de 3 em 3 dias, pra não encher). */
export function remindToday(all: CoachTask[], today = todayBRT()): CoachTask[] {
  return all.filter((t) => {
    if (t.done) return false;
    const late = daysBetween(t.due, today);
    return late === 0 || (late > 0 && late % 3 === 0 && late <= 30);
  });
}
