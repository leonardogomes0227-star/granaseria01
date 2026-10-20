// O motor do chat roteirizado (sem IA). Um roteiro é uma lista de passos; o estado da conversa é só o histórico de
// respostas. O passo atual sai de repetir o histórico do começo, então salvar e retomar é guardar essa lista.

import type { CoachId } from './coaches';

export type Answers = Record<string, number | string>;

export type Ask =
  | { kind: 'money'; placeholder?: string; min?: number; max?: number }
  | { kind: 'buttons'; options: { value: string; label: string }[] }
  | { kind: 'text'; placeholder?: string; maxLength?: number }
  | null; // só o coach fala (o fim do roteiro)

export interface Step {
  id: string;
  /** As falas do coach neste passo: um texto por coach, ou uma função (pra usar o que a pessoa já respondeu). */
  say: Record<CoachId, string | string[]> | string[] | ((answers: Answers, coach: CoachId) => string[]);
  ask: Ask | ((answers: Answers) => Ask);
  /** Devolve a mensagem de erro, ou null se a resposta serve. */
  validate?: (value: number | string, answers: Answers) => string | null;
  /** O próximo passo; null termina o roteiro. */
  next: (value: number | string, answers: Answers) => string | null;
  /** Como a resposta aparece no balão da pessoa. */
  label?: (value: number | string, answers: Answers) => string;
}

export interface Script {
  id: string;
  first: string;
  steps: Step[];
}

export interface HistoryEntry {
  step: string;
  value: number | string;
}

export const brl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
export const brl2 = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const find = (script: Script, id: string): Step => {
  const step = script.steps.find((s) => s.id === id);
  if (!step) throw new Error(`Passo desconhecido: ${id}`);
  return step;
};

/** Repete o histórico e devolve o passo em que a conversa está (null: terminou) e as respostas até aqui. */
export function replay(script: Script, history: HistoryEntry[]): { step: Step | null; answers: Answers; valid: HistoryEntry[] } {
  const answers: Answers = {};
  const valid: HistoryEntry[] = [];
  let step: Step | null = find(script, script.first);
  for (const h of history) {
    // histórico que não bate com o roteiro (roteiro mudou): para no último ponto que ainda faz sentido
    if (!step || step.id !== h.step) break;
    answers[step.id] = h.value;
    valid.push(h);
    const next = step.next(h.value, answers);
    step = next === null ? null : find(script, next);
  }
  return { step, answers, valid };
}

export function lines(step: Step, answers: Answers, coach: CoachId): string[] {
  if (typeof step.say === 'function') return step.say(answers, coach);
  if (Array.isArray(step.say)) return step.say;
  const v = step.say[coach];
  return Array.isArray(v) ? v : [v];
}

export const askOf = (step: Step, answers: Answers): Ask => (typeof step.ask === 'function' ? step.ask(answers) : step.ask);

export function labelOf(step: Step, value: number | string, answers: Answers): string {
  if (step.label) return step.label(value, answers);
  const ask = askOf(step, answers);
  if (ask?.kind === 'buttons') return ask.options.find((o) => o.value === value)?.label ?? String(value);
  if (ask?.kind === 'money') return brl2(Number(value));
  return String(value);
}

/** Confere a resposta: os limites do tipo e a validação do passo. */
export function check(step: Step, value: number | string, answers: Answers): string | null {
  const ask = askOf(step, answers);
  if (ask?.kind === 'money') {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Digite um valor.';
    if (ask.min !== undefined && n < ask.min) return ask.min === 0 ? 'O valor não pode ser negativo.' : `Digite um valor de pelo menos ${brl2(ask.min)}.`;
    if (ask.max !== undefined && n > ask.max) return 'Esse valor parece alto demais. Confere e digita de novo.';
  }
  if (ask?.kind === 'text' && !String(value).trim()) return 'Escreva alguma coisa.';
  return step.validate ? step.validate(value, answers) : null;
}
