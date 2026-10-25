import { useMemo, useState } from 'react';
import { useEstado } from './store';
import { dividirExtra } from './ferramentas';
import { guardar, pagarDivida, removerAporte, desfazerPagamentoDivida, configurarAssistente } from './acoes';
import { paraSim, passoDoMes, saldoAtual } from './dividas';
import { CampoDinheiro, CampoNumero, Titulo } from './ui';
import { brl0, hoje as hojeSP } from './datas';
import { toast } from '../components/ui/Toast';

/* ---------- Dinheiro extra: 13º, bônus, freela. Dê destino antes que ele suma. ---------- */

export function Extras() {
  const e = useEstado();
  const [valor, setValor] = useState(0);
  const [origem, setOrigem] = useState<'13º' | 'Bônus' | 'Dinheiro extra'>('13º');
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  const temDivida = abertas.length > 0;
  const [pd, setPd] = useState<number | ''>(50);
  const [pr, setPr] = useState<number | ''>(30);
  const [pl, setPl] = useState<number | ''>(20);
  const pcts = { divida: typeof pd === 'number' ? pd : 0, reserva: typeof pr === 'number' ? pr : 0, lazer: typeof pl === 'number' ? pl : 0 };
  const soma = pcts.divida + pcts.reserva + pcts.lazer;
  const div = useMemo(() => dividirExtra(valor, temDivida, pcts), [valor, temDivida, pcts.divida, pcts.reserva, pcts.lazer]); // eslint-disable-line react-hooks/exhaustive-deps
  const aplicar = () => {
    const desfazer: (() => void)[] = [];
    const data = hojeSP();
    if (div.reserva > 0) {
      const id = guardar(div.reserva, 'extra', 'extras');
      if (id) desfazer.push(() => removerAporte(id));
    }
    if (div.divida > 0 && temDivida) {
      const sim = paraSim(e.dividas);
      const passo = passoDoMes(sim, e.planoDividas?.pagamentoMensal ?? 0, e.planoDividas?.estrategia ?? 'maior-juro');
      let resta = div.divida;
      const ordem = passo ? [passo.divida.id, ...sim.map((d) => d.id).filter((i) => i !== passo.divida.id)] : sim.map((d) => d.id);
      for (const id of ordem) {
        if (resta <= 0.005) break;
        const d = e.dividas.find((x) => x.id === id);
        if (!d) continue;
        const p = Math.min(resta, saldoAtual(d));
        if (p > 0 && pagarDivida(id, p, data)) {
          desfazer.push(() => desfazerPagamentoDivida(id, data, p));
          resta -= p;
        }
      }
    }
    configurarAssistente('extras', { ultimo: `${data}|${origem}|${valor}` });
    toast(`${origem} dividido: ${brl0(div.divida)} dívida, ${brl0(div.reserva)} reserva, ${brl0(div.lazer)} pra você`, { acao: { rotulo: 'Desfazer', onClick: () => desfazer.forEach((f) => f()) }, duracao: 7000 });
    setValor(0);
  };
  return (
    <>
      <Titulo titulo="Dinheiro extra" sub="13º, bônus ou um dinheiro que caiu. Sugestão: 50% dívida, 30% reserva, 20% pra você." />
      <section className="gs-card">
        <div className="gs-chips" role="group" aria-label="Origem">
          {(['13º', 'Bônus', 'Dinheiro extra'] as const).map((o) => <button key={o} type="button" className={`gs-chip ${origem === o ? 'on' : ''}`} onClick={() => setOrigem(o)}>{o}</button>)}
        </div>
        <CampoDinheiro rotulo="Quanto entrou?" valor={valor} onChange={setValor} grande />
        {!temDivida && <p className="gs-nota" style={{ marginTop: -6 }}>Sem dívidas abertas: a parte da dívida vai pra reserva.</p>}
      </section>
      {valor > 0 && (
        <section className="gs-card destaque">
          <div className="gs-tres">
            <div><span className="gs-mudo">Dívida</span><b className="gs-tab">{brl0(div.divida)}</b></div>
            <div><span className="gs-mudo">Reserva</span><b className="gs-tab">{brl0(div.reserva)}</b></div>
            <div><span className="gs-mudo">Pra você</span><b className="gs-tab">{brl0(div.lazer)}</b></div>
          </div>
          <div className="gs-dois" style={{ marginTop: 14 }}>
            <CampoNumero rotulo="Dívida" sufixo="%" valor={pd} onChange={setPd} min={0} max={100} />
            <CampoNumero rotulo="Reserva" sufixo="%" valor={pr} onChange={setPr} min={0} max={100} />
          </div>
          <CampoNumero rotulo="Pra você" sufixo="%" valor={pl} onChange={setPl} min={0} max={100} />
          {soma !== 100 && <p className="gs-erro" role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>Os percentuais somam {soma}%. Ajuste pra fechar 100%.</p>}
          <button type="button" className="gs-btn cheio" disabled={soma !== 100} onClick={aplicar}>Aplicar</button>
          <p className="gs-nota">Aplicar guarda a parte da reserva e abate a parte da dívida. Dá pra desfazer logo em seguida.</p>
        </section>
      )}
    </>
  );
}
