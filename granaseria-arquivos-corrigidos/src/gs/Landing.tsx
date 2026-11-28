import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, ChevronDown, Compass, Landmark, Lock, MessageCircle, ShieldCheck, Smartphone, Sparkles, Wallet, X } from 'lucide-react';
import { CampoDinheiro, CampoNumero } from './ui';
import { horasDeTrabalho } from './ferramentas';
import { Moeda } from '../components/ui/Moeda';
import { CartoesPlanos } from './Planos';
import { PRECO_ANUAL, PRECO_MENSAL } from '../config';
import { brl0 } from './datas';
import { useContagem } from './base';
import { FERRAMENTAS } from './registroFerramentas';
import './landing.css';

/* ---------- Página inicial: prende na primeira tela, mostra o valor e leva à fila ---------- */

const PROBLEMAS_FAIXA = ['Conta atrasada', 'Cartão estourado', 'Dinheiro que some', 'Dívida sem data para acabar', 'Parcelas que não fecham', 'Assinatura esquecida', 'Compra por impulso', 'Mês que não fecha'];

const DORES: string[] = [
  'O dinheiro acaba antes do fim do mês e eu não sei para onde foi',
  'Tenho conta atrasada ou dívida que não sai do lugar',
  'O cartão virou uma bola de neve',
  'Já parcelei sem saber quanto de juro estava pagando',
  'Nunca consegui guardar dinheiro de verdade',
  'Dá um aperto no peito quando vou abrir o app do banco',
];

const MUDANCAS: { t: string; d: string; prova: string }[] = [
  { t: 'Abrir a fatura sem susto', d: 'Você passa a saber, antes de a conta chegar, quanto sobra e o que vence primeiro. A surpresa ruim vira um número conhecido.', prova: 'Calendário de contas e aviso antes de vencer' },
  { t: 'Parar de brigar com o dinheiro', d: 'Cada real tem um destino combinado por você. Menos culpa, menos discussão em casa, mais conversa com números na mão.', prova: 'Orçamento por categoria e o painel do mês' },
  { t: 'Ter uma data para sair das dívidas', d: 'Em vez de “um dia eu saio”, você vê o mês exato em que fica livre e quanto pagar a cada mês para chegar lá.', prova: 'Quitar dívidas, com o plano mês a mês' },
  { t: 'Finalmente guardar', d: 'A reserva deixa de ser sonho: quanto guardar, em quantos meses você fica protegido e o que fazer quando entra um dinheiro extra.', prova: 'Reserva de emergência, metas e dinheiro extra' },
];

const LINHA_DO_TEMPO: { q: string; t: string; d: string }[] = [
  { q: 'Hoje, em 2 minutos', t: 'Você vê o primeiro número', d: 'Informa quanto ganha e já descobre quanto pode gastar por dia.' },
  { q: 'Nesta semana', t: 'Você enxerga para onde vai o dinheiro', d: 'Anota os gastos no app ou pelo WhatsApp, e o painel mostra o que mais pesa.' },
  { q: 'No primeiro mês', t: 'Você tem o mês inteiro sob controle', d: 'Entrou, saiu, o que dá para segurar e a data de saída das dívidas.' },
  { q: 'Em 3 meses', t: 'Você vê a diferença', d: 'Os relatórios comparam mês a mês e mostram se você está melhorando.' },
];

const FUNDAMENTOS: { t: string; d: string; no: string }[] = [
  { t: 'Pague-se primeiro', d: 'A regra mais antiga da Babilônia: antes de pagar qualquer conta, uma parte do que entra é sua.', no: 'No app: a reserva combinada sai do “pode gastar” antes de tudo.' },
  { t: 'Necessidade não é desejo', d: 'Quem separa o que precisa do que quer decide melhor e se arrepende menos.', no: 'No app: cada gasto é classificado e o “dá pra segurar” mostra o que é vontade.' },
  { t: 'Ativo põe dinheiro no bolso, passivo tira', d: 'A lição de Pai Rico, Pai Pobre: o que você tem rende ou custa?', no: 'No app: o Placar mostra o que rende e o que custa.' },
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
  ['E se eu não gostar?', 'Você tem 7 dias de garantia: é só pedir o reembolso. E pode cancelar a assinatura quando quiser, sem perder o que registrou.'],
  ['Vou ter muito trabalho para anotar tudo?', 'Não. Pelo WhatsApp você manda “mercado 35” e pronto, leva uns 5 segundos. O que você anota lá aparece no app, e o contrário também.'],
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

/** A abertura mostra o app de verdade em dois celulares, com os números principais flutuando (exemplo). */
function CelularesHero() {
  return (
    <div className="lx-duplo" role="img" aria-label="O app Grana Séria em dois celulares: o painel do mês e o assistente Midas resolvendo um problema">
      <div className="lx-fone lx-fone-b" aria-hidden="true"><img src="/telas/midas.webp" width={600} height={1298} alt="" decoding="async" /></div>
      <div className="lx-fone lx-fone-a" aria-hidden="true"><img src="/telas/funil.webp" width={600} height={1298} alt="" decoding="async" fetchPriority="high" /></div>
      <div className="lx-flut a"><Wallet size={16} aria-hidden="true" /><span><small>Pode gastar hoje</small><b><Numero v={82} /></b></span></div>
      <div className="lx-flut b"><Landmark size={16} aria-hidden="true" /><span><small>Livre das dívidas</small><b>jan/2027</b></span></div>
      <small className="lx-ex-hero">Telas reais, com dados de exemplo</small>
    </div>
  );
}

/** No celular, depois da primeira tela, um botão fixo leva à fila. Some quando a fila já está na tela. */
function BarraFixa({ aoClicar }: { aoClicar: () => void }) {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('topo-lx');
    const fila = document.getElementById('acesso');
    if (!hero || !fila || typeof IntersectionObserver === 'undefined') return;
    const vistos = new Set<string>();
    const io = new IntersectionObserver((lista) => {
      lista.forEach((en) => { if (en.isIntersecting) vistos.add(en.target.id); else vistos.delete(en.target.id); });
      setMostrar(vistos.size === 0);
    });
    io.observe(hero); io.observe(fila);
    // enquanto a pessoa digita num campo, a barra sai da frente
    const dentro = (e: FocusEvent) => { if ((e.target as HTMLElement)?.matches?.('input, textarea')) { vistos.add('digitando'); setMostrar(false); } };
    const fora = (e: FocusEvent) => { if ((e.target as HTMLElement)?.matches?.('input, textarea')) { vistos.delete('digitando'); setMostrar(vistos.size === 0); } };
    document.addEventListener('focusin', dentro); document.addEventListener('focusout', fora);
    return () => { io.disconnect(); document.removeEventListener('focusin', dentro); document.removeEventListener('focusout', fora); };
  }, []);
  return (
    <div className={`lx-barra${mostrar ? ' on' : ''}`} aria-hidden={!mostrar}>
      <span><b>Comece hoje</b><small>Acesso liberado após o pagamento</small></span>
      <button type="button" tabIndex={mostrar ? 0 : -1} onClick={aoClicar}>Quero assinar <ArrowRight size={16} aria-hidden="true" /></button>
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


/** "Isso é com você?": a pessoa marca o que sente e a página responde. */
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
        {n > 0 && n < 3 && <p><b>Já dá para ver por onde começar.</b> O Grana Séria mostra o seu primeiro passo em 2 minutos.</p>}
        {n >= 3 && <p><b>Você não está sozinho(a): {n} {n === 1 ? 'coisa' : 'coisas'} marcada{n === 1 ? '' : 's'}.</b> Essas coisas andam juntas, e é exatamente isso que o Grana Séria resolve, um passo de cada vez.</p>}
        {n > 0 && <button type="button" className="lx-btn ouro" onClick={aoClicar}>Quero resolver isso <ArrowRight size={18} aria-hidden="true" /></button>}
      </div>
    </div>
  );
}

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

/** O gancho: quanto o dinheiro está custando por ano (conta simples, com os números que a pessoa digita). */
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
                <span className="lx-roi">O Grana Séria custa {brl(PRECO_MENSAL * 12)} por ano. {PRECO_MENSAL * 12 >= ano ? 'Já a sua conta é pequena, mas o mês sem controle costuma custar bem mais que isso.' : `Se ele ajudar você a evitar só ${Math.max(1, Math.round(((PRECO_MENSAL * 12) / ano) * 100))}% disso, já se paga.`}</span></>
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
  return (
    <div className="lx">
      {/* ===== abertura: o que muda, dito em uma frase ===== */}
      <section className="lx-hero" id="topo-lx">
        <div className="lx-hero-in">
          <div className="lx-hero-txt">
            <span className="lx-selo"><Sparkles size={14} aria-hidden="true" />Assine hoje e comece em minutos</span>
            <h1>Seu dinheiro some todo mês. <em>Descubra para onde.</em></h1>
            <p>Em 2 minutos você descobre quanto pode gastar hoje, o que pagar primeiro e o dia em que sai das dívidas. Sem planilha, sem senha de banco.</p>
            <ul className="lx-ganhos-hero">
              <li><Check size={18} strokeWidth={3} aria-hidden="true" /><span><b>Pare de se perguntar</b> “para onde foi?”</span></li>
              <li><Check size={18} strokeWidth={3} aria-hidden="true" /><span><b>Tenha uma data</b> para sair das dívidas</span></li>
              <li><Check size={18} strokeWidth={3} aria-hidden="true" /><span><b>Guarde dinheiro</b> sem depender de força de vontade</span></li>
            </ul>
            <div className="lx-acoes">
              <button type="button" className="lx-btn ouro" onClick={() => ir('acesso')}>Quero assinar agora <ArrowRight size={18} aria-hidden="true" /></button>
              <button type="button" className="lx-btn claro" onClick={() => ir('teste')}>Ver quanto isso me custa</button>
            </div>
            <p className="lx-escassez"><span className="lx-ponto" aria-hidden="true" />Acesso liberado logo após o pagamento.</p>
          </div>
          <div className="lx-hero-vis"><CelularesHero /></div>
        </div>
      </section>

      {/* ===== faixa de problemas que passa sozinha ===== */}
      <div className="lx-faixa" aria-label="Problemas que o Grana Séria resolve">
        <div className="lx-faixa-in">
          {[0, 1].map((k) => <ul key={k} aria-hidden={k === 1}>{PROBLEMAS_FAIXA.map((t) => <li key={t}>{t}</li>)}</ul>)}
        </div>
      </div>

      {/* ===== isso é com você? ===== */}
      <section className="lx-sec" id="com-voce">
        <div className="lx-duo">
          <Revela className="lx-duo-txt">
            <span className="lx-eyebrow">Isso é com você?</span>
            <h2>Se você se reconheceu em <em>alguma dessas</em>, o app é para você</h2>
            <p>Não é falta de capacidade nem de inteligência. É falta de um número claro na hora certa. O Grana Séria foi feito para quem está começando e não quer complicação.</p>
          </Revela>
          <Revela atraso={80}><Identificacao aoClicar={() => ir('acesso')} /></Revela>
        </div>
      </section>

      {/* ===== o custo de não saber ===== */}
      <section className="lx-sec escura" id="teste">
        <div className="lx-duo">
          <Revela className="lx-duo-txt">
            <span className="lx-eyebrow ouro">O custo de não saber</span>
            <h2>Quanto o seu dinheiro está <em>custando por ano</em>?</h2>
            <p>Juros e assinaturas esquecidas fazem o dinheiro sair em silêncio. Ninguém sente no mês, mas no ano é um salário que escorre. Coloque os seus números e veja.</p>
            <p className="lx-nota-calc">A conta é simples: valor × juros × 12 meses. Nada é enviado nem guardado.</p>
          </Revela>
          <Revela atraso={80}><CalculadoraCusto aoClicar={() => ir('acesso')} /></Revela>
        </div>
      </section>

      {/* ===== o que muda na vida ===== */}
      <section className="lx-sec" id="muda">
        <Revela className="lx-centro"><span className="lx-eyebrow">O que muda na sua vida</span><h2>Não é sobre planilha. <em>É sobre dormir tranquilo.</em></h2>
          <p className="lx-sub">O app é só o meio. O que você leva é isto:</p></Revela>
        <div className="lx-mudancas">
          {MUDANCAS.map((m, i) => (
            <Revela key={m.t} atraso={i * 70} className="lx-mud">
              <span className="lx-ordem">{String(i + 1).padStart(2, '0')}</span>
              <h3>{m.t}</h3>
              <p>{m.d}</p>
              <div className="lx-prova"><Check size={14} strokeWidth={3} aria-hidden="true" /><span>{m.prova}</span></div>
            </Revela>
          ))}
        </div>
        <ol className="lx-tempo" aria-label="O que acontece depois que você começa">
          {LINHA_DO_TEMPO.map((l, i) => (
            <Revela key={l.q} atraso={i * 70} className="lx-tempo-i"><small>{l.q}</small><b>{l.t}</b><span>{l.d}</span></Revela>
          ))}
        </ol>
      </section>

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

      {/* ===== antes e depois ===== */}
      <section className="lx-sec claro">
        <Revela><span className="lx-eyebrow">A diferença</span><h2>Sem o app, <em>é no escuro</em></h2></Revela>
        <Revela atraso={60} className="lx-vs">
          <div className="lx-vs-cab"><span>Sem o Grana Séria</span><span>Com o Grana Séria</span></div>
          {ANTES_DEPOIS.map(([a, b]) => (
            <div key={a} className="lx-vs-lin"><p className="nao"><X size={16} aria-hidden="true" />{a}</p><p className="sim"><Check size={16} aria-hidden="true" />{b}</p></div>
          ))}
        </Revela>
      </section>

      {/* ===== números que você passa a ter ===== */}
      <section className="lx-sec escura">
        <Revela><span className="lx-eyebrow ouro">Na prática</span><h2>Quatro números que <em>mudam o seu mês</em></h2></Revela>
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

      {/* ===== por que funciona ===== */}
      <section className="lx-sec claro">
        <Revela><span className="lx-eyebrow">Por que funciona</span><h2>Ideias antigas, <em>aplicadas ao seu celular</em></h2>
          <p className="lx-sub">O Grana Séria transforma as lições de <i>O Homem Mais Rico da Babilônia</i> e de <i>Pai Rico, Pai Pobre</i> em números do seu mês.</p></Revela>
        <div className="lx-fund">
          {FUNDAMENTOS.map((f, i) => (
            <Revela key={f.t} atraso={i * 70} className="lx-fund-i">
              <BookOpen size={20} aria-hidden="true" />
              <h3>{f.t}</h3>
              <p>{f.d}</p>
              <div className="lx-prova"><Check size={14} strokeWidth={3} aria-hidden="true" /><span>{f.no}</span></div>
            </Revela>
          ))}
        </div>
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

      {/* ===== oferta e acesso ===== */}
      <section className="lx-sec escura" id="acesso">
        <Revela><span className="lx-eyebrow ouro">Planos</span><h2>Menos de <em>R$ 1 por dia</em> para ter o mês sob controle</h2>
          <p className="lx-sub">São {brl0(PRECO_MENSAL)} por mês, o mesmo que o preço de um lanche. Escolha o plano, pague e o acesso é liberado.</p></Revela>
        <Revela atraso={60} className="lx-garantia">
          <span><ShieldCheck size={18} aria-hidden="true" /><b>7 dias de garantia.</b> Se não for para você, é só pedir o reembolso.</span>
          <span><Check size={18} aria-hidden="true" /><b>Cancele quando quiser.</b> Você não perde o que registrou.</span>
        </Revela>
        <Revela atraso={100} className="lx-planos"><CartoesPlanos semNota /></Revela>
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
          <p>Quem sabe o número decide melhor. Daqui a 30 dias você pode estar lendo o seu mês inteiro, ou se perguntando de novo para onde ele foi.</p>
          <div className="lx-acoes centro">
            <button type="button" className="lx-btn ouro" onClick={() => ir('acesso')}>Quero assinar agora <ArrowRight size={18} aria-hidden="true" /></button>
            <Link to="/entrar" className="lx-btn claro">Já sou membro</Link>
          </div>
          {resume !== null && <button type="button" className="lx-link" onClick={onResume}>Continuar meu diagnóstico ({resume} de 7)</button>}
          {resume === null && <button type="button" className="lx-link" onClick={onStart}>Fazer o diagnóstico financeiro</button>}
          <small>Conteúdo educativo, não é consultoria financeira.</small>
        </Revela>
      </section>

      <BarraFixa aoClicar={() => ir('acesso')} />
    </div>
  );
}
