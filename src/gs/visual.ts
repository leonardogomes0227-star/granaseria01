// O visual novo (areia e dourado) vale só dentro do app: a landing e as páginas públicas ficam como estão.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { painelToken } from '../painel';

const PUBLICAS = ['/guias', '/termos-de-uso', '/politica-de-privacidade', '/diagnostico', '/admin', '/ferramentas'];

export function rotaDoApp(pathname: string, logado: boolean): boolean {
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  if ((pathname === '/' || pathname === '/inicio') && !logado) return false;
  return true;
}

export function useVisualDoApp(forcar?: boolean) {
  const { pathname } = useLocation();
  const on = forcar ?? rotaDoApp(pathname, Boolean(painelToken()));
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
