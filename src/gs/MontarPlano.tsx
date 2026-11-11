import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { ESCONDIVEIS, FOCOS, ferramentasLiberadas, focosIndicados, montarPlano, resumoDoPlano } from './planoPessoal';
import { ferramenta } from './registroFerramentas';
import { salvarPlano } from './acoes';
import { Eyebrow, Moeda } from './base';
import { toast } from '../components/ui/Toast';
import type { Estado } from './tipos';

/* ---------- O Coach monta o plano: 3 perguntas em botões, e a pessoa só vê o que vai usar ---------- */

export function MontarPlano({ onPronto }: { onPronto?: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const indicados = useMemo(() => focosIndicados(e, hoje), [e, hoje]);
  const atual = e.caminho.plano;
  const [passo, setPasso] = useState(0);
  const [focos, setFocos] = useState<string[]>(() => atual?.focos ?? indicados.slice(0, 2).map((x) => x.foco.id));
  const [esconder, setEsconder] = useState<string[]>(() => atual?.esconder ?? []);
  const [ritmo, setRitmo] = useState<'um-passo' | 'tudo'>(atual?.ritmo ?? 'um-passo');
  const ordem = [...indicados.map((x) => x.foco), ...FOCOS.filter((f) => !indicados.some((x) => x.foco.id === f.id))];
  const porque = (id: string) => indicados.find((x) => x.foco.id === id)?.porque;
  const alterna = (lista: string[], set: (v: string[]) => void, id: string, max = 9) => set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id].slice(-max));
  const proposto = montarPlano({ focos, esconder, ritmo }, hoje, atual);
  const previa: Estado = { ...e, caminho: { ...e.caminho, plano: proposto } };
  const liberadas = [...ferramentasLiberadas(previa, hoje)].map((id) => ferramenta(id)).filter((f) => f && f.area !== 'perfil' && f.id !== 'coach');

  return (
    <section className="cm-card" aria-label="Montar meu plano">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Moeda tamanho={40} /><Eyebrow>{passo < 3 ? `Seu plano · pergunta ${passo + 1} de 3` : 'Seu plano'}</Eyebrow></div>

      {passo === 0 && (
        <>
          <b style={{ display: 'block', font: '600 25px/1.2 var(--cm-serif)', margin: '10px 0 4px' }}>O que você quer resolver primeiro?</b>
          <p className="cm-mudo" style={{ margin: 0 }}>Escolha até 3. Os marcados com ★ são o que os seus números pedem.</p>
          <div className="cm-chips" role="group" aria-label="O que resolver primeiro">
            {ordem.map((f) => (
              <button key={f.id} type="button" className={`cm-chip${focos.includes(f.id) ? ' on' : ''}`} aria-pressed={focos.includes(f.id)} onClick={() => alterna(focos, setFocos, f.id, 3)} style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '10px 16px', borderRadius: 18 }}>
                <span>{porque(f.id) ? '★ ' : ''}{f.titulo}</span>
                {porque(f.id) && <small className="cm-mudo" style={{ fontWeight: 500 }}>{porque(f.id)}</small>}
              </button>
            ))}
          </div>
          <button type="button" className="gs-btn" disabled={focos.length === 0} onClick={() => setPasso(1)}>Continuar</button>
        </>
      )}

      {passo === 1 && (
        <>
          <b style={{ display: 'block', font: '600 25px/1.2 var(--cm-serif)', margin: '10px 0 4px' }}>Tem algo que você não quer ver agora?</b>
          <p className="cm-mudo" style={{ margin: 0 }}>Eu tiro da sua tela. Dá para trazer de volta quando quiser.</p>
          <div className="cm-chips" role="group" aria-label="O que esconder">
            {ESCONDIVEIS.map((x) => <button key={x.id} type="button" className={`cm-chip${esconder.includes(x.id) ? ' on' : ''}`} aria-pressed={esconder.includes(x.id)} onClick={() => alterna(esconder, setEsconder, x.id)}>{esconder.includes(x.id) ? 'Esconder: ' : ''}{x.titulo}</button>)}
          </div>
          <div className="gs-acoes"><button type="button" className="gs-btn" onClick={() => setPasso(2)}>{esconder.length ? 'Continuar' : 'Quero ver tudo isso'}</button><button type="button" className="gs-btn link" onClick={() => setPasso(0)}>Voltar</button></div>
        </>
      )}

      {passo === 2 && (
        <>
          <b style={{ display: 'block', font: '600 25px/1.2 var(--cm-serif)', margin: '10px 0 4px' }}>Como você prefere ir?</b>
          <div className="cm-chips" role="group" aria-label="Ritmo">
            <button type="button" className={`cm-chip${ritmo === 'um-passo' ? ' on' : ''}`} aria-pressed={ritmo === 'um-passo'} onClick={() => setRitmo('um-passo')}>Um passo de cada vez (no máximo 3 na tela)</button>
            <button type="button" className={`cm-chip${ritmo === 'tudo' ? ' on' : ''}`} aria-pressed={ritmo === 'tudo'} onClick={() => setRitmo('tudo')}>Ver o mês inteiro</button>
          </div>
          <div className="gs-acoes"><button type="button" className="gs-btn" onClick={() => setPasso(3)}>Ver meu plano</button><button type="button" className="gs-btn link" onClick={() => setPasso(1)}>Voltar</button></div>
        </>
      )}

      {passo === 3 && (
        <>
          <b style={{ display: 'block', font: '600 25px/1.2 var(--cm-serif)', margin: '10px 0 6px' }}>{resumoDoPlano(proposto)}</b>
          <p className="cm-mudo" style={{ margin: '0 0 8px' }}>Na sua tela ficam só estas ferramentas. As outras continuam no app, e eu te indico quando precisar delas.</p>
          <ul style={{ margin: '0 0 14px', paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {liberadas.map((f) => <li key={f!.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}><Check size={16} aria-hidden="true" style={{ color: 'var(--cm-ok)', flex: 'none' }} /><span><b>{f!.titulo}</b> <span className="cm-mudo">· {f!.resolve}</span></span></li>)}
          </ul>
          <div className="gs-acoes">
            <button type="button" className="gs-btn" onClick={() => { salvarPlano(proposto); toast('Plano pronto. Sua tela agora mostra só o que você vai usar.', { acao: { rotulo: 'Desfazer', onClick: () => salvarPlano(atual) } }); onPronto?.(); }}>Usar este plano</button>
            <button type="button" className="gs-btn link" onClick={() => setPasso(0)}>Ajustar</button>
          </div>
        </>
      )}
    </section>
  );
}
