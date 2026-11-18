// Gráficos pequenos dos cards do Início (só desenho; os números vêm prontos).

import { useEffect, useId, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Barrinhas. Arrastar o dedo mostra o valor daquele dia. */
export function MiniBarras({ valores, rotulo, rotulos, onEscolha }: { valores: number[]; rotulo: string; rotulos?: string[]; onEscolha?: (i: number) => void }) {
  const max = Math.max(1, ...valores);
  const [i, setI] = useState<number | null>(null);
  const escolher = (ev: ReactPointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const idx = Math.min(valores.length - 1, Math.max(0, Math.floor(((ev.clientX - r.left) / Math.max(1, r.width)) * valores.length)));
    setI((prev) => {
      if (prev !== idx) onEscolha?.(idx);
      return idx;
    });
  };
  const ativo = i ?? valores.length - 1;
  return (
    <span className="gm-toque">
      <svg className="gm-barras" viewBox={`0 0 ${valores.length * 10} 32`} role="img" aria-label={rotulo} preserveAspectRatio="none" onPointerDown={escolher} onPointerMove={(ev) => { if (ev.buttons === 1 || ev.pointerType === 'touch') escolher(ev); }}>
        {valores.map((v, n) => { const h = Math.max(3, (v / max) * 30); return <rect key={n} x={n * 10 + 2} y={32 - h} width={6} height={h} rx={3} className={n === ativo ? 'hoje' : ''} style={{ animationDelay: `${n * 45}ms` }} />; })}
      </svg>
      {i !== null && <em className="gm-dica">{rotulos?.[i] ?? `Dia ${i + 1}`} · {valores[i].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</em>}
    </span>
  );
}

/** Meia-lua de progresso (0 a 100), com o número no meio. */
export function Medidor({ pct, rotulo, legenda }: { pct: number; rotulo: string; legenda: string }) {
  const gid = useId().replace(/:/g, '');
  const reduz = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const alvo = Math.max(0, Math.min(100, pct));
  const [p, setP] = useState(() => (reduz ? alvo : 0));
  useEffect(() => {
    if (reduz) { setP(alvo); return; }
    const id = requestAnimationFrame(() => setP(alvo));
    return () => cancelAnimationFrame(id);
  }, [alvo, reduz]);
  const r = 42, c = Math.PI * r;
  return (
    <div className="gm-medidor" role="img" aria-label={`${rotulo}: ${Math.round(alvo)}%`}>
      <svg viewBox="0 0 100 56" aria-hidden="true">
        <defs><linearGradient id={gid} x1="0" x2="1"><stop offset="0" stopColor="#E6C77A" /><stop offset="1" stopColor="#A9822E" /></linearGradient></defs>
        <path d="M8 50 A42 42 0 0 1 92 50" className="trilha" />
        <path d="M8 50 A42 42 0 0 1 92 50" className="valor" stroke={`url(#${gid})`} strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} />
      </svg>
      <b>{Math.round(p)}%</b>
      <small>{legenda}</small>
    </div>
  );
}

/** Linha com área (ex.: gasto acumulado do mês, dia a dia). `ate` marca até que ponto há dado (o resto do mês fica vazio). */
export function LinhaArea({ valores, ate, rotulo }: { valores: number[]; ate: number; rotulo: string }) {
  const W = 300, H = 110, n = Math.max(2, valores.length);
  const max = Math.max(1, ...valores);
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - 8 - (v / max) * (H - 22);
  const pts = valores.slice(0, Math.max(1, ate)).map((v, i) => [x(i), y(v)] as const);
  const linha = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`).join(' ');
  const ult = pts[pts.length - 1];
  return (
    <svg className="gm-linha" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo} preserveAspectRatio="none">
      <defs><linearGradient id="gm-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D9B45E" stopOpacity=".38" /><stop offset="1" stopColor="#D9B45E" stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75].map((k) => <line key={k} x1={0} x2={W} y1={H * k} y2={H * k} className="grade" />)}
      {pts.length > 1 && <path d={`${linha} L${ult[0].toFixed(1)} ${H} L0 ${H} Z`} fill="url(#gm-area)" />}
      {pts.length > 1 && <path d={linha} className="traco" pathLength={1} vectorEffect="non-scaling-stroke" />}
      <circle cx={ult[0]} cy={ult[1]} r={4} className="ponto" />
    </svg>
  );
}

/** Linha fina (ex.: dentro do card colorido). */
export function MiniLinha({ valores, rotulo }: { valores: number[]; rotulo: string }) {
  const W = 80, H = 32, n = Math.max(2, valores.length);
  const max = Math.max(1, ...valores), min = Math.min(...valores, 0);
  const d = valores.map((v, i) => `${i ? 'L' : 'M'}${((i / (n - 1)) * W).toFixed(1)} ${(H - 3 - ((v - min) / (max - min || 1)) * (H - 6)).toFixed(1)}`).join(' ');
  return <svg className="gm-minilinha" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo}><path d={d} pathLength={1} /></svg>;
}

/** Degraus: quanto das contas do mês já venceu até cada dia, com a marca de hoje. */
export function LinhaDegraus({ valores, hoje, rotulo }: { valores: number[]; hoje: number; rotulo: string }) {
  const W = 300, H = 120, n = Math.max(2, valores.length);
  const max = Math.max(1, ...valores);
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - 10 - (v / max) * (H - 26);
  let d = `M0 ${y(valores[0] ?? 0).toFixed(1)}`;
  for (let i = 1; i < valores.length; i++) d += ` H${x(i).toFixed(1)} V${y(valores[i]).toFixed(1)}`;
  const hi = Math.max(0, Math.min(valores.length - 1, hoje - 1));
  return (
    <svg className="gm-linha gm-degraus" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo} preserveAspectRatio="none">
      <defs><linearGradient id="gm-area2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D9B45E" stopOpacity=".3" /><stop offset="1" stopColor="#D9B45E" stopOpacity="0" /></linearGradient></defs>
      {[0.3, 0.55, 0.8].map((k) => <line key={k} x1={0} x2={W} y1={H * k} y2={H * k} className="grade" />)}
      <path d={`${d} V${H} H0 Z`} fill="url(#gm-area2)" />
      <path d={d} className="traco" pathLength={1} vectorEffect="non-scaling-stroke" />
      <line x1={x(hi)} x2={x(hi)} y1={6} y2={H} className="hoje" vectorEffect="non-scaling-stroke" />
      <circle cx={x(hi)} cy={y(valores[hi] ?? 0)} r={4.5} className="ponto" />
    </svg>
  );
}
