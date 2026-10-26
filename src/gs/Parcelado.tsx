import { useState } from 'react';
import { analisarParcelado } from './parcelado';
import { CampoDinheiro, CampoNumero, Aprende, Dica, Titulo } from './ui';
import { brl, brl0, pct } from './datas';

/* ---------- À vista ou parcelado? Descubra o juro escondido ---------- */

export function ParceladoTela() {
  const [avista, setAvista] = useState(1800);
  const [n, setN] = useState<number | ''>(10);
  const [parcela, setParcela] = useState(210);
  const parcelas = typeof n === 'number' ? n : 0;
  const r = avista > 0 && parcelas > 0 && parcela > 0 ? analisarParcelado({ avista, parcelas, parcela }) : null;
  return (
    <>
      <Titulo titulo="À vista ou parcelado?" sub="Coloque o preço à vista e o parcelamento da loja. Eu mostro quanto de juro vem escondido." />
      <section className="gs-card">
        <CampoDinheiro rotulo="Preço à vista" valor={avista} onChange={setAvista} grande />
        <div className="gs-dois">
          <CampoNumero rotulo="Parcelas" valor={n} onChange={setN} min={2} max={60} />
          <CampoDinheiro rotulo="Valor da parcela" valor={parcela} onChange={setParcela} />
        </div>
      </section>
      {r && (
        <section className="gs-card destaque">
          <span className="gs-rotulo">O que o parcelado esconde</span>
          {r.semJuros ? (
            <div style={{ background: 'var(--success-bg, #E6EFE1)', borderRadius: 16, padding: 14, marginTop: 8 }}>
              <b className="gs-medio" style={{ fontSize: 20, color: 'var(--success)' }}>Parcelado sem juros</b>
              <p style={{ margin: '4px 0 0' }}>Você paga {brl0(r.total)}, o mesmo valor. Vale parcelar se o dinheiro rende mais parado.</p>
            </div>
          ) : (
            <div style={{ background: r.taxaMensalPct > 3 ? '#F5E1DC' : '#F8EBCF', borderRadius: 16, padding: 14, marginTop: 8 }}>
              <b className="gs-medio" style={{ fontSize: 20, color: r.taxaMensalPct > 3 ? 'var(--danger)' : 'var(--warning)' }}>Você paga {brl0(r.jurosPagos)} a mais</b>
              <p style={{ margin: '4px 0 0' }}>Total {brl0(r.total)} contra {brl0(avista)} à vista. Juro de <b>{pct(r.taxaMensalPct, 2)} ao mês</b> ({r.taxaAnualPct}% ao ano).</p>
            </div>
          )}
          <Dica>Peça desconto à vista: 5% a 10% é comum. Com 7%, você pagaria <b>{brl(r.comDescontoAvista)}</b> e economizaria {brl0(r.economiaComDesconto)} em relação ao parcelado.</Dica>
        </section>
      )}
      <Aprende titulo="A parcela pequena engana" texto="A parcela cabe no mês, e é por isso que o parcelado vende. Mas o preço de verdade é o total e a taxa por mês. Se a loja dá o mesmo preço nos dois, parcele. Se não, o juro está na parcela." />
    </>
  );
}
