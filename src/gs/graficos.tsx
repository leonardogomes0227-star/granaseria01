import { brl0 } from './datas';

/* ---------- Gráficos em SVG próprio (sem biblioteca): linha, barras, rosca e anel ---------- */

export function Linha({ serie, fim, rotulo }: { serie: number[]; fim: string; rotulo: string }) {
  const W = 320;
  const H = 130;
  const mx = Math.max(...serie, 1);
  const n = Math.max(1, serie.length - 1);
  const pts = serie.map((v, i) => [(i / n) * (W - 8) + 4, 6 + (1 - v / mx) * (H - 22)] as const);
  const l = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 8 }} role="img" aria-label={rotulo}>
      <path d={`${l} L${W - 4},${H - 16} L4,${H - 16}Z`} fill="rgba(197,160,89,0.22)" />
      <path d={l} fill="none" stroke="var(--gold-strong)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <text x="4" y={H - 3} fontSize="10" fill="var(--ink-muted)">hoje</text>
      <text x={W - 4} y={H - 3} fontSize="10" textAnchor="end" fill="var(--ink-muted)">{fim}</text>
      <text x="6" y="14" fontSize="10" fill="var(--ink-muted)">{brl0(mx)}</text>
    </svg>
  );
}

export function Barras({ dados, rotulos, nomes, rotulo }: { dados: [number, number][]; rotulos: string[]; nomes: [string, string]; rotulo: string }) {
  const W = 330;
  const H = 150;
  const mx = Math.max(...dados.map((d) => Math.max(d[0], d[1])), 1) * 1.1;
  const bw = (W - 20) / dados.length;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={rotulo}>
        <line x1="10" x2={W - 10} y1={8} y2={8} stroke="var(--line)" />
        <line x1="10" x2={W - 10} y1={8 + (H - 34) / 2} y2={8 + (H - 34) / 2} stroke="var(--line)" />
        {dados.map((d, i) => {
          const x = 10 + i * bw;
          const h1 = (d[0] / mx) * (H - 34);
          const h2 = (d[1] / mx) * (H - 34);
          return (
            <g key={i}>
              <rect x={x + bw * 0.14} y={H - 26 - h1} width={bw * 0.32} height={h1} rx="4" fill="var(--success)" />
              <rect x={x + bw * 0.5} y={H - 26 - h2} width={bw * 0.32} height={h2} rx="4" fill="var(--gold-strong)" />
              <text x={x + bw / 2} y={H - 9} fontSize="10" textAnchor="middle" fill="var(--ink-muted)">{rotulos[i]}</text>
            </g>
          );
        })}
      </svg>
      <p className="gs-mudo" style={{ margin: '4px 0 0', fontSize: 12 }}>
        <span style={{ color: 'var(--success)' }}>■</span> {nomes[0]} &nbsp;<span style={{ color: 'var(--gold-strong)' }}>■</span> {nomes[1]}
      </p>
    </div>
  );
}

export function Anel({ pct, grande, sub, cor = 'var(--gold-strong)', tamanho = 120 }: { pct: number; grande: string; sub: string; cor?: string; tamanho?: number }) {
  const r = 52;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 130 130" width={tamanho} height={tamanho} role="img" aria-label={`${sub}: ${grande}`} style={{ display: 'block', maxWidth: '100%' }}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="var(--bg-2)" strokeWidth="12" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={cor} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(p / 100) * C} ${C}`} transform="rotate(-90 65 65)" style={{ transition: 'stroke-dasharray .6s cubic-bezier(.22,1,.36,1)' }} />
      <text x="65" y="70" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize={grande.length > 3 ? 26 : 34} fill="var(--ink)">{grande}</text>
      <text x="65" y="88" textAnchor="middle" fontSize="10" fill="var(--ink-muted)">{sub}</text>
    </svg>
  );
}

export interface FatiaGrafico {
  id: string;
  cor: string;
  valor: number;
}
export function Rosquinha({ fatias, centro, sub }: { fatias: FatiaGrafico[]; centro: string; sub: string }) {
  const tot = fatias.reduce((t, f) => t + f.valor, 0) || 1;
  const r = 42;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" style={{ width: '100%', maxWidth: 190, margin: '0 auto', display: 'block' }} role="img" aria-label={`Gráfico por categoria. Total ${centro}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--bg-2)" strokeWidth="14" />
      <g transform="rotate(-90 60 60)">
        {fatias.filter((f) => f.valor > 0).map((f) => {
          const p = (f.valor / tot) * C;
          const o = -acc;
          acc += p;
          return <circle key={f.id} cx="60" cy="60" r={r} fill="none" stroke={f.cor} strokeWidth="14" strokeDasharray={`${Math.max(0, p - 1.5)} ${C}`} strokeDashoffset={o} />;
        })}
      </g>
      <text x="60" y="58" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="15" fill="var(--ink)">{centro}</text>
      <text x="60" y="72" textAnchor="middle" fontSize="7.5" fill="var(--ink-muted)">{sub}</text>
    </svg>
  );
}
