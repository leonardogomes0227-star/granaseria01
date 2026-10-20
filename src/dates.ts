import { daysBetween } from './coach';

// Um jeito só de mostrar datas no app: "pra hoje", "amanhã", "20 out" (dia e mês curto, sempre no horário de Brasília)
// e "out/26" pra meses (monthShort, em plan.ts).

const SHORT = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' });
const clean = (s: string) => s.replace('.', '').replace(' de ', ' ');

/** "20 out" a partir de um instante (ISO) ou de um Date. */
export const fmtDay = (when: string | Date): string => clean(SHORT.format(typeof when === 'string' ? new Date(when) : when));

/** O prazo de um passo: "pra hoje", "amanhã" ou "25 out". */
export function fmtDue(due: string, today: string): string {
  const d = daysBetween(today, due);
  if (d <= 0) return 'pra hoje';
  if (d === 1) return 'amanhã';
  return fmtDay(new Date(`${due}T15:00:00Z`));
}
