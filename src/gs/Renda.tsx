import { useState } from 'react';
import { useEstado } from './store';
import { gastoMensalMedio, patrimonioGuardado } from './selectores';
import { patrimonioParaRenda, progressoRenda, TAXA_RENDA_PADRAO } from './ferramentas';
import { Barra, CampoNumero, Titulo } from './ui';
import { brl0, mesDe } from './datas';
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
      <section className="gs-card">
        <CampoNumero rotulo="Rendimento esperado" sufixo="% ao mês" valor={taxa} onChange={setTaxa} min={0.1} max={5} passo={0.1} />
        <p className="gs-nota">Estimativa com os seus números. Não é recomendação de investimento. Mude a taxa pra ver como o número muda.</p>
      </section>
    </>
  );
}
