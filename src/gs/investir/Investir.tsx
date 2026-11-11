import { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Esqueleto, Titulo } from '../ui';
import { RespostaFerramenta } from '../RespostaFerramenta';
import { importarComRetry } from '../importar';

/* ---------- Investir: Meu caminho (o passo a passo) | Mercado | Perguntar | Treinar. Cada parte carrega só quando abre. ---------- */

const Mercado = lazy(() => importarComRetry(() => import('./Mercado')).then((m) => ({ default: m.Mercado })));
const Caminho = lazy(() => importarComRetry(() => import('./Caminho')).then((m) => ({ default: m.Caminho })));
const Simulacao = lazy(() => importarComRetry(() => import('./Simulacao')).then((m) => ({ default: m.Simulacao })));
const Conversar = lazy(() => importarComRetry(() => import('./Conversar')).then((m) => ({ default: m.Conversar })));

const ABAS = [
  ['caminho', 'Caminho'],
  ['mercado', 'Mercado'],
  ['conversar', 'Perguntar'],
  ['simulacao', 'Treinar'],
] as const;

export function Investir() {
  const [params, setParams] = useSearchParams();
  const aba = ABAS.find(([id]) => id === params.get('aba'))?.[0] ?? 'caminho';
  return (
    <>
      <Titulo titulo="Investir" sub="Do primeiro real guardado até o dinheiro render. Um passo de cada vez." />
      <RespostaFerramenta id="investir" />
      <div className="gs-seg" role="tablist" aria-label="Investir">
        {ABAS.map(([id, nome]) => <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? 'on' : ''} onClick={() => setParams(id === 'caminho' ? {} : { aba: id })}>{nome}</button>)}
      </div>
      <Suspense fallback={<Esqueleto linhas={5} />}>
        {aba === 'mercado' && <Mercado />}
        {aba === 'caminho' && <Caminho />}
        {aba === 'simulacao' && <Simulacao />}
        {aba === 'conversar' && <Conversar />}
      </Suspense>
    </>
  );
}
