import { useEffect, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useContagem } from './contagem';

/* Peças do painel de vidro, para qualquer tela. CSS em vidroBase.css. */

export function movimentoReduzido(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function aplicarInclinar(el: HTMLElement, clientX: number, clientY: number, giro = true) {
  const r = el.getBoundingClientRect();
  const px = (clientX - r.left) / Math.max(1, r.width);
  const py = (clientY - r.top) / Math.max(1, r.height);
  if (giro) {
    el.style.setProperty('--rx', `${((0.5 - py) * 6).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((px - 0.5) * 8).toFixed(2)}deg`);
  }
  el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
  el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
}

export function soltarInclinar(el: HTMLElement) {
  el.style.setProperty('--rx', '0deg');
  el.style.setProperty('--ry', '0deg');
}

export function inclinar(ev: { currentTarget: HTMLElement; clientX: number; clientY: number }) {
  if (movimentoReduzido()) return;
  aplicarInclinar(ev.currentTarget, ev.clientX, ev.clientY, true);
}

export function soltar(ev: { currentTarget: HTMLElement }) {
  soltarInclinar(ev.currentTarget);
}

const TILT = '.vd-vidro, .vd-inclina, .gs-card, .cm-card, .ini-destaque, .cm-topo-area, .ms-perfil, .ms-agora, .pn-card, .pn-acao, .pn-ftile, .lp-calc, .lp-f, .login-wall, .gs-plano';

function alvoTilt(ev: Event): HTMLElement | null {
  const t = ev.target;
  if (!(t instanceof Element)) return null;
  if (t.closest('input, textarea, select, .gs-folha, .cm-abas, .cm-lateral')) return null;
  const el = t.closest(TILT);
  return el instanceof HTMLElement ? el : null;
}

/** Fundo com as três luzes e o brilho no toque. Uma vez no app, para não reiniciar a cada tela. */
export function VidroCamada() {
  useEffect(() => {
    let alvo: HTMLElement | null = null;
    let solta = 0;
    const limpar = () => {
      if (alvo) soltarInclinar(alvo);
      alvo = null;
    };
    const onda = (ev: PointerEvent) => {
      if (movimentoReduzido()) return;
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.vd, .gs-folha, input, textarea, select, nav, aside, .cm-abas, .cm-lateral')) return;
      const host = document.querySelector('.vd-ondas-app');
      if (!host) return;
      const el = document.createElement('i');
      el.className = 'vd-onda';
      el.style.left = `${ev.clientX}px`;
      el.style.top = `${ev.clientY}px`;
      host.appendChild(el);
      window.setTimeout(() => el.remove(), 700);
    };
    const mover = (ev: PointerEvent) => {
      if (movimentoReduzido() || ev.pointerType !== 'mouse') return;
      const el = alvoTilt(ev);
      if (alvo && alvo !== el) soltarInclinar(alvo);
      alvo = el;
      if (el) aplicarInclinar(el, ev.clientX, ev.clientY, true);
    };
    const toque = (ev: PointerEvent) => {
      if (movimentoReduzido() || ev.pointerType === 'mouse') return;
      const el = alvoTilt(ev);
      if (!el) return;
      if (alvo && alvo !== el) soltarInclinar(alvo);
      alvo = el;
      aplicarInclinar(el, ev.clientX, ev.clientY, true);
      window.clearTimeout(solta);
      solta = window.setTimeout(limpar, 480);
    };
    window.addEventListener('pointerdown', onda);
    window.addEventListener('pointerdown', toque);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', limpar);
    window.addEventListener('pointercancel', limpar);
    return () => {
      window.removeEventListener('pointerdown', onda);
      window.removeEventListener('pointerdown', toque);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', limpar);
      window.removeEventListener('pointercancel', limpar);
      window.clearTimeout(solta);
      limpar();
    };
  }, []);
  return <FundoAnimado fixo />;
}

export function FundoAnimado({ fixo = false }: { fixo?: boolean }) {
  return (
    <div className={fixo ? 'vd-fundo vd-fundo-app' : 'vd-fundo'} aria-hidden="true">
      <i className="vd-blob ouro" />
      <i className="vd-blob ambar" />
      <i className="vd-blob violeta" />
      {fixo && <div className="vd-ondas vd-ondas-app" />}
    </div>
  );
}

/** Cartão de vidro com inclinação. O painel e as outras telas usam o mesmo. */
export function CartaoVidro({
  className = '',
  children,
  style,
  onPointerMove,
  onPointerLeave,
  ...rest
}: {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
  onPointerMove?: (ev: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (ev: ReactPointerEvent<HTMLElement>) => void;
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'style' | 'children' | 'onPointerMove' | 'onPointerLeave'>) {
  return (
    <section
      className={`vd-vidro${className ? ` ${className}` : ''}`}
      style={style}
      onPointerMove={(ev) => {
        inclinar(ev);
        onPointerMove?.(ev);
      }}
      onPointerLeave={(ev) => {
        soltar(ev);
        onPointerLeave?.(ev);
      }}
      {...rest}
    >
      {children}
    </section>
  );
}

/** Troca de tela com profundidade. O som de navegar continua no OuvirSons. */
export function TransicaoTela({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="vd-tela">
      {children}
    </div>
  );
}

/** Conta o número de verdade. Com menos movimento, mostra o valor final. */
export function NumeroVidro({ valor, formato, ms = 900 }: { valor: number; formato: (n: number) => string; ms?: number }) {
  const n = useContagem(valor, ms);
  return <>{formato(n)}</>;
}
