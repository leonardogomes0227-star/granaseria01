/* ---------- Anel de progresso (spec v2, 7.3 e 9): 0% fica vazio; anima do valor anterior pro novo ---------- */

export function Anel({ pct, tamanho = 64, espessura = 7, rotulo, tom = 'verde' }: { pct: number; tamanho?: number; espessura?: number; rotulo?: string; tom?: 'verde' | 'ambar' | 'dourado' | 'claro' }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={`anel ${tom}`} style={{ width: tamanho, height: tamanho }} role="img" aria-label={rotulo ?? `${p}% concluído`}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
        <circle className="anel-trilha" cx={tamanho / 2} cy={tamanho / 2} r={r} strokeWidth={espessura} fill="none" />
        {p > 0 && (
          <circle
            className="anel-valor"
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={r}
            strokeWidth={espessura}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p / 100)}
            transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
          />
        )}
      </svg>
      <b className="anel-pct" aria-hidden="true">
        {p}%
      </b>
    </span>
  );
}
