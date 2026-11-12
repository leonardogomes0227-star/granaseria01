import { painelToken } from '../painel';
import { lazy, Suspense } from 'react';
import { importarComRetry } from '../gs/importar';
// a tela de quem está logado vem num pacote separado: a página de entrada abre mais rápido
const Caderno = lazy(() => importarComRetry(() => import('../gs/Caderno')).then((m) => ({ default: m.Caderno })));
import { Landing } from '../gs/Landing';
import { Porteiro } from '../gs/Porteiro';
import { ErroGlobal } from '../gs/ErroGlobal';

/** Enquanto o painel carrega: o mesmo desenho, sem números. */
function PainelCarregando() {
  return (
    <div className="pn pn-skel" role="status" aria-label="Carregando o painel">
      <span className="sk sk-titulo" />
      <span className="sk sk-busca" />
      <div className="pn-acoes">{[0, 1, 2, 3].map((i) => <span key={i} className="sk sk-acao" />)}</div>
      <div className="pn-stats">{[0, 1, 2, 3].map((i) => <span key={i} className="sk sk-stat" />)}</div>
      <span className="sk sk-hero" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/* ---------- Início ---------- */
// Logado: o dashboard do app (src/gs/Inicio.tsx). Ainda não: a página de entrada (src/gs/Landing.tsx).

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
  if (!logged) return <Landing resume={resume} onStart={onStart} onResume={onResume} />;
  return (
    <ErroGlobal>
      <Porteiro>
        <Suspense fallback={<PainelCarregando />}><Caderno /></Suspense>
      </Porteiro>
    </ErroGlobal>
  );
}
