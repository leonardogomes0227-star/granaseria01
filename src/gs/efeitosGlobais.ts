// Efeitos do painel em todas as telas do app: pílula que desliza nas abas, título que se decifra e sons.
// Mexe só no que a tela já desenhou (classes e um <i> de enfeite), sem tocar nos componentes de cada tela.
import { tocar } from './sons';

const GRUPOS = '.gs-seg, .seg, .cm-seg, .cm-abas, .cm-lateral';
const ATIVO = '[aria-selected="true"], [aria-pressed="true"], [aria-current="page"], .on, .active, .ativo, .sel';

export const semMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function posicionar(grupo: HTMLElement, som: boolean) {
  let pl = grupo.querySelector<HTMLElement>(':scope > i.gl-pilula');
  if (!pl) {
    pl = document.createElement('i');
    pl.className = 'gl-pilula';
    pl.setAttribute('aria-hidden', 'true');
    grupo.prepend(pl);
  }
  const btn = Array.from(grupo.children).find((c) => c !== pl && c.matches(ATIVO)) as HTMLElement | undefined;
  if (!btn || btn.offsetWidth === 0) { pl.classList.remove('pronta'); return; }
  const esq = btn.offsetLeft;
  const antes = pl.dataset.esq === undefined ? null : Number(pl.dataset.esq);
  const indo = antes === null || esq >= antes;
  pl.style.setProperty('--pl-esq', `${esq}px`);
  pl.style.setProperty('--pl-larg', `${btn.offsetWidth}px`);
  pl.style.setProperty('--pl-alt', `${btn.offsetHeight}px`);
  pl.style.setProperty('--pl-top', `${btn.offsetTop}px`);
  pl.style.setProperty('--pl-t-esq', antes === null ? '0s' : indo ? '.5s' : '.3s');
  pl.style.setProperty('--pl-t-larg', antes === null ? '0s' : indo ? '.3s' : '.5s');
  pl.classList.add('pronta');
  grupo.classList.add('gl-com-pilula');
  if (antes !== null && antes !== esq && som) tocar('deslizar');
  pl.dataset.esq = String(esq);
}

/** Liga os efeitos na tela inteira. Devolve a função que desliga. */
export function iniciarEfeitos(): () => void {
  const todos = () => document.querySelectorAll<HTMLElement>(GRUPOS);
  let agendado = 0;
  const atualizar = (som: boolean) => {
    window.cancelAnimationFrame(agendado);
    agendado = window.requestAnimationFrame(() => todos().forEach((g) => posicionar(g, som)));
  };
  // só reage quando a mudança é dentro de um grupo de abas (ou cria um); o resto da tela não refaz nada
  const relevante = (n: Node | null): boolean => {
    const el = n instanceof HTMLElement ? n : n?.parentElement ?? null;
    if (!el || el.classList.contains('gl-pilula')) return false;
    return Boolean(el.closest(GRUPOS)) || Boolean(el.querySelector?.(GRUPOS));
  };
  const obs = new MutationObserver((muts) => {
    const mudou = muts.some((m) => (m.type === 'attributes' ? relevante(m.target) : Array.from(m.addedNodes).some(relevante)));
    if (mudou) atualizar(true);
  });
  obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'aria-selected', 'aria-current'] });
  const redim = () => atualizar(false);
  window.addEventListener('resize', redim);
  atualizar(false);
  return () => { obs.disconnect(); window.removeEventListener('resize', redim); window.cancelAnimationFrame(agendado); };
}
