import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, ChevronRight, Search, Sparkles, X } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { getName } from '../painel';
import { NOME_ASSISTENTE, SUGESTOES, perguntarAoAssistente, type MensagemAssistente } from './assistenteLocal';

/* ---------- O assistente: a bolinha dourada que flutua, a barra "pergunte" e o painel de conversa ---------- */
// As respostas vêm de assistenteLocal.ts (é lá que a API entra depois). Aqui é só a tela.

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
type PrefMidas = { tour?: boolean; min?: boolean };
const lerMidas = (): PrefMidas => {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE_MIDAS) || '{}') as PrefMidas;
    return { tour: j.tour === true, min: j.min === true };
  } catch { return {}; }
};
const gravarMidas = (p: PrefMidas) => {
  try { localStorage.setItem(CHAVE_MIDAS, JSON.stringify({ ...lerMidas(), ...p })); } catch { /* segue nesta visita */ }
};
const dicasDaSessao = new Set<string>();
/** O passo da visita nesta aba. Não vai pro localStorage: só evita perder o guia quando a tela remonta. */
let guiaMemoria: { indice: number; pausado: boolean } | null = null;

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
const visivel = (sel: string) => [...document.querySelectorAll(sel)].find((el) => {
  const r = el.getBoundingClientRect();
  return r.width > 8 && r.height > 8;
}) ?? null;
const casaDoMidas = () => {
  const nav = document.querySelector('nav.cm-abas');
  const nr = nav?.getBoundingClientRect();
  const acima = nr && nr.height > 0 ? nr.top : window.innerHeight - 12;
  return { x: Math.max(12, window.innerWidth - 78), y: Math.max(12, acima - 74) };
};
const aoLado = (r: DOMRect) => {
  const nav = document.querySelector('nav.cm-abas');
  const nr = nav?.getBoundingClientRect();
  const limite = nr && nr.height > 0 ? nr.top - 78 : window.innerHeight - 78;
  let x = r.left - 74;
  let y = r.top + r.height / 2 - 28;
  if (x < 8) x = Math.min(r.right + 12, window.innerWidth - 74);
  y = Math.max(8, Math.min(y, limite));
  return { x, y };
};
const rotaAtual = (p: string) => (p === '/inicio' ? '/' : p);
type Caixa = { l: number; t: number; r: number; b: number };
const cruza = (a: Caixa, b: Caixa) => !(a.r + 4 <= b.l || a.l >= b.r + 4 || a.b + 4 <= b.t || a.t >= b.b + 4);
const obstaculos = (extra?: DOMRect | null): Caixa[] => {
  const lista = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"], nav.cm-abas, .cm-mais')]
    .filter((el) => !el.closest('.as-fala') && !el.closest('.as-menu'))
    .flatMap((el) => {
      if (el.closest('.as-mascote') && !el.closest('.as-figura') && !el.classList.contains('as-opcoes') && !el.classList.contains('as-recolher')) return [];
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none') return [];
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > window.innerHeight) return [];
      return [{ l: r.left, t: r.top, r: r.right, b: r.bottom }];
    });
  if (extra && extra.width > 8) lista.push({ l: extra.left, t: extra.top, r: extra.right, b: extra.bottom });
  return lista;
};
const cabe = (l: number, t: number, w: number, h: number, obs: Caixa[]) => {
  if (l < 6 || t < 6 || l + w > window.innerWidth - 6 || t + h > window.innerHeight - 6) return false;
  const c = { l, t, r: l + w, b: t + h };
  return !obs.some((o) => cruza(c, o));
};
/** Um lugar livre, de preferência perto do mascote. */
const lugarDaFala = (w: number, h: number, px: number, py: number, obs: Caixa[]): { l: number; t: number } | null => {
  const maxL = window.innerWidth - w - 6;
  const maxT = window.innerHeight - h - 6;
  if (maxL < 6 || maxT < 6) return null;
  const candidatos = [{ l: px, t: py }];
  for (const o of obs) {
    candidatos.push({ l: Math.min(o.l, maxL), t: o.t - h - 8 }, { l: Math.min(o.l, maxL), t: o.b + 8 }, { l: o.r + 8, t: o.t }, { l: o.l - w - 8, t: o.t });
  }
  let melhor: { l: number; t: number; d: number } | null = null;
  const tenta = (l: number, t: number) => {
    const cl = Math.max(6, Math.min(l, maxL));
    const ct = Math.max(6, Math.min(t, maxT));
    if (!cabe(cl, ct, w, h, obs)) return null;
    return { l: cl, t: ct, d: (cl - px) * (cl - px) + (ct - py) * (ct - py) };
  };
  const guarda = (achou: { l: number; t: number; d: number } | null) => { if (achou && (!melhor || achou.d < melhor.d)) melhor = achou; };
  for (const p of candidatos) guarda(tenta(p.l, p.t));
  for (let t = 6; t <= maxT; t += 8) for (let l = 6; l <= maxL; l += 8) guarda(tenta(l, t));
  return melhor;
};

/** O mascote: anda com um pulo, aponta e volta pro canto sem cobrir o menu. */
function Mascote({ oculto, onAbrir }: { oculto: boolean; onAbrir: () => void }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const reduz = reduzMovimento();
  const [min, setMin] = useState(() => lerMidas().min === true);
  const [pos, setPos] = useState(casaDoMidas);
  const [pronto] = useState(true);
  const [face, setFace] = useState(1);
  const [andando, setAndando] = useState(false);
  const [tour, setTour] = useState<number | null>(() => guiaMemoria?.indice ?? null);
  const [pausado, setPausado] = useState(() => guiaMemoria?.pausado ?? false);
  const [foco, setFoco] = useState<DOMRect | null>(null);
  const [fala, setFala] = useState<{ texto: string; modo: 'tour' | 'tela' } | null>(null);
  const [ancora, setAncora] = useState<{ l: number; t: number } | null>(null);
  const [miuda, setMiuda] = useState(false);
  const [menu, setMenu] = useState(false);
  const posRef = useRef(pos);
  const tourRef = useRef(tour);
  const pausadoRef = useRef(pausado);
  const falaEl = useRef<HTMLDivElement>(null);
  const pedidoRota = useRef<{ rota: string; desde: string } | null>(null);
  const seguindo = useRef(false);
  tourRef.current = tour;
  pausadoRef.current = pausado;
  const timer = useRef<number[]>([]);
  const limpar = () => { timer.current.forEach((id) => window.clearTimeout(id)); timer.current = []; };
  const depois = (ms: number, fn: () => void) => { const id = window.setTimeout(fn, ms); timer.current.push(id); };

  const ir = (x: number, y: number) => {
    const nx = Math.max(8, Math.min(x, window.innerWidth - 70));
    const ny = Math.max(8, Math.min(y, window.innerHeight - 70));
    setFace(nx < posRef.current.x - 6 ? -1 : nx > posRef.current.x + 6 ? 1 : (posRef.current.x <= nx ? 1 : -1));
    posRef.current = { x: nx, y: ny };
    setPos({ x: nx, y: ny });
    if (!reduz) {
      setAndando(true);
      depois(880, () => setAndando(false));
    }
  };

  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => () => limpar(), []);

  const encerrar = () => {
    limpar();
    pedidoRota.current = null;
    seguindo.current = false;
    guiaMemoria = null;
    setPausado(false);
    setTour(null);
    setFoco(null);
    setFala(null);
    gravarMidas({ tour: true });
    ir(casaDoMidas().x, casaDoMidas().y);
  };

  const pausar = () => {
    limpar();
    pedidoRota.current = null;
    seguindo.current = false;
    if (tourRef.current !== null) guiaMemoria = { indice: tourRef.current, pausado: true };
    setPausado(true);
    setFala(null);
    setFoco(null);
    ir(casaDoMidas().x, casaDoMidas().y);
  };

  /** Troca de tela só quando o guia pede. Sair no meio pausa neste passo. */
  const seguir = (indice: number) => {
    const passo = TOUR[indice];
    if (!passo) { encerrar(); return; }
    setMenu(false);
    setPausado(false);
    setFala(null);
    setFoco(null);
    const aqui = rotaAtual(pathname);
    const muda = Boolean(passo.rota && passo.rota !== aqui);
    pedidoRota.current = muda && passo.rota ? { rota: passo.rota, desde: aqui } : null;
    seguindo.current = muda;
    guiaMemoria = { indice, pausado: false };
    if (muda && passo.rota) nav(passo.rota);
    setTour(indice);
  };

  useEffect(() => {
    if (tour === null) { if (!pausado) guiaMemoria = null; return; }
    guiaMemoria = { indice: tour, pausado };
  }, [tour, pausado]);
  useEffect(() => () => {
    if (tourRef.current === null) return;
    guiaMemoria = { indice: tourRef.current, pausado: seguindo.current ? false : true };
    seguindo.current = false;
  }, []);

  useEffect(() => {
    if (min || pausado || tour !== null || guiaMemoria || lerMidas().tour) return;
    if (pathname !== '/' && pathname !== '/inicio') return;
    const id = window.setTimeout(() => {
      if (tourRef.current !== null || pausadoRef.current) return;
      setTour(0);
    }, 1100);
    return () => window.clearTimeout(id);
  }, [pathname, min, pausado, tour]);

  useEffect(() => {
    if (tour === null || oculto || min || pausado) return;
    const passo = TOUR[tour];
    if (!passo) { encerrar(); return; }
    const aqui = rotaAtual(pathname);
    if (passo.rota && passo.rota !== aqui) {
      const pedido = pedidoRota.current;
      if (pedido?.rota === passo.rota && (aqui === pedido.desde || aqui === passo.rota)) return;
      pausar();
      return;
    }
    pedidoRota.current = null;
    seguindo.current = false;
    let vivo = true;
    let espera = 0;
    let depoisFala = 0;
    const mostrar = () => {
      if (!vivo || pausadoRef.current) return;
      const el = visivel(passo.sel);
      if (!el) { seguir(tour + 1); return; }
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduz ? 'auto' : 'smooth' });
      espera = window.setTimeout(() => {
        if (!vivo || pausadoRef.current) return;
        const r = el.getBoundingClientRect();
        setFoco(r);
        if (!reduz) { const p = aoLado(r); ir(p.x, p.y); }
        depoisFala = window.setTimeout(() => {
          if (!vivo || pausadoRef.current) return;
          setFala({ texto: passo.texto, modo: 'tour' });
        }, reduz ? 0 : 900);
      }, reduz ? 30 : 380);
    };
    const id = window.setTimeout(mostrar, 80);
    return () => { vivo = false; window.clearTimeout(id); window.clearTimeout(espera); window.clearTimeout(depoisFala); };
    // seguir lê o passo atual; o efeito acompanha o índice e a rota
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, pathname, oculto, min, pausado, reduz]);

  useEffect(() => {
    if ((tour !== null && !pausado) || min || oculto || dicasDaSessao.has(pathname)) return;
    const regra = DICAS_TELA.find((d) => d.teste(pathname));
    if (!regra) return;
    let falaTimer = 0;
    const id = window.setTimeout(() => {
      if (tourRef.current !== null && !pausadoRef.current) return;
      const el = visivel(regra.sel);
      if (!el) return;
      dicasDaSessao.add(pathname);
      const r = el.getBoundingClientRect();
      setFoco(r);
      if (!reduz) { const p = aoLado(r); ir(p.x, p.y); }
      falaTimer = window.setTimeout(() => {
        if (tourRef.current !== null && !pausadoRef.current) return;
        setFala({ texto: regra.texto, modo: 'tela' });
      }, reduz ? 0 : 900);
    }, 1500);
    return () => { window.clearTimeout(id); window.clearTimeout(falaTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tour, pausado, min, oculto]);

  useEffect(() => {
    if (!pronto || min || reduz || (tour !== null && !pausado) || fala || oculto) return;
    const id = window.setInterval(() => {
      if (tourRef.current !== null && !pausadoRef.current) return;
      const c = casaDoMidas();
      ir(c.x + (Math.random() > 0.5 ? 36 : -28), c.y - 10);
      depois(2000, () => ir(casaDoMidas().x, casaDoMidas().y));
    }, 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, min, reduz, tour, pausado, fala, oculto]);

  useEffect(() => { setMiuda(false); }, [fala?.texto]);
  useLayoutEffect(() => {
    const el = falaEl.current;
    if (!el || !fala || min || oculto) { setAncora(null); return; }
    const lugar = lugarDaFala(el.offsetWidth, el.offsetHeight, pos.x, pos.y - el.offsetHeight - 8, obstaculos(foco));
    if (!lugar) { if (!miuda) setMiuda(true); return; }
    const l = Math.round(lugar.l - pos.x);
    const t = Math.round(lugar.t - pos.y);
    setAncora((prev) => (prev && prev.l === l && prev.t === t ? prev : { l, t }));
  }, [fala, pos.x, pos.y, foco, min, oculto, pathname, miuda]);

  const alternarMin = () => {
    const prox = !min;
    setMin(prox);
    gravarMidas({ min: prox });
    setMenu(false);
    setFala(null);
    setFoco(null);
    ir(casaDoMidas().x, casaDoMidas().y);
  };

  return (
    <>
    {foco && !min && !oculto && !pausado && (
      <div className="as-foco" style={{ width: Math.round(foco.width + 12), height: Math.round(foco.height + 12), transform: `translate3d(${Math.round(foco.left - 6)}px, ${Math.round(foco.top - 6)}px, 0)` }} />
    )}
    <div
      className={`as-mascote${min ? ' min' : ''}${andando ? ' andando' : ''}${reduz ? ' parado' : ''}${oculto ? ' oculto' : ''}${pausado ? ' pausado' : ''}${pronto ? '' : ' sem-mover'}`}
      style={{ transform: `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)` }}
    >
      <div className={`as-figura${face < 0 ? ' esq' : ''}${andando ? ' andando' : ''}`}>
        <button type="button" className="as-orb-btn" onClick={onAbrir} aria-label={`Perguntar ao ${NOME_ASSISTENTE}, seu assistente`}>
          <Orbe tamanho={min ? 40 : 52} />
        </button>
        <span className="as-pernas" aria-hidden="true"><i /><i /></span>
      </div>
      {fala && !min && !oculto && (
        <div ref={falaEl} className={`as-fala${miuda ? ' miuda' : ''}`} role="dialog" aria-label="Dica do Midas" style={ancora ? { left: ancora.l, top: ancora.t } : { visibility: 'hidden' }}>
          <p>{fala.texto}</p>
          <div>
            {fala.modo === 'tour' ? (
              <>
                <button type="button" onClick={encerrar}>Pular</button>
                <button type="button" onClick={() => seguir((tour ?? 0) + 1)}>{tour !== null && tour >= TOUR.length - 1 ? 'Pronto' : 'Próximo'}</button>
              </>
            ) : (
              <button type="button" onClick={() => { setFala(null); setFoco(null); }}>Fechar</button>
            )}
          </div>
        </div>
      )}
      {!min && (
        <button type="button" className="as-opcoes" aria-expanded={menu} aria-label="Opções do Midas" onClick={() => setMenu((v) => !v)}>⋯</button>
      )}
      {menu && !min && (
        <div className="as-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => seguir(tourRef.current ?? 0)}>Me mostra o app</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); onAbrir(); }}>Perguntar</button>
        </div>
      )}
      <button type="button" className="as-recolher" aria-pressed={min} aria-label={min ? `Mostrar o ${NOME_ASSISTENTE} passeando` : `Recolher o ${NOME_ASSISTENTE}`} onClick={alternarMin}>{min ? '+' : '–'}</button>
    </div>
    </>
  );
}

export function Assistente() {
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

  const enviar = async (pergunta: string) => {
    const p = pergunta.trim();
    if (!p) return;
    setTexto('');
    const antes = estado.current.msgs;
    setMsgs([...antes, { de: 'voce', texto: p }]);
    setPensando(true);
    try {
      const [r] = await Promise.all([perguntarAoAssistente(p, estado.current.e, estado.current.hoje, antes), new Promise((ok) => setTimeout(ok, 450))]);
      setMsgs((m) => [...m, { de: 'assistente', texto: r.texto, links: r.links }]);
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
    if (pathname !== '/' && pathname !== '/inicio') return setBalao(false);
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
              <p>Olho os seus números e respondo na hora: contas, dívidas, gastos e o que você guardou.</p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`as-msg ${m.de}`}>
              <p>{m.texto}</p>
              {m.links && <div className="as-links">{m.links.map((l) => <Link key={l.rota + l.titulo} to={l.rota}>{l.titulo}<ChevronRight size={14} aria-hidden="true" /></Link>)}</div>}
            </div>
          ))}
          {pensando && <div className="as-msg assistente as-digitando" aria-label="Pensando"><i /><i /><i /></div>}
          <div ref={fim} />
        </div>
        <div className="as-sugestoes" role="group" aria-label="Perguntas sugeridas">
          {SUGESTOES.map((s) => <button key={s} type="button" onClick={() => void enviar(s)}>{s}</button>)}
        </div>
        <form className="as-campo" onSubmit={(ev) => { ev.preventDefault(); void enviar(texto); }}>
          <input ref={campo} value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="Pergunte sobre suas contas, dívidas…" aria-label={`Pergunta para o ${NOME_ASSISTENTE}`} maxLength={300} tabIndex={aberto ? 0 : -1} />
          <button type="submit" aria-label="Enviar" disabled={!texto.trim() || pensando} tabIndex={aberto ? 0 : -1}><ArrowUp size={18} aria-hidden="true" /></button>
        </form>
      </aside>
    </>
  );
}
