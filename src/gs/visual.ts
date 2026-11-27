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
    const raiz = document.documentElement;
    let timer = 0;
    const aoRolar = () => {
      raiz.classList.add('gs-rolando');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => raiz.classList.remove('gs-rolando'), 140);
    };
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.clearTimeout(timer);
      raiz.classList.remove('gs-rolando');
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
