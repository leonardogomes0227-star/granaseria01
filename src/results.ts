import type { ToolId } from './tools';
import type { PlanGoal } from './plan';
import { TASKS_KEY, completeTask, parseTasks, replaceTasks, undoTask, type CoachTask, type NewTask, type TaskSource } from './coach';

// O que cada ferramenta deixou no plano da pessoa. Usou uma ferramenta: o resultado fica salvo, aparece no painel
// e, quando muda o plano (metas, vazamentos), entra no plano de ação. Sincroniza com o WhatsApp como o resto.

const RESULTS_KEY = 'gs-resultados';
const GOALS_KEY = 'gs-metas';

/** O cartão de cada ferramenta no painel: o resultado em destaque e o que a pessoa colocou. */
export interface ResultCard {
  label: string; // o que é o número grande ("Comece por", "Por mês"…)
  big: string; // o resultado
  rows: [string, string][]; // o que a pessoa colocou e os outros números
}

export interface ToolResult {
  summary: string;
  at: string;
  card?: ResultCard;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // segue sem salvar
  }
}

export const getResults = (): Partial<Record<ToolId, ToolResult>> => {
  const all = read<Partial<Record<ToolId, ToolResult>>>(RESULTS_KEY, {});
  // o plano do conselheiro chegou a ser gravado no lugar do resultado da ferramenta: esses não valem
  for (const k of Object.keys(all) as ToolId[]) if (all[k]?.card?.label.startsWith('Plano do ')) delete all[k];
  return all;
};

export function saveResult(tool: ToolId, summary: string, card?: ResultCard) {
  const all = getResults();
  if (all[tool]?.summary === summary && JSON.stringify(all[tool]?.card) === JSON.stringify(card)) return;
  write(RESULTS_KEY, { ...all, [tool]: { summary, at: new Date().toISOString(), ...(card ? { card } : {}) } });
}

/* ---------- próximos passos do coach ---------- */

export const getTasks = (): CoachTask[] => {
  try {
    return parseTasks(localStorage.getItem(TASKS_KEY));
  } catch {
    return [];
  }
};
function writeTasks(t: CoachTask[]) {
  write(TASKS_KEY, t);
  window.dispatchEvent(new Event('gs-tarefas'));
}
export function setToolTasks(source: TaskSource, tasks: NewTask[]) {
  const all = getTasks();
  const open = all.filter((t) => t.source === source && !t.done).map((t) => t.text).join('|');
  if (open === tasks.map((t) => t.text).join('|')) return; // nada mudou: não mexe nas datas
  writeTasks(replaceTasks(all, source, tasks));
}
export const markTaskDone = (id: string) => writeTasks(completeTask(getTasks(), id));
export const unmarkTask = (id: string) => writeTasks(undoTask(getTasks(), id));

export const getGoals = (): PlanGoal[] => read<PlanGoal[]>(GOALS_KEY, []).filter((g) => g && g.monthly > 0 && g.months > 0);

/** Salva (ou troca, pelo nome) uma meta da calculadora de meta. Máximo de 3. */
export function saveGoal(goal: PlanGoal) {
  const rest = getGoals().filter((g) => g.name.toLowerCase() !== goal.name.toLowerCase());
  write(GOALS_KEY, [...rest, goal].slice(-3));
}

export function removeGoal(name: string) {
  write(GOALS_KEY, getGoals().filter((g) => g.name !== name));
}
