import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Compass, Copy, Hourglass, Landmark, Lock, MessageCircle, ShieldCheck, Smartphone, Sparkles, Wallet, X } from 'lucide-react';
import { CampoDinheiro } from './ui';
import { horasDeTrabalho } from './ferramentas';
import { Moeda } from '../components/ui/Moeda';
import { CartoesPlanos } from './Planos';
import { PRECO_ANUAL, PRECO_MENSAL } from '../config';
import { brl0 } from './datas';
import { waLink } from '../whatsapp';
import { useConvite } from './convite';
import { useContagem } from './base';
import { FERRAMENTAS, GRUPOS, NOME_AREA, type Area } from './registroFerramentas';
import './landing.css';

/* ---------- Página inicial: prende na primeira tela, mostra o valor e leva à fila ---------- */

const PROBLEMAS_FAIXA = ['Conta atrasada', 'Cartão estourado', 'Dinheiro que some', 'Dívida sem data para acabar', 'Parcelas que não fecham', 'Assinatura esquecida', 'Compra por impulso', 'Mês que não fecha'];

const CUSTO: { n: string; t: string; d: string; r: string }[] = [
  { n: '01', t: 'Os juros trabalham contra você todo dia', d: 'Uma dívida cobra juros até enquanto você dorme. Sem saber a data de saída, cada mês parece igual ao anterior.', r: 'O app calcula o dia em que você fica livre e o que pagar a cada mês.' },
  { n: '02', t: 'Parcelas viram um mês que nunca fecha', d: 'Cada parcela parece pequena. Juntas, elas decidem quanto sobra antes de o mês começar.', r: 'Você vê a fatura de hoje, as parcelas que vêm e quanto cabe no seu bolso.' },
  { n: '03', t: 'Gasto pequeno, conta grande', d: 'Assinaturas esquecidas e compras por impulso somam um salário ao longo do ano, e ninguém percebe.', r: 'O app aponta o que você paga sem ver e traduz cada compra em horas de trabalho.' },
];

const ANTES_DEPOIS: [string, string][] = [
  ['No fim do mês: “para onde foi o dinheiro?”', 'Você vê para onde cada real foi, por categoria, em um painel só'],
  ['A conta vence e você lembra tarde', 'Aviso antes de vencer, com o que pagar primeiro'],
  ['Dívida sem data para acabar', 'O dia exato em que você fica livre, e quanto pagar por mês'],
  ['Parcela que parece pequena', 'Todas as parcelas somadas, com o juro que está escondido'],
  ['Compra por impulso', 'O preço em horas do seu trabalho, antes de pagar'],
  ['Planilha que você abandona na semana 2', 'Anota por mensagem: “mercado 35”, e pronto'],
];

const TELAS: { img: string; t: string; d: string }[] = [
  { img: 'funil', t: 'Para onde foi cada real', d: 'Da renda ao que sobrou, mês a mês, em um painel só.' },
  { img: 'contas', t: 'O que vence e o que pagar primeiro', d: 'Atrasadas, as que vencem logo e as pagas, com um toque para pagar.' },
  { img: 'mapa', t: 'Os dias que mais pesam', d: 'Veja em quais dias e categorias o dinheiro escapa.' },
  { img: 'ferramentas', t: '40 ferramentas ao alcance', d: 'Busca, filtro por área e o estado de cada uma na hora.' },
  { img: 'midas', t: 'Conte o problema, ele acha a ferramenta', d: 'O Midas entende o que está acontecendo e aponta o caminho.' },
];

const FAQ: [string, string][] = [
  ['Preciso entender de finanças?', 'Não. O app usa palavras simples e explica cada termo na hora. Você só informa os números; a leitura é com ele.'],
  ['O app pede a senha do meu banco?', 'Nunca. Você digita os valores à mão ou manda por mensagem. Nenhuma conta bancária é conectada.'],
  ['Onde ficam os meus dados?', 'No seu aparelho. Ao entrar com WhatsApp ou e-mail, uma cópia fica guardada na sua conta para você ver em outro aparelho. Só você acessa.'],
  ['Como funciona o pagamento?', `Acesso completo por ${brl0(PRECO_MENSAL)} por mês ou ${brl0(PRECO_ANUAL)} por ano. Cancelar é simples e você não perde o que registrou.`],
  ['Quanto tempo leva para começar?', 'Cerca de 2 minutos: você informa quanto ganha por mês e já vê quanto pode gastar por dia.'],
  ['Funciona no celular?', 'Foi pensado para o celular e pode ser instalado na tela inicial, como um aplicativo.'],
  ['É consultoria financeira?', 'Não. É educação financeira, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre. Os cálculos são estimativas para ajudar você a decidir.'],
];

/* Um único observador para a página inteira (vários observadores pesam em celular fraco). Começa a mostrar um pouco antes de entrar na tela. */
let observador: IntersectionObserver | null = null;
const avisos = new WeakMap<Element, () => void>();
function observar(el: Element, fn: () => void) {
  if (typeof IntersectionObserver === 'undefined') { fn(); return () => undefined; }
  observador ??= new IntersectionObserver((lista) => lista.forEach((en) => { if (en.isIntersecting) { avisos.get(en.target)?.(); avisos.delete(en.target); observador?.unobserve(en.target); } }), { rootMargin: '0px 0px 12% 0px', threshold: 0.01 });
  avisos.set(el, fn); observador.observe(el);
  return () => { avisos.delete(el); observador?.unobserve(el); };
}

/** Aparece suavemente quando está chegando na tela. */
function Revela({ children, atraso = 0, className = '' }: { children: ReactNode; atraso?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setVis(true); return; }
    return observar(el, () => setVis(true));
  }, []);
  return <div ref={ref} className={`lx-rev${vis ? ' vis' : ''} ${className}`} style={atraso ? { transitionDelay: `${atraso}ms` } : undefined}>{children}</div>;
}

function Numero({ v, prefixo = 'R$ ' }: { v: number; prefixo?: string }) {
  const n = useContagem(v, 1100);
  return <>{prefixo}{Math.round(n).toLocaleString('pt-BR')}</>;
}

/** O painel do produto em miniatura (exemplo): os números contam e as barras crescem. */
function JanelaExemplo() {
  const cols: [string, number, number, string?][] = [['Receita', 5200, 100], ['Contas fixas', 1680, 32], ['Variáveis', 1404, 27], ['Sobrou', 2116, 41, 'verde']];
  return (
    <div className="lx-jan" role="img" aria-label="Exemplo do painel do Grana Séria: da renda ao que sobrou no mês">
      <div className="lx-jan-topo"><i /><i /><i /><span>Exemplo ilustrativo</span></div>
      <div className="lx-jan-corpo">
        <div className="lx-jan-tit"><small>Olá, Marina</small><b>Funil do mês</b><em>Sobrou <u><Numero v={2116} /></u> · hoje dá para gastar <u><Numero v={82} /></u></em></div>
        <div className="lx-jan-abas"><span className="on">Funil</span><span>Contas</span><span>Mapa</span><span>Ferramentas</span></div>
        <div className="lx-jan-cols">
          {cols.map(([n, v, h, tom], i) => (
            <div key={n} className="lx-jan-col"><small>{i + 1}. {n}</small><b><Numero v={v} /></b><span className="bx"><i className={tom} style={{ height: `${h}%`, animationDelay: `${0.4 + i * 0.14}s` }} /></span></div>
          ))}
        </div>
      </div>
      <div className="lx-flut a"><Wallet size={16} aria-hidden="true" /><span><small>Pode gastar hoje</small><b>R$ 82</b></span></div>
      <div className="lx-flut b"><Landmark size={16} aria-hidden="true" /><span><small>Livre das dívidas</small><b>jan/2027</b></span></div>
      <div className="lx-fone lx-fone-hero" aria-hidden="true"><img src="/telas/contas.webp" width={600} height={1298} alt="" decoding="async" fetchPriority="low" /></div>
    </div>
  );
}

/** No celular, depois da primeira tela, um botão fixo leva à fila. Some quando a fila já está na tela. */
function BarraFixa({ aoClicar }: { aoClicar: () => void }) {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('topo-lx');
    const fila = document.getElementById('fila');
    if (!hero || !fila || typeof IntersectionObserver === 'undefined') return;
    const vistos = new Set<string>();
    const io = new IntersectionObserver((lista) => {
      lista.forEach((en) => { if (en.isIntersecting) vistos.add(en.target.id); else vistos.delete(en.target.id); });
      setMostrar(vistos.size === 0);
    });
    io.observe(hero); io.observe(fila);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`lx-barra${mostrar ? ' on' : ''}`} aria-hidden={!mostrar}>
      <span><b>Entre na fila</b><small>Vagas abertas em ondas</small></span>
      <button type="button" tabIndex={mostrar ? 0 : -1} onClick={aoClicar}>Quero entrar <ArrowRight size={16} aria-hidden="true" /></button>
    </div>
  );
}

function Calculadora() {
  const [renda, setRenda] = useState(0);
  const [preco, setPreco] = useState(0);
  const horas = renda > 0 && preco > 0 ? horasDeTrabalho(preco, renda, 220) : 0;
  const h = Math.round(horas);
  const dias = Math.round(horas / 8);
  return (
    <div className="lx-calc">
      <div className="lx-calc-cab"><Hourglass size={18} aria-hidden="true" /><b>Teste agora, leva 10 segundos</b></div>
      <div className="lx-calc-campos">
        <CampoDinheiro rotulo="Quanto você ganha por mês?" valor={renda} onChange={setRenda} />
        <CampoDinheiro rotulo="Quanto custa o que você quer?" valor={preco} onChange={setPreco} />
      </div>
      <div className="lx-calc-res" aria-live="polite">
        {horas > 0 ? (
          <><b>{h} {h === 1 ? 'hora' : 'horas'}</b><span>de trabalho{dias >= 1 ? `, quase ${dias} ${dias === 1 ? 'dia' : 'dias'} inteiros` : ''}. Ainda vale a pena?</span></>
        ) : (
          <span>Digite os dois valores. Considero 220 horas de trabalho por mês.</span>
        )}
      </div>
    </div>
  );
}


/* ----- fila de espera: posição de verdade, indicação para subir e convite com prazo ----- */
interface SituacaoFila { codigo: string; posicao: number | null; total: number; indicacoes: number; status: string; conviteAte: string | null }
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };
const ler = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

function FilaDeEspera() {
  const [nome, setNome] = useState('');
  const [fone, setFone] = useState('');
  const [erro, setErro] = useState('');
  const [envio, setEnvio] = useState(false);
  const [s, setS] = useState<SituacaoFila | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [fora, setFora] = useState(false); // a fila ainda não está ligada no servidor: usa o WhatsApp
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[A-Za-z0-9]{6}$/.test(ref)) guardar('gs-ref', ref.toUpperCase());
    const meu = ler('gs-fila');
    if (meu) fetch(`/api/fila?codigo=${meu}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setS({ codigo: meu, ...j }); }).catch(() => undefined);
    fetch('/api/fila?total=1').then((r) => (r.ok ? r.json() : null)).then((j: { total: number } | null) => { if (j) setTotal(j.total); else setFora(true); }).catch(() => setFora(true));
  }, []);
  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErro(''); setEnvio(true);
    try {
      const r = await fetch('/api/fila', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, whatsapp: fone, ref: ler('gs-ref') ?? undefined }) });
      const j = await r.json();
      if (!r.ok) { setErro(j.error ?? 'Não consegui agora. Tente de novo.'); return; }
      guardar('gs-fila', j.codigo);
      setS(j);
    } catch { setErro('Sem conexão. Tente de novo.'); } finally { setEnvio(false); }
  };
  const link = s ? `${window.location.origin}/?ref=${s.codigo}` : '';
  const copiar = async () => { try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2200); } catch { /* sem permissão */ } };
  return (
    <div className="lx-fila" id="fila">
      {s ? (
        <div className="lx-fila-ok" aria-live="polite">
          <span className="lx-eyebrow ouro">Você está na fila</span>
          {s.status === 'convidado' ? (
            <><h3>Sua vez chegou.</h3><p>O seu convite foi liberado{s.conviteAte ? ` e vale até ${new Date(s.conviteAte).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}` : ''}. Veja a mensagem que enviamos no seu WhatsApp.</p></>
          ) : (
            <><div className="lx-pos"><small>Sua posição</small><b>{s.posicao ?? '—'}</b><span>{s.total > 0 ? `de ${s.total} ${s.total === 1 ? 'pessoa' : 'pessoas'}` : ''}</span></div>
              <p>Quando sua vez chegar, você recebe o convite no WhatsApp, com prazo para aceitar. {s.indicacoes > 0 ? `Você já subiu indicando ${s.indicacoes} ${s.indicacoes === 1 ? 'pessoa' : 'pessoas'}.` : 'Indique amigos para subir na fila.'}</p>
              <div className="lx-ind"><span>Cada amigo que entrar pelo seu link faz você subir 5 posições.</span>
                <button type="button" onClick={copiar}>{copiado ? <><Check size={15} aria-hidden="true" /> Link copiado</> : <><Copy size={15} aria-hidden="true" /> Copiar meu link</>}</button></div></>
          )}
        </div>
      ) : fora ? (
        <div className="lx-fila-ok">
          <span className="lx-eyebrow ouro">Fila de espera</span>
          <h3>Entre na fila pelo WhatsApp</h3>
          <p>As vagas abrem em ondas. Mande uma mensagem e a gente coloca o seu nome na fila. Quando chegar a sua vez, o convite vem por lá, com prazo para aceitar.</p>
          <a className="lx-btn ouro" href={waLink('Oi! Quero entrar na fila de espera do Grana Séria.')} target="_blank" rel="noopener noreferrer" style={{ marginTop: 18, width: '100%' }}>Entrar na fila pelo WhatsApp <ArrowRight size={18} aria-hidden="true" /></a>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate>
          <span className="lx-eyebrow ouro">Fila de espera</span>
          <h3>Entre na fila para receber o seu convite</h3>
          <p>As vagas abrem em ondas. Deixe o seu nome e o seu WhatsApp: quando chegar a sua vez, o convite vai direto para lá, com um prazo para aceitar.</p>
          <div className="lx-fila-campos">
            <label>Seu nome<input value={nome} onChange={(ev) => setNome(ev.target.value)} autoComplete="given-name" maxLength={60} required /></label>
            <label>Seu WhatsApp<input value={fone} onChange={(ev) => setFone(ev.target.value)} inputMode="tel" autoComplete="tel" placeholder="(67) 99999-9999" maxLength={20} required /></label>
          </div>
          {erro && <p className="lx-fila-erro" role="alert">{erro}</p>}
          <button type="submit" className="lx-btn ouro" disabled={envio}>{envio ? 'Entrando…' : 'Entrar na fila'} <ArrowRight size={18} aria-hidden="true" /></button>
          <small>{total !== null && total >= 10 ? `${total} pessoas já estão na fila. ` : ''}Usamos o seu número só para o convite. Nada de spam.</small>
        </form>
      )}
    </div>
  );
}

function Sanfona({ itens }: { itens: [string, string][] }) {
  const [aberto, setAberto] = useState<number | null>(null);
  return (
    <div className="lx-faq">
      {itens.map(([q, a], i) => (
        <div key={q} className={aberto === i ? 'on' : ''}>
          <button type="button" aria-expanded={aberto === i} onClick={() => setAberto(aberto === i ? null : i)}>{q}<ChevronDown size={18} aria-hidden="true" /></button>
          {aberto === i && <p>{a}</p>}
        </div>
      ))}
    </div>
  );
}

export function Landing({ resume, onStart, onResume }: { resume: number | null; onStart: () => void; onResume: () => void }) {
  const ir = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const convite = useConvite();
  const areas = (Object.keys(GRUPOS) as Area[]).map((a) => ({ a, itens: FERRAMENTAS.filter((f) => f.area === a) }));
  const [naFila, setNaFila] = useState<number | null>(null);
  useEffect(() => { fetch('/api/fila?total=1').then((r) => (r.ok ? r.json() : null)).then((j: { total: number } | null) => { if (j && j.total >= 10) setNaFila(j.total); }).catch(() => undefined); }, []);
  return (
    <div className="lx">
      {/* ===== abertura: escura, grande e direta ===== */}
      <section className="lx-hero" id="topo-lx">
        <div className="lx-hero-in">
          <div className="lx-hero-txt">
            <span className="lx-selo"><Sparkles size={14} aria-hidden="true" />Acesso exclusivo · vagas abertas em ondas</span>
            <h1>Seu dinheiro some todo mês. <em>Descubra para onde.</em></h1>
            <p>O Grana Séria responde, todo dia, o que ninguém te conta: quanto você pode gastar hoje, o que pagar primeiro e em que dia você fica livre das dívidas.</p>
            <div className="lx-acoes">
              <button type="button" className="lx-btn ouro" onClick={() => ir('fila')}>Entrar na fila de espera <ArrowRight size={18} aria-hidden="true" /></button>
              <button type="button" className="lx-btn claro" onClick={() => ir('teste')}>Fazer o teste de 10 segundos</button>
            </div>
            <ul className="lx-conf" aria-label="Garantias">
              <li><Lock size={15} aria-hidden="true" />Sem senha de banco</li>
              <li><ShieldCheck size={15} aria-hidden="true" />Só você vê os seus dados</li>
              <li><MessageCircle size={15} aria-hidden="true" />Anote pelo WhatsApp</li>
              <li><Smartphone size={15} aria-hidden="true" />Funciona no celular</li>
            </ul>
            {naFila !== null && <p className="lx-fila-n"><span className="lx-ponto" aria-hidden="true" /><b>{naFila}</b> pessoas já estão na fila</p>}
          </div>
          <div className="lx-hero-vis"><JanelaExemplo /></div>
        </div>
      </section>

      {/* ===== faixa de problemas que passa sozinha ===== */}
      <div className="lx-faixa" aria-label="Problemas que o Grana Séria resolve">
        <div className="lx-faixa-in">
          {[0, 1].map((k) => <ul key={k} aria-hidden={k === 1}>{PROBLEMAS_FAIXA.map((t) => <li key={t}>{t}</li>)}</ul>)}
        </div>
      </div>

      {/* ===== as telas de verdade ===== */}
      <section className="lx-sec lx-por-dentro" id="por-dentro">
        <Revela className="lx-centro"><span className="lx-eyebrow">Veja por dentro</span><h2>O app <em>de verdade</em>, tela por tela</h2>
          <p className="lx-sub">Telas reais do Grana Séria, com dados de exemplo. Tudo o que aparece aqui você usa no seu celular.</p></Revela>
        <div className="lx-telas" role="list">
          {TELAS.map((t, i) => (
            <Revela key={t.img} atraso={i * 70} className="lx-tela">
              <div className="lx-fone" role="listitem"><img src={`/telas/${t.img}.webp`} width={600} height={1298} alt={`Tela do app: ${t.t}`} loading="lazy" decoding="async" /></div>
              <b>{t.t}</b><span>{t.d}</span>
            </Revela>
          ))}
        </div>
      </section>

      {/* ===== o gancho: o teste ===== */}
      <section className="lx-sec" id="teste">
        <div className="lx-duo">
          <Revela className="lx-duo-txt">
            <span className="lx-eyebrow">Veja na prática</span>
            <h2>Aquela compra custa <em>quantas horas</em> do seu trabalho?</h2>
            <p>Dinheiro é tempo de vida. O Grana Séria traduz qualquer valor em horas trabalhadas, para você decidir com a cabeça, e não com a vontade do momento.</p>
          </Revela>
          <Revela atraso={80}><Calculadora /></Revela>
        </div>
      </section>

      {/* ===== o custo de não saber ===== */}
      <section className="lx-sec claro">
        <Revela><span className="lx-eyebrow">O custo de não saber</span><h2>O que acontece quando <em>ninguém conta o dinheiro</em></h2></Revela>
        <div className="lx-tres">
          {CUSTO.map((c, i) => (
            <Revela key={c.t} atraso={i * 70} className="lx-cartao">
              <span className="lx-ordem">{c.n}</span>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
              <div className="lx-resolve"><Sparkles size={14} aria-hidden="true" /><span>{c.r}</span></div>
            </Revela>
          ))}
        </div>
      </section>

      {/* ===== antes e depois ===== */}
      <section className="lx-sec">
        <Revela><span className="lx-eyebrow">A diferença</span><h2>Sem o app, <em>é no escuro</em></h2></Revela>
        <Revela atraso={60} className="lx-vs">
          <div className="lx-vs-cab"><span>Sem o Grana Séria</span><span>Com o Grana Séria</span></div>
          {ANTES_DEPOIS.map(([a, b]) => (
            <div key={a} className="lx-vs-lin"><p className="nao"><X size={16} aria-hidden="true" />{a}</p><p className="sim"><Check size={16} aria-hidden="true" />{b}</p></div>
          ))}
        </Revela>
      </section>

      {/* ===== o que a pessoa passa a ter ===== */}
      <section className="lx-sec escura">
        <Revela><span className="lx-eyebrow ouro">O que você passa a ter</span><h2>Quatro coisas que <em>mudam o seu mês</em></h2></Revela>
        <div className="lx-bento">
          <Revela className="lx-bl grande">
            <span className="lx-ganho-k">Clareza</span>
            <h3>Um número por dia</h3>
            <p>Quanto você pode gastar hoje, já descontando contas, dívidas e a reserva combinada.</p>
            <div className="lx-pilulas" aria-label="Já descontado"><span>contas fixas</span><span>parcelas das dívidas</span><span>reserva combinada</span></div>
            <div className="lx-gnum"><b>R$ 82</b><small>pode gastar hoje</small></div>
            <div className="lx-barrinha"><i style={{ width: '64%' }} /></div>
            <small className="lx-ex">Exemplo ilustrativo</small>
          </Revela>
          <Revela atraso={60} className="lx-bl">
            <span className="lx-ganho-k">Direção</span>
            <h3>Uma data de saída</h3>
            <p>O dia em que você fica livre das dívidas, com o plano mês a mês e o aviso antes de cada parcela.</p>
            <div className="lx-gnum"><b>jan/2027</b><small>livre das dívidas</small></div>
          </Revela>
          <Revela atraso={100} className="lx-bl">
            <span className="lx-ganho-k">Segurança</span>
            <h3>Decisão sem culpa</h3>
            <p>O preço de uma compra em horas de trabalho, o juro escondido do parcelado, o empréstimo mais barato.</p>
            <div className="lx-gnum"><b>18 h</b><small>de trabalho num tênis</small></div>
          </Revela>
          <Revela atraso={140} className="lx-bl largo">
            <span className="lx-ganho-k">Progresso</span>
            <h3>Um caminho guiado</h3>
            <p>Do atraso à reserva e ao investimento, um passo de cada vez. Você sempre sabe qual é o próximo.</p>
            <ol className="lx-trilha" aria-label="Exemplo de caminho">
              <li className="feito"><Check size={14} aria-hidden="true" />Contas em dia</li>
              <li className="feito"><Check size={14} aria-hidden="true" />Dívida cara quitada</li>
              <li className="agora"><span aria-hidden="true" />Reserva de emergência</li>
              <li><span aria-hidden="true" />Começar a investir</li>
            </ol>
          </Revela>
        </div>
      </section>

      {/* ===== Midas ===== */}
      <section className="lx-sec">
        <div className="lx-duo">
          <Revela className="lx-duo-txt">
            <span className="lx-eyebrow">Midas, o assistente</span>
            <h2>Conte o problema. <em>Ele acha a ferramenta.</em></h2>
            <p>São {FERRAMENTAS.length} ferramentas, mas você nunca precisa procurar. Descreva o que está acontecendo com as suas palavras e o Midas aponta a ferramenta certa para aquilo.</p>
            <ul className="lx-pontos">
              <li><MessageCircle size={16} aria-hidden="true" />Entende o problema como você conta</li>
              <li><Compass size={16} aria-hidden="true" />Aponta a ferramenta e leva direto até ela</li>
              <li><Wallet size={16} aria-hidden="true" />Anota gastos pelo WhatsApp: “mercado 35”</li>
            </ul>
          </Revela>
          <Revela atraso={100} className="lx-chat">
            <div className="lx-chat-in" role="img" aria-label="Exemplo de conversa com o Midas">
              <div className="b voce">meu dinheiro acaba antes do fim do mês</div>
              <div className="b midas"><Moeda tamanho={22} /><span>Então o primeiro passo é dar um limite para cada gasto. Comece pelo Orçamento.</span></div>
              <div className="lx-chat-link">Abrir Orçamento <ArrowRight size={14} aria-hidden="true" /></div>
              <div className="b voce">tenho conta atrasada</div>
              <div className="b midas"><Moeda tamanho={22} /><span>A ordem do que pagar primeiro faz diferença. Te levo para Sair do atraso.</span></div>
              <small>Exemplo ilustrativo</small>
            </div>
          </Revela>
        </div>
      </section>

      {/* ===== ferramentas ===== */}
      <section className="lx-sec claro" id="ferramentas">
        <Revela><span className="lx-eyebrow">Tudo num lugar só</span><h2>{FERRAMENTAS.length} ferramentas, <em>uma só lógica</em></h2>
          <p className="lx-sub">Cada área resolve uma parte da sua vida financeira e diz o que fazer agora.</p></Revela>
        <div className="lx-areas">
          {areas.map(({ a, itens }, i) => (
            <Revela key={a} atraso={i * 50} className="lx-area">
              <div className="lx-area-cab"><b>{NOME_AREA[a]}</b><span>{itens.length}</span></div>
              <ul>{itens.slice(0, 5).map((f) => <li key={f.id}>{f.titulo}</li>)}{itens.length > 5 && <li className="mais">e mais {itens.length - 5}</li>}</ul>
            </Revela>
          ))}
        </div>
      </section>

      {/* ===== como funciona ===== */}
      <section className="lx-sec">
        <Revela><span className="lx-eyebrow">Como funciona</span><h2>Em 2 minutos você vê <em>o primeiro número</em></h2></Revela>
        <ol className="lx-passos">
          {[['Informe quanto você ganha', 'É só um número. Leva um minuto.'], ['Anote o que entra e o que sai', 'No app ou pelo WhatsApp, do seu jeito.'], ['Siga o que o painel mostra', 'O que está livre, o que vence e o próximo passo.']].map(([t, x], i) => (
            <Revela key={t} atraso={i * 80} className="lx-passo"><em>{i + 1}</em><b>{t}</b><span>{x}</span></Revela>
          ))}
        </ol>
      </section>

      {/* ===== segurança ===== */}
      <section className="lx-seg">
        <Revela className="lx-seg-in">
          {[[Lock, 'Sem senha de banco', 'Nenhuma conta bancária é conectada. Você digita ou manda por mensagem.'], [ShieldCheck, 'Os dados são seus', 'Só você acessa. Exporte tudo ou apague quando quiser, em Meus dados.'], [Smartphone, 'No seu celular', 'Instale na tela inicial e use como um aplicativo, sem baixar nada pesado.'], [MessageCircle, 'Anote pelo WhatsApp', 'Mande “mercado 35” e o gasto aparece no app, e o mês também no WhatsApp.']].map(([I, t, d]) => {
            const Icone = I as typeof Lock;
            return <div key={t as string} className="lx-seg-i"><i aria-hidden="true"><Icone size={20} /></i><b>{t as string}</b><span>{d as string}</span></div>;
          })}
        </Revela>
      </section>

      {/* ===== acesso ===== */}
      <section className="lx-sec escura" id="acesso">
        <Revela><span className="lx-eyebrow ouro">Acesso exclusivo</span><h2>Entra quem <em>recebe o convite</em></h2>
          <p className="lx-sub">{convite.valido ? `O seu convite está liberado${convite.ate ? ` até ${new Date(convite.ate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}` : ''}. Escolha o seu plano.` : 'O Grana Séria abre vagas em ondas. Entre na fila e a gente chama você pelo WhatsApp.'}</p></Revela>
        <Revela atraso={60}><FilaDeEspera /></Revela>
        <Revela atraso={100} className="lx-planos"><CartoesPlanos semNota travado={!convite.valido} /></Revela>
      </section>

      {/* ===== dúvidas ===== */}
      <section className="lx-sec estreita">
        <Revela><span className="lx-eyebrow">Dúvidas</span><h2>O que as pessoas <em>perguntam antes</em></h2></Revela>
        <Revela atraso={60}><Sanfona itens={FAQ} /></Revela>
      </section>

      {/* ===== fechamento ===== */}
      <section className="lx-fim">
        <Revela>
          <Moeda tamanho={56} />
          <h2>O próximo mês pode ser <em>diferente</em></h2>
          <p>Quem sabe o número decide melhor. Comece a ver o seu hoje.</p>
          <div className="lx-acoes centro">
            <button type="button" className="lx-btn ouro" onClick={() => ir('fila')}>Entrar na fila de espera <ArrowRight size={18} aria-hidden="true" /></button>
            <Link to="/entrar" className="lx-btn claro">Já sou membro</Link>
          </div>
          {resume !== null && <button type="button" className="lx-link" onClick={onResume}>Continuar meu diagnóstico ({resume} de 7)</button>}
          {resume === null && <button type="button" className="lx-link" onClick={onStart}>Fazer o diagnóstico financeiro</button>}
          <small>Conteúdo educativo, não é consultoria financeira.</small>
        </Revela>
      </section>

      <BarraFixa aoClicar={() => ir('fila')} />
    </div>
  );
}
