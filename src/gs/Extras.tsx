import { useMemo, useState } from 'react';
import { useEstado } from './store';
import { dividirExtra } from './ferramentas';
import { guardar, pagarDivida, removerAporte, desfazerPagamentoDivida, configurarAssistente } from './acoes';
import { paraSim, passoDoMes, saldoAtual } from './dividas';
import { Agora, CampoDinheiro, CampoNumero, Conquistas, Heroi, MaisAjuda, Titulo } from './ui';
import { conquistasExtras, efeitoNaDivida, guardarHistorico, lerHistorico, mesesDeProtecao, totalComDestino } from './extrasLogica';
import { gastoMensalMedio } from './selectores';
import { Rosquinha } from './graficos';
import { brl0, hoje as hojeSP, mesDe } from './datas';
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
  const hist = lerHistorico(e.agentes.extras?.config.historico);
  const gastoMedio = gastoMensalMedio(e, mesDe(hojeSP()));
  const efDiv = temDivida && div.divida > 0 ? efeitoNaDivida(paraSim(e.dividas), e.planoDividas?.pagamentoMensal ?? 0, e.planoDividas?.estrategia ?? 'maior-juro', div.divida) : null;
  const protege = mesesDeProtecao(div.reserva, gastoMedio);
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
    configurarAssistente('extras', { ultimo: `${data}|${origem}|${valor}`, historico: guardarHistorico(hist, { data, origem, valor, divida: div.divida, reserva: div.reserva, lazer: div.lazer }) });
    toast(`${origem} dividido: ${brl0(div.divida)} dívida, ${brl0(div.reserva)} reserva, ${brl0(div.lazer)} pra você`, { acao: { rotulo: 'Desfazer', onClick: () => desfazer.forEach((f) => f()) }, duracao: 7000 });
    setValor(0);
  };
  return (
    <>
      <Titulo titulo="Dinheiro extra" sub="13º, bônus ou um dinheiro que caiu. Dê destino antes que ele suma." />
      {hist.length > 0 && <Heroi pct={Math.min(100, (hist.length / 3) * 100)} anel={`${hist.length}`} anelSub={hist.length === 1 ? 'extra' : 'extras'} rotulo="Você já deu destino a" grande={brl0(totalComDestino(hist))} sub="em dinheiro extra, sem deixar sumir" cor="var(--success)" />}
      <Conquistas lista={conquistasExtras(hist)} />
      <Agora tom={valor > 0 ? 'ok' : 'dica'} texto={valor > 0 ? 'Confira a divisão e toque em Aplicar. Dá pra desfazer logo em seguida.' : 'Caiu dinheiro extra? Digite quanto e eu divido entre dívida, reserva e você, antes de gastar.'} />
      <section className="gs-card">
        <div className="gs-chips" role="group" aria-label="Origem">
          {(['13º', 'Bônus', 'Dinheiro extra'] as const).map((o) => <button key={o} type="button" className={`gs-chip ${origem === o ? 'on' : ''}`} onClick={() => setOrigem(o)}>{o}</button>)}
        </div>
        <CampoDinheiro rotulo="Quanto entrou?" valor={valor} onChange={setValor} grande />
        {!temDivida && <p className="gs-nota" style={{ marginTop: -6 }}>Sem dívidas abertas: a parte da dívida vai pra reserva.</p>}
      </section>
      {valor > 0 && (
        <section className="gs-card destaque">
          <Rosquinha fatias={[{ id: 'd', cor: 'var(--danger)', valor: div.divida }, { id: 'r', cor: 'var(--gold-strong)', valor: div.reserva }, { id: 'l', cor: 'var(--ink-muted)', valor: div.lazer }]} centro={brl0(valor)} sub={origem} />
          <div className="gs-tres" style={{ marginTop: 10 }}>
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
          {(efDiv || protege > 0) && (
            <div className="gs-banner" style={{ marginBottom: 0 }}>
              {efDiv && efDiv.meses > 0 && <div>Dívida: você termina <b>{efDiv.meses} {efDiv.meses === 1 ? 'mês' : 'meses'} antes</b> e economiza <b>{brl0(efDiv.economia)}</b> de juros.</div>}
              {protege > 0.05 && <div>Reserva: <b>+{protege.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {protege === 1 ? 'mês' : 'meses'}</b> de segurança.</div>}
            </div>
          )}
          <button type="button" className="gs-btn cheio" style={{ marginTop: 12 }} disabled={soma !== 100} onClick={aplicar}>Aplicar</button>
          <p className="gs-nota">Aplicar guarda a parte da reserva e abate a parte da dívida. Dá pra desfazer logo em seguida.</p>
        </section>
      )}
      <MaisAjuda>
        <p className="gs-sub" style={{ marginTop: 0 }}>Dinheiro que chega de uma vez some rápido. Dar um destino antes de gastar faz uma parte atacar a dívida, outra proteger você e outra ser aproveitada sem culpa. Você pode mudar os percentuais. A sugestão é 50% dívida, 30% reserva e 20% pra você.</p>
        {hist.length > 0 && (
          <>
            <span className="gs-rotulo">Últimos extras</span>
            {[...hist].reverse().map((r, i) => <div className="gs-linha" key={i}><div className="gs-corpo"><b>{r.origem} · {brl0(r.valor)}</b><small>{brl0(r.divida)} dívida · {brl0(r.reserva)} reserva · {brl0(r.lazer)} pra você</small></div></div>)}
          </>
        )}
      </MaisAjuda>
    </>
  );
}
