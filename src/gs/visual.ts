// O visual novo (areia e dourado) vale só dentro do app: a landing e as páginas públicas ficam como estão.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PUBLICAS = ['/admin'];

export function rotaDoApp(pathname: string): boolean {
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return true;
}

export function useVisualDoApp(forcar?: boolean) {
  const { pathname } = useLocation();
  const on = forcar ?? rotaDoApp(pathname);
  useEffect(() => {
    let timer = 0;
    let ativo = false;
    let pausadas: Animation[] = [];
    const aoRolar = () => {
      if (!ativo) {
        ativo = true;
        const nos = document.querySelectorAll('.lx-faixa-in, .lx-flut, .lx-ponto, .as-orbe, .midas-svg, .pv-kpi.ouro, .cm-vivo, .rv-vivo, .cm-sino, .vd-blob, .medallion, .lp-raios');
        const achadas: Animation[] = [];
        nos.forEach((el) => achadas.push(...el.getAnimations({ subtree: true })));
        pausadas = achadas.filter((a) => {
          const vezes = a.effect && 'getTiming' in a.effect ? a.effect.getTiming().iterations : 1;
          return a.playState === 'running' && vezes === Infinity;
        });
        for (const a of pausadas) a.pause();
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        for (const a of pausadas) a.play();
        pausadas = [];
        ativo = false;
      }, 160);
    };
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.clearTimeout(timer);
      for (const a of pausadas) a.play();
    };
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('gs-app', on);
    const icone = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const antes = icone?.getAttribute('href');
    if (on && icone) icone.setAttribute('href', '/moeda.svg');
    el.style.setProperty('color-scheme', on ? 'light' : '');
    return () => {
      el.classList.remove('gs-app');
      if (icone && antes) icone.setAttribute('href', antes);
    };
  }, [on]);
  return on;
}
