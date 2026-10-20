import { useEffect, useState } from 'react';
import { Check, ChevronDown, Undo2 } from 'lucide-react';
import { getResults, markTaskDone, unmarkTask, type ToolResult } from '../results';
import { daysBetween, todayBRT } from '../coach';
import { JOURNEYS } from '../journeys';
import type { ToolId } from '../tools';
import { useTasks } from './CoachPanel';

/* ---------- O painel de cada ferramenta ---------- */
// Começo, meio e fim (com o passo em que a pessoa está), os números que ela salvou, os próximos passos pra marcar
// e o histórico das outras vezes. Fica em cima da ferramenta: é o controle de tudo que ela fez ali.

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const when = (due: string, today: string) => {
  const d = daysBetween(today, due);
  if (d <= 0) return 'pra hoje';
  if (d === 1) return 'amanhã';
  return new Date(`${due}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

export function useResult(id: ToolId): ToolResult | undefined {
  const [r, setR] = useState(() => getResults()[id]);
  useEffect(() => {
    const on = () => setR(getResults()[id]);
    window.addEventListener('gs-resultados', on);
    return () => window.removeEventListener('gs-resultados', on);
  }, [id]);
  return r;
}

export function ToolPanel({ id }: { id: ToolId }) {
  const result = useResult(id);
  const tasks = useTasks().filter((t) => t.source === id);
  const today = todayBRT();
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const done = tasks.filter((t) => t.done);
  const [history, setHistory] = useState(false);
  const journey = JOURNEYS[id];
  const stage = !result ? 0 : tasks.length > 0 && open.length === 0 ? 2 : 1;
  const c = result?.card;

  return (
    <div className="tool-panel">
      {journey && (
        <ol className="journey-line" aria-label="Começo, meio e fim">
          {journey.map((text, i) => (
            <li key={i} className={i < stage ? 'done' : i === stage ? 'now' : ''} title={text}>
              <span className="jl-dot">{i < stage ? <Check size={11} /> : null}</span>
              <span>{i === stage ? text : ['Começo', 'Meio', 'Fim'][i]}</span>
            </li>
          ))}
        </ol>
      )}

      {result && (
        <div className="card panel-card">
          <div className="card-row">
            <span className="card-label">{c?.label ?? 'Seu resultado'}</span>
            <small className="panel-date">Atualizado em {dayMonth(result.at)}</small>
          </div>
          <b className="panel-big">{c?.big ?? result.summary}</b>
          {c && c.rows.length > 0 && (
            <div className="panel-tiles">
              {c.rows.slice(0, 4).map(([k, v], i) => (
                <span key={i}>
                  <small>{k}</small>
                  <b>{v}</b>
                </span>
              ))}
            </div>
          )}
          {result.history && result.history.length > 0 && (
            <>
              <button type="button" className="link-btn" aria-expanded={history} onClick={() => setHistory((v) => !v)}>
                <ChevronDown size={14} style={{ transform: history ? 'rotate(180deg)' : undefined, verticalAlign: '-2px' }} /> Histórico ({result.history.length})
              </button>
              {history && (
                <ul className="panel-history">
                  {result.history.map((h, i) => (
                    <li key={i}>
                      <small>{dayMonth(h.at)}</small>
                      <span>{h.summary}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="card">
          <div className="card-row">
            <span className="card-label">Seus passos</span>
            <small className="panel-date">{done.length} de {tasks.length} feitos</small>
          </div>
          <div className="jp-bar"><i style={{ width: `${Math.max(3, (done.length / tasks.length) * 100)}%` }} /></div>
          <ul className="task-list">
            {open.map((t) => (
              <li key={t.id} className={t.due <= today ? 'today' : ''}>
                <button type="button" className="task-check" aria-label={`Marcar como feito: ${t.text}`} onClick={() => markTaskDone(t.id)}>
                  <Check size={15} />
                </button>
                <span className="task-copy">
                  <b>{t.text}</b>
                  <small>{when(t.due, today)}{t.repeat === 'monthly' ? ' · todo mês' : ''}</small>
                </span>
              </li>
            ))}
            {done.map((t) => (
              <li key={t.id} className="done">
                <span className="task-check on"><Check size={15} /></span>
                <span className="task-copy">
                  <b>{t.text}</b>
                  <small>feito</small>
                </span>
                <button type="button" className="link-btn" aria-label="Desfazer" onClick={() => unmarkTask(t.id)}><Undo2 size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
