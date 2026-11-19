// Efeitos do painel em todas as telas do app: pílula que desliza nas abas, título que se decifra e sons.
// Mexe só no que a tela já desenhou (classes e um <i> de enfeite), sem tocar nos componentes de cada tela.
import { tocar } from './sons';

const GRUPOS = '.gs-seg, .seg, .cm-seg, .cm-abas';
const ATIVO = '[aria-selected="true"], [aria-pressed="true"], [aria-current="page"], .on, .active, .ativo, .sel';
const GLIFOS = 'abcdefghijklmnopqrstuvwxyz0123456789#%&';

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

function decifrar(el: HTMLElement) {
  const texto = el.textContent ?? '';
  if (!texto.trim() || el.childNodes.length !== 1 || el.firstChild?.nodeType !== 3 || semMovimento()) return;
  const t0 = performance.now();
  const dur = 560;
  const passo = (agora: number) => {
    if (!el.isConnected) return;
    const f = Math.min(1, (agora - t0) / dur);
    const fixas = Math.floor(f * texto.length);
    el.textContent = f < 1 ? texto.split('').map((c, i) => (i < fixas || c === ' ' ? c : GLIFOS[Math.floor(Math.random() * GLIFOS.length)])).join('') : texto;
    if (f < 1) requestAnimationFrame(passo);
  };
  tocar('digitar');
  requestAnimationFrame(passo);
}

const REVELAR = '.pu-kpi, .pu-vidro, .cm-card, .gs-card, .cm-lista, .ini-cards > *, .cm-acao-card';

/** Cartões abaixo da dobra sobem e aparecem quando chegam na tela (e os gráficos só começam a crescer aí). */
function revelarAoRolar(): () => void {
  if (typeof IntersectionObserver === 'undefined' || semMovimento()) return () => undefined;
  const io = new IntersectionObserver((itens) => {
    for (const it of itens) {
      if (!it.isIntersecting) continue;
      (it.target as HTMLElement).classList.remove('gl-oculto');
      io.unobserve(it.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  const varrer = () => {
    document.querySelectorAll<HTMLElement>(REVELAR).forEach((el) => {
      if (el.dataset.gl) return;
      el.dataset.gl = '1';
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
      el.classList.add('gl-anim', 'gl-oculto');
      io.observe(el);
    });
  };
  let t = 0;
  const obs = new MutationObserver(() => { window.clearTimeout(t); t = window.setTimeout(varrer, 60); });
  obs.observe(document.body, { subtree: true, childList: true });
  varrer();
  return () => { obs.disconnect(); io.disconnect(); window.clearTimeout(t); };
}

/** Liga os efeitos na tela inteira. Devolve a função que desliga. */
export function iniciarEfeitos(): () => void {
  const todos = () => document.querySelectorAll<HTMLElement>(GRUPOS);
  let agendado = 0;
  const atualizar = (som: boolean) => {
    window.cancelAnimationFrame(agendado);
    agendado = window.requestAnimationFrame(() => todos().forEach((g) => posicionar(g, som)));
  };
  const obs = new MutationObserver((muts) => {
    const mudou = muts.some((m) => m.type === 'attributes' || Array.from(m.addedNodes).some((n) => n instanceof HTMLElement && !(n as HTMLElement).classList.contains('gl-pilula')));
    if (mudou) atualizar(true);
  });
  obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'aria-selected', 'aria-current'] });
  const redim = () => atualizar(false);
  window.addEventListener('resize', redim);
  atualizar(false);
  const parar = revelarAoRolar();
  return () => { obs.disconnect(); parar(); window.removeEventListener('resize', redim); window.cancelAnimationFrame(agendado); };
}

/** A cada tela nova: espera o título aparecer, decifra e devolve o texto (para o caminho no topo). */
export function titulosDaTela(aoAchar: (titulo: string) => void): () => void {
  let vivo = true;
  let tentativas = 0;
  const procurar = () => {
    if (!vivo) return;
    const h1 = document.querySelector<HTMLElement>('.gs-principal h1');
    if (h1 && (h1.textContent ?? '').trim()) {
      aoAchar((h1.textContent ?? '').trim());
      decifrar(h1);
      return;
    }
    if (++tentativas < 40) window.setTimeout(procurar, 50);
    else aoAchar('');
  };
  procurar();
  return () => { vivo = false; };
}
