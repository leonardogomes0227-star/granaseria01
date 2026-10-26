import { useState } from 'react';
import { useEstado } from './store';
import { gastoMensalMedio, patrimonioGuardado } from './selectores';
import { patrimonioParaRenda, progressoRenda, TAXA_RENDA_PADRAO } from './ferramentas';
import { Aprende, Barra, CampoNumero, Deslizante, Titulo } from './ui';
import { Linha } from './graficos';
import { brl0, mesCurto, mesDe, somaMes } from './datas';
import { useHoje } from './useHoje';
import { Link } from 'react-router-dom';

/* ---------- Liberdade de renda: quanto precisa estar guardado pra os rendimentos pagarem a sua vida ---------- */

export function Renda() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [taxa, setTaxa] = useState<number | ''>(TAXA_RENDA_PADRAO);
  const gasto = gastoMensalMedio(e, mes);
  const alvo = patrimonioParaRenda(gasto, typeof taxa === 'number' ? taxa : 0);
  const guardado = patrimonioGuardado(e);
  const falta = Math.max(0, alvo - guardado);
  const [aporte, setAporte] = useState(300);
  const i = (typeof taxa === 'number' ? taxa : 0) / 100;
  const caminho = (extra: number) => {
    const serie = [guardado];
    let v = guardado;
    while (v < alvo && serie.length <= 600) {
      v = v * (1 + i) + extra;
      serie.push(v);
      if (extra <= 0 && i <= 0) break;
    }
    return { serie, meses: v >= alvo ? serie.length - 1 : null };
  };
  const c0 = caminho(aporte);
  const c1 = caminho(aporte + 300);
  const anos = (m: number) => (m / 12).toFixed(1).replace('.', ',');
  const mes0 = mes;
  return (
    <>
      <Titulo titulo="Liberdade de renda" sub="Quanto você precisa ter guardado pra viver dos rendimentos." />
      {gasto <= 0 ? (
        <div className="gs-card aviso"><p className="gs-sub" style={{ margin: 0 }}>Cadastre suas <Link to="/mes" className="gs-btn link">contas fixas</Link> e anote os gastos do dia a dia. Com eles eu calculo o seu número.</p></div>
      ) : (
        <section className="gs-card destaque">
          <span className="gs-rotulo">Você precisa de</span>
          <p className="gs-grande" style={{ margin: '4px 0 6px' }}>{brl0(alvo)}</p>
          <p className="gs-sub" style={{ margin: '0 0 12px' }}>Pra render {brl0(gasto)} por mês (o seu gasto médio), a {String(taxa).replace('.', ',')}% ao mês.</p>
          <Barra pct={progressoRenda(guardado, alvo)} rotulo="Caminho até a liberdade de renda" />
          <p className="gs-sub" style={{ margin: '10px 0 0' }}>Você já guardou {brl0(guardado)}. {falta > 0 ? `Faltam ${brl0(falta)}.` : 'Você chegou lá.'}</p>
        </section>
      )}
      {gasto > 0 && falta > 0 && (
        <section className="gs-card">
          <span className="gs-rotulo">Seu caminho</span>
          <Deslizante rotulo="Quanto guarda por mês" valor={aporte} min={0} max={5000} passo={50} onChange={setAporte} formato={brl0} />
          {c0.meses !== null ? (
            <>
              <p style={{ margin: '6px 0 0' }}>Você chega em <b>{mesCurto(somaMes(mes0, c0.meses))}</b>, daqui a {anos(c0.meses)} anos.</p>
              <Linha serie={c0.serie.filter((_, k) => k % Math.max(1, Math.ceil(c0.serie.length / 40)) === 0)} fim={mesCurto(somaMes(mes0, c0.meses))} rotulo="Patrimônio até a liberdade de renda" />
              {c1.meses !== null && c1.meses < c0.meses && <p className="gs-sub" style={{ margin: '8px 0 0' }}>Guardando mais R$ 300 por mês, você antecipa <b>{anos(c0.meses - c1.meses)} anos</b>.</p>}
            </>
          ) : (
            <p className="gs-sub" style={{ margin: '6px 0 0' }}>Nesse ritmo leva mais de 50 anos. Aumente o valor guardado.</p>
          )}
        </section>
      )}
      <section className="gs-card">
        <CampoNumero rotulo="Rendimento esperado" sufixo="% ao mês" valor={taxa} onChange={setTaxa} min={0.1} max={5} passo={0.1} />
        <p className="gs-nota">Estimativa com os seus números. Não é recomendação de investimento. Mude a taxa pra ver como o número muda.</p>
      </section>
      <Aprende titulo="De onde vem esse número?" texto="É o seu gasto mensal dividido pela taxa de rendimento. Se o dinheiro guardado rende o que você gasta por mês, você não precisa mais trabalhar só pra pagar as contas. Quanto menos você gasta, menor o número." />
    </>
  );
}
