import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { gastoMensalMedio, patrimonioGuardado } from './selectores';
import { patrimonioParaRenda, TAXA_RENDA_PADRAO } from './ferramentas';
import { Agora, Barra, CampoNumero, Conquistas, Deslizante, Heroi, MaisAjuda, Titulo } from './ui';
import { Linha } from './graficos';
import { brl0, mesCurto, mesDe, somaMes } from './datas';
import { salvarConfig } from './acoes';
import { coberturaPct, conquistasRenda, contasCobertas, mesesAteMeta, rendimentoMensal } from './rendaLogica';

/* ---------- Viver de renda: quanto o seu dinheiro já rende, o que isso paga e quanto falta ---------- */

const anos = (m: number) => (m / 12).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function Renda() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [taxa, setTaxa] = useState<number | ''>(TAXA_RENDA_PADRAO);
  const [aporte, setAporte] = useState(300);
  const t = typeof taxa === 'number' ? taxa : 0;
  const gasto = gastoMensalMedio(e, mes);
  const guardado = patrimonioGuardado(e);
  if (gasto <= 0)
    return (
      <>
        <Titulo titulo="Viver de renda" sub="Quando o seu dinheiro paga a sua vida." />
        <section className="gs-card destaque">
          <span className="gs-rotulo">Primeiro passo</span>
          <p style={{ margin: '6px 0 10px' }}>Eu preciso saber quanto você gasta por mês pra calcular o seu número.</p>
          <div className="gs-acoes" style={{ marginTop: 0 }}>
            <Link to="/mes" className="gs-btn">Cadastrar contas fixas</Link>
            <Link to="/mes?aba=dia" className="gs-btn sec">Anotar gastos</Link>
          </div>
        </section>
      </>
    );
  const alvoMensal = e.config.rendaAlvo ?? Math.round(gasto);
  const meta = patrimonioParaRenda(alvoMensal, t);
  const rende = rendimentoMensal(guardado, t);
  const cobre = coberturaPct(rende, alvoMensal);
  const falta = Math.max(0, meta - guardado);
  const m0 = mesesAteMeta(guardado, meta, aporte, t);
  const m1 = mesesAteMeta(guardado, meta, aporte + 300, t);
  const serie = (() => {
    const s = [guardado];
    let v = guardado;
    for (let k = 0; k < 600 && v < meta; k++) {
      v = v * (1 + t / 100) + aporte;
      s.push(v);
    }
    return s.filter((_, k, a) => k % Math.max(1, Math.ceil(a.length / 40)) === 0);
  })();
  const cobertas = contasCobertas(e.gastosFixos, rende);
  const proxima = [...e.gastosFixos].sort((a, b) => a.valor - b.valor).find((g) => !cobertas.includes(g.nome));
  const completa = falta <= 0;
  return (
    <>
      <Titulo titulo="Viver de renda" sub="Quando o seu dinheiro paga a sua vida." />
      <Heroi pct={cobre} anel={`${cobre < 1 && cobre > 0 ? '<1' : Math.round(cobre)}%`} anelSub="coberto" rotulo="Seu dinheiro já rende" grande={`${brl0(rende)}/mês`} sub={`de ${brl0(alvoMensal)} que você quer por mês`} cor="var(--success)" />
      <Agora tom={completa ? 'ok' : 'dica'} texto={completa ? 'Você chegou lá: os rendimentos pagam o que você quer por mês.' : m0 !== null ? `Faltam ${brl0(falta)}. Guardando ${brl0(aporte)} por mês, você chega em ${mesCurto(somaMes(mes, m0))} (daqui a ${anos(m0)} anos).` : `Faltam ${brl0(falta)}. Nesse ritmo leva mais de 50 anos: aumente o valor guardado.`}>
        {!completa && (
          <>
            <div style={{ marginTop: 12 }}><Deslizante rotulo="Quanto guardar por mês" valor={aporte} min={0} max={5000} passo={50} onChange={setAporte} formato={brl0} /></div>
            {m0 !== null && <Linha serie={serie} fim={mesCurto(somaMes(mes, m0))} rotulo="Patrimônio até a liberdade de renda" />}
            {m0 !== null && m1 !== null && m1 < m0 && <p className="gs-sub" style={{ margin: '8px 0 0' }}>Guardando mais R$ 300 por mês, você antecipa <b>{anos(m0 - m1)} anos</b>.</p>}
          </>
        )}
      </Agora>
      {(cobertas.length > 0 || proxima) && (
        <section className="gs-card">
          <span className="gs-rotulo">O que o seu dinheiro já paga</span>
          {cobertas.length > 0 ? <p style={{ margin: '6px 0 0' }}>{cobertas.join(', ')}.</p> : <p style={{ margin: '6px 0 0' }}>Ainda nenhuma conta inteira.</p>}
          {proxima && <p className="gs-sub" style={{ margin: '6px 0 0' }}>Próxima: <b>{proxima.nome}</b> ({brl0(proxima.valor)}). Faltam {brl0(Math.max(0, (proxima.valor - rende) / (t / 100)))} guardados.</p>}
          <Barra pct={Math.min(100, (guardado / meta) * 100)} tom="ok" rotulo="Caminho até a meta" />
          <p className="gs-mudo" style={{ margin: '6px 0 0', fontSize: 13 }}>{brl0(guardado)} guardados de {brl0(meta)}</p>
        </section>
      )}
      <Conquistas lista={conquistasRenda(cobre)} />
      <MaisAjuda>
        <Deslizante rotulo="Quanto você quer receber por mês" valor={alvoMensal} min={500} max={Math.max(20000, Math.ceil((gasto * 2) / 500) * 500)} passo={100} onChange={(n) => salvarConfig({ rendaAlvo: n })} formato={brl0} extra={`seu gasto médio: ${brl0(gasto)}`} />
        <div style={{ marginTop: 12 }}><CampoNumero rotulo="Rendimento esperado" sufixo="% ao mês" valor={taxa} onChange={setTaxa} min={0.1} max={5} passo={0.1} /></div>
        <p className="gs-nota">Estimativa com os seus números. Não é recomendação de investimento. Mude a taxa pra ver como o número muda.</p>
        <p className="gs-sub" style={{ marginBottom: 0 }}>O número é o que você quer receber por mês dividido pela taxa de rendimento. Se o dinheiro guardado rende o que você gasta, você não precisa mais trabalhar só pra pagar as contas. Quanto menos você gasta, menor o número.</p>
      </MaisAjuda>
    </>
  );
}
