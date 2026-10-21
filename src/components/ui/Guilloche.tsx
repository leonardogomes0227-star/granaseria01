import { useEffect, useMemo, useRef } from 'react';
import { poucoMovimento } from '../../lib/celebrar';

/* ---------- Guilhochê de cédula (Ouro Antigo, 4.2): anéis ondulados concêntricos, bem sutis ---------- */
// Faz um parallax de 4px com o mouse (PC) ou ao inclinar o celular; quem pediu menos movimento não vê.

function aneis(n = 16): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = 18 + i * 9;
    const amp = 2.2 + (i % 3);
    const ondas = 18 + (i % 4) * 2;
    let d = '';
    for (let k = 0; k <= 360; k += 3) {
      const t = (k * Math.PI) / 180;
      const rr = r + amp * Math.sin(ondas * t + i);
      d += `${k === 0 ? 'M' : 'L'}${(160 + rr * Math.cos(t)).toFixed(1)},${(160 + rr * Math.sin(t)).toFixed(1)}`;
    }
    out.push(`${d}Z`);
  }
  return out;
}

export function Guilloche() {
  const paths = useMemo(() => aneis(), []);
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (poucoMovimento()) return;
    let raf = 0;
    const mover = (x: number, y: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ref.current) ref.current.style.transform = `translate3d(${x * 4}px, ${y * 4}px, 0)`;
      });
    };
    const onMouse = (e: MouseEvent) => mover(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      mover(Math.max(-1, Math.min(1, e.gamma / 30)) / 2, Math.max(-1, Math.min(1, (e.beta - 40) / 30)) / 2);
    };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);
  return (
    <svg ref={ref} className="guilloche" viewBox="0 0 320 320" aria-hidden="true" focusable="false">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="0.7" />
      ))}
    </svg>
  );
}

/** Divisor ornamentado: fio fino com um losango dourado no meio (lugares nobres). */
export function Ornamento({ className = '' }: { className?: string }) {
  return (
    <span className={`ornamento ${className}`} aria-hidden="true">
      <i />
      <b />
      <i />
    </span>
  );
}
