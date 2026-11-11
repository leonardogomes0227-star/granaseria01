import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { nomeMes } from './datas';
import { simularImpacto, type Mudanca } from './caminho';
import { colocarNoCaminho, removerPasso } from './acoes';
import { Eyebrow } from './base';
import { toast } from '../components/ui/Toast';

/* ---------- As peças que fazem uma ferramenta terminar em solução, e não em número ---------- */

export interface PassoProposto {
  titulo: string; // começa com verbo: "Cancelar o streaming"
  detalhe: string;
  rota?: string;
  origem: string; // id da ferramenta
}

/** "Colocar no meu caminho": vira um passo no plano do mês. */
export function BotaoCaminho({ passo, principal }: { passo: PassoProposto; principal?: boolean }) {
  const e = useEstado();
  const ja = e.caminho.passos.find((p) => !p.feitoEm && p.origem === passo.origem && p.titulo === passo.titulo.trim().slice(0, 120));
  if (ja) return <Link to="/" className="gs-btn sec"><Check size={18} aria-hidden="true" /> Está no seu caminho</Link>;
  return (
    <button type="button" className={principal ? 'gs-btn' : 'gs-btn sec'} onClick={() => {
      const id = colocarNoCaminho(passo);
      if (id) toast('Coloquei nos seus passos deste mês.', { acao: { rotulo: 'Desfazer', onClick: () => removerPasso(id) } });
    }}>Colocar no meu caminho</button>
  );
}

/** O que esta decisão muda na data do destino: antes e depois, numa frase. Não aparece quando não há data para comparar. */
export function ImpactoNoCaminho({ mudanca, passo, semImpacto }: { mudanca: Mudanca | null; passo?: PassoProposto; semImpacto?: ReactNode }) {
  const e = useEstado();
  const hoje = useHoje();
  const chave = JSON.stringify(mudanca);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a mudança é comparada pelo conteúdo, não pela referência
  const imp = useMemo(() => (mudanca ? simularImpacto(e, hoje, mudanca) : null), [e, hoje, chave]);
  if (!imp) return semImpacto || passo ? <section className="cm-impacto"><Eyebrow>No seu caminho</Eyebrow><p>{semImpacto ?? 'Ainda não tenho uma data de destino para comparar. Coloque no plano e eu acompanho.'}</p>{passo && <div className="gs-acoes"><BotaoCaminho passo={passo} /></div>}</section> : null;
  const tom = imp.meses > 0 || !imp.dataDepois ? 'atrasa' : imp.meses < 0 ? 'adianta' : '';
  return (
    <section className={`cm-impacto ${tom}`} aria-label="Impacto no seu caminho">
      <Eyebrow>Impacto no seu caminho</Eyebrow>
      <p>{imp.frase}</p>
      {imp.dataDepois && imp.meses !== 0 && (
        <div className="cm-antes-depois">
          <div><span>Hoje</span><b>{nomeMes(imp.dataAntes)}</b></div>
          <span aria-hidden="true">→</span>
          <div><span>Com isso</span><b style={{ color: imp.meses > 0 ? 'var(--cm-atraso)' : 'var(--cm-ok)' }}>{nomeMes(imp.dataDepois)}</b></div>
        </div>
      )}
      <div className="gs-acoes">
        {passo && <BotaoCaminho passo={passo} principal={imp.meses < 0} />}
        <Link to="/" className="gs-btn link">Ver meu caminho</Link>
      </div>
    </section>
  );
}

/** A resposta em uma frase, com o porquê recolhido em "Como cheguei nisso". */
export function Resposta({ rotulo = 'A resposta', frase, porque, children }: { rotulo?: string; frase: ReactNode; porque?: ReactNode; children?: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section className="cm-resposta" aria-label={rotulo}>
      <Eyebrow>{rotulo}</Eyebrow>
      <b>{frase}</b>
      {children && <div className="gs-acoes" style={{ marginTop: 12 }}>{children}</div>}
      {porque && (
        <>
          <button type="button" className="cm-link" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>Como cheguei nisso</button>
          {aberto && <div className="cm-premissas">{porque}</div>}
        </>
      )}
    </section>
  );
}
