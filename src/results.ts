import type { ToolId } from './tools';
import type { PlanGoal } from './plan';

// O que cada ferramenta deixou no plano da pessoa. Usou uma ferramenta: o resultado fica salvo, aparece no painel
// e, quando muda o plano (metas, vazamentos), entra no plano de ação. Sincroniza com o WhatsApp como o resto.

const RESULTS_KEY = 'gs-resultados';
const GOALS_KEY = 'gs-metas';

export interface ToolResult {
  summary: string;
  at: string;
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

export const getResults = (): Partial<Record<ToolId, ToolResult>> => read(RESULTS_KEY, {});

export function saveResult(tool: ToolId, summary: string) {
  const all = getResults();
  if (all[tool]?.summary === summary) return;
  write(RESULTS_KEY, { ...all, [tool]: { summary, at: new Date().toISOString() } });
}

export const getGoals = (): PlanGoal[] => read<PlanGoal[]>(GOALS_KEY, []).filter((g) => g && g.monthly > 0 && g.months > 0);

/** Salva (ou troca, pelo nome) uma meta da calculadora de meta. Máximo de 3. */
export function saveGoal(goal: PlanGoal) {
  const rest = getGoals().filter((g) => g.name.toLowerCase() !== goal.name.toLowerCase());
  write(GOALS_KEY, [...rest, goal].slice(-3));
}

export function removeGoal(name: string) {
  write(GOALS_KEY, getGoals().filter((g) => g.name !== name));
}
