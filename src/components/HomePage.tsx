import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, MessageCircle, Plus, Users } from 'lucide-react';
import { painelToken } from '../painel';
import { Inicio } from '../gs/Inicio';

/* ---------- Início ---------- */
// Logado: o dashboard do app (src/gs/Inicio.tsx). Ainda não: o que é, em 3 linhas, e um botão.

const FAQ: [string, string][] = [
  ['É de graça?', 'Sim. O plano, os conselheiros e as ferramentas são gratuitos. Você entra com o seu WhatsApp, sem senha.'],
  ['O que eu faço no WhatsApp?', 'Anota o que gastou e o que entrou, do seu jeito (ex.: mercado 80 no pix), por texto, áudio ou foto do cupom.'],
  ['Meus dados ficam onde?', 'Na sua conta, ligada ao seu número. Só você vê. Pra apagar tudo, mande "apagar meus dados" no WhatsApp.'],
  ['É consultoria financeira?', 'Não. É educação financeira, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre.'],
];

function Welcome({ resume, onStart, onResume }: { resume: number | null; onStart: () => void; onResume: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <section className="welcome">
        <span className="welcome-tag">Grátis · entra com o WhatsApp</span>
        <h1>Saia das dívidas com um plano que cabe no seu bolso</h1>
        <p>Você anota no WhatsApp, a gente monta o plano e um conselheiro te lembra do próximo passo.</p>
        <div className="welcome-cta">
          {resume !== null ? (
            <button type="button" className="btn-primary" onClick={onResume}>Continuar meu plano (etapa {resume} de 7) <ArrowRight size={16} /></button>
          ) : (
            <button type="button" className="btn-primary" onClick={onStart}>Montar meu plano <ArrowRight size={16} /></button>
          )}
          <Link className="btn-outline" to="/entrar">Já uso, entrar</Link>
        </div>
      </section>

      <section className="home-block how">
        {[
          [MessageCircle, 'Anote no WhatsApp', '"mercado 80 no pix", um áudio ou a foto do cupom.'],
          [ClipboardList, 'Receba o seu plano', 'Quanto pagar, guardar e cortar, com datas.'],
          [Users, 'Siga com um conselheiro', 'Ele monta os passos e te lembra no dia.'],
        ].map(([Icon, title, text], i) => {
          const I = Icon as typeof MessageCircle;
          return (
            <div key={i} className="how-row">
              <span className="how-icon"><I size={20} /></span>
              <span>
                <b>{title as string}</b>
                <small>{text as string}</small>
              </span>
            </div>
          );
        })}
      </section>

      <section className="home-block">
        <div className="block-head"><h2>Dúvidas</h2></div>
        <div className="faq-list">
          {FAQ.map(([q, a], i) => (
            <div key={q} className={`faq-row ${open === i ? 'open' : ''}`}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                {q} <Plus size={18} />
              </button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}


export function HomePage({
  savedProgress,
  onStart,
  onResume,
}: {
  savedProgress: { step: number } | null;
  onStart: () => void;
  onResume: () => void;
  onOpenTool?: unknown;
}) {
  const logged = Boolean(painelToken());
  const resume = savedProgress && savedProgress.step > 0 && savedProgress.step < 7 ? savedProgress.step : null;
  if (!logged) return <Welcome resume={resume} onStart={onStart} onResume={onResume} />;
  return <Inicio />;
}
