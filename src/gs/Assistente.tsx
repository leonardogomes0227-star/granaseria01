import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

const DICAS = [
  'Toque em mim para perguntar.',
  'Eu olho os seus números antes de responder.',
  'O que vence primeiro é o que eu olho antes.',
];

/** O mascote do assistente: passeia numa faixa livre, pisca, fala pouco e sai do caminho. */
function Mascote({ inicio, onAbrir }: { inicio: boolean; onAbrir: () => void }) {
  const [min, setMin] = useState(false);
  const [dica, setDica] = useState<string | null>(null);
  const reduz = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!inicio || min || reduz) return;
    const mostra = window.setTimeout(() => {
      const orb = document.querySelector('.as-orb-btn');
      if (!orb) return;
      const o = orb.getBoundingClientRect();
      const caixa = { l: Math.max(8, o.left - 160), t: o.top - 4, r: o.left - 4, b: o.bottom + 4 };
      const cobre = [...document.querySelectorAll('.pn-acao, .gs-btn, .cm-abas')].some((el) => {
        const x = el.getBoundingClientRect();
        return x.width > 8 && !(caixa.r < x.left || caixa.l > x.right || caixa.b < x.top || caixa.t > x.bottom);
      });
      if (!cobre) setDica(DICAS[Math.floor(Date.now() / 8000) % DICAS.length]);
    }, 900);
    const esconde = window.setTimeout(() => setDica(null), 6800);
    return () => { window.clearTimeout(mostra); window.clearTimeout(esconde); };
  }, [inicio, min, reduz]);
  return (
    <div className={`as-mascote${min ? ' min' : ''}${inicio && !min && !reduz ? ' anda' : ''}${reduz ? ' parado' : ''}`}>
      <div className="as-andar">
        {dica && !min && (
          <p className="as-dica" role="status">
            {dica}
            <button type="button" onClick={() => setDica(null)} aria-label="Fechar a dica">×</button>
          </p>
        )}
        <button type="button" className="as-orb-btn" onClick={onAbrir} aria-label={`Perguntar ao ${NOME_ASSISTENTE}, seu assistente`}>
          <Orbe tamanho={min ? 40 : 52} />
        </button>
        <button type="button" className="as-recolher" aria-pressed={min} aria-label={min ? `Mostrar o ${NOME_ASSISTENTE} passeando` : `Recolher o ${NOME_ASSISTENTE}`} onClick={() => { setMin((v) => !v); setDica(null); }}>{min ? '+' : '–'}</button>
      </div>
    </div>
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
      {!aberto && (
        <Mascote
          inicio={pathname === '/' || pathname === '/inicio'}
          onAbrir={() => abrirAssistente()}
        />
      )}
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
