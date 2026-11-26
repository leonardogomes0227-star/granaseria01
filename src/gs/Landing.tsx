import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Check, ChevronDown, Compass, Copy, Gauge, Hourglass, Landmark, Lock, MessageCircle, ShieldCheck, Smartphone, Sparkles, Wallet } from 'lucide-react';
import { CampoDinheiro } from './ui';
import { horasDeTrabalho } from './ferramentas';
import { Moeda } from '../components/ui/Moeda';
import { CartoesPlanos } from './Planos';
import { PRECO_ANUAL, PRECO_MENSAL } from '../config';
import { brl0 } from './datas';
import { waLink } from '../whatsapp';
import { FERRAMENTAS, GRUPOS, NOME_AREA, type Area } from './registroFerramentas';
import './landing.css';

/* ---------- Página inicial: o que o Grana Séria entrega, por que importa e o que a pessoa passa a ter ---------- */

const CUSTO: { t: string; d: string; r: string }[] = [
  { t: 'Os juros trabalham contra você todo dia', d: 'Uma dívida cobra juros até enquanto você dorme. Sem saber a data de saída, cada mês parece igual ao anterior.', r: 'O Grana Séria calcula o dia em que você fica livre e o que pagar a cada mês.' },
  { t: 'Parcelas viram um mês que nunca fecha', d: 'Cada parcela parece pequena. Juntas, elas decidem quanto sobra antes de o mês começar.', r: 'Você vê a fatura de hoje, as parcelas que ainda vêm e quanto cabe no seu bolso.' },
  { t: 'Gasto pequeno, conta grande', d: 'Assinaturas esquecidas e compras por impulso somam um salário ao longo do ano, e ninguém percebe.', r: 'O app aponta o que você paga sem ver e traduz cada compra em horas do seu trabalho.' },
];

const GANHOS: { I: typeof Gauge; t: string; d: string; k: string }[] = [
  { I: Gauge, t: 'Um número por dia', d: 'Quanto você pode gastar hoje, já descontando contas, dívidas e a reserva combinada.', k: 'Clareza' },
  { I: CalendarClock, t: 'Uma data de saída', d: 'O dia em que você fica livre das dívidas, com o plano mês a mês e o aviso antes de cada parcela.', k: 'Direção' },
  { I: Hourglass, t: 'Decisão sem culpa', d: 'O preço de uma compra em horas de trabalho, o juro escondido do parcelado, o empréstimo mais barato de verdade.', k: 'Segurança' },
  { I: Compass, t: 'Um caminho guiado', d: 'Do atraso à reserva e ao investimento, um passo de cada vez. Você sempre sabe qual é o próximo.', k: 'Progresso' },
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

/** Aparece suavemente quando entra na tela. */
function Revela({ children, atraso = 0, className = '' }: { children: ReactNode; atraso?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setVis(true); return; }
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`lx-rev${vis ? ' vis' : ''} ${className}`} style={{ transitionDelay: `${atraso}ms` }}>{children}</div>;
}

/** A janela do produto, só como exemplo: é o painel de verdade em miniatura. */
function JanelaExemplo() {
  const cols: [string, string, number, string?][] = [['Receita', 'R$ 5.200', 100], ['Contas fixas', 'R$ 1.680', 32], ['Variáveis', 'R$ 1.404', 27], ['Sobrou', 'R$ 2.116', 41, 'verde']];
  return (
    <div className="lx-jan" role="img" aria-label="Exemplo do painel do Grana Séria: da renda ao que sobrou no mês">
      <div className="lx-jan-topo"><i /><i /><i /><span>Exemplo ilustrativo</span></div>
      <div className="lx-jan-corpo">
        <div className="lx-jan-tit"><small>Olá, Marina</small><b>Funil do mês</b><em>Sobrou <u>R$ 2.116</u> · hoje dá para gastar <u>R$ 82</u></em></div>
        <div className="lx-jan-abas"><span className="on">Funil</span><span>Contas</span><span>Mapa</span></div>
        <div className="lx-jan-cols">
          {cols.map(([n, v, h, tom], i) => (
            <div key={n} className="lx-jan-col"><small>{i + 1}. {n}</small><b>{v}</b><span className="bx"><i className={tom} style={{ height: `${h}%`, animationDelay: `${0.5 + i * 0.15}s` }} /></span></div>
          ))}
        </div>
      </div>
      <div className="lx-flut a"><Wallet size={15} aria-hidden="true" /><span><small>Pode gastar hoje</small><b>R$ 82</b></span></div>
      <div className="lx-flut b"><Landmark size={15} aria-hidden="true" /><span><small>Livre das dívidas</small><b>jan/2027</b></span></div>
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
      <div className="lx-calc-cab"><Hourglass size={18} aria-hidden="true" /><b>Veja na prática</b></div>
      <h3>Quanto custa, em horas do seu trabalho, o que você quer comprar?</h3>
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

/** O convite do link (?convite=CÓDIGO) ainda vale? Só então os planos abrem. */
function useConvite(): { valido: boolean; ate: string | null } {
  const [c, setC] = useState<{ valido: boolean; ate: string | null }>({ valido: false, ate: null });
  useEffect(() => {
    const codigo = (new URLSearchParams(window.location.search).get('convite') ?? ler('gs-convite') ?? '').toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(codigo)) return;
    fetch(`/api/fila?convite=${codigo}`).then((r) => (r.ok ? r.json() : null)).then((j: { valido: boolean; ate: string | null } | null) => { if (j?.valido) { guardar('gs-convite', codigo); setC(j); } }).catch(() => undefined);
  }, []);
  return c;
}

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
  return (
    <div className="lx">
      {/* ===== abertura ===== */}
      <section className="lx-hero">
        <div className="lx-hero-in">
          <div className="lx-hero-txt">
            <span className="lx-selo"><Sparkles size={14} aria-hidden="true" />Acesso exclusivo · Controle financeiro de verdade</span>
            <h1>Pare de perguntar <em>para onde o dinheiro foi.</em></h1>
            <p>O Grana Séria responde todo dia o que importa: quanto você pode gastar, o que pagar primeiro e em que dia você fica livre das dívidas.</p>
            <div className="lx-acoes">
              <button type="button" className="lx-btn ouro" onClick={() => ir('fila')}>Entrar na fila de espera <ArrowRight size={18} aria-hidden="true" /></button>
              <Link to="/entrar" className="lx-btn claro">Já sou membro</Link>
            </div>
            <ul className="lx-conf" aria-label="Garantias">
              <li><Lock size={15} aria-hidden="true" />Sem senha de banco</li>
              <li><ShieldCheck size={15} aria-hidden="true" />Só você vê os seus dados</li>
              <li><Smartphone size={15} aria-hidden="true" />Funciona no celular</li>
            </ul>
          </div>
          <div className="lx-hero-vis"><JanelaExemplo /></div>
        </div>
      </section>

      {/* ===== o custo de não saber ===== */}
      <section className="lx-sec">
        <Revela><span className="lx-eyebrow">O custo de não saber</span><h2>O que acontece quando <em>ninguém conta o dinheiro</em></h2></Revela>
        <div className="lx-tres">
          {CUSTO.map((c, i) => (
            <Revela key={c.t} atraso={i * 90} className="lx-cartao">
              <h3>{c.t}</h3>
              <p>{c.d}</p>
              <div className="lx-resolve"><Sparkles size={14} aria-hidden="true" /><span>{c.r}</span></div>
            </Revela>
          ))}
        </div>
      </section>

      {/* ===== o que a pessoa passa a ter ===== */}
      <section className="lx-sec escura">
        <Revela><span className="lx-eyebrow ouro">O que você passa a ter</span><h2>Quatro coisas que <em>mudam o seu mês</em></h2></Revela>
        <div className="lx-quatro">
          {GANHOS.map(({ I, t, d, k }, i) => (
            <Revela key={t} atraso={i * 80} className="lx-ganho">
              <span className="lx-ganho-k">{k}</span>
              <i aria-hidden="true"><I size={22} strokeWidth={1.8} /></i>
              <h3>{t}</h3>
              <p>{d}</p>
            </Revela>
          ))}
        </div>
      </section>

      {/* ===== Midas ===== */}
      <section className="lx-sec">
        <div className="lx-duo">
          <Revela className="lx-duo-txt">
            <span className="lx-eyebrow">Midas, o assistente</span>
            <h2>Não sabe onde fica? <em>Pergunte e ele te leva.</em></h2>
            <p>São mais de {Math.floor(FERRAMENTAS.length / 5) * 5} ferramentas, mas você nunca precisa procurar. Diga o que quer resolver e o Midas abre a tela certa, com os seus números já preenchidos.</p>
            <ul className="lx-pontos">
              <li><MessageCircle size={16} aria-hidden="true" />Responde com os seus dados, em uma frase</li>
              <li><Compass size={16} aria-hidden="true" />Leva direto para a aba que resolve</li>
              <li><Wallet size={16} aria-hidden="true" />Anota gastos pelo WhatsApp: “mercado 35”</li>
            </ul>
          </Revela>
          <Revela atraso={120} className="lx-chat" >
            <div className="lx-chat-in" role="img" aria-label="Exemplo de conversa com o Midas">
              <div className="b voce">quero pagar o aluguel</div>
              <div className="b midas"><Moeda tamanho={22} /><span>O aluguel de R$ 1.400 vence dia 10. Te levo para as Contas.</span></div>
              <div className="lx-chat-link">Abrir Contas <ArrowRight size={14} aria-hidden="true" /></div>
              <div className="b voce">quando fico livre das dívidas?</div>
              <div className="b midas"><Moeda tamanho={22} /><span>Pagando R$ 2.000 por mês, em janeiro de 2027.</span></div>
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
            <Revela key={a} atraso={i * 70} className="lx-area">
              <div className="lx-area-cab"><b>{NOME_AREA[a]}</b><span>{itens.length}</span></div>
              <ul>{itens.slice(0, 5).map((f) => <li key={f.id}>{f.titulo}</li>)}{itens.length > 5 && <li className="mais">e mais {itens.length - 5}</li>}</ul>
            </Revela>
          ))}
        </div>
      </section>

      {/* ===== na prática ===== */}
      <section className="lx-sec">
        <div className="lx-duo inv">
          <Revela className="lx-duo-txt">
            <span className="lx-eyebrow">Como funciona</span>
            <h2>Em 2 minutos você vê <em>o primeiro número</em></h2>
            <ol className="lx-passos">
              {[['Informe quanto você ganha', 'É só um número.'], ['Anote o que entra e o que sai', 'No app ou pelo WhatsApp, do seu jeito.'], ['Siga o que o painel mostra', 'O que está livre, o que vence e o próximo passo.']].map(([t, x], i) => (
                <li key={t}><em>{i + 1}</em><div><b>{t}</b><span>{x}</span></div></li>
              ))}
            </ol>
          </Revela>
          <Revela atraso={100}><Calculadora /></Revela>
        </div>
      </section>

      {/* ===== acesso ===== */}
      <section className="lx-sec escura" id="acesso">
        <Revela><span className="lx-eyebrow ouro">Acesso exclusivo</span><h2>Entra quem <em>recebe o convite</em></h2>
          <p className="lx-sub">{convite.valido ? `O seu convite está liberado${convite.ate ? ` até ${new Date(convite.ate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}` : ''}. Escolha o seu plano.` : 'O Grana Séria abre vagas em ondas. Entre na fila e a gente chama você pelo WhatsApp.'}</p></Revela>
        <Revela atraso={80}><FilaDeEspera /></Revela>
        <Revela atraso={120} className="lx-planos"><CartoesPlanos semNota travado={!convite.valido} /></Revela>
      </section>

      {/* ===== dúvidas ===== */}
      <section className="lx-sec estreita">
        <Revela><span className="lx-eyebrow">Dúvidas</span><h2>O que as pessoas <em>perguntam antes</em></h2></Revela>
        <Revela atraso={80}><Sanfona itens={FAQ} /></Revela>
      </section>

      {/* ===== fechamento ===== */}
      <section className="lx-fim">
        <Revela>
          <Moeda tamanho={56} />
          <h2>O próximo mês pode ser <em>diferente</em></h2>
          <p>Quem sabe o número decide melhor. Comece a ver o seu hoje.</p>
          <div className="lx-acoes centro">
            <button type="button" className="lx-btn ouro" onClick={() => ir('fila')}>Entrar na fila de espera <ArrowRight size={18} aria-hidden="true" /></button>
            <Link to="/entrar" className="lx-btn claro">Entrar</Link>
          </div>
          {resume !== null && <button type="button" className="lx-link" onClick={onResume}>Continuar meu diagnóstico ({resume} de 7)</button>}
          {resume === null && <button type="button" className="lx-link" onClick={onStart}>Fazer o diagnóstico financeiro</button>}
          <small>Conteúdo educativo, não é consultoria financeira.</small>
        </Revela>
      </section>
    </div>
  );
}
