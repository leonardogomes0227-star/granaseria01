import { painelToken } from '../painel';
import { Inicio } from '../gs/Inicio';
import { Landing } from '../gs/Landing';
import { Porteiro } from '../gs/Porteiro';
import { ErroGlobal } from '../gs/ErroGlobal';

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
        <Inicio />
      </Porteiro>
    </ErroGlobal>
  );
}
