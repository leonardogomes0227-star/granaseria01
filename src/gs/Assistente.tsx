import { useEffect, useRef, useState } from 'react';
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
  const [tour, setTour] = useState<number | null>(null);
  const [foco, setFoco] = useState<DOMRect | null>(null);
  const [fala, setFala] = useState<{ texto: string; modo: 'tour' | 'tela' } | null>(null);
  const [menu, setMenu] = useState(false);
  const posRef = useRef(pos);
  const tourRef = useRef(tour);
  tourRef.current = tour;
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
    setTour(null);
    setFoco(null);
    setFala(null);
    gravarMidas({ tour: true });
    const c = casaDoMidas();
    ir(c.x, c.y);
  };

  useEffect(() => {
    if (min || lerMidas().tour) return;
    if (pathname !== '/' && pathname !== '/inicio') return;
    const id = window.setTimeout(() => setTour(0), 1100);
    return () => window.clearTimeout(id);
  }, [pathname, min]);

  useEffect(() => {
    if (tour === null || oculto) return;
    const passo = TOUR[tour];
    if (!passo) { encerrar(); return; }
    const aqui = pathname === '/inicio' ? '/' : pathname;
    if (passo.rota && passo.rota !== aqui) { nav(passo.rota); return; }
    let vivo = true;
    const mostrar = () => {
      const el = visivel(passo.sel);
      if (!vivo) return;
      if (!el) { setTour((t) => (t === null ? null : t + 1)); return; }
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduz ? 'auto' : 'smooth' });
      window.setTimeout(() => {
        if (!vivo) return;
        const r = el.getBoundingClientRect();
        setFoco(r);
        if (!reduz) { const p = aoLado(r); ir(p.x, p.y); }
        setFala({ texto: passo.texto, modo: 'tour' });
      }, reduz ? 30 : 420);
    };
    const id = window.setTimeout(mostrar, 60);
    return () => { vivo = false; window.clearTimeout(id); };
    // ir muda a cada render; o passo só depende do índice e da rota
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, pathname, oculto, reduz]);

  useEffect(() => {
    if (tour !== null || min || oculto || dicasDaSessao.has(pathname)) return;
    const regra = DICAS_TELA.find((d) => d.teste(pathname));
    if (!regra) return;
    const id = window.setTimeout(() => {
      if (tourRef.current !== null) return;
      const el = visivel(regra.sel);
      if (!el) return;
      dicasDaSessao.add(pathname);
      const r = el.getBoundingClientRect();
      setFoco(r);
      if (!reduz) { const p = aoLado(r); ir(p.x, p.y); }
      setFala({ texto: regra.texto, modo: 'tela' });
    }, 1500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tour, min, oculto]);

  useEffect(() => {
    if (!pronto || min || reduz || tour !== null || fala || oculto) return;
    const id = window.setInterval(() => {
      if (tourRef.current !== null) return;
      const c = casaDoMidas();
      ir(c.x + (Math.random() > 0.5 ? 36 : -28), c.y - 10);
      depois(2000, () => ir(casaDoMidas().x, casaDoMidas().y));
    }, 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, min, reduz, tour, fala, oculto]);

  const alternarMin = () => {
    const prox = !min;
    setMin(prox);
    gravarMidas({ min: prox });
    setMenu(false);
    setFala(null);
    setFoco(null);
    if (prox) setTour(null);
    const c = casaDoMidas();
    ir(c.x, c.y);
  };

  return (
    <>
    {foco && !min && !oculto && (
      <div className="as-foco" style={{ width: Math.round(foco.width + 12), height: Math.round(foco.height + 12), transform: `translate3d(${Math.round(foco.left - 6)}px, ${Math.round(foco.top - 6)}px, 0)` }} />
    )}
    <div
      className={`as-mascote${min ? ' min' : ''}${andando ? ' andando' : ''}${reduz ? ' parado' : ''}${oculto ? ' oculto' : ''}${pronto ? '' : ' sem-mover'}`}
      style={{ transform: `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)` }}
    >
      <div className={`as-figura${face < 0 ? ' esq' : ''}${andando ? ' andando' : ''}`}>
        <button type="button" className="as-orb-btn" onClick={onAbrir} aria-label={`Perguntar ao ${NOME_ASSISTENTE}, seu assistente`}>
          <Orbe tamanho={min ? 40 : 52} />
        </button>
        <span className="as-pernas" aria-hidden="true"><i /><i /></span>
      </div>
      {fala && !min && !oculto && (
        <div className={`as-fala${pos.y < 150 ? ' baixo' : ''}`} role="dialog" aria-label="Dica do Midas">
          <p>{fala.texto}</p>
          <div>
            {fala.modo === 'tour' ? (
              <>
                <button type="button" onClick={encerrar}>Pular</button>
                <button type="button" onClick={() => setTour((t) => (t === null ? null : t + 1))}>{tour !== null && tour >= TOUR.length - 1 ? 'Pronto' : 'Próximo'}</button>
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
          <button type="button" role="menuitem" onClick={() => { setMenu(false); setFala(null); setTour(0); }}>Me mostra o app</button>
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
