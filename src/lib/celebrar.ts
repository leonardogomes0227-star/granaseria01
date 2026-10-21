// Comemorações (spec v2, seção 9): confete dourado e uma vibração leve, respeitando quem pediu menos movimento.

import confetti from 'canvas-confetti';

const DOURADO = ['#C98A1E', '#E9B04C', '#F3D38A', '#1A382B', '#FFFFFF'];

export const poucoMovimento = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function vibrar(ms = 30) {
  try {
    if (!poucoMovimento()) navigator.vibrate?.(ms);
  } catch {
    // aparelho sem vibração
  }
}

/** Confete dourado. "grande" = missão concluída (tela cheia); "pequeno" = começar a missão, passo feito. */
export function confete(tamanho: 'pequeno' | 'grande' = 'pequeno') {
  if (poucoMovimento()) return;
  try {
    if (tamanho === 'pequeno') {
      void confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 }, colors: DOURADO, disableForReducedMotion: true, zIndex: 120 });
      return;
    }
    const fim = Date.now() + 900;
    const rajada = () => {
      void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors: DOURADO, zIndex: 120, disableForReducedMotion: true });
      void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors: DOURADO, zIndex: 120, disableForReducedMotion: true });
      if (Date.now() < fim) requestAnimationFrame(rajada);
    };
    rajada();
  } catch {
    // sem canvas: segue sem confete
  }
}
