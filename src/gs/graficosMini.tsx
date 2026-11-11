// Gráficos pequenos dos cards do Início (só desenho; os números vêm prontos).

/** Barrinhas (ex.: gasto dos últimos 7 dias). A última barra é a de hoje, em destaque. */
export function MiniBarras({ valores, rotulo }: { valores: number[]; rotulo: string }) {
  const max = Math.max(1, ...valores);
  return (
    <svg className="gm-barras" viewBox={`0 0 ${valores.length * 10} 32`} role="img" aria-label={rotulo} preserveAspectRatio="none">
      {valores.map((v, i) => { const h = Math.max(3, (v / max) * 30); return <rect key={i} x={i * 10 + 2} y={32 - h} width={6} height={h} rx={3} className={i === valores.length - 1 ? 'hoje' : ''} />; })}
    </svg>
  );
}

/** Meia-lua de progresso (0 a 100), com o número no meio. */
export function Medidor({ pct, rotulo, legenda }: { pct: number; rotulo: string; legenda: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const r = 42, c = Math.PI * r;
  return (
    <div className="gm-medidor" role="img" aria-label={`${rotulo}: ${Math.round(p)}%`}>
      <svg viewBox="0 0 100 56" aria-hidden="true">
        <defs><linearGradient id="gm-ouro" x1="0" x2="1"><stop offset="0" stopColor="#E6C77A" /><stop offset="1" stopColor="#A9822E" /></linearGradient></defs>
        <path d="M8 50 A42 42 0 0 1 92 50" className="trilha" />
        <path d="M8 50 A42 42 0 0 1 92 50" className="valor" stroke="url(#gm-ouro)" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} />
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
      {pts.length > 1 && <path d={linha} className="traco" vectorEffect="non-scaling-stroke" />}
      <circle cx={ult[0]} cy={ult[1]} r={4} className="ponto" />
    </svg>
  );
}
