import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Esqueleto, Titulo } from '../ui';
import { importarComRetry } from '../importar';

/* ---------- Investir: Mercado | Meu plano | Simulação | Conversar. Cada parte carrega só quando abre. ---------- */

const Mercado = lazy(() => importarComRetry(() => import('./Mercado')).then((m) => ({ default: m.Mercado })));
const MeuPlano = lazy(() => importarComRetry(() => import('./MeuPlano')).then((m) => ({ default: m.MeuPlano })));
const Simulacao = lazy(() => importarComRetry(() => import('./Simulacao')).then((m) => ({ default: m.Simulacao })));
const Conversar = lazy(() => importarComRetry(() => import('./Conversar')).then((m) => ({ default: m.Conversar })));

const ABAS = [
  ['mercado', 'Mercado'],
  ['plano', 'Meu plano'],
  ['simulacao', 'Simulação'],
  ['conversar', 'Conversar'],
] as const;

export function Investir() {
  const [params, setParams] = useSearchParams();
  const aba = ABAS.find(([id]) => id === params.get('aba'))?.[0] ?? 'mercado';
  return (
    <>
      <Titulo titulo="Investir" />
      <p className="gs-banner" role="note" style={{ fontSize: 13 }}>Conteúdo educativo. Não é recomendação de investimento. Rentabilidade passada não garante resultado futuro.</p>
      <div className="gs-seg" role="tablist" aria-label="Investir">
        {ABAS.map(([id, nome]) => <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? 'on' : ''} onClick={() => setParams(id === 'mercado' ? {} : { aba: id })}>{nome}</button>)}
      </div>
      <Suspense fallback={<Esqueleto linhas={5} />}>
        {aba === 'mercado' && <Mercado />}
        {aba === 'plano' && <MeuPlano />}
        {aba === 'simulacao' && <Simulacao />}
        {aba === 'conversar' && <Conversar />}
      </Suspense>
    </>
  );
}
