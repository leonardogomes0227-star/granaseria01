import { useState } from 'react';
import { DailyTop, StartSteps, ToolsDirectory } from './HomeSections';
import { Journey } from './Journey';
import { Plus } from 'lucide-react';
import { CHECKOUT_READY, PRICE_LABEL } from '../config';
import { getName } from '../painel';
import type { ToolId } from '../tools';
import { Reveal } from './motion';
import { SiteHeader, SiteFooter, BackToTop } from './Layout';

/* ---------- Página inicial ---------- */
// Só três coisas: o que você quer fazer (logo de cara), como funciona e as dúvidas. Nada de vitrine.

interface SavedProgressInfo {
  step: number;
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'É de graça mesmo?',
    a: 'Sim. O diagnóstico e todas as ferramentas são gratuitos. Você só entra com o seu WhatsApp (sem senha e sem e-mail) pra que seu plano e seus gastos fiquem salvos.',
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
    q: 'O que eu faço pelo WhatsApp?',
    a: 'Só o dia a dia do dinheiro: o que você gastou e o que entrou, escrito do seu jeito (ex.: mercado 80 no pix) ou com a foto do cupom. O assistente soma, separa por categoria e mostra quanto ainda dá pra gastar. Tudo aparece no seu painel aqui no site.',
  },
  {
    q: 'Meus dados ficam salvos onde?',
    a: 'Na sua conta da Grana Séria, ligada ao seu número de WhatsApp. Só você vê os seus números. Pra apagar tudo, mande "apagar meus dados" no WhatsApp.',
  },
  {
    q: 'Preciso saber os valores exatos?',
    a: 'Não. Estimativas já dão um retrato bem fiel. Depois, o que você anota no WhatsApp vai deixando tudo mais preciso.',
  },
  {
    q: 'Isso é consultoria financeira?',
    a: 'Não. A Grana Séria é uma ferramenta educacional baseada nos princípios do livro O Homem Mais Rico da Babilônia. Ela ajuda a enxergar e organizar, mas não substitui um profissional certificado.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="faq">
      {FAQ.map((item, i) => (
        <Reveal key={item.q} delay={i * 50} className={`faq-item ${open === i ? 'open' : ''}`}>
          <button type="button" className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
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
  const name = getName();
  return (
    <div id="topo">
      <SiteHeader onStart={onStart} onOpenTool={onOpenTool} />

      <section className="home">
        <div className="home-head">
          <div className="home-coin">
            <div className="glow" />
            <Medallion />
          </div>
          <div className="kicker"><span className="wedge" />{name ? `Oi, ${name}!` : 'Grátis · entra com o seu WhatsApp'}</div>
          <h1>Seu dinheiro organizado, sem planilha</h1>
          <p className="lede">No WhatsApp você anota o dia a dia. Aqui no site ficam o seu plano e as ferramentas.</p>
        </div>

        {/* diagnóstico pela metade: dá pra continuar. Pronto: o resultado e o plano ficam no painel. */}
        {savedProgress && savedProgress.step < 7 && (
          <div className="resume-banner">
            <div className="msg">
              <b>Você tem um diagnóstico pela metade.</b>
              Parou na etapa {savedProgress.step} de 7.
            </div>
            <div className="resume-actions">
              <button className="btn-primary" onClick={onResume} type="button">Continuar</button>
              <button className="btn-outline" onClick={onStart} type="button">Recomeçar</button>
            </div>
          </div>
        )}

        <StartSteps hasDiagnosis={Boolean(savedProgress && savedProgress.step >= 7)} onDiagnosis={savedProgress && savedProgress.step > 0 && savedProgress.step < 7 ? onResume : onStart} />
        <DailyTop />
      </section>

      <ToolsDirectory onStart={savedProgress && savedProgress.step >= 7 ? onResume : onStart} onOpenTool={onOpenTool} hasDiagnosis={Boolean(savedProgress && savedProgress.step >= 7)} />

      <Journey onStart={onStart} />

      <section className="section home-faq" id="duvidas">
        <Reveal className="section-head center">
          <div className="kicker"><span className="wedge" />Dúvidas</div>
          <h2>O que todo mundo pergunta</h2>
        </Reveal>
        <Faq />
      </section>

      <SiteFooter onStart={onStart} onOpenTool={onOpenTool} />
      <BackToTop />
    </div>
  );
}
