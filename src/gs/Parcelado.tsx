import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { analisarParcelado } from './parcelado';
import { comprarNoCartao, esperar72h } from './acoes';
import { Agora, Campo, CampoDinheiro, CampoNumero, Deslizante, Heroi, MaisAjuda, Titulo } from './ui';
import { brl, brl0, mesDe, pct } from './datas';
import { livreParaGastar } from './selectores';
import { toast } from '../components/ui/Toast';

/* ---------- À vista ou parcelado? Descubra o juro escondido e decida com o seu mês na mão ---------- */

export function ParceladoTela() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [item, setItem] = useState('');
  const [avista, setAvista] = useState(0);
  const [n, setN] = useState<number | ''>('');
  const [parcela, setParcela] = useState(0);
  const [desc, setDesc] = useState(7);
  const parcelas = typeof n === 'number' ? n : 0;
  const r = avista > 0 && parcelas > 1 && parcela > 0 ? analisarParcelado({ avista, parcelas, parcela, descontoAvistaPct: desc }) : null;
  const livre = livreParaGastar(e, mes);
  const pesoRenda = e.config.renda > 0 && parcela > 0 ? (parcela / e.config.renda) * 100 : null;
  const tom = !r ? 'ok' : r.semJuros ? 'ok' : r.taxaMensalPct > 3 ? 'perigo' : 'aviso';
  const veredito = !r
    ? ''
    : r.semJuros
      ? 'Sem juros: parcelar é bom, o preço é o mesmo e o seu dinheiro fica livre.'
      : r.taxaMensalPct <= 1.5
        ? `Juro baixo (${pct(r.taxaMensalPct, 2)} ao mês). Se o dinheiro à vista fica rendendo mais que isso, parcele. Senão, pague à vista.`
        : r.taxaMensalPct <= 3
          ? `Juro alto (${pct(r.taxaMensalPct, 2)} ao mês). Se tiver o dinheiro, pague à vista e peça desconto.`
          : `Juro muito alto (${pct(r.taxaMensalPct, 2)} ao mês). Evite: junte o dinheiro e compre à vista.`;
  return (
    <>
      <Titulo titulo="À vista ou parcelado?" sub="Digite o preço à vista e o parcelamento da loja. Eu mostro o juro escondido." />
      <section className="gs-card">
        <Campo rotulo="O que você quer comprar? (opcional)" valor={item} onChange={setItem} placeholder="Ex.: geladeira" maxLength={60} />
        <CampoDinheiro rotulo="Preço à vista" valor={avista} onChange={setAvista} grande />
        <div className="gs-dois">
          <CampoNumero rotulo="Parcelas" valor={n} onChange={setN} min={2} max={60} placeholder="Ex.: 10" />
          <CampoDinheiro rotulo="Valor da parcela" valor={parcela} onChange={setParcela} />
        </div>
        {!r && <p className="gs-nota" style={{ marginTop: -4 }}>Preencha os três campos pra ver o resultado.</p>}
      </section>
      {r && (
        <>
          <Heroi pct={Math.min(100, (r.jurosPagos / avista) * 100)} anel={r.semJuros ? '0%' : `${Math.round((r.jurosPagos / avista) * 100)}%`} anelSub="de juros" rotulo={r.semJuros ? 'Parcelado sem juros' : 'Você paga a mais'} grande={r.semJuros ? brl0(r.total) : brl0(r.jurosPagos)} sub={r.semJuros ? 'o mesmo valor do à vista' : `${brl0(r.total)} contra ${brl0(avista)} · ${pct(r.taxaMensalPct, 2)} ao mês (${r.taxaAnualPct}% ao ano)`} cor={tom === 'perigo' ? 'var(--danger)' : tom === 'aviso' ? 'var(--gold-strong)' : 'var(--success)'} />
          <Agora tom={tom} texto={veredito}>
            {pesoRenda !== null && <p className="gs-sub" style={{ margin: '8px 0 0' }}>A parcela pesa <b>{Math.round(pesoRenda)}%</b> da sua renda por {parcelas} meses.{livre < parcela ? ` Hoje só restam ${brl0(Math.max(0, livre))} livres neste mês.` : ''}</p>}
            <div className="gs-acoes">
              {e.cartao && <button type="button" className="gs-btn" onClick={() => { if (comprarNoCartao({ descricao: item || 'Compra parcelada', valor: r.total, parcelas })) toast('Anotado no cartão. As parcelas aparecem nas próximas faturas.'); }}>Anotar no cartão</button>}
              <button type="button" className="gs-btn sec" onClick={() => { if (esperar72h(item || 'Compra parcelada', avista)) toast('Combinado: espere 72 horas e decida de cabeça fria.'); }}>Esperar 72h</button>
            </div>
            {!e.cartao && <p className="gs-nota">Se parcelar no cartão, cadastre o cartão em <Link to="/plano/cartao">Cartão de crédito</Link> pra ver as parcelas nas próximas faturas.</p>}
          </Agora>
        </>
      )}
      <MaisAjuda>
        {r && (
          <>
            <Deslizante rotulo="Desconto que você consegue à vista" valor={desc} min={0} max={20} passo={1} formato={(v) => `${v}%`} onChange={setDesc} />
            <p style={{ margin: '4px 0 12px' }}>Com {desc}% de desconto você pagaria <b>{brl(r.comDescontoAvista)}</b> e economizaria <b>{brl0(r.economiaComDesconto)}</b> em relação ao parcelado.</p>
          </>
        )}
        <p className="gs-sub" style={{ margin: 0 }}>A parcela pequena engana: ela cabe no mês, por isso o parcelado vende. O preço de verdade é o total e a taxa por mês. Se a loja dá o mesmo preço nos dois, parcele. Se não, o juro está na parcela. Peça sempre o desconto à vista.</p>
      </MaisAjuda>
    </>
  );
}
