import { useEffect, useRef, useState, CSSProperties, ReactNode, ElementType } from 'react';

// Utilitários de animação do site: revelar ao rolar, números que "contam" e barras que crescem.
// Tudo respeita prefers-reduced-motion — quem desativou animações no sistema vê o estado final direto.

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Retorna true (uma única vez) quando o elemento entra na tela. */
export function useInView<T extends Element>(rootMargin = '0px 0px -8% 0px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

/** Envolve um bloco que aparece suavemente (fade + subida) quando entra na tela. */
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
  style,
  variant = 'up',
  ...rest
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  variant?: 'up' | 'fade' | 'scale' | 'left' | 'right';
} & Record<string, unknown>) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${variant} ${inView ? 'is-visible' : ''} ${className}`}
      style={{ ...style, transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Anima um número de 0 (ou do valor anterior) até `value`. Começa quando entra na tela. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString('pt-BR'),
  duration = 1100,
  render,
  className,
  style,
}: {
  value: number;
  format?: (n: number) => string;
  /** em vez de texto, desenha o número (ex.: o valor em estilo cédula) */
  render?: (n: number) => ReactNode;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>('0px');
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    // mudanças pequenas (digitando num campo) animam mais rápido que a entrada inicial
    const dur = from === 0 ? duration : Math.min(duration, 450);
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const current = from + (value - from) * easeOutCubic(t);
      setDisplay(current);
      fromRef.current = current;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, inView, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {render ? render(display) : format(display)}
    </span>
  );
}

/** Largura que começa em 0 e cresce até `pct` quando o elemento aparece. */
export function useGrowWidth(pct: number) {
  const { ref, inView } = useInView<HTMLDivElement>('0px');
  const width = inView ? `${Math.max(0, Math.min(pct, 100))}%` : '0%';
  return { ref, width };
}

export function AnimatedFill({
  pct,
  className,
  style,
  delay = 0,
}: {
  pct: number;
  className: string;
  style?: CSSProperties;
  delay?: number;
}) {
  const { ref, width } = useGrowWidth(pct);
  return <div ref={ref} className={`${className} grow-fill`} style={{ ...style, width, transitionDelay: `${delay}ms` }} />;
}
