import { useMemo, useState } from 'react';
import { RespostaFerramenta } from './RespostaFerramenta';
import { Link } from 'react-router-dom';
import { CalendarClock, Gift, PiggyBank, Sprout, Target } from 'lucide-react';
import { useEstado } from './store';
import { configurarAssistente, desfazerPagamentoDivida, guardar, pagarAtraso, pagarDivida, removerAporte, separarExtraParaAtraso } from './acoes';
import { Conquistas, Heroi, MaisAjuda, Titulo, CampoDinheiro } from './ui';
import { ImpactoNoCaminho } from './Impacto';
import { conquistasExtras, guardarHistorico, lerHistorico, rumoDoExtra, totalComDestino, type TipoDestino } from './extrasLogica';
import { brl0, hoje as hojeSP } from './datas';
import { useHoje } from './useHoje';
import { confete } from '../lib/celebrar';
import { toast } from '../components/ui/Toast';
import { Banknote, Landmark } from 'lucide-react';
import { FaixaKpis, GraficoBarras } from './PainelUI';

/* ---------- Dinheiro extra: 13º, bônus, freela. O app diz o rumo, do que mais pesa pro que pode render, e faz com 1 toque. ---------- */

const ICONE: Record<TipoDestino, typeof Gift> = { atraso: CalendarClock, 'separar-atraso': CalendarClock, divida: Target, reserva: PiggyBank, investir: Sprout, voce: Gift };
const PCTS = [0, 10, 20];

export function Extras() {
  const e = useEstado();
  const hoje = useHoje();
  const [valor, setValor] = useState(0);
  const [origem, setOrigem] = useState<'13º' | 'Bônus' | 'Dinheiro extra'>('13º');
  const [pctVoce, setPctVoce] = useState(10);
  const rumo = useMemo(() => rumoDoExtra(e, hoje, valor, pctVoce), [e, hoje, valor, pctVoce]);
  const hist = lerHistorico(e.agentes.extras?.config.historico);

  const fazer = () => {
    const desfazer: (() => void)[] = [];
    const data = hojeSP();
    let divida = 0;
    let reserva = 0;
    let voce = 0;
    for (const d of rumo.destinos) {
      if (d.tipo === 'atraso' && d.atraso) {
        const u = pagarAtraso(d.atraso, d.valor, data, { extra: true });
        if (u) desfazer.push(u.desfazer);
        divida += d.valor;
      } else if (d.tipo === 'separar-atraso') {
        const u = separarExtraParaAtraso(d.valor);
        if (u) desfazer.push(u.desfazer);
        divida += d.valor;
      } else if (d.tipo === 'divida' && d.refId) {
        const id = d.refId;
        if (pagarDivida(id, d.valor, data)) desfazer.push(() => desfazerPagamentoDivida(id, data, d.valor));
        divida += d.valor;
      } else if (d.tipo === 'reserva' || d.tipo === 'investir') {
        const id = guardar(d.valor, 'extra', d.tipo === 'investir' ? 'investimentos' : 'extras');
        if (id) desfazer.push(() => removerAporte(id));
        reserva += d.valor;
      } else if (d.tipo === 'voce') voce += d.valor;
    }
    configurarAssistente('extras', { ultimo: `${data}|${origem}|${valor}`, historico: guardarHistorico(hist, { data, origem, valor, divida, reserva, lazer: voce }) });
    confete('grande');
    toast(`${origem} com destino: ${rumo.manchete.replace(/^Com esse dinheiro você /, '').replace(/\.$/, '')}`, { acao: { rotulo: 'Desfazer', onClick: () => desfazer.reverse().forEach((f) => f()) }, duracao: 8000 });
    setValor(0);
  };

  return (
    <>
      <Titulo titulo="Dinheiro extra" sub="13º, bônus ou dinheiro que caiu: o melhor destino." />
      <RespostaFerramenta id="extras" />
      {hist.length > 0 && <Heroi pct={Math.min(100, (hist.length / 3) * 100)} anel={`${hist.length}`} anelSub={hist.length === 1 ? 'extra' : 'extras'} rotulo="Você já deu destino a" grande={brl0(totalComDestino(hist))} sub="em dinheiro extra, sem deixar sumir" cor="var(--success)" />}
      {hist.length > 0 && (
        <>
          <FaixaKpis itens={[
            { rotulo: 'Extras com destino', valor: hist.length, formato: 'int', icone: Gift, tom: 'ok', nota: 'até agora' },
            { rotulo: 'Total que caiu', valor: hist.reduce((t, h) => t + h.valor, 0), icone: Banknote, nota: 'somando todos' },
            { rotulo: 'Foi pra dívida', valor: hist.reduce((t, h) => t + h.divida, 0), icone: Landmark, nota: 'e atraso' },
            { rotulo: 'Foi pra reserva', valor: hist.reduce((t, h) => t + h.reserva, 0), icone: PiggyBank, tom: 'ok', nota: 'e investimentos' },
          ]} />
          <GraficoBarras titulo="Seus extras" sub="mais recente à direita" dados={[...hist].reverse().map((h) => ({ rotulo: h.origem, valor: h.valor, tom: 'ok', legenda: `${h.origem} · ${h.data.slice(8, 10)}/${h.data.slice(5, 7)}` }) as const)} />
        </>
      )}
      <Conquistas lista={conquistasExtras(hist)} />

      <section className="gs-card">
        <div className="gs-chips" role="group" aria-label="De onde veio">
          {(['13º', 'Bônus', 'Dinheiro extra'] as const).map((o) => <button key={o} type="button" className={`gs-chip ${origem === o ? 'on' : ''}`} aria-pressed={origem === o} onClick={() => setOrigem(o)}>{o}</button>)}
        </div>
        <CampoDinheiro rotulo="Quanto entrou?" valor={valor} onChange={setValor} grande />
        {valor <= 0 && <p className="gs-nota" style={{ marginTop: -6 }}>Digite o valor e eu mostro o que esse dinheiro consegue fazer por você.</p>}
      </section>

      {valor > 0 && (
        <>
          <section className="gs-card destaque">
            <span className="gs-rotulo">O melhor rumo pra esse {origem === '13º' ? '13º' : origem.toLowerCase()}</span>
            <p className="gs-medio" style={{ margin: '6px 0 0', fontSize: 21, lineHeight: '28px' }}>{rumo.manchete}</p>
          </section>

          <ImpactoNoCaminho mudanca={{ tipo: 'extra', valor: Math.max(0, valor - (rumo.destinos.find((d) => d.tipo === 'voce')?.valor ?? 0)) }} passo={{ titulo: `Dar destino ao ${origem === '13º' ? '13º' : origem.toLowerCase()} de ${brl0(valor)}`, detalhe: rumo.manchete, rota: '/plano/extras', origem: 'extras' }} />

          <ol className="gs-rumo">
            {rumo.destinos.map((d, i) => {
              const Ic = ICONE[d.tipo];
              return (
                <li key={i} className={`gs-rumo-item ${d.tipo}`}>
                  <span className="gs-rumo-ic" aria-hidden="true"><Ic size={20} /></span>
                  <div className="gs-corpo">
                    <b>{d.titulo}</b>
                    <small>{d.resultado}</small>
                  </div>
                  <span className="gs-valor">{brl0(d.valor)}</span>
                </li>
              );
            })}
          </ol>

          <section className="gs-card">
            <span className="gs-rotulo">Quanto fica pra você aproveitar</span>
            <div className="gs-chips" role="group" aria-label="Parte pra você" style={{ marginTop: 8 }}>
              {PCTS.map((p) => <button key={p} type="button" className={`gs-chip ${pctVoce === p ? 'on' : ''}`} aria-pressed={pctVoce === p} onClick={() => setPctVoce(p)}>{p === 0 ? 'Nada' : `${p}%`}</button>)}
            </div>
            <p className="gs-nota" style={{ marginTop: 0 }}>Uma parte pra você faz o plano durar: ninguém aguenta só cortar.</p>
            <button type="button" className="gs-btn cheio" style={{ marginTop: 6 }} onClick={fazer}>Fazer isso</button>
            <p className="gs-nota">Eu pago as contas atrasadas e as dívidas, guardo a reserva e registro tudo. Dá pra desfazer logo em seguida.</p>
          </section>
        </>
      )}

      <MaisAjuda titulo="Por que nessa ordem">
        <p className="gs-sub" style={{ marginTop: 0 }}>
          1. <b>Conta atrasada</b> cobra multa e juros todo mês e pode virar nome sujo. 2. <b>Dívida cara</b> (juro acima de 1,5% ao mês, como cartão e cheque especial) cobra mais do que qualquer investimento rende. 3. <b>Reserva</b> evita que o próximo imprevisto vire dívida nova. 4. Com tudo isso em dia, o resto <Link to="/investir">pode render</Link>.
        </p>
        <p className="gs-sub" style={{ marginBottom: 0 }}>Dívida com juro baixo (financiamento de casa, consignado) não entra: vale mais manter a parcela em dia e usar o dinheiro na reserva.</p>
        {hist.length > 0 && (
          <>
            <span className="gs-rotulo" style={{ display: 'block', marginTop: 14 }}>Últimos extras</span>
            {[...hist].reverse().map((r, i) => <div className="gs-linha" key={i}><div className="gs-corpo"><b>{r.origem} · {brl0(r.valor)}</b><small>{brl0(r.divida)} em contas e dívidas · {brl0(r.reserva)} guardados · {brl0(r.lazer)} pra você</small></div></div>)}
          </>
        )}
      </MaisAjuda>
    </>
  );
}
