import { useEffect, useState } from 'react';
import { ArrowRight, Check, Undo2 } from 'lucide-react';
import { daysBetween, todayBRT, type CoachTask } from '../coach';
import { getTasks, markTaskDone, unmarkTask } from '../results';
import { getTool, type ToolId } from '../tools';

/* ---------- O coach: próximos passos com data, pra marcar como feito ---------- */
// Cada ferramenta deixa compromissos aqui. O WhatsApp lembra no dia (server/coach.ts).

const when = (due: string, today: string) => {
  const d = daysBetween(today, due);
  if (d < 0) return `atrasado ${-d} ${d === -1 ? 'dia' : 'dias'}`;
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d < 7) return `em ${d} dias`;
  return new Date(`${due}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};
const sourceName = (t: CoachTask) => (t.source === 'plano' ? 'Seu plano de ação' : getTool(t.source as ToolId).title);

export function useTasks(): CoachTask[] {
  const [tasks, setTasks] = useState(getTasks);
  useEffect(() => {
    const on = () => setTasks(getTasks());
    window.addEventListener('gs-tarefas', on);
    return () => window.removeEventListener('gs-tarefas', on);
  }, []);
  return tasks;
}

export function CoachPanel({ onOpenTool, onOpenPlan }: { onOpenTool: (id: ToolId) => void; onOpenPlan: () => void }) {
  const tasks = useTasks();
  const today = todayBRT();
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const late = open.filter((t) => t.due < today);
  const now = open.filter((t) => t.due === today);
  const soon = open.filter((t) => t.due > today && daysBetween(today, t.due) <= 7);
  const later = open.filter((t) => daysBetween(today, t.due) > 7);
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.done ?? '').localeCompare(a.done ?? '')).slice(0, 6);
  const [showDone, setShowDone] = useState(false);

  const row = (t: CoachTask) => (
    <li key={t.id} className={t.due < today ? 'late' : t.due === today ? 'today' : ''}>
      <button type="button" className="coach-check" aria-label={`Marcar como feito: ${t.text}`} onClick={() => markTaskDone(t.id)}>
        <Check size={16} />
      </button>
      <span className="coach-copy">
        <b>{t.text}</b>
        <small>
          {when(t.due, today)}
          {t.repeat === 'monthly' ? ' · todo mês' : ''} ·{' '}
          <button type="button" className="coach-src" onClick={() => (t.source === 'plano' ? onOpenPlan() : onOpenTool(t.source as ToolId))}>
            {sourceName(t)} <ArrowRight size={11} />
          </button>
        </small>
      </span>
    </li>
  );
  const group = (title: string, list: CoachTask[]) =>
    list.length > 0 && (
      <div className="coach-group">
        <p className="coach-title">{title}</p>
        <ul>{list.map(row)}</ul>
      </div>
    );

  return (
    <section className="painel-section coach">
      <div className="coach-head">
        <p className="diag-label">Seu coach</p>
        <p className="coach-big">
          {open.length === 0 ? 'Tudo em dia' : late.length + now.length > 0 ? `${late.length + now.length} pra fazer hoje` : `${open.length} próximos passos`}
        </p>
        <p className="coach-sub">Cada ferramenta que você usa vira um passo aqui. No dia, o WhatsApp te lembra.</p>
      </div>
      {open.length === 0 && <p className="field-hint">Use uma ferramenta ou faça o diagnóstico: eu crio os seus próximos passos, com data e lembrete.</p>}
      {group('Atrasados', late)}
      {group('Hoje', now)}
      {group('Nos próximos 7 dias', soon)}
      {group('Depois', later)}
      {done.length > 0 && (
        <>
          <button type="button" className="plan-more" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Esconder os feitos' : `Ver o que você já fez (${done.length})`}
          </button>
          {showDone && (
            <ul className="coach-done">
              {done.map((t) => (
                <li key={t.id}>
                  <span><Check size={13} /> {t.text}</span>
                  <button type="button" className="plan-more" onClick={() => unmarkTask(t.id)}><Undo2 size={13} /> desfazer</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
