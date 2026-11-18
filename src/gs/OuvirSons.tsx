import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../account';
import { painelToken } from '../painel';
import { rotaDoApp } from './visual';
import { marcarGesto, sonsLigados, tocar } from './sons';

/* ---------- Toque, troca de tela e erro, só depois que a pessoa age e só dentro do app ---------- */

function controleDe(alvo: EventTarget | null): HTMLElement | null {
  if (!(alvo instanceof Element)) return null;
  const el = alvo.closest('button, a, [role="button"], [role="switch"], summary');
  return el instanceof HTMLElement ? el : null;
}

export function OuvirSons() {
  const { pathname } = useLocation();
  const session = useSession();
  const noApp = rotaDoApp(pathname) && Boolean(painelToken() || session);
  const primeiro = useRef(true);
  const noAppRef = useRef(noApp);
  noAppRef.current = noApp;

  useEffect(() => {
    if (!noApp) return;
    const tocarSe = (tipo: 'toque' | 'erro') => { if (noAppRef.current && sonsLigados()) tocar(tipo); };
    const noPonteiro = (ev: PointerEvent) => {
      marcarGesto();
      const el = controleDe(ev.target);
      if (!el || el.closest('.as-painel')) return;
      if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return;
      const link = el.closest('a[href]');
      if (link instanceof HTMLAnchorElement) {
        if (link.target === '_blank' || link.origin !== window.location.origin) tocarSe('toque');
        return;
      }
      tocarSe('toque');
    };
    const naTecla = (ev: KeyboardEvent) => {
      marcarGesto();
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const el = controleDe(ev.target);
      if (!el || el.closest('a[href]') || el.matches(':disabled')) return;
      tocarSe('toque');
    };
    const avisos = new Set<Element>();
    const olhar = new MutationObserver((lista) => {
      for (const m of lista) {
        const nos = m.type === 'characterData' ? [m.target.parentElement] : [...m.addedNodes];
        for (const n of nos) {
          if (!(n instanceof Element)) continue;
          const alertas = n.matches('[role="alert"]') ? [n] : [...n.querySelectorAll('[role="alert"]')];
          for (const a of alertas) {
            const texto = (a.textContent ?? '').trim();
            if (!texto || avisos.has(a)) continue;
            avisos.add(a);
            tocarSe('erro');
          }
        }
      }
    });
    window.addEventListener('pointerdown', noPonteiro, true);
    window.addEventListener('keydown', naTecla, true);
    olhar.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      window.removeEventListener('pointerdown', noPonteiro, true);
      window.removeEventListener('keydown', naTecla, true);
      olhar.disconnect();
    };
  }, [noApp]);

  useEffect(() => {
    if (!rotaDoApp(pathname)) return;
    if (primeiro.current) { primeiro.current = false; return; }
    if (sonsLigados()) tocar('navegar');
  }, [pathname]);

  return null;
}
