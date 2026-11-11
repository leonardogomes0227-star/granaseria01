import { useMemo, useState } from 'react';
import { RespostaFerramenta } from './RespostaFerramenta';
import { Link } from 'react-router-dom';
import { Check, Lock } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { gastoMensalMedio, patrimonioGuardado } from './selectores';
import { patrimonioParaRenda, TAXA_RENDA_PADRAO } from './ferramentas';
import { CampoNumero, Deslizante, Dica, MaisAjuda, Titulo } from './ui';
import { Linha } from './graficos';
import { brl0, mesDe, pct, somaMes } from './datas';
import { salvarConfig } from './acoes';
import { degrausDeRenda, mesesAteMeta, rendimentoMensal } from './rendaLogica';
import { prioridadeAntesDeInvestir } from './investir/calculos';
import { lerCdiMensal } from './mercadoCache';

/* ---------- Viver de renda: juntar um dinheiro tão grande que só o rendimento dele paga as suas contas. Em degraus. ---------- */

const quando = (mes: string, m: number | null) => (m === null ? 'mais de 50 anos' : m === 0 ? 'já chegou' : m < 12 ? `em ${m} ${m === 1 ? 'mês' : 'meses'}` : `em ${somaMes(mes, m).slice(0, 4)} (${Math.round(m / 12)} ${Math.round(m / 12) === 1 ? 'ano' : 'anos'})`);
const mil = (n: number) => (n >= 1_000_000 ? `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} milhão${n >= 2_000_000 ? 'ões' : ''}`.replace('milhãoões', 'milhões') : n >= 10_000 ? `R$ ${Math.round(n / 1000).toLocaleString('pt-BR')} mil` : brl0(n));

export function Renda() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [taxa, setTaxa] = useState<number | ''>(TAXA_RENDA_PADRAO);
  const [aporte, setAporte] = useState(Math.max(100, Math.round((e.investir.aporteMensalPlanejado ?? e.config.renda * 0.1) / 50) * 50) || 300);
  const t = typeof taxa === 'number' ? taxa : 0;
  const gasto = gastoMensalMedio(e, mes);
  const guardado = Math.max(0, patrimonioGuardado(e));
  const alvoMensal = e.config.rendaAlvo ?? Math.round(gasto);
  const degraus = useMemo(() => degrausDeRenda(e.gastosFixos, alvoMensal, guardado, t, aporte), [e.gastosFixos, alvoMensal, guardado, t, aporte]);
  const prio = prioridadeAntesDeInvestir(e, mes, lerCdiMensal());

  if (gasto <= 0)
    return (
      <>
        <Titulo titulo="Viver de renda" sub="Quando o rendimento paga as suas contas." />
        <RespostaFerramenta id="renda" />
        <section className="gs-card destaque">
          <span className="gs-rotulo">Primeiro passo</span>
          <p style={{ margin: '6px 0 10px' }}>Eu preciso saber quanto você gasta por mês pra calcular o seu número.</p>
          <div className="gs-acoes" style={{ marginTop: 0 }}>
            <Link to="/lancamentos?aba=contas" className="gs-btn">Cadastrar contas fixas</Link>
            <Link to="/lancamentos?aba=dia" className="gs-btn sec">Anotar gastos</Link>
          </div>
        </section>
      </>
    );

  const meta = patrimonioParaRenda(alvoMensal, t);
  const rende = rendimentoMensal(guardado, t);
  const mFinal = mesesAteMeta(guardado, meta, aporte, t);
  const mMais = mesesAteMeta(guardado, meta, aporte + 300, t);
  const iProx = degraus.findIndex((d) => !d.feito);
  const prox = iProx >= 0 ? degraus[iProx] : null;
  const serie = (() => {
    const s = [guardado];
    let v = guardado;
    for (let k = 0; k < 600 && v < meta; k++) {
      v = v * (1 + t / 100) + aporte;
      s.push(v);
    }
    return s.filter((_, k, a) => k % Math.max(1, Math.ceil(a.length / 40)) === 0);
  })();

  return (
    <>
      <Titulo titulo="Viver de renda" sub="Quando o rendimento paga as suas contas." />

      <section className="gs-card destaque">
        <span className="gs-rotulo">A ideia em uma frase</span>
        <p className="gs-medio" style={{ margin: '6px 0 12px', fontSize: 20, lineHeight: '27px' }}>Juntar um dinheiro tão grande que só o rendimento dele paga a sua vida, sem você mexer no dinheiro.</p>
        <div className="gs-renda-conta">
          <div><small>Você gasta por mês</small><b>{brl0(alvoMensal)}</b></div>
          <div><small>Pra render isso sozinho, precisa de</small><b>{mil(meta)}</b></div>
          <div><small>Hoje você tem {brl0(guardado)}, que rendem</small><b>{brl0(rende)} por mês</b></div>
        </div>
      </section>

      {prio.passo !== 'investir' && (
        <Dica>
          <b>Esse é o passo depois.</b> {prio.frase} {prio.rota && <Link to={prio.rota} className="gs-btn link">Ver agora</Link>}
        </Dica>
      )}

      <h2 className="gs-h2">Os degraus até lá</h2>
      <p className="gs-mudo" style={{ margin: '-4px 4px 10px', fontSize: 14 }}>Cada degrau é uma conta que o rendimento passa a pagar por você. Guardando {brl0(aporte)} por mês, rendendo {pct(t, 1)} ao mês:</p>
      <ol className="gs-fases">
        {degraus.map((d, i) => {
          const estado = d.feito ? 'feita' : i === iProx ? 'atual' : 'bloqueada';
          return (
            <li key={d.n} className={`gs-fase ${estado}`}>
              <span className="gs-fase-no" aria-hidden="true">{d.feito ? <Check size={16} /> : estado === 'bloqueada' ? <Lock size={14} /> : d.n}</span>
              <div className="gs-corpo">
                <b>{d.titulo}</b>
                <small>O rendimento precisa dar {brl0(d.rendaMes)} por mês: juntar {mil(d.patrimonio)}.</small>
                <small className="gs-fase-meta">{d.feito ? 'conquistado' : quando(mes, d.meses)}</small>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="gs-card">
        <Deslizante rotulo="Quanto guardar por mês pra isso" valor={aporte} min={50} max={5000} passo={50} onChange={setAporte} formato={brl0} />
        <p style={{ margin: '10px 0 0' }}>
          {mFinal === 0 ? 'Você já chegou: o rendimento paga o que você gasta.' : mFinal === null ? 'Nesse ritmo leva mais de 50 anos. Aumente o valor guardado ou comece pelos primeiros degraus.' : <>Guardando {brl0(aporte)} por mês, você vive de renda <b>{quando(mes, mFinal)}</b>.</>}
          {prox && prox.n < degraus.length && prox.meses !== null ? ` O próximo degrau (${prox.titulo.replace(/^Paga (também )?/, '').toLowerCase()}) vem ${quando(mes, prox.meses)}.` : ''}
        </p>
        {mFinal !== null && mMais !== null && mMais < mFinal && <p className="gs-sub" style={{ margin: '8px 0 0' }}>Guardando mais R$ 300 por mês, você chega <b>{Math.round((mFinal - mMais) / 12)} {Math.round((mFinal - mMais) / 12) === 1 ? 'ano' : 'anos'} antes</b>.</p>}
        {mFinal !== null && mFinal > 0 && <Linha serie={serie} fim={somaMes(mes, mFinal).slice(0, 4)} rotulo="Seu dinheiro crescendo até viver de renda" />}
      </section>

      <MaisAjuda titulo="Ajustar o seu número">
        <Deslizante rotulo="Quanto você quer receber por mês" valor={alvoMensal} min={500} max={Math.max(20000, Math.ceil((gasto * 2) / 500) * 500)} passo={100} onChange={(n) => salvarConfig({ rendaAlvo: n })} formato={brl0} extra={`seu gasto médio: ${brl0(gasto)}`} />
        <div style={{ marginTop: 12 }}><CampoNumero rotulo="Quanto o dinheiro rende" sufixo="% ao mês, acima da inflação" valor={taxa} onChange={setTaxa} min={0.1} max={5} passo={0.1} /></div>
        <p className="gs-sub" style={{ marginBottom: 0 }}>
          A conta é simples: o que você quer receber por mês dividido por quanto o dinheiro rende. Com {pct(t, 1)} ao mês, cada R$ 100 mil rendem cerca de {brl0(100000 * (t / 100))} por mês. Use um rendimento <b>acima da inflação</b>, pra que o dinheiro não perca valor com o tempo. Quanto menos você gasta, menor o número.
        </p>
        <p className="gs-nota">Estimativa com os seus números. Não é recomendação de investimento.</p>
      </MaisAjuda>
    </>
  );
}
