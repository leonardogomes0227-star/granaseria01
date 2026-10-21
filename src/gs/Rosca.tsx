import { useEffect, useState } from 'react';
import { brl0, pct as fmtPct } from './datas';
import type { Fatia } from './selectores';

/* ---------- Rosca da renda do mês (SVG próprio): Gastos fixos | Livre para gastar | Guardado ---------- */

const COR: Record<Fatia['id'], string> = { fixos: 'var(--ink)', livre: 'var(--gold)', guardado: 'var(--success)' };
const R = 42;
const C = 2 * Math.PI * R;

export function Rosca({ fatias, guardadoTotal, semRenda }: { fatias: Fatia[]; guardadoTotal: number; semRenda?: boolean }) {
  const [montada, setMontada] = useState(false);
  const [sel, setSel] = useState<Fatia['id'] | null>(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMontada(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  const atual = fatias.find((f) => f.id === sel);
  const descricao = semRenda || total <= 0 ? 'Rosca vazia: informe sua renda.' : `Rosca da renda do mês. ${fatias.map((f) => `${f.rotulo}: ${brl0(f.valor)}, ${fmtPct(f.pct)}`).join('. ')}.`;
  let acumulado = 0;
  return (
    <div>
      <div className="gs-rosca" role="img" aria-label={descricao}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-2)" strokeWidth="13" style={{ cursor: 'default' }} />
          <g transform="rotate(-90 50 50)">
          {total > 0 &&
            fatias.map((f) => {
              const parte = (f.valor / total) * C;
              const inicio = acumulado;
              acumulado += parte;
              if (parte <= 0) return null;
              const gap = parte > 2 ? 1.2 : 0;
              return (
                <circle
                  key={f.id}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={COR[f.id]}
                  strokeWidth="13"
                  strokeDasharray={`${montada ? Math.max(0, parte - gap) : 0} ${C}`}
                  strokeDashoffset={-inicio}
                  className={sel ? (sel === f.id ? 'sel' : 'fraca') : ''}
                  style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)' }}
                  onClick={() => setSel(sel === f.id ? null : f.id)}
                />
              );
            })}
          </g>
        </svg>
        <div className="gs-rosca-centro">
          {atual ? (
            <>
              <small>{atual.rotulo}</small>
              <b className="gs-tab">{brl0(atual.valor)}</b>
              <small>{fmtPct(atual.pct)} da renda</small>
            </>
          ) : (
            <>
              <small>Guardado até hoje</small>
              <b className="gs-tab">{brl0(guardadoTotal)}</b>
            </>
          )}
        </div>
      </div>
      <div className="gs-legenda">
        {fatias.map((f) => (
          <button key={f.id} type="button" className={sel === f.id ? 'on' : ''} aria-pressed={sel === f.id} onClick={() => setSel(sel === f.id ? null : f.id)}>
            <i style={{ background: COR[f.id] }} />
            <span>{f.rotulo}</span>
            <b className="gs-tab">{brl0(f.valor)}</b>
            <small className="gs-tab">{fmtPct(f.pct)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
