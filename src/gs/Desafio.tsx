import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Dices, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEstado } from './store';
import { criarDesafio, desmarcarCelula, marcarCelula, removerMeta, restaurarMeta } from './acoes';
import { brl0 } from './datas';
import { CampoDinheiro, Dica, Titulo } from './ui';
import { toast } from '../components/ui/Toast';
import { confete, vibrar } from '../lib/celebrar';
import { tocar } from './sons';
import { mascarar, useOculto } from './privacidade';
import { METAS_SUGERIDAS, QUANTIDADES, gerarCelulas, marcoAtingido, progresso, sortear, valorCurto } from './desafioLogica';
import type { Meta } from './tipos';
import './desafio.css';

/* ---------- Desafio de juntar: uma grade de quadradinhos que somam a meta. Cada um marcado é dinheiro guardado. ---------- */

function Novo({ onCriado, primeiro }: { onCriado: (id: string) => void; primeiro: boolean }) {
  const [alvo, setAlvo] = useState(5000);
  const [n, setN] = useState(100);
  const [outro, setOutro] = useState(false);
  const celulas = useMemo(() => gerarCelulas(alvo, n), [alvo, n]);
  const pequeno = alvo > 0 && celulas.length === 0;
  const criar = () => {
    const id = criarDesafio({ nome: `Desafio dos ${brl0(alvo)}`, alvo, celulas });
    if (!id) { toast('Não consegui criar. Confira a meta (no máximo 20 metas ao mesmo tempo).'); return; }
    tocar('sucesso');
    onCriado(id);
  };
  return (
    <section className="dz-novo" aria-label="Novo desafio">
      {primeiro && <p className="dz-intro">Escolha quanto quer juntar e em quantos depósitos. Eu monto a grade: cada quadradinho é um valor. Guardou aquele valor, marca o quadradinho. Quando todos estiverem marcados, a meta está batida.</p>}
      <span className="dz-rot">Quanto você quer juntar?</span>
      <div className="dz-chips">
        {METAS_SUGERIDAS.map((v) => <button key={v} type="button" className={!outro && alvo === v ? 'on' : ''} onClick={() => { setOutro(false); setAlvo(v); tocar('tique2'); }}>{brl0(v)}</button>)}
        <button type="button" className={outro ? 'on' : ''} onClick={() => setOutro(true)}>Outro valor</button>
      </div>
      {outro && <CampoDinheiro rotulo="Valor da meta" valor={alvo} onChange={setAlvo} />}
      <span className="dz-rot">Em quantos quadradinhos?</span>
      <div className="dz-qtd">
        {QUANTIDADES.map((q) => <button key={q.n} type="button" className={n === q.n ? 'on' : ''} onClick={() => { setN(q.n); tocar('tique2'); }}><b>{q.rotulo}</b><small>{q.dica}</small></button>)}
      </div>
      {celulas.length > 0 && (
        <div className="dz-previa" aria-live="polite">
          <p>Depósitos de <b>{brl0(celulas[0])}</b> a <b>{brl0(celulas[celulas.length - 1])}</b>, em média <b>{brl0(alvo / n)}</b>. Os primeiros são pequenos, para começar fácil.</p>
          <div className="dz-mini" aria-hidden="true">{celulas.slice(0, 40).map((v, i) => <i key={i} style={{ opacity: 0.35 + (v / celulas[celulas.length - 1]) * 0.65 }} />)}</div>
        </div>
      )}
      {pequeno && <p className="dz-aviso">A meta precisa ser de pelo menos {brl0(n)} para {n} quadradinhos.</p>}
      <button type="button" className="gs-btn cheio dz-criar" disabled={celulas.length === 0} onClick={criar}><Sparkles size={18} aria-hidden="true" /> Começar o desafio dos {brl0(alvo)}</button>
    </section>
  );
}

function Grade({ meta }: { meta: Meta }) {
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const celulas = meta.desafio?.celulas ?? [];
  const marcadas = useMemo(() => meta.guardados.filter((g) => g.celula !== undefined).map((g) => g.celula as number), [meta.guardados]);
  const marcadasSet = useMemo(() => new Set(marcadas), [marcadas]);
  const p = progresso(celulas, marcadas);
  const pctTexto = p.guardado > 0 && p.pct === 0 ? '<1%' : `${p.pct}%`;
  const [sorteada, setSorteada] = useState<number | null>(null);
  const [recem, setRecem] = useState<number | null>(null);
  const grade = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sorteada !== null && marcadasSet.has(sorteada)) setSorteada(null); }, [sorteada, marcadasSet]);

  const alternar = (i: number) => {
    if (marcadasSet.has(i)) {
      desmarcarCelula(meta.id, i);
      tocar('tique2');
      toast(`Quadradinho de ${brl0(celulas[i])} desmarcado.`, { acao: { rotulo: 'Desfazer', onClick: () => marcarCelula(meta.id, i) } });
      return;
    }
    const antes = p.pct;
    if (!marcarCelula(meta.id, i)) return;
    setRecem(i); setTimeout(() => setRecem(null), 700);
    const depois = progresso(celulas, [...marcadas, i]).pct;
    const marco = marcoAtingido(antes, depois);
    vibrar(20);
    if (marco === 100) { confete('grande'); toast(`Meta batida: ${brl0(p.alvo)} guardados. Você conseguiu!`); }
    else if (marco) { confete('pequeno'); toast(`${marco}% da meta! Guardado ${brl0(celulas[i])}.`, { acao: { rotulo: 'Desfazer', onClick: () => desmarcarCelula(meta.id, i) } }); }
    else { tocar('sucesso'); toast(`Guardado ${brl0(celulas[i])}. Faltam ${brl0(p.falta - celulas[i])}.`, { acao: { rotulo: 'Desfazer', onClick: () => desmarcarCelula(meta.id, i) } }); }
  };
  const sortearHoje = () => {
    const i = sortear(celulas, marcadas);
    if (i === null) return;
    setSorteada(i);
    tocar('brilho');
    requestAnimationFrame(() => grade.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const excluir = () => {
    const copia = meta;
    removerMeta(meta.id);
    toast('Desafio excluído. O que já foi guardado continua na sua reserva.', { acao: { rotulo: 'Desfazer', onClick: () => restaurarMeta(copia) } });
  };

  return (
    <section className="dz-painel" aria-label={meta.nome}>
      <header className="dz-cab">
        <div className="dz-anel" style={{ ['--p' as string]: `${Math.max(p.guardado > 0 ? 4 : 0, p.pct * 3.6)}deg` }} aria-hidden="true"><span>{pctTexto}</span></div>
        <div className="dz-nums">
          <small>{meta.nome}</small>
          <b>{m(brl0(p.guardado))} <em>de {m(brl0(p.alvo))}</em></b>
          <span>{p.marcadas} de {p.total} quadradinhos · faltam {m(brl0(p.falta))}</span>
        </div>
      </header>
      <div className="dz-barra" aria-hidden="true"><i style={{ width: `${p.guardado > 0 ? Math.max(1, p.pct) : 0}%` }} /></div>
      {p.pct < 100 ? (
        <div className="dz-acoes">
          <button type="button" className="gs-btn" onClick={sortearHoje}><Dices size={18} aria-hidden="true" /> Sortear o depósito de hoje</button>
          {sorteada !== null && <button type="button" className="gs-btn sec" onClick={() => alternar(sorteada)}><Check size={18} aria-hidden="true" /> Guardei {brl0(celulas[sorteada])}</button>}
        </div>
      ) : <p className="dz-feito">Desafio completo. Que tal começar o próximo, um pouco maior?</p>}
      <p className="dz-como">Toque no quadradinho do valor que você guardou. Errou? Toque de novo para desmarcar.</p>
      <div className="dz-grade" ref={grade} role="group" aria-label="Quadradinhos do desafio">
        {celulas.map((v, i) => {
          const on = marcadasSet.has(i);
          return (
            <button key={i} type="button" data-i={i} className={`dz-cel${on ? ' on' : ''}${sorteada === i ? ' sorteada' : ''}${recem === i ? ' recem' : ''}`} onClick={() => alternar(i)} aria-pressed={on} aria-label={`${brl0(v)}${on ? ', guardado' : ''}`}>
              {on ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : null}
              <span>{oculto ? '•••' : valorCurto(v)}</span>
            </button>
          );
        })}
      </div>
      <Dica>Separe o dinheiro de verdade: transfira para uma conta ou caixinha só do desafio. Cada quadradinho marcado entra em Metas e sai do “pode gastar”, então o app continua batendo com o seu bolso.</Dica>
      <button type="button" className="gs-btn link dz-excluir" onClick={excluir}><Trash2 size={15} aria-hidden="true" /> Excluir este desafio</button>
    </section>
  );
}

export function Desafio() {
  const e = useEstado();
  const desafios = e.metas.filter((x) => x.desafio && x.desafio.celulas.length > 0);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const atual = desafios.find((d) => d.id === ativo) ?? desafios[0];
  const mostrarNovo = novo || desafios.length === 0;
  return (
    <>
      <Titulo titulo="Desafio de juntar" sub="Uma grade de quadradinhos que somam a sua meta. Guardou, marcou." />
      {desafios.length > 0 && (
        <div className="dz-lista" role="tablist" aria-label="Seus desafios">
          {desafios.map((d) => {
            const p = progresso(d.desafio!.celulas, d.guardados.filter((g) => g.celula !== undefined).map((g) => g.celula as number));
            return <button key={d.id} type="button" role="tab" aria-selected={!novo && atual?.id === d.id} className={!novo && atual?.id === d.id ? 'on' : ''} onClick={() => { setNovo(false); setAtivo(d.id); }}>{d.nome}<em>{p.guardado > 0 && p.pct === 0 ? '<1' : p.pct}%</em></button>;
          })}
          <button type="button" role="tab" aria-selected={novo} className={novo ? 'on' : ''} onClick={() => setNovo(true)}><Plus size={14} aria-hidden="true" /> Novo</button>
        </div>
      )}
      {mostrarNovo ? <Novo primeiro={desafios.length === 0} onCriado={(id) => { setNovo(false); setAtivo(id); }} /> : atual && <Grade key={atual.id} meta={atual} />}
    </>
  );
}
