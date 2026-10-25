import { useMemo, useRef, useState } from 'react';
import { mesCurto } from '../datas';

/* ---------- Gráfico de linha em SVG próprio: rentabilidade acumulada em 12 meses (base 100) ---------- */

export interface Serie {
  id: string;
  nome: string;
  cor: string;
  valores: number[];
}

const W = 340;
const H = 190;
const M = { t: 10, r: 10, b: 24, l: 34 };

export function Grafico({ meses, series }: { meses: string[]; series: Serie[] }) {
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [idx, setIdx] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const visiveis = series.filter((s) => !ocultas.includes(s.id));
  const { min, max } = useMemo(() => {
    const todos = (visiveis.length ? visiveis : series).flatMap((s) => s.valores);
    const lo = Math.min(...todos, 100);
    const hi = Math.max(...todos, 100);
    const pad = (hi - lo) * 0.08 || 2;
    return { min: lo - pad, max: hi + pad };
  }, [visiveis, series]);
  const x = (i: number) => M.l + (i / Math.max(1, meses.length - 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - min) / (max - min)) * (H - M.t - M.b);
  const caminho = (v: number[]) => v.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const mover = (ev: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((ev.clientX - r.left) / r.width) * W;
    setIdx(Math.max(0, Math.min(meses.length - 1, Math.round(((px - M.l) / (W - M.l - M.r)) * (meses.length - 1)))));
  };
  const ticks = [min, (min + max) / 2, max];
  const resumo = series.map((s) => `${s.nome}: ${(s.valores[s.valores.length - 1] - 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`).join('. ');
  return (
    <div>
      <div className="gs-chips" role="group" aria-label="Séries do gráfico">
        {series.map((s) => {
          const on = !ocultas.includes(s.id);
          return (
            <button key={s.id} type="button" className={`gs-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setOcultas(on ? [...ocultas, s.id] : ocultas.filter((o) => o !== s.id))}>
              <i style={{ width: 10, height: 10, borderRadius: '50%', background: s.cor, marginRight: 6, display: 'inline-block' }} />
              {s.nome}
            </button>
          );
        })}
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', touchAction: 'pan-y' }} role="img" aria-label={`Gráfico de linha, rentabilidade acumulada em 12 meses, base 100. ${resumo}.`} onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setIdx(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={M.l - 4} y={y(t) + 3} fontSize="9" textAnchor="end" fill="var(--ink-muted)">{Math.round(t)}</text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={y(100)} y2={y(100)} stroke="var(--line-strong)" strokeDasharray="3 3" />
        {[0, Math.floor((meses.length - 1) / 2), meses.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="9" textAnchor={i === 0 ? 'start' : i === meses.length - 1 ? 'end' : 'middle'} fill="var(--ink-muted)">{mesCurto(meses[i])}</text>
        ))}
        {visiveis.map((s) => (
          <path key={s.id} d={caminho(s.valores)} fill="none" stroke={s.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {idx !== null && (
          <g>
            <line x1={x(idx)} x2={x(idx)} y1={M.t} y2={H - M.b} stroke="var(--ink-muted)" strokeDasharray="2 2" />
            {visiveis.map((s) => <circle key={s.id} cx={x(idx)} cy={y(s.valores[idx])} r="3.5" fill={s.cor} stroke="#fff" strokeWidth="1.5" />)}
          </g>
        )}
      </svg>
      <div className="gs-banner" aria-live="polite" style={{ minHeight: 44 }}>
        {idx === null ? 'Toque no gráfico pra ver o valor em cada data.' : (
          <>
            <b>{mesCurto(meses[idx])}</b>
            {' · '}
            {visiveis.map((s) => `${s.nome}: ${(s.valores[idx] - 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })}%`).join(' · ')}
          </>
        )}
      </div>
      <details>
        <summary className="gs-mudo" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Ver em tabela</summary>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <caption className="gs-mudo" style={{ textAlign: 'left' }}>Rentabilidade acumulada (base 100)</caption>
            <thead><tr><th scope="col" style={{ textAlign: 'left' }}>Mês</th>{series.map((s) => <th key={s.id} scope="col" style={{ textAlign: 'right' }}>{s.nome}</th>)}</tr></thead>
            <tbody>{meses.map((m, i) => <tr key={m}><th scope="row" style={{ textAlign: 'left', fontWeight: 500 }}>{mesCurto(m)}</th>{series.map((s) => <td key={s.id} style={{ textAlign: 'right' }}>{s.valores[i].toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
