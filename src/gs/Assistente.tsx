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
        <button type="button" className="as-flutua" onClick={() => abrirAssistente()} aria-label={`Perguntar ao ${NOME_ASSISTENTE}, seu assistente`}>
          {balao && <span className="as-balao">Sou o {NOME_ASSISTENTE}, seu assistente</span>}
          <Orbe tamanho={46} />
          <span className="as-rotulo">Perguntar</span>
        </button>
      )}
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
