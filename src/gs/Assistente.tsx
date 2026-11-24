import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, ChevronRight, Search, Sparkles, X } from 'lucide-react';
import { useSession } from '../account';
import { getName, painelToken } from '../painel';
import { getEstado, useEstado } from './store';
import { useHoje } from './useHoje';
import { comentarioDoGasto, dicasDoMidas, dicasParaTela, temAvisoUrgente, textoSeCouber, type Dica, type HumorMidas, type TomDica } from './midasDicas';
/** Destaca o número da frase (R$ e porcentagem) sem mudar o texto. */
function FraseDica({ texto }: { texto: string }) {
  const pedacos = texto.split(/(R\$\s?[\d.]+|\d+%)/g);
  return <>{pedacos.map((p, i) => (/^(R\$|\d+%)/.test(p) ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}</>;
}
import { rotaDoApp } from './visual';
import { aoLadoDoAlvo, casaDoMidas, cruza, lugarSemCobrir, type Caixa } from './midasPosicao';
import { EXEMPLOS_ANOTAR, NOME_ASSISTENTE, SUGESTOES, perguntarAoAssistente, type MensagemAssistente } from './assistenteLocal';

/* ---------- O assistente: a bolinha dourada que flutua, a barra "pergunte" e o painel de conversa ---------- */
// As respostas vêm de assistenteLocal.ts (é lá que a API entra depois). Aqui é só a tela.
// O mascote fica montado uma vez (em App), para a troca de rota não recriar o guia no meio do passo.

export const EVENTO_ASSISTENTE = 'gs-assistente';
/** Abre o painel; com uma pergunta, já envia. */
export const abrirAssistente = (pergunta?: string) => window.dispatchEvent(new CustomEvent<string | undefined>(EVENTO_ASSISTENTE, { detail: pergunta }));

/** A bolinha com olhos: pisca e flutua (parada para quem pediu menos movimento). */
export function Orbe({ tamanho = 44, pensando = false }: { tamanho?: number; pensando?: boolean }) {
  return (
    <span className={`as-orbe${pensando ? ' pensando' : ''}`} style={{ width: tamanho, height: tamanho }} aria-hidden="true">
      <i /><i />
    </span>
  );
}

/** A barra "Buscar ou perguntar": fica no topo do Início e abre o painel. */
export function BarraPerguntar() {
  return (
    <button type="button" className="as-barra" onClick={() => abrirAssistente()}>
      <Orbe tamanho={30} />
      <span>Pergunte ao {NOME_ASSISTENTE}…</span>
      <i aria-hidden="true"><Search size={16} /></i>
    </button>
  );
}

/** "Perguntar sobre isso": o link discreto no pé dos cards. */
export const PerguntarSobre = ({ pergunta, rotulo = `Perguntar ao ${NOME_ASSISTENTE}` }: { pergunta: string; rotulo?: string }) => (
  <button type="button" className="as-sobre" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); abrirAssistente(pergunta); }}><Sparkles size={13} aria-hidden="true" />{rotulo}</button>
);

const primeiroNome = (n: string) => (n.trim().split(/\s+/)[0] ?? '');

/** Uma chave nova, só das preferências do mascote. Não mistura com grana-seria:v1 nem com as outras. */
const CHAVE_MIDAS = 'gs-midas-guia';
type PrefMidas = { tour?: boolean; min?: boolean; auto?: boolean };
const lerMidas = (): PrefMidas => {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE_MIDAS) || '{}') as PrefMidas;
    return { tour: j.tour === true, min: j.min === true, auto: j.auto === true };
  } catch { return {}; }
};
const gravarMidas = (p: PrefMidas) => {
  try { localStorage.setItem(CHAVE_MIDAS, JSON.stringify({ ...lerMidas(), ...p })); } catch { /* segue nesta visita */ }
};
const dicasDaSessao = new Set<string>();
const vistasMidas: Record<string, number> = {};
let iaDoCoach: Promise<boolean> | null = null;
const coachLigado = () => (iaDoCoach ??= fetch('/api/conselheiro').then((r) => (r.ok ? r.json() : {})).then((j: { ativo?: boolean }) => j.ativo === true).catch(() => false));
/** A regra já fala. Se o conselheiro estiver ligado no servidor, ele só pode encurtar a mesma frase. */
async function enriquecer(dica: Dica): Promise<string> {
  const tk = painelToken();
  if (!tk || !(await coachLigado())) return dica.texto;
  try {
    const res = await fetch('/api/conselheiro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
      body: JSON.stringify({ question: `Reescreva em uma frase curta, em português do Brasil, sem mudar nenhum número: ${dica.texto}`, history: [] }),
    });
    if (!res.ok) return dica.texto;
    const j = (await res.json()) as { reply?: string };
    return textoSeCouber(dica.texto, j.reply);
  } catch {
    return dica.texto;
  }
}
/** O passo da visita nesta aba. Não vai pro localStorage: só evita perder o guia quando a tela remonta. */
let guiaMemoria: { indice: number; pausado: boolean } | null = null;
/** A posição também sobrevive a um remonte, para ele não piscar de volta pro canto. */
let posMemoria: { x: number; y: number } | null = null;

type Passo = { sel: string; texto: string; rota?: string };
const TOUR: Passo[] = [
  { sel: '.pn-hero', texto: 'Aqui está quanto você pode gastar hoje.', rota: '/' },
  { sel: '[data-midas="pagar"]', texto: 'Pagar: contas, dívidas e o cartão.', rota: '/' },
  { sel: '[data-midas="gastar"]', texto: 'Gastar: para onde o dinheiro foi.', rota: '/' },
  { sel: '[data-midas="guardar"]', texto: 'Guardar: reserva, metas e investir.', rota: '/' },
  { sel: 'nav.cm-abas a[href="/"], aside.cm-lateral a[href="/"]', texto: 'Início traz o resumo do mês.', rota: '/' },
  { sel: 'nav.cm-abas a[href="/mais"], aside.cm-lateral a[href="/mais"]', texto: 'Mais guarda todas as ferramentas.', rota: '/' },
  { sel: '.cm-busca', texto: 'Pergunte o que você quer resolver.', rota: '/mais' },
];
const DICAS_TELA: { teste: (p: string) => boolean; sel: string; texto: string }[] = [
  { teste: (p) => p === '/pagar', sel: '.gs-btn', texto: 'A próxima conta se paga por aqui.' },
  { teste: (p) => p === '/mais', sel: '.cm-busca', texto: 'Diga o que você quer resolver.' },
  { teste: (p) => p.startsWith('/plano/dividas'), sel: '.gs-btn', texto: 'Aqui você vê quando fica livre das dívidas.' },
  { teste: (p) => p === '/guardar', sel: '.gs-btn', texto: 'A reserva e as metas começam neste botão.' },
  { teste: (p) => p === '/gastos', sel: '.gs-btn, button', texto: 'Anote o gasto do dia por aqui.' },
];

const reduzMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function useReduz() {
  const [v, setV] = useState(reduzMovimento);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const fn = () => setV(mq.matches);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);
  return v;
}
const rectDe = (r: DOMRect): Caixa => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
const navCaixa = (): Caixa | null => {
  const nav = document.querySelector('nav.cm-abas');
  if (!nav) return null;
  const r = nav.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  return rectDe(r);
};
const casaAgora = () => casaDoMidas(window.innerWidth, window.innerHeight, navCaixa());
/** Sobe o canto de casa enquanto ele cobrir um botão da tela (o atalho de anotar gasto, por exemplo). */
const cantoLivre = () => {
  const base = casaAgora();
  const nav = navCaixa();
  let y = base.y;
  const cobre = (yy: number) => {
    const corpo: Caixa = { l: base.x - 4, t: yy - 8, r: base.x + 70, b: yy + 78 };
    if (nav && cruza(corpo, nav, 0)) return true;
    for (const el of document.querySelectorAll('.pn-acao, .pn-stat, .pn-ftile, .cm-mais')) {
      if (el.closest('.as-mascote, .as-painel, nav.cm-abas')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 20 || r.bottom < 0 || r.top > window.innerHeight) continue;
      if (cruza(corpo, rectDe(r), 0)) return true;
    }
    return false;
  };
  for (let i = 0; i < 14 && cobre(y); i++) y = Math.max(64, y - 22);
  return { x: base.x, y };
};
const escolher = (sel: string): Element | null => {
  const els = [...document.querySelectorAll(sel)].filter((el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  });
  return els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }) ?? els[0] ?? null;
};
const obstaculos = (foco: DOMRect | null): Caixa[] => {
  const lista: Caixa[] = [];
  for (const el of document.querySelectorAll('nav.cm-abas, .cm-lateral, .cm-topo')) {
    const r = el.getBoundingClientRect();
    if (r.width > 8 && r.height > 8) lista.push(rectDe(r));
  }
  if (foco && foco.width > 8 && foco.width < 220 && foco.height < 180) lista.push(rectDe(foco));
  let n = 0;
  for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"]')) {
    if (n >= 24) break;
    if (el.closest('.as-mascote, .as-fala, nav.cm-abas, .cm-lateral, .cm-topo')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    // Um bloco grande (o herói, um grupo) não empurra a fala para o canto oposto.
    if (r.width < 8 || r.height < 8 || r.width > 220 || r.height > 160 || r.bottom < 0 || r.top > window.innerHeight) continue;
    lista.push(rectDe(r));
    n += 1;
  }
  return lista;
};
const preso = (el: Element) => getComputedStyle(el).position === 'fixed' || !!el.closest('nav.cm-abas, .cm-lateral');
/** O anel marca o topo do alvo. Uma seção mais alta que a tela não vira um buraco do tamanho da página. */
const anelDe = (r: DOMRect) => {
  const alt = Math.min(r.height, 200);
  const larg = Math.min(r.width, Math.max(32, window.innerWidth - 16));
  const top = Math.max(8, Math.min(r.top, window.innerHeight - alt - 8));
  const left = Math.max(8, Math.min(r.left, window.innerWidth - larg - 8));
  return new DOMRect(left, top, Math.max(24, larg), Math.max(24, alt));
};
const jaNaTela = (r: DOMRect) => r.top >= -4 && r.left >= -4 && r.bottom <= window.innerHeight + 4 && r.right <= window.innerWidth + 4;
const rotaAtual = (p: string) => (p === '/inicio' ? '/' : p);
const somaGuardada = (guardados: { valor: number }[]) => guardados.reduce((s, g) => s + g.valor, 0);

/** O mascote: anda com um passo, respira parado e não cobre o menu. */
function Mascote({ oculto, onAbrir }: { oculto: boolean; onAbrir: () => void }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const e = useEstado();
  const hoje = useHoje();
  const reduz = useReduz();
  const [min, setMin] = useState(() => lerMidas().min === true);
  // Calado por padrão: só fala quando a pessoa toca nele. "Dicas sozinho" é opção no menu dele.
  const [auto, setAuto] = useState(() => lerMidas().auto === true);
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const [pos, setPos] = useState(() => posMemoria ?? (typeof document === 'undefined' ? { x: 16, y: 16 } : casaAgora()));
  const [face, setFace] = useState(1);
  const [andando, setAndando] = useState(false);
  const [tour, setTour] = useState<number | null>(() => guiaMemoria?.indice ?? null);
  const [pausado, setPausado] = useState(() => guiaMemoria?.pausado ?? false);
  const [foco, setFoco] = useState<DOMRect | null>(null);
  const [fala, setFala] = useState<{ texto: string; modo: 'tour' | 'tela' | 'festa' | 'dica'; rota?: string; rotulo?: string; id?: string; tom?: TomDica; humor?: HumorMidas; icone?: string; indice?: number; total?: number } | null>(null);
  const [chega, setChega] = useState(true);
  const [mexe, setMexe] = useState(false);
  const [apertada, setApertada] = useState(false);
  const [ancora, setAncora] = useState<{ l: number; t: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [humor, setHumor] = useState<'' | 'festa' | 'meta'>('');
  const posRef = useRef(pos);
  const tourRef = useRef(tour);
  const pausadoRef = useRef(pausado);
  const falaRef = useRef(fala);
  const alvoRef = useRef<Element | null>(null);
  const falaEl = useRef<HTMLDivElement>(null);
  const pedidoRota = useRef<{ rota: string; desde: string } | null>(null);
  const seguindo = useRef(false);
  const vivoRef = useRef(true);
  const andarTimer = useRef(0);
  const humorTimer = useRef(0);
  const festaTimer = useRef(0);
  const metasVistas = useRef<Map<string, number> | null>(null);
  const passoDica = useRef(0);
  const miuda = typeof window !== 'undefined' && window.innerWidth <= 330;
  tourRef.current = tour;
  pausadoRef.current = pausado;
  falaRef.current = fala;
  posMemoria = pos;

  const ir = (x: number, y: number, imediato = false) => {
    const navBox = navCaixa();
    const nx = Math.max(8, Math.min(x, window.innerWidth - 70));
    const ny = Math.max(8, Math.min(navBox ? Math.min(y, navBox.t - 80) : y, window.innerHeight - 70));
    const antes = posRef.current;
    if (Math.hypot(nx - antes.x, ny - antes.y) < 2) return;
    setFace(nx < antes.x - 6 ? -1 : nx > antes.x + 6 ? 1 : (antes.x <= nx ? 1 : -1));
    const prox = { x: nx, y: ny };
    posRef.current = prox;
    posMemoria = prox;
    setPos(prox);
    if (imediato || reduz) {
      window.clearTimeout(andarTimer.current);
      setAndando(false);
      return;
    }
    setAndando(true);
    window.clearTimeout(andarTimer.current);
    andarTimer.current = window.setTimeout(() => { if (vivoRef.current) setAndando(false); }, 720);
  };
  const irRef = useRef(ir);
  irRef.current = ir;

  const encerrar = () => {
    pedidoRota.current = null;
    seguindo.current = false;
    guiaMemoria = null;
    alvoRef.current = null;
    setPausado(false);
    setTour(null);
    setFoco(null);
    setFala(null);
    gravarMidas({ tour: true });
    const c = cantoLivre();
    ir(c.x, c.y);
  };
  const pausar = () => {
    pedidoRota.current = null;
    seguindo.current = false;
    if (tourRef.current !== null) guiaMemoria = { indice: tourRef.current, pausado: true };
    alvoRef.current = null;
    setPausado(true);
    setFala(null);
    setFoco(null);
    const c = cantoLivre();
    ir(c.x, c.y);
  };
  /** Troca de tela só quando o guia pede. Sair no meio pausa neste passo. */
  const seguir = (indice: number) => {
    const passo = TOUR[indice];
    if (!passo) { encerrar(); return; }
    setMenu(false);
    setPausado(false);
    setFala(null);
    setFoco(null);
    alvoRef.current = null;
    const aqui = rotaAtual(pathname);
    const muda = Boolean(passo.rota && passo.rota !== aqui);
    pedidoRota.current = muda && passo.rota ? { rota: passo.rota, desde: aqui } : null;
    seguindo.current = muda;
    guiaMemoria = { indice, pausado: false };
    if (muda && passo.rota) nav(passo.rota);
    setTour(indice);
  };
  const festejar = (texto: string, tipo: 'festa' | 'meta') => {
    setHumor(tipo);
    window.clearTimeout(humorTimer.current);
    humorTimer.current = window.setTimeout(() => { if (vivoRef.current) setHumor(''); }, 1700);
    if ((tourRef.current !== null && !pausadoRef.current) || !autoRef.current) return;
    setFala({ texto, modo: 'festa' });
    window.clearTimeout(festaTimer.current);
    festaTimer.current = window.setTimeout(() => {
      if (!vivoRef.current) return;
      setFala((atual) => (atual?.modo === 'festa' ? null : atual));
    }, 2200);
  };
  const encerrarRef = useRef(encerrar);
  const pausarRef = useRef(pausar);
  const seguirRef = useRef(seguir);
  const festejarRef = useRef(festejar);
  encerrarRef.current = encerrar;
  pausarRef.current = pausar;
  seguirRef.current = seguir;
  festejarRef.current = festejar;

  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { const id = window.setTimeout(() => setChega(false), 700); return () => window.clearTimeout(id); }, []);
  useEffect(() => { setApertada(false); }, [fala?.id]);
  // ao trocar de tela o Midas "lê" a página: dá uma balançada curta, como se reagisse aos números novos
  useEffect(() => {
    setMexe(true);
    const id = window.setTimeout(() => setMexe(false), 520);
    return () => window.clearTimeout(id);
  }, [pathname]);
  useEffect(() => { if (!fala) passoDica.current = 0; }, [fala]);
  const urgente = useMemo(() => temAvisoUrgente(e, hoje), [e, hoje]);
  useEffect(() => () => {
    vivoRef.current = false;
    window.clearTimeout(andarTimer.current);
    window.clearTimeout(humorTimer.current);
    window.clearTimeout(festaTimer.current);
  }, []);
  useEffect(() => {
    if (tour === null) { if (!pausado) guiaMemoria = null; return; }
    guiaMemoria = { indice: tour, pausado };
  }, [tour, pausado]);
  useEffect(() => () => {
    if (tourRef.current === null) return;
    guiaMemoria = { indice: tourRef.current, pausado: seguindo.current ? false : pausadoRef.current };
    seguindo.current = false;
  }, []);

  useLayoutEffect(() => {
    if (tourRef.current !== null && !pausadoRef.current) return;
    const c = cantoLivre();
    if (Math.hypot(c.x - posRef.current.x, c.y - posRef.current.y) < 12) return;
    irRef.current(c.x, c.y, true);
  }, []);

  useEffect(() => {
    if (tour !== null && !pausado) return;
    let vivo = true;
    const ajustar = () => {
      if (!vivo || (tourRef.current !== null && !pausadoRef.current)) return;
      const c = cantoLivre();
      const dist = Math.hypot(c.x - posRef.current.x, c.y - posRef.current.y);
      if (dist < 8) return;
      irRef.current(c.x, c.y, dist < 100);
    };
    const a = window.setTimeout(ajustar, 350);
    const b = window.setTimeout(ajustar, 1400);
    void document.fonts?.ready?.then(ajustar);
    return () => { vivo = false; window.clearTimeout(a); window.clearTimeout(b); };
  }, [pathname, tour, pausado]);

  useEffect(() => {
    const ajustar = () => {
      if (tourRef.current !== null && !pausadoRef.current) return;
      const c = cantoLivre();
      if (Math.hypot(c.x - posRef.current.x, c.y - posRef.current.y) < 16) return;
      irRef.current(c.x, c.y, true);
    };
    window.addEventListener('resize', ajustar);
    window.visualViewport?.addEventListener('resize', ajustar);
    return () => {
      window.removeEventListener('resize', ajustar);
      window.visualViewport?.removeEventListener('resize', ajustar);
    };
  }, []);

  const mostrarDica = (forcar = false) => {
    const agora = Date.now();
    const todas = forcar ? dicasParaTela(getEstado(), hoje, pathname) : dicasDoMidas(getEstado(), hoje);
    if (todas.length === 0) return;
    const livres = forcar ? todas : dicasDoMidas(getEstado(), hoje, vistasMidas, agora);
    if (livres.length === 0) return;
    const dica = forcar ? todas[passoDica.current % todas.length] : livres[0];
    const indice = Math.max(0, todas.findIndex((d) => d.id === dica.id));
    passoDica.current = (indice + 1) % todas.length;
    vistasMidas[dica.id] = agora;
    setFoco(null);
    alvoRef.current = null;
    setFala({ texto: dica.texto, modo: 'dica', rota: dica.rota, rotulo: dica.rotulo, id: dica.id, tom: dica.tom, humor: dica.humor, icone: dica.icone, indice, total: todas.length });
    void enriquecer(dica).then((texto) => {
      if (!vivoRef.current) return;
      setFala((atual) => (atual?.id === dica.id ? { ...atual, texto } : atual));
    });
  };
  const mostrarDicaRef = useRef(mostrarDica);
  mostrarDicaRef.current = mostrarDica;

  useEffect(() => {
    if (!auto || min || pausado || tour !== null || (fala && fala.modo === 'tour')) return;
    if (pathname !== '/' && pathname !== '/inicio') return;
    const id = window.setTimeout(() => {
      if (tourRef.current !== null || pausadoRef.current || falaRef.current) return;
      mostrarDicaRef.current(false);
    }, 900);
    return () => window.clearTimeout(id);
  }, [pathname, min, pausado, tour, hoje, auto]);

  useEffect(() => {
    if (tour === null || oculto || min || pausado) return;
    const passo = TOUR[tour];
    if (!passo) { encerrarRef.current(); return; }
    const aqui = rotaAtual(pathname);
    if (passo.rota && passo.rota !== aqui) {
      const pedido = pedidoRota.current;
      if (pedido?.rota === passo.rota && (aqui === pedido.desde || aqui === passo.rota)) return;
      pausarRef.current();
      return;
    }
    pedidoRota.current = null;
    seguindo.current = false;
    let vivo = true;
    let espera = 0;
    let depoisFala = 0;
    let quadro = 0;
    let tentativas = 0;
    const apontar = (el: Element) => {
      if (!vivo || pausadoRef.current) return;
      const r = anelDe(el.getBoundingClientRect());
      alvoRef.current = el;
      setFoco(r);
      if (!reduz) {
        const p = aoLadoDoAlvo(rectDe(r), window.innerWidth, window.innerHeight, navCaixa());
        irRef.current(p.x, p.y);
      }
      depoisFala = window.setTimeout(() => {
        if (!vivo || pausadoRef.current) return;
        setFala({ texto: passo.texto, modo: 'tour' });
      }, reduz ? 0 : 760);
    };
    const mostrar = () => {
      if (!vivo || pausadoRef.current) return;
      const el = escolher(passo.sel);
      if (!el) {
        if (tentativas < 15) { tentativas += 1; espera = window.setTimeout(mostrar, 200); return; }
        seguirRef.current(tour + 1);
        return;
      }
      if (reduz || preso(el) || jaNaTela(el.getBoundingClientRect())) {
        espera = window.setTimeout(() => apontar(el), reduz ? 16 : 40);
        return;
      }
      el.scrollIntoView({ block: el.getBoundingClientRect().height > 320 ? 'start' : 'center', inline: 'nearest', behavior: 'smooth' });
      let ultimo = '';
      let estavel = 0;
      let n = 0;
      const quadroPasso = () => {
        if (!vivo || pausadoRef.current) return;
        const r = el.getBoundingClientRect();
        const chave = `${Math.round(r.top)}:${Math.round(r.left)}`;
        estavel = chave === ultimo ? estavel + 1 : 0;
        ultimo = chave;
        n += 1;
        if (estavel >= 3 || n > 48) apontar(el);
        else quadro = requestAnimationFrame(quadroPasso);
      };
      quadro = requestAnimationFrame(quadroPasso);
    };
    const id = window.setTimeout(mostrar, 50);
    return () => {
      vivo = false;
      window.clearTimeout(id);
      window.clearTimeout(espera);
      window.clearTimeout(depoisFala);
      cancelAnimationFrame(quadro);
    };
  }, [tour, pathname, oculto, min, pausado, reduz]);

  useEffect(() => {
    if (!auto || (tour !== null && !pausado) || min || oculto || dicasDaSessao.has(pathname)) return;
    const regra = DICAS_TELA.find((d) => d.teste(pathname));
    if (!regra) return;
    let falaTimer = 0;
    let espera = 0;
    const id = window.setTimeout(() => {
      if ((tourRef.current !== null && !pausadoRef.current) || falaRef.current) return;
      const el = escolher(regra.sel);
      if (!el) return;
      dicasDaSessao.add(pathname);
      const mostrar = () => {
        if (tourRef.current !== null && !pausadoRef.current) return;
        const r = anelDe(el.getBoundingClientRect());
        alvoRef.current = el;
        setFoco(r);
        if (!reduz) {
          const p = aoLadoDoAlvo(rectDe(r), window.innerWidth, window.innerHeight, navCaixa());
          irRef.current(p.x, p.y);
        }
        falaTimer = window.setTimeout(() => {
          if (tourRef.current !== null && !pausadoRef.current) return;
          setFala({ texto: regra.texto, modo: 'tela' });
        }, reduz ? 0 : 760);
      };
      if (reduz || preso(el) || jaNaTela(el.getBoundingClientRect())) mostrar();
      else {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        espera = window.setTimeout(mostrar, 520);
      }
    }, 1500);
    return () => { window.clearTimeout(id); window.clearTimeout(falaTimer); window.clearTimeout(espera); };
  }, [pathname, tour, pausado, min, oculto, reduz, auto]);

  // Dica solta some sozinha e some ao tocar fora: ele não fica parado no meio da tela.
  useEffect(() => {
    if (!fala || fala.modo === 'tour') return;
    const fechar = () => { setFala((a) => (a && a.modo !== 'tour' ? null : a)); setFoco(null); alvoRef.current = null; };
    const tempo = window.setTimeout(fechar, fala.modo === 'festa' ? 2200 : 14000);
    const fora = (ev: PointerEvent) => {
      const alvo = ev.target instanceof Element ? ev.target : null;
      if (alvo?.closest('.as-mascote')) return;
      fechar();
    };
    window.addEventListener('pointerdown', fora, true);
    return () => { window.clearTimeout(tempo); window.removeEventListener('pointerdown', fora, true); };
  }, [fala]);

  useEffect(() => {
    if (!foco) return;
    let quadro = 0;
    const atualizar = () => {
      const el = alvoRef.current;
      if (!el?.isConnected) return;
      const r = anelDe(el.getBoundingClientRect());
      setFoco((prev) => (prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1 ? prev : r));
    };
    const noScroll = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(atualizar); };
    window.addEventListener('scroll', noScroll, true);
    window.addEventListener('resize', noScroll);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('scroll', noScroll, true);
      window.removeEventListener('resize', noScroll);
    };
  }, [foco !== null]); // eslint-disable-line react-hooks/exhaustive-deps -- liga uma vez enquanto o alvo existe

  useEffect(() => {
    const onAviso = (ev: Event) => {
      const texto = String((ev as CustomEvent<string>).detail ?? '');
      if (/gasto anotado|compra no cartão|compra no cartao/i.test(texto)) {
        const frase = comentarioDoGasto(getEstado(), hoje) ?? 'Anotado.';
        festejarRef.current(frase, 'festa');
      }
    };
    window.addEventListener('gs-aviso', onAviso);
    return () => window.removeEventListener('gs-aviso', onAviso);
  }, []);

  useEffect(() => {
    const mapa = new Map(e.metas.map((m) => [m.id, somaGuardada(m.guardados)]));
    const antes = metasVistas.current;
    metasVistas.current = mapa;
    if (!antes) return;
    for (const m of e.metas) {
      const agora = mapa.get(m.id) ?? 0;
      const prev = antes.get(m.id);
      if (prev === undefined || prev >= m.alvo || agora < m.alvo) continue;
      festejarRef.current(`Meta ${m.nome} batida.`, 'meta');
    }
  }, [e.metas]);

  useLayoutEffect(() => {
    const el = falaEl.current;
    if (!el || !fala || min || oculto) { setAncora(null); return; }
    const criticos = [...document.querySelectorAll('nav.cm-abas, .cm-mais, .pn-acao, .as-barra, .pn-redondo, .pn-periodo button, .pn-stat, .pn-ftile, .pn-hero, .gs-btn')].flatMap((el) => {
      if (el.closest('.as-mascote, .as-fala')) return [];
      const r = el.getBoundingClientRect();
      return r.width > 8 && r.height > 8 ? [{ l: r.left - 6, t: r.top - 6, r: r.right + 6, b: r.bottom + 6 }] : [];
    });
    const hero = document.querySelector('.pn-hero')?.getBoundingClientRect();
    const lugar = lugarSemCobrir(el.offsetWidth || 220, el.offsetHeight || 96, pos.x, pos.y, window.innerWidth, window.innerHeight, criticos, hero && hero.width > 8 ? [rectDe(hero)] : [], navCaixa());
    const busca = document.querySelector('.as-barra')?.getBoundingClientRect();
    const altura = el.offsetHeight || 96;
    let topo = lugar.t;
    if (busca && busca.height > 8 && topo < busca.bottom && topo + altura > busca.top - 14) {
      const acima = busca.top - 14 - altura;
      if (acima >= 4) topo = acima;
      else if (!apertada) { setApertada(true); return; }
    }
    const l = Math.round(lugar.l - pos.x);
    const t = Math.round(topo - pos.y);
    setAncora((prev) => (prev && prev.l === l && prev.t === t ? prev : { l, t }));
  }, [fala, pos.x, pos.y, foco, min, oculto, pathname, miuda, apertada]);

  useEffect(() => {
    if (!menu) return;
    const fechar = (ev: PointerEvent) => {
      const alvo = ev.target instanceof Element ? ev.target : null;
      if (alvo?.closest('.as-menu, .as-opcoes')) return;
      setMenu(false);
    };
    window.addEventListener('pointerdown', fechar, true);
    return () => window.removeEventListener('pointerdown', fechar, true);
  }, [menu]);

  const alternarMin = () => {
    const prox = !min;
    setMin(prox);
    gravarMidas({ min: prox });
    setMenu(false);
    setFala(null);
    setFoco(null);
    alvoRef.current = null;
    const c = cantoLivre();
    ir(c.x, c.y);
  };

  return (
    <>
    {foco && !min && !oculto && !pausado && (
      <div className="as-foco" style={{ width: Math.round(foco.width + 12), height: Math.round(foco.height + 12), transform: `translate3d(${Math.round(foco.left - 6)}px, ${Math.round(foco.top - 6)}px, 0)` }} />
    )}
    <div
      className={`as-mascote${min ? ' min' : ''}${andando ? ' andando' : ''}${reduz ? ' parado' : ''}${oculto ? ' oculto' : ''}${pausado ? ' pausado' : ''}${humor ? ` ${humor}` : ''}${fala?.tom ? ` tom-${fala.tom}` : ''}${fala?.humor ? ` ${fala.humor}` : ''}`}
      style={{ transform: `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)` }}
    >
      <div className={`as-figura${face < 0 ? ' esq' : ''}${andando ? ' andando' : ''}${chega ? ' chega' : ''}`}>
        <button type="button" className={`as-orb-btn${mexe ? ' toque' : ''}${urgente && !fala ? ' tem-aviso' : ''}`} onClick={() => { setMexe(true); window.setTimeout(() => setMexe(false), 520); onAbrir(); }} aria-label={`Próxima dica do ${NOME_ASSISTENTE}`}>
          <Orbe tamanho={min ? 40 : 52} />
          <i className="as-faisca" aria-hidden="true" /><i className="as-faisca" aria-hidden="true" /><i className="as-moeda" aria-hidden="true" />
        </button>
        <span className="as-pernas" aria-hidden="true"><i /><i /></span>
      </div>
      {fala && !min && !oculto && (
        <div key={fala.id ?? fala.texto} ref={falaEl} className={`as-fala${miuda ? ' miuda' : ''}${apertada ? ' as-apertada' : ''} ${fala.tom ?? (fala.modo === 'festa' ? 'ok' : 'neutro')}${ancora && ancora.t > 36 ? ' cauda-cima' : ' cauda-baixo'}`} role={fala.modo === 'festa' ? 'status' : 'dialog'} aria-live="polite" aria-label={fala.texto} style={ancora ? { left: ancora.l, top: ancora.t } : { visibility: 'hidden' }}>
          <p className={reduz ? undefined : 'as-revela'}>{(fala.icone || fala.tom) && <span className={`as-chip ${fala.tom ?? 'neutro'}`} aria-hidden="true">{fala.icone ?? '💡'}</span>}<FraseDica texto={fala.texto} /></p>
          {typeof fala.total === 'number' && fala.total > 1 && (
            <span className="as-pontos" aria-label={`Dica ${(fala.indice ?? 0) + 1} de ${fala.total}`}>
              {Array.from({ length: Math.min(fala.total, 6) }, (_, i) => <i key={i} className={i === (fala.total! <= 6 ? fala.indice : (fala.indice ?? 0) % 6) ? 'on' : ''} />)}
            </span>
          )}
          {fala.modo !== 'festa' && (
            <div>
              {fala.modo === 'tour' ? (
                <>
                  <button type="button" className="sec" onClick={encerrar}>Pular</button>
                  <button type="button" className="prim" onClick={() => seguir((tour ?? 0) + 1)}>{tour !== null && tour >= TOUR.length - 1 ? 'Pronto' : 'Próximo'}</button>
                </>
              ) : fala.modo === 'dica' ? (
                <>
                  {fala.rota && fala.rota !== pathname ? <Link className="prim" to={fala.rota} onClick={() => setFala(null)}>{fala.rotulo ?? 'Ver'}</Link> : <button type="button" className="prim" onClick={() => setFala(null)}>Ver</button>}
                  <button type="button" className="sec" onClick={() => mostrarDica(true)}>Outra dica</button>
                </>
              ) : (
                <button type="button" className="sec" onClick={() => { setFala(null); setFoco(null); alvoRef.current = null; }}>Fechar</button>
              )}
            </div>
          )}
        </div>
      )}
      {!min && (
        <button type="button" className="as-opcoes" aria-expanded={menu} aria-label="Opções do Midas" onClick={() => setMenu((v) => !v)}>⋯</button>
      )}
      {menu && !min && (
        <div className={`as-menu${pos.y < 150 ? ' baixo' : ''}${pos.x > window.innerWidth - 196 ? ' direita' : ''}`} role="menu">
          <button type="button" role="menuitem" onClick={() => seguir(tourRef.current ?? 0)}>Me mostra o app</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); onAbrir(); }}>Perguntar</button>
          <button type="button" role="menuitem" aria-checked={auto} onClick={() => { const v = !auto; setAuto(v); gravarMidas({ auto: v }); setMenu(false); setFala(null); setFoco(null); }}>{auto ? 'Parar as dicas sozinho' : 'Dar dicas sozinho'}</button>
        </div>
      )}
      <button type="button" className="as-recolher" aria-pressed={min} aria-label={min ? `Mostrar o ${NOME_ASSISTENTE} passeando` : `Recolher o ${NOME_ASSISTENTE}`} onClick={alternarMin}>{min ? '+' : '–'}</button>
    </div>
    </>
  );
}

function AssistenteNoApp() {
  const e = useEstado();
  const hoje = useHoje();
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<MensagemAssistente[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [balao, setBalao] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const estado = useRef({ e, hoje, msgs });
  estado.current = { e, hoje, msgs };
  const nome = primeiroNome(e.config.nome || getName() || '');
  const noApp = e.config.onboardingFeito;
  // o que mais importa agora, para quem abre o Midas sem saber o que perguntar
  const agora = useMemo(() => dicasParaTela(e, hoje, pathname)[0] ?? null, [e, hoje, pathname]);

  const enviar = async (pergunta: string) => {
    const p = pergunta.trim();
    if (!p) return;
    setTexto('');
    const antes = estado.current.msgs;
    setMsgs([...antes, { de: 'voce', texto: p }]);
    setPensando(true);
    try {
      const [r] = await Promise.all([perguntarAoAssistente(p, estado.current.e, estado.current.hoje, antes), new Promise((ok) => setTimeout(ok, 450))]);
      setMsgs((m) => [...m, { de: 'assistente', texto: r.texto, links: r.links, desfazer: r.desfazer }]);
    } catch {
      setMsgs((m) => [...m, { de: 'assistente', texto: 'Não consegui responder agora. Tente de novo em instantes.' }]);
    } finally {
      setPensando(false);
    }
  };
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;

  useEffect(() => {
    const abrir = (ev: Event) => {
      setAberto(true);
      setBalao(false);
      const p = (ev as CustomEvent<string | undefined>).detail;
      if (p) void enviarRef.current(p);
    };
    window.addEventListener(EVENTO_ASSISTENTE, abrir);
    return () => window.removeEventListener(EVENTO_ASSISTENTE, abrir);
  }, []);
  // o balão de apresentação aparece uma vez por visita, no Início
  useEffect(() => {
    if (!lerMidas().auto || (pathname !== '/' && pathname !== '/inicio')) return setBalao(false);
    let visto = false;
    try { visto = sessionStorage.getItem('gs-as-balao') === '1'; } catch { /* sem armazenamento */ }
    if (visto) return;
    const a = window.setTimeout(() => setBalao(true), 900);
    const b = window.setTimeout(() => { setBalao(false); try { sessionStorage.setItem('gs-as-balao', '1'); } catch { /* idem */ } }, 6500);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [pathname]);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [msgs, pensando]);
  useEffect(() => {
    if (!aberto) return;
    campo.current?.focus();
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setAberto(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto]);
  // trocar de tela (tocou num atalho da resposta) fecha o painel no celular
  useEffect(() => { setAberto(false); }, [pathname]);

  if (!noApp) return null;

  return (
    <>
      <Mascote oculto={aberto} onAbrir={() => { setAberto(true); setBalao(false); }} />
      {/* o balão antigo de apresentação continua disponível para quem já o viu nesta visita */}
      {balao && !aberto && <span className="sr-only">Sou o {NOME_ASSISTENTE}, seu assistente</span>}
      {aberto && <div className="as-fundo" onClick={() => setAberto(false)} aria-hidden="true" />}
      <aside className={`as-painel${aberto ? ' aberto' : ''}`} role="dialog" aria-modal="false" aria-label={`${NOME_ASSISTENTE}, seu assistente`} aria-hidden={!aberto}>
        <header>
          <Orbe tamanho={34} pensando={pensando} />
          <div><b>{NOME_ASSISTENTE}</b><small>Seu assistente no Grana Séria</small></div>
          <button type="button" onClick={() => setAberto(false)} aria-label="Fechar"><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="as-conversa" aria-live="polite">
          {msgs.length === 0 && (
            <div className="as-ola">
              <Orbe tamanho={72} />
              <b>{nome ? `Oi, ${nome}. ` : 'Oi. '}Sou o {NOME_ASSISTENTE}</b>
              <p>Anoto seus gastos por frase e respondo com os seus números.</p>
              {agora && (
                <div className={`as-agora ${agora.tom}`}>
                  <small>Pra agora</small>
                  <b>{agora.texto}</b>
                  <Link to={agora.rota} onClick={() => setAberto(false)}>{agora.rotulo}<ChevronRight size={14} aria-hidden="true" /></Link>
                </div>
              )}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`as-msg ${m.de}`}>
              <p>{m.texto}</p>
              {m.desfazer && (
                <button type="button" className="as-desfazer" disabled={m.desfeito} onClick={() => { m.desfazer?.(); setMsgs((l) => l.map((x, j) => (j === i ? { ...x, desfeito: true } : x))); }}>{m.desfeito ? 'Desfeito' : 'Desfazer'}</button>
              )}
              {m.links && <div className="as-links">{m.links.map((l) => <Link key={l.rota + l.titulo} to={l.rota}>{l.titulo}<ChevronRight size={14} aria-hidden="true" /></Link>)}</div>}
            </div>
          ))}
          {pensando && <div className="as-msg assistente as-digitando" aria-label="Pensando"><i /><i /><i /></div>}
          <div ref={fim} />
        </div>
        <div className="as-sugestoes anotar" role="group" aria-label="Anotar por frase">
          <span>Anote falando:</span>
          {EXEMPLOS_ANOTAR.map((s) => <button key={s} type="button" onClick={() => { setTexto(s); campo.current?.focus(); }}>{s}</button>)}
        </div>
        <div className="as-sugestoes" role="group" aria-label="Perguntas sugeridas">
          {SUGESTOES.map((s) => <button key={s} type="button" onClick={() => void enviar(s)}>{s}</button>)}
        </div>
        <form className="as-campo" onSubmit={(ev) => { ev.preventDefault(); void enviar(texto); }}>
          <input ref={campo} value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="Anote (mercado 35) ou pergunte…" aria-label={`Pergunta para o ${NOME_ASSISTENTE}`} maxLength={300} tabIndex={aberto ? 0 : -1} />
          <button type="submit" aria-label="Enviar" disabled={!texto.trim() || pensando} tabIndex={aberto ? 0 : -1}><ArrowUp size={18} aria-hidden="true" /></button>
        </form>
      </aside>
    </>
  );
}

/** Fora do app (a página de entrada) ele nem monta, para não gravar o estado de quem só está lendo. */
export function Assistente() {
  const session = useSession();
  const { pathname } = useLocation();
  if (!rotaDoApp(pathname) || !(painelToken() || session)) return null;
  return <AssistenteNoApp />;
}
