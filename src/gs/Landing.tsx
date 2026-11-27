import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Lock, MessageCircle, ShieldCheck, Smartphone } from 'lucide-react';
import { CampoDinheiro, CampoNumero } from './ui';
import { horasDeTrabalho } from './ferramentas';
import { Moeda } from '../components/ui/Moeda';
import { CartoesFundador, CartoesPlanos } from './Planos';
import { PRECO_ANUAL, PRECO_FUNDADOR_ANUAL, PRECO_FUNDADOR_MENSAL, PRECO_MENSAL } from '../config';
import { brl0 } from './datas';
import { waLink } from '../whatsapp';
import { useConvite } from './convite';
import { FERRAMENTAS } from './registroFerramentas';
import './landing.css';

/* Página de vendas. Escura, com ouro só como destaque. O que mexe é opacidade e deslocamento. */

const DORES: string[] = [
  'O dinheiro acaba antes do fim do mês e eu não sei para onde foi',
  'Tenho conta atrasada ou dívida que não sai do lugar',
  'O cartão virou uma bola de neve',
  'Já parcelei sem saber quanto de juro estava pagando',
  'Nunca consegui guardar dinheiro de verdade',
  'Dá um aperto no peito quando vou abrir o app do banco',
];

const TELAS: { img: string; t: string; d: string }[] = [
  { img: 'funil', t: 'O mês inteiro', d: 'Da renda ao que sobrou, num painel só.' },
  { img: 'contas', t: 'O que pagar primeiro', d: 'Atrasadas, as que vencem logo e as pagas.' },
  { img: 'midas', t: 'O Midas', d: 'Você conta o problema. Ele aponta a ferramenta.' },
];

const FAQ: [string, string][] = [
  ['Preciso entender de finanças?', 'Não. O app usa palavras simples e explica cada termo na hora. Você só informa os números. A leitura é com ele.'],
  ['O app pede a senha do meu banco?', 'Nunca. Você digita os valores à mão ou manda por mensagem. Nenhuma conta bancária é conectada.'],
  ['Onde ficam os meus dados?', 'No seu aparelho. Ao entrar com WhatsApp ou e-mail, uma cópia fica guardada na sua conta para você ver em outro aparelho. Só você acessa.'],
  ['Como funciona o pagamento?', `O preço de fundador é ${brl0(PRECO_FUNDADOR_MENSAL)} por mês ou ${brl0(PRECO_FUNDADOR_ANUAL)} por ano. O preço de lançamento é ${brl0(PRECO_MENSAL)} por mês ou ${brl0(PRECO_ANUAL)} por ano. Cancelar é simples e você não perde o que registrou.`],
  ['E se eu não gostar?', 'Você tem 7 dias de garantia: é só pedir o reembolso. E pode cancelar a assinatura quando quiser, sem perder o que registrou.'],
  ['Vou ter muito trabalho para anotar tudo?', 'Não. Pelo WhatsApp você manda “mercado 35” e pronto, leva uns 5 segundos. O que você anota lá aparece no app, e o contrário também.'],
  ['Quanto tempo leva para começar?', 'Cerca de 2 minutos: você informa quanto ganha por mês e já vê quanto pode gastar por dia.'],
  ['Funciona no celular?', 'Foi pensado para o celular e pode ser instalado na tela inicial, como um aplicativo.'],
  ['É consultoria financeira?', 'Não. É educação financeira, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre. Os cálculos são estimativas para ajudar você a decidir.'],
];

let observador: IntersectionObserver | null = null;
const avisos = new WeakMap<Element, () => void>();
function observar(el: Element, fn: () => void) {
  if (typeof IntersectionObserver === 'undefined') { fn(); return () => undefined; }
  observador ??= new IntersectionObserver((lista) => lista.forEach((en) => {
    if (!en.isIntersecting) return;
    avisos.get(en.target)?.();
    avisos.delete(en.target);
    observador?.unobserve(en.target);
  }), { rootMargin: '80px 0px', threshold: 0.01 });
  avisos.set(el, fn);
  observador.observe(el);
  return () => { avisos.delete(el); observador?.unobserve(el); };
}

/** Entra com um deslocamento curto. A classe muda no elemento, sem novo render do React. */
function Revela({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { el.classList.add('vis'); return; }
    return observar(el, () => el.classList.add('vis'));
  }, []);
  return <div ref={ref} className={`lx-rev ${className}`}>{children}</div>;
}

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
    io.observe(hero);
    io.observe(fila);
    const dentro = (e: FocusEvent) => { if ((e.target as HTMLElement)?.matches?.('input, textarea')) { vistos.add('digitando'); setMostrar(false); } };
    const fora = (e: FocusEvent) => { if ((e.target as HTMLElement)?.matches?.('input, textarea')) { vistos.delete('digitando'); setMostrar(vistos.size === 0); } };
    document.addEventListener('focusin', dentro);
    document.addEventListener('focusout', fora);
    return () => { io.disconnect(); document.removeEventListener('focusin', dentro); document.removeEventListener('focusout', fora); };
  }, []);
  return (
    <div className={`lx-barra${mostrar ? ' on' : ''}`} aria-hidden={!mostrar}>
      <span><b>Organizar meu mês</b><small>Leva cerca de 2 minutos</small></span>
      <button type="button" tabIndex={mostrar ? 0 : -1} onClick={aoClicar}>Começar <ArrowRight size={16} aria-hidden="true" /></button>
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
    <div>
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

function Identificacao({ aoClicar }: { aoClicar: () => void }) {
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const alternar = (i: number) => setMarcadas((m) => { const n = new Set(m); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const n = marcadas.size;
  return (
    <div className="lx-ident">
      <ul>
        {DORES.map((d, i) => (
          <li key={d}><label className={marcadas.has(i) ? 'on' : ''}><input type="checkbox" checked={marcadas.has(i)} onChange={() => alternar(i)} /><i aria-hidden="true"><Check size={14} strokeWidth={3} /></i><span>{d}</span></label></li>
        ))}
      </ul>
      <div className={`lx-ident-res${n ? ' on' : ''}`} aria-live="polite">
        {n === 0 && <p>Marque o que combina com você. Leva 10 segundos.</p>}
        {n > 0 && n < 3 && <p><b>Já dá para ver por onde começar.</b> O Grana Séria mostra o primeiro passo em 2 minutos.</p>}
        {n >= 3 && <p><b>{n} {n === 1 ? 'coisa marcada' : 'coisas marcadas'}.</b> Elas andam juntas, e é isso que o app organiza, um passo de cada vez.</p>}
        {n > 0 && <button type="button" className="lx-btn ouro" onClick={aoClicar}>Quero resolver isso <ArrowRight size={18} aria-hidden="true" /></button>}
      </div>
    </div>
  );
}

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

function CalculadoraCusto({ aoClicar }: { aoClicar: () => void }) {
  const [aba, setAba] = useState<'custo' | 'horas'>('custo');
  const [divida, setDivida] = useState(0);
  const [juros, setJuros] = useState<number | ''>(12);
  const [assin, setAssin] = useState(0);
  const jurosMes = divida > 0 && typeof juros === 'number' ? (divida * juros) / 100 : 0;
  const ano = jurosMes * 12 + assin * 12;
  return (
    <div className="lx-calc">
      <div className="lx-abas2" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'custo'} className={aba === 'custo' ? 'on' : ''} onClick={() => setAba('custo')}>Quanto custa não saber</button>
        <button type="button" role="tab" aria-selected={aba === 'horas'} className={aba === 'horas' ? 'on' : ''} onClick={() => setAba('horas')}>Quanto vale em horas</button>
      </div>
      {aba === 'custo' ? (
        <>
          <div className="lx-calc-campos">
            <CampoDinheiro rotulo="Quanto você deve no cartão ou em empréstimos?" valor={divida} onChange={setDivida} />
            <CampoNumero rotulo="Juros ao mês" sufixo="%, taxa de exemplo: confira a sua" valor={juros} onChange={setJuros} min={0} max={30} placeholder="12" />
            <CampoDinheiro rotulo="Assinaturas e tarifas que você paga por mês" valor={assin} onChange={setAssin} />
          </div>
          <div className="lx-calc-res" aria-live="polite">
            {ano > 0 ? (
              <><span>Só de juros e assinaturas, saem pelo menos</span><b>{brl(ano)} por ano</b><span>{jurosMes > 0 ? `${brl(jurosMes)} por mês em juros` : ''}{jurosMes > 0 && assin > 0 ? ' + ' : ''}{assin > 0 ? `${brl(assin)} por mês em assinaturas` : ''}. Dinheiro que não traz nada de volta.</span>
                <span className="lx-roi">O Grana Séria custa {brl(PRECO_MENSAL * 12)} por ano no preço de lançamento. {PRECO_MENSAL * 12 >= ano ? 'Já a sua conta é pequena, mas o mês sem controle costuma custar bem mais que isso.' : `Se ele ajudar você a evitar só ${Math.max(1, Math.round(((PRECO_MENSAL * 12) / ano) * 100))}% disso, já se paga.`}</span></>
            ) : (
              <span>Digite os valores e veja quanto sai por ano sem você perceber.</span>
            )}
          </div>
          {ano > 0 && <button type="button" className="lx-btn ouro lx-calc-cta" onClick={aoClicar}>Quero parar de perder isso <ArrowRight size={18} aria-hidden="true" /></button>}
        </>
      ) : <Calculadora />}
    </div>
  );
}

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
  const [fora, setFora] = useState(false);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[A-Za-z0-9]{6}$/.test(ref)) guardar('gs-ref', ref.toUpperCase());
    const meu = ler('gs-fila');
    if (meu) fetch(`/api/fila?codigo=${meu}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) setS({ codigo: meu, ...j }); }).catch(() => undefined);
    fetch('/api/fila?total=1').then((r) => (r.ok ? r.json() : null)).then((j: { total: number } | null) => { if (j) setTotal(j.total); else setFora(true); }).catch(() => setFora(true));
  }, []);
  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setErro('');
    setEnvio(true);
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
          <span className="lx-eyebrow">Você está na fila</span>
          {s.status === 'convidado' ? (
            <><h3>Sua vez chegou.</h3><p>O seu convite foi liberado{s.conviteAte ? ` e vale até ${new Date(s.conviteAte).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}` : ''}. Veja a mensagem que enviamos no seu WhatsApp.</p></>
          ) : (
            <><div className="lx-pos"><small>Sua posição</small><b>{s.posicao ?? 'na fila'}</b><span>{s.total > 0 ? `de ${s.total} ${s.total === 1 ? 'pessoa' : 'pessoas'}` : ''}</span></div>
              <p>Quando sua vez chegar, você recebe o convite no WhatsApp, com prazo para aceitar. {s.indicacoes > 0 ? `Você já subiu indicando ${s.indicacoes} ${s.indicacoes === 1 ? 'pessoa' : 'pessoas'}.` : 'Indique amigos para subir na fila.'}</p>
              <div className="lx-ind"><span>Cada amigo que entrar pelo seu link faz você subir 5 posições.</span>
                <button type="button" onClick={copiar}>{copiado ? 'Link copiado' : 'Copiar meu link'}</button></div></>
          )}
        </div>
      ) : fora ? (
        <div className="lx-fila-ok">
          <span className="lx-eyebrow">Fila de espera</span>
          <h3>Entre na fila pelo WhatsApp</h3>
          <p>As vagas abrem em ondas. Mande uma mensagem e a gente coloca o seu nome na fila. Quando chegar a sua vez, o convite vem por lá.</p>
          <a className="lx-btn ouro" href={waLink('Oi! Quero entrar na fila de espera do Grana Séria.')} target="_blank" rel="noopener noreferrer">Entrar na fila pelo WhatsApp <ArrowRight size={18} aria-hidden="true" /></a>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate>
          <span className="lx-eyebrow">Fila de espera</span>
          <h3>Entre na fila para receber o seu convite</h3>
          <p>As vagas abrem em ondas. Deixe o seu nome e o seu WhatsApp. Quando chegar a sua vez, o convite vai direto para lá.</p>
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

function Fone({ img, alt, prioridade = false }: { img: string; alt: string; prioridade?: boolean }) {
  return (
    <div className="lx-fone">
      <img src={`/telas/${img}.webp`} width={600} height={1298} alt={alt} decoding="async" loading={prioridade ? 'eager' : 'lazy'} fetchPriority={prioridade ? 'high' : 'auto'} />
    </div>
  );
}

export function Landing({ resume, onStart, onResume }: { resume: number | null; onStart: () => void; onResume: () => void }) {
  const ir = (id: string) => {
    const suave = window.matchMedia('(min-width: 900px)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
  };
  const convite = useConvite();
  return (
    <div className="lx">
      <section className="lx-hero" id="topo-lx">
        <div className="lx-hero-in">
          <div className="lx-hero-txt">
            <p className="lx-kicker">Grana Séria</p>
            <h1>Veja para onde vai cada real do seu mês. <em>E o que fazer agora.</em></h1>
            <p>O app organiza o mês no celular. Você descobre quanto pode gastar hoje, o que pagar primeiro e o dia em que fica livre das dívidas.</p>
            <div className="lx-acoes">
              <button type="button" className="lx-btn ouro" onClick={() => ir('acesso')}>Começar agora <ArrowRight size={18} aria-hidden="true" /></button>
              <button type="button" className="lx-btn claro" onClick={() => ir('app')}>Ver o app</button>
            </div>
            <ul className="lx-conf">
              <li><Check size={16} aria-hidden="true" />Sem senha de banco</li>
              <li><Check size={16} aria-hidden="true" />No celular, em 2 minutos</li>
              <li><Check size={16} aria-hidden="true" />7 dias de garantia</li>
            </ul>
          </div>
          <div className="lx-hero-vis">
            <Fone img="funil" alt="Tela real do Grana Séria: o painel do mês, com dados de exemplo" prioridade />
            <small>Tela real do app, com dados de exemplo</small>
          </div>
        </div>
      </section>

      <section className="lx-sec" id="app">
        <Revela className="lx-centro">
          <span className="lx-eyebrow ouro">O app</span>
          <h2>O que você abre no celular</h2>
          <p className="lx-sub">Três telas reais. Nada de foto montada. É o Grana Séria, com números de exemplo.</p>
        </Revela>
        <div className="lx-telas">
          {TELAS.map((t) => (
            <Revela key={t.img} className="lx-tela">
              <Fone img={t.img} alt={`Tela do app: ${t.t}`} />
              <b>{t.t}</b>
              <span>{t.d}</span>
            </Revela>
          ))}
        </div>
      </section>

      <section className="lx-sec papel" id="com-voce">
        <div className="lx-duo">
          <Revela className="lx-duo-txt">
            <span className="lx-eyebrow">Isso é com você?</span>
            <h2>Se alguma dessas frases é a sua, o app foi feito para isso</h2>
            <p>Não é falta de capacidade. É falta de um número claro na hora certa.</p>
          </Revela>
          <Revela><Identificacao aoClicar={() => ir('acesso')} /></Revela>
        </div>
      </section>

      <section className="lx-sec">
        <Revela className="lx-centro">
          <span className="lx-eyebrow ouro">O que muda</span>
          <h2>Quatro coisas que o mês passa a ter</h2>
        </Revela>
        <div className="lx-benef">
          {[
            ['Quanto posso gastar hoje', 'Um número por dia, já descontando contas, parcelas e a reserva que você combinou.'],
            ['O que pagar primeiro', 'Atrasos e vencimentos em ordem, com aviso antes de a conta chegar.'],
            ['Uma data para sair das dívidas', 'O mês em que você fica livre, e quanto pagar para chegar lá.'],
            ['Dinheiro que fica guardado', 'A reserva deixa de depender de sobrar no fim do mês.'],
          ].map(([t, d]) => (
            <Revela key={t} className="lx-benef-i">
              <h3>{t}</h3>
              <p>{d}</p>
            </Revela>
          ))}
        </div>
      </section>

      <section className="lx-sec papel" id="passos">
        <Revela className="lx-centro">
          <span className="lx-eyebrow">Como funciona</span>
          <h2>Três passos. Sem planilha.</h2>
        </Revela>
        <ol className="lx-passos">
          {[
            ['Diga quanto entra', 'A renda do mês. Em seguida o app calcula quanto cabe por dia.'],
            ['Anote o que sai', 'No app ou pelo WhatsApp. “Mercado 35” já vira um lançamento.'],
            ['Siga o próximo passo', 'Pagar, segurar um gasto ou guardar. O app diz qual é a vez.'],
          ].map(([t, d], i) => (
            <Revela key={t} className="lx-passo">
              <em>{i + 1}</em>
              <b>{t}</b>
              <span>{d}</span>
            </Revela>
          ))}
        </ol>
      </section>

      <section className="lx-sec papel estreita" id="conta">
        <Revela className="lx-centro">
          <span className="lx-eyebrow">Com os seus números</span>
          <h2>Veja o custo de não saber</h2>
          <p className="lx-sub">A conta fica neste aparelho. Nada é enviado.</p>
        </Revela>
        <Revela><CalculadoraCusto aoClicar={() => ir('acesso')} /></Revela>
      </section>

      <section className="lx-sec" id="midas">
        <div className="lx-duo lx-midas">
          <Revela className="lx-orbe-bloco">
            <span className="lx-orbe" role="img" aria-label="Midas, uma esfera dourada com dois olhos">
              <i /><i />
            </span>
          </Revela>
          <Revela className="lx-duo-txt">
            <span className="lx-eyebrow ouro">WhatsApp</span>
            <h2>Mande uma frase. O Midas anota e aponta o caminho.</h2>
            <p>São {FERRAMENTAS.length} ferramentas, e você não precisa caçar o menu. Descreva o que está acontecendo. Ele abre a tela certa. Pelo WhatsApp, “mercado 35” já entra no mês.</p>
            <a className="lx-btn ouro" href={waLink('Oi! Quero anotar meus gastos por aqui.')} target="_blank" rel="noopener noreferrer">Falar no WhatsApp <MessageCircle size={18} aria-hidden="true" /></a>
          </Revela>
        </div>
      </section>

      <section className="lx-seg" id="seguranca">
        <Revela className="lx-seg-in">
          <div className="lx-seg-i"><i aria-hidden="true"><Lock size={20} /></i><b>Sem senha de banco</b><span>Nenhuma conta é conectada. Você digita ou manda por mensagem.</span></div>
          <div className="lx-seg-i"><i aria-hidden="true"><ShieldCheck size={20} /></i><b>Os dados são seus</b><span>Só você acessa. Em Meus dados você exporta tudo ou apaga.</span></div>
          <div className="lx-seg-i"><i aria-hidden="true"><Smartphone size={20} /></i><b>No seu celular</b><span>Instale na tela inicial e use como um aplicativo.</span></div>
        </Revela>
      </section>

      <section className="lx-sec" id="acesso">
        <Revela className="lx-centro">
          <span className="lx-eyebrow ouro">Planos</span>
          <h2>Preço de fundador, {brl0(PRECO_FUNDADOR_MENSAL)} por mês</h2>
          <p className="lx-sub">{convite.valido ? 'O seu convite está liberado. Escolha o plano.' : 'Quem entra agora paga menos. O valor de fundador fica este enquanto a assinatura estiver ativa. Também dá para entrar na fila e esperar o convite.'}</p>
        </Revela>
        <Revela className="lx-planos"><CartoesFundador limite={4} /></Revela>
        <Revela className="lx-lancamento">
          <p>O preço de lançamento é {brl0(PRECO_MENSAL)} por mês ou {brl0(PRECO_ANUAL)} por ano.</p>
          <CartoesPlanos semNota travado={!convite.valido} limite={4} />
        </Revela>
        <Revela><FilaDeEspera /></Revela>
        <p className="lx-garantia"><ShieldCheck size={16} aria-hidden="true" /> 7 dias para pedir o reembolso. Cancele quando quiser, sem perder o que registrou.</p>
      </section>

      <section className="lx-sec papel estreita" id="duvidas">
        <Revela>
          <span className="lx-eyebrow">Dúvidas</span>
          <h2>Antes de começar</h2>
        </Revela>
        <Revela><Sanfona itens={FAQ} /></Revela>
      </section>

      <section className="lx-fim">
        <Revela>
          <Moeda tamanho={52} />
          <h2>O próximo mês pode ser mais claro</h2>
          <p>Quem sabe o número decide melhor. Comece pelo que entra e pelo que sai.</p>
          <div className="lx-acoes centro">
            <button type="button" className="lx-btn ouro" onClick={() => ir('acesso')}>Começar agora <ArrowRight size={18} aria-hidden="true" /></button>
            <Link to="/entrar" className="lx-btn claro">Já tenho conta</Link>
          </div>
          {resume !== null && <button type="button" className="lx-link" onClick={onResume}>Continuar meu diagnóstico ({resume} de 7)</button>}
          {resume === null && <button type="button" className="lx-link" onClick={onStart}>Fazer o diagnóstico financeiro</button>}
          <small>Conteúdo educativo, não é consultoria financeira. <Link to="/termos-de-uso">Termos</Link> · <Link to="/politica-de-privacidade">Privacidade</Link></small>
        </Revela>
      </section>

      <BarraFixa aoClicar={() => ir('acesso')} />
    </div>
  );
}
