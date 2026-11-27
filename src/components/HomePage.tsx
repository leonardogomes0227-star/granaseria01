import { painelToken } from '../painel';
import { useSession } from '../account';
import { lazy, Suspense } from 'react';
import { importarComRetry } from '../gs/importar';
// a tela de quem está logado vem num pacote separado: a página de entrada abre mais rápido
const Caderno = lazy(() => importarComRetry(() => import('../gs/Caderno')).then((m) => ({ default: m.Caderno })));
const Landing = lazy(() => importarComRetry(() => import('../gs/Landing')).then((m) => ({ default: m.Landing })));
import { Porteiro } from '../gs/Porteiro';
import { ErroGlobal } from '../gs/ErroGlobal';

/** Enquanto o painel carrega: o mesmo desenho, sem números. */
function PainelCarregando() {
  return (
    <div className="pn pn-v2 pn-skel" role="status" aria-label="Carregando o painel">
      <div className="pn-cab"><span className="sk sk-titulo" /><span className="sk sk-redondo" /></div>
      <span className="sk sk-busca" />
      <span className="sk sk-hero" />
      <div className="pn-stats">{[0, 1, 2].map((i) => <span key={i} className="sk sk-stat" />)}</div>
      <div className="pn-acoes">{[0, 1, 2, 3].map((i) => <span key={i} className="sk sk-acao" />)}</div>
      <span className="sk sk-card" />
      <span className="sk sk-card curto" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/* ---------- Início ---------- */
// Logado: o dashboard do app (src/gs/Inicio.tsx). Ainda não: a página de entrada (src/gs/Landing.tsx).

/** Enquanto o resto da página inicial baixa, já aparece a abertura escura com a frase principal (estilo no próprio elemento: o CSS da página ainda não chegou). */
function AberturaRapida() {
  return (
    <section role="status" aria-label="Carregando" style={{ marginInline: 'calc(50% - 50vw)', padding: 'clamp(56px, 10vw, 120px) 20px', minHeight: '78vh', background: 'radial-gradient(900px 520px at 88% -8%, rgba(217,174,85,.30), transparent 70%), #14110C', color: '#F7F2E7' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h1 style={{ margin: 0, maxWidth: 760, font: '300 clamp(40px, 7vw, 84px)/1 Outfit, Inter, sans-serif', letterSpacing: '-.025em', color: '#F7F2E7' }}>
          Seu dinheiro some todo mês. <span style={{ color: '#E8C770' }}>Descubra para onde.</span>
        </h1>
      </div>
    </section>
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
  const session = useSession();
  // o mesmo critério do LoginGate: link do WhatsApp ou sessão de e-mail
  const logged = Boolean(painelToken() || session);
  const resume = savedProgress && savedProgress.step > 0 && savedProgress.step < 7 ? savedProgress.step : null;
  if (!logged) return <Suspense fallback={<AberturaRapida />}><Landing resume={resume} onStart={onStart} onResume={onResume} /></Suspense>;
  return (
    <ErroGlobal>
      <Porteiro>
        <Suspense fallback={<PainelCarregando />}><Caderno /></Suspense>
      </Porteiro>
    </ErroGlobal>
  );
}
