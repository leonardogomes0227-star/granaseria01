import { MouseEvent, useEffect, useState } from 'react';
import { GoalsSection, WhatsAppSection } from './GoalsAndWhatsApp';
import { ArrowRight, Check, Clock, Lock, ShieldCheck, TrendingUp, Sparkles, Compass, Plus, Instagram } from 'lucide-react';
import { CHECKOUT_READY, PRICE_LABEL } from '../config';
import { ARCHETYPES } from '../archetypes';
import { QUOTES, dailyQuoteIndex, formatDayLabel } from '../quotes';
import { renderStoryCard, StoryTheme } from '../storyCard';
import { TOOLS, ToolId } from '../tools';
import { formatBRL } from '../calculations';
import { Reveal, CountUp, AnimatedFill, useInView } from './motion';
import { SiteHeader, SiteFooter, ToolIcon, BackToTop } from './Layout';

interface SavedProgressInfo {
  step: number;
}

// brilho que segue o mouse dentro do cartão de ferramenta
function trackGlow(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

function Medallion() {
  return (
    <svg className="medallion" viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        <radialGradient id="coinFace" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#E8B45C" />
          <stop offset="55%" stopColor="#C6842A" />
          <stop offset="100%" stopColor="#93611A" />
        </radialGradient>
        <clipPath id="coinClip"><circle cx="150" cy="150" r="126" /></clipPath>
      </defs>
      <circle cx="150" cy="150" r="144" fill="none" stroke="#DCC996" strokeWidth="1" strokeDasharray="1 6" className="ring-rotate" />
      <circle cx="150" cy="150" r="130" fill="none" stroke="#7A5311" strokeWidth="10" strokeDasharray="2.2 5.6" className="ring-rotate" />
      <circle cx="150" cy="150" r="126" fill="url(#coinFace)" />
      <circle cx="150" cy="150" r="126" fill="none" stroke="#5A3A0A" strokeWidth="2" />
      <circle cx="150" cy="150" r="104" fill="none" stroke="#93611A" strokeWidth="1.4" />
      <g fill="#5A3A0A" clipPath="url(#coinClip)">
        <rect x="106" y="198" width="88" height="11" />
        <rect x="118" y="172" width="64" height="11" />
        <rect x="130" y="146" width="40" height="11" />
        <rect x="142" y="120" width="16" height="11" />
      </g>
      <circle cx="150" cy="88" r="9" fill="#5A3A0A" clipPath="url(#coinClip)" />
      <g stroke="#5A3A0A" strokeWidth="2.4" clipPath="url(#coinClip)">
        <line x1="150" y1="68" x2="150" y2="76" />
        <line x1="164" y1="74" x2="159" y2="80" />
        <line x1="136" y1="74" x2="141" y2="80" />
        <line x1="170" y1="88" x2="162" y2="88" />
        <line x1="130" y1="88" x2="138" y2="88" />
      </g>
      <g className="sheen" clipPath="url(#coinClip)">
        <ellipse cx="150" cy="150" rx="150" ry="34" fill="#FFF3D6" opacity="0.28" />
      </g>
    </svg>
  );
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'O diagnóstico é de graça mesmo?',
    a: 'Sim. O diagnóstico completo e todas as ferramentas são gratuitos e não pedem cadastro. Você responde, vê seu retrato financeiro e sua nota na hora.',
  },
  ...(CHECKOUT_READY
    ? [
        {
          q: 'Então o que é pago?',
          a: `Só o plano de ação completo e priorizado pra sua situação, por ${PRICE_LABEL} em pagamento único. O primeiro passo do plano você já vê de graça no resultado.`,
        },
      ]
    : []),
  {
    q: 'Meus dados ficam salvos onde?',
    a: 'Só no seu navegador, neste aparelho. Nada do que você digita é enviado pra um servidor — por isso dá pra continuar de onde parou, e ninguém além de você vê seus números.',
  },
  {
    q: 'Preciso saber os valores exatos?',
    a: 'Não. Estimativas já dão um retrato bem fiel. Depois você pode refazer o diagnóstico ou usar o check-in mensal pra ir ajustando.',
  },
  {
    q: 'Isso é consultoria financeira?',
    a: 'Não. A Grana Séria é uma ferramenta educacional baseada nos princípios do livro O Homem Mais Rico da Babilônia. Ela ajuda a enxergar e organizar, mas não substitui um profissional certificado.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Funciona — o site foi feito pensando primeiro no celular. Leva uns 10 minutos do começo ao resultado.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {FAQ.map((item, i) => (
        <Reveal key={item.q} delay={i * 60} className={`faq-item ${open === i ? 'open' : ''}`}>
          <button
            type="button"
            className="faq-q"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            {item.q}
            <Plus size={20} />
          </button>
          <div className="faq-a">
            <div>
              <p>{item.a}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

const SHOWCASE: { id: keyof typeof ARCHETYPES; theme: StoryTheme }[] = [
  { id: 'construtor', theme: 'lapis' },
  { id: 'guardiao', theme: 'ouro' },
  { id: 'semeador', theme: 'terracota' },
];

function StoryShowcase({ onStart }: { onStart: () => void }) {
  const { ref, inView } = useInView<HTMLDivElement>('200px');
  const [imgs, setImgs] = useState<string[]>([]);
  useEffect(() => {
    if (!inView) return;
    let alive = true;
    Promise.all(
      SHOWCASE.map((s) =>
        renderStoryCard(ARCHETYPES[s.id], s.theme, { siteUrl: window.location.host.replace(/^www\./, '') }).then((c) =>
          c.toDataURL('image/jpeg', 0.75)
        )
      )
    ).then((r) => alive && setImgs(r));
    return () => {
      alive = false;
    };
  }, [inView]);

  return (
    <section className="showcase" id="arquetipos">
      <div className="showcase-inner">
        <Reveal className="showcase-copy" variant="left">
          <div className="kicker"><span className="wedge" />Feito pra postar</div>
          <h2>Qual é o seu arquétipo financeiro?</h2>
          <p>
            No fim do diagnóstico você descobre qual personagem da Babilônia você é — e ganha um cartão lindo,
            no formato do story, pra postar. Sem nenhum valor em reais: só a sua vibe.
          </p>
          <ul className="showcase-list">
            {Object.values(ARCHETYPES).map((a) => (
              <li key={a.id}><b>{a.numeral}</b> {a.name}</li>
            ))}
          </ul>
          <button className="btn-primary btn-shine" type="button" onClick={onStart}>
            Descobrir o meu <ArrowRight size={17} className="arrow" />
          </button>
        </Reveal>
        <div className="showcase-phones" ref={ref}>
          {SHOWCASE.map((s, i) => (
            <div className={`phone phone-${i}`} key={s.id}>
              <div className="phone-screen">
                {imgs[i] ? <img src={imgs[i]} alt={`Exemplo de cartão: ${ARCHETYPES[s.id].name}`} /> : <div className="phone-loading" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileCta({ onStart }: { onStart: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const nearEnd = y + window.innerHeight > document.documentElement.scrollHeight - 900;
      setShow(y > 650 && !nearEnd);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return (
    <div className={`mobile-cta ${show ? 'show' : ''}`} aria-hidden={!show}>
      <button type="button" className="btn-primary" onClick={onStart} tabIndex={show ? 0 : -1}>
        Fazer meu diagnóstico grátis <ArrowRight size={16} className="arrow" />
      </button>
    </div>
  );
}

function HowItWorks() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const steps = [
    { n: '01', title: 'Você responde', text: 'Perguntas objetivas sobre renda, gastos, dívidas e reserva — sem precisar abrir planilha nenhuma.' },
    { n: '02', title: 'A gente traduz', text: 'Seu diagnóstico é lido à luz das leis do livro e vira um retrato claro: onde você está e o que pesa mais.' },
    { n: '03', title: 'Você aplica', text: 'Um plano de ação priorizado e ferramentas pro dia a dia, com check-in mensal pra ver a evolução.' },
  ];
  return (
    <div className={`path ${inView ? 'is-visible' : ''}`} ref={ref}>
      <div className="path-line"><i /></div>
      {steps.map((s, i) => (
        <Reveal className="path-step" key={s.n} delay={i * 140} variant="right">
          <div className="marker">{s.n}</div>
          <div className="path-card">
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export function Landing({
  savedProgress,
  onStart,
  onResume,
  onOpenTool,
}: {
  savedProgress: SavedProgressInfo | null;
  onStart: () => void;
  onResume: () => void;
  onOpenTool: (id: ToolId) => void;
}) {
  return (
    <div id="topo">
      <SiteHeader onStart={onStart} onOpenTool={onOpenTool} />

      <section className="hero">
        <div className="hero-copy">
          {savedProgress && (
            <div className="resume-banner">
              <div className="msg">
                <b>{savedProgress.step >= 7 ? 'Seu diagnóstico já está pronto.' : 'Você tem um diagnóstico em andamento.'}</b>
                {savedProgress.step >= 7 ? 'Veja seu resultado de novo quando quiser.' : `Parou na etapa ${savedProgress.step} de 7.`}
              </div>
              <div className="resume-actions">
                <button className="btn-primary" onClick={onResume} type="button">
                  {savedProgress.step >= 7 ? 'Ver diagnóstico' : 'Continuar'}
                </button>
                <button className="btn-outline" onClick={onStart} type="button">Recomeçar</button>
              </div>
            </div>
          )}
          <div className="kicker"><span className="wedge" />Diagnóstico financeiro gratuito</div>
          <h1>
            Sua riqueza começa com <span className="accent">um punhado de moedas</span> guardadas com disciplina.
          </h1>
          <p className="lede">
            Clareza sobre o seu dinheiro e um plano de ação construído com os princípios de{' '}
            <i>O Homem Mais Rico da Babilônia</i> — sem planilha, sem jargão, sem enrolação.
          </p>
          <div className="cta-row">
            <button className="btn-primary btn-shine" onClick={onStart} type="button">
              Fazer meu diagnóstico <ArrowRight size={17} className="arrow" />
            </button>
            <a className="btn-outline" href="#objetivos">
              <Compass size={17} /> O que você quer resolver?
            </a>
          </div>
          <div className="trust-row">
            <span><Clock size={15} /> 10 minutos</span>
            <span><Check size={15} /> Sem cadastro</span>
            <span><Lock size={15} /> Dados ficam no seu navegador</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="medallion-wrap">
            <div className="glow" />
            <Medallion />
          </div>

          <div className="float-card fc-1">
            <div className="fc-label"><ShieldCheck size={13} /> Taxa de poupança</div>
            <div className="fc-value"><CountUp value={12} format={(n) => `${Math.round(n)}%`} /></div>
            <div className="mini-track"><AnimatedFill pct={100} className="mini-fill" delay={900} /></div>
          </div>

          <div className="float-card fc-2">
            <div className="fc-label"><TrendingUp size={13} /> Projeção em 10 anos</div>
            <div className="fc-value"><CountUp value={61450} duration={1800} format={(n) => formatBRL(n)} /></div>
            <span className="fc-sub">▲ exemplo guardando 10% ao mês</span>
          </div>

          <div className="float-card fc-3">
            <div className="fc-label"><Sparkles size={13} /> Reserva de emergência</div>
            <div className="fc-value"><CountUp value={68} format={(n) => `${Math.round(n)}%`} /></div>
            <div className="mini-track"><AnimatedFill pct={68} className="mini-fill" delay={1100} /></div>
          </div>
        </div>
      </section>

      <GoalsSection onStart={onStart} onOpenTool={onOpenTool} />

      <WhatsAppSection />

      <div className="band">
        <div className="wrap">
          <Reveal className="stat" delay={0}>
            <b><CountUp value={TOOLS.length} /></b>
            <span>ferramentas gratuitas</span>
          </Reveal>
          <Reveal className="stat" delay={100}>
            <b><CountUp value={10} format={(n) => `${Math.round(n)}%`} /></b>
            <span>guardado antes de qualquer gasto</span>
          </Reveal>
          <Reveal className="stat" delay={200}>
            <b><CountUp value={10} format={(n) => `${Math.round(n)} min`} /></b>
            <span>para o diagnóstico completo</span>
          </Reveal>
          <Reveal className="stat" delay={300}>
            <b><CountUp value={0} format={() => 'R$ 0'} /></b>
            <span>pra começar</span>
          </Reveal>
        </div>
      </div>

      <section className="section" id="ferramentas">
        <Reveal className="section-head">
          <div className="kicker"><span className="wedge" />Ferramentas</div>
          <h2>Tudo que te ajuda a decidir melhor, num só lugar.</h2>
          <p>Calculadoras e simuladores pra usar antes de comprar, contratar ou investir. Abra qualquer uma — sem cadastro.</p>
        </Reveal>
        <div className="tools-grid">
          {TOOLS.map((t, i) => (
            <Reveal key={t.id} delay={(i % 4) * 90} variant="up">
              <button type="button" className="tool-card" onClick={() => onOpenTool(t.id)} onMouseMove={trackGlow}>
                <ToolIcon tool={t} size="lg" />
                <span className={`tag ${t.needsDiagnosis ? '' : 'free'}`}>{t.needsDiagnosis ? 'Usa o diagnóstico' : 'Grátis'}</span>
                <h3>{t.title}</h3>
                <p>{t.description}</p>
                <span className="open">Abrir ferramenta <ArrowRight size={15} /></span>
              </button>
            </Reveal>
          ))}
          <Reveal delay={270} variant="up">
            <button type="button" className="tool-card feature" onClick={onStart} onMouseMove={trackGlow}>
              <span className="tool-icon lg tone-gold"><Sparkles size={24} strokeWidth={1.9} /></span>
              <span>
                <h3>Diagnóstico completo</h3>
                <p>Em 10 minutos: sua nota de 0 a 100, seu arquétipo financeiro e o que fazer primeiro.</p>
              </span>
              <span className="open">Começar agora <ArrowRight size={15} /></span>
            </button>
          </Reveal>
        </div>
      </section>

      <StoryShowcase onStart={onStart} />

      <section className="section" id="principios">
        <Reveal className="section-head">
          <div className="kicker"><span className="wedge" />Os princípios</div>
          <h2>Três leis, escritas há milhares de anos, ainda sustentam qualquer plano.</h2>
        </Reveal>
        <div className="frieze">
          {[
            { n: 'I', t: 'Pague-se primeiro', p: 'Guarde uma parte de tudo o que você ganha antes de qualquer outra despesa. Não o que resta — o que você decide guardar.' },
            { n: 'II', t: 'Controle os gastos', p: 'O problema raramente é ganhar pouco. É não saber pra onde o dinheiro vai. Mapeie antes de cortar.' },
            { n: 'III', t: 'Proteja-se de perdas', p: 'Decisões financeiras de impulso custam mais do que economizam. Avalie o risco antes de comprometer o capital.' },
          ].map((x, i) => (
            <Reveal className="panel" key={x.n} delay={i * 120}>
              <div className="numeral">{x.n}</div>
              <h3>{x.t}</h3>
              <p>{x.p}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="quote-section">
        <svg className="quote-seal left" viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="126" fill="none" stroke="#DDA13B" strokeWidth="2" strokeDasharray="3 7" />
          <circle cx="150" cy="150" r="104" fill="none" stroke="#DDA13B" strokeWidth="1" />
        </svg>
        <svg className="quote-seal right" viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="126" fill="none" stroke="#DDA13B" strokeWidth="2" strokeDasharray="3 7" />
          <circle cx="150" cy="150" r="104" fill="none" stroke="#DDA13B" strokeWidth="1" />
        </svg>
        <div className="wrap">
          <Reveal className="quote-frame" variant="scale">
            <span className="today-tag">Frase do dia · {formatDayLabel()}</span>
            <span className="dropcap">“</span>
            <blockquote>{QUOTES[dailyQuoteIndex()]}</blockquote>
            <div className="quote-cta">
              <button type="button" className="btn-primary btn-shine" onClick={() => onOpenTool('quote')}>
                <Instagram size={17} /> Postar a frase de hoje
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section" id="como-funciona">
        <div className="how-grid">
          <Reveal className="section-head" variant="left">
            <div className="kicker"><span className="wedge" />Como funciona</div>
            <h2>Do diagnóstico ao plano, em três passos.</h2>
            <p>Você sai sabendo exatamente onde está e qual é o próximo passo — não com mais uma planilha esquecida.</p>
            <button className="btn-primary" type="button" onClick={onStart} style={{ marginTop: 26 }}>
              Começar diagnóstico <ArrowRight size={16} className="arrow" />
            </button>
          </Reveal>
          <HowItWorks />
        </div>
      </section>

      <section className="section" id="duvidas" style={{ paddingTop: 0 }}>
        <Reveal className="section-head">
          <div className="kicker"><span className="wedge" />Dúvidas frequentes</div>
          <h2>Antes de começar, o que todo mundo pergunta.</h2>
        </Reveal>
        <Faq />
      </section>

      <section className="final-cta">
        <Reveal className="cta-frame" variant="scale">
          <svg className="cta-coin" viewBox="0 0 300 300" aria-hidden="true">
            <circle cx="150" cy="150" r="130" fill="none" stroke="#DDA13B" strokeWidth="10" strokeDasharray="2.2 5.6" />
            <circle cx="150" cy="150" r="104" fill="none" stroke="#DDA13B" strokeWidth="2" />
          </svg>
          <h2>Pronto para guardar sua primeira moeda?</h2>
          <p>O diagnóstico é gratuito e leva menos tempo do que decidir o que comer no almoço.</p>
          <div className="cta-row">
            <button className="btn-primary btn-shine" type="button" onClick={onStart}>
              Fazer meu diagnóstico <ArrowRight size={17} className="arrow" />
            </button>
            <a className="btn-outline" href="#ferramentas">Ver ferramentas</a>
          </div>
        </Reveal>
      </section>

      <SiteFooter onStart={onStart} onOpenTool={onOpenTool} />
      <BackToTop />
      <MobileCta onStart={onStart} />
    </div>
  );
}
