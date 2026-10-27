import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { compararOfertas } from './ferramentas';
import { configurarAssistente, salvarDivida } from './acoes';
import { Agora, CampoDinheiro, CampoNumero, Dica, Heroi, MaisAjuda, Titulo } from './ui';
import { Barras } from './graficos';
import { avaliarOferta, ofertaComoDivida } from './emprestimosLogica';
import { capacidadeDePagamento } from './painelDividas';
import { gastoMensalMedio } from './selectores';
import { maiorJuroMensal } from './dividas';
import { brl0, mesDe, pct } from './datas';
import { toast } from '../components/ui/Toast';

/* ---------- Empréstimos: compare ofertas pelo custo real, veja se cabe no bolso e se compensa trocar dívida ---------- */

interface Of {
  valor: number;
  parcelas: number | '';
  parcela: number;
}
const VAZIA: Of = { valor: 0, parcelas: '', parcela: 0 };

function carregar(e: ReturnType<typeof useEstado>): Of[] {
  try {
    const v = JSON.parse(String(e.agentes.emprestimos?.config.ofertas ?? '[]')) as Of[];
    return Array.isArray(v) && v.length >= 2 ? v.slice(0, 3) : [{ ...VAZIA }, { ...VAZIA }];
  } catch {
    return [{ ...VAZIA }, { ...VAZIA }];
  }
}

export function Emprestimos() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [ofertas, setOfertas] = useState<Of[]>(() => carregar(e));
  const validas = ofertas.map((o, i) => ({ o, i })).filter(({ o }) => o.valor > 0 && typeof o.parcelas === 'number' && o.parcelas > 0 && o.parcela > 0);
  const r = useMemo(() => compararOfertas(validas.map(({ o }) => ({ valor: o.valor, parcelas: o.parcelas as number, parcela: o.parcela }))), [validas.length, JSON.stringify(ofertas)]); // eslint-disable-line react-hooks/exhaustive-deps
  const muda = (i: number, p: Partial<Of>) => setOfertas((os) => os.map((o, k) => (k === i ? { ...o, ...p } : o)));
  const ctx = { renda: e.config.renda, capacidade: capacidadeDePagamento(e.config.renda, gastoMensalMedio(e, mes)), horasMes: e.config.horasMes, maiorJuroDivida: maiorJuroMensal(e.dividas) };
  const melhor = r.melhor >= 0 ? r.custos[r.melhor] : null;
  const aval = melhor ? avaliarOferta(melhor, ctx) : null;
  const contratar = (k: number) => {
    const c = r.custos[k];
    const n = validas[k].i + 1;
    if (salvarDivida(ofertaComoDivida(c, `Empréstimo (oferta ${n})`))) toast('Anotado em Quitar dívidas. Cadastre o dia do vencimento lá pra eu te avisar.');
  };
  return (
    <>
      <Titulo titulo="Comparar empréstimos" sub="Coloque 2 ou 3 ofertas. Eu mostro quanto cada uma custa de verdade." />
      {melhor && (
        <Heroi pct={r.custos.length > 1 && r.custos[r.custos.length - 1] ? Math.min(100, (melhor.juros / Math.max(1, melhor.valor)) * 100) : 0} anel={`${Math.round((melhor.juros / Math.max(1, melhor.valor)) * 100)}%`} anelSub="de juros" rotulo={r.custos.length > 1 ? `Mais barata: oferta ${validas[r.melhor].i + 1} · juros` : 'Essa oferta custa em juros'} grande={brl0(melhor.juros)} sub={`Você paga ${brl0(melhor.total)} no total${melhor.taxaMensal !== null ? ` · ${pct(melhor.taxaMensal, 2)} ao mês` : ''}${r.custos.length > 1 && r.diferenca > 0 ? ` · economiza ${brl0(r.diferenca)} contra a mais cara` : ''}`} cor="var(--gold-strong)" />
      )}
      {melhor && aval && (
        <Agora tom={aval.cabe === false ? 'perigo' : aval.trocaCompensa === false ? 'aviso' : 'ok'} texto={aval.cabe === false ? `A parcela de ${brl0(melhor.parcela)} é maior do que sobra por mês (cerca de ${brl0(ctx.capacidade)}). Pode apertar demais.` : aval.cabe ? `A parcela de ${brl0(melhor.parcela)} cabe: hoje sobram cerca de ${brl0(ctx.capacidade)} por mês.` : 'Cadastre sua renda e seus gastos pra eu dizer se a parcela cabe.'}>
          {aval.pesoRenda !== null && <p className="gs-sub" style={{ margin: '8px 0 0' }}>A parcela pesa <b>{Math.round(aval.pesoRenda)}%</b> da sua renda.{aval.juroDeTrabalho ? ` Só o juro custa cerca de ${aval.juroDeTrabalho} horas do seu trabalho.` : ''}</p>}
          {aval.trocaCompensa !== null && (aval.trocaCompensa
            ? <p className="gs-banner" style={{ marginBottom: 0 }}>Essa taxa é <b>menor que a da sua dívida mais cara</b> ({pct(ctx.maiorJuroDivida, 1)} ao mês). Se for pra quitar essa dívida, compensa. <Link to="/plano/dividas">Ver dívidas</Link></p>
            : <p className="gs-banner" style={{ marginBottom: 0 }}>Essa taxa <b>não é menor</b> que a da sua dívida mais cara ({pct(ctx.maiorJuroDivida, 1)} ao mês). Trocar não ajuda.</p>)}
        </Agora>
      )}

      {ofertas.map((o, i) => (
        <section className="gs-card" key={i}>
          <p className="gs-rotulo">Oferta {i + 1}</p>
          <CampoDinheiro rotulo="Valor que você recebe" valor={o.valor} onChange={(n) => muda(i, { valor: n })} />
          <div className="gs-dois">
            <CampoNumero rotulo="Parcelas" valor={o.parcelas} onChange={(n) => muda(i, { parcelas: n })} min={1} max={480} placeholder="Ex.: 24" />
            <CampoDinheiro rotulo="Valor da parcela" valor={o.parcela} onChange={(n) => muda(i, { parcela: n })} />
          </div>
          {validas.some((v) => v.i === i) && (() => {
            const k = validas.findIndex((v) => v.i === i);
            const c = r.custos[k];
            return (
              <>
                <p className="gs-sub" style={{ margin: '0 0 8px' }}>Total {brl0(c.total)} · <b>{brl0(c.juros)} de juros</b>{c.taxaMensal !== null ? ` · ${pct(c.taxaMensal, 2)} ao mês` : ''}{k === r.melhor && r.custos.length > 1 ? ' · mais barata' : ''}</p>
                <button type="button" className="gs-btn sec" onClick={() => contratar(k)}>Vou contratar essa</button>
              </>
            );
          })()}
        </section>
      ))}
      {ofertas.length < 3 && <button type="button" className="gs-btn sec cheio" onClick={() => setOfertas((os) => [...os, { ...VAZIA }])}>+ Terceira oferta</button>}
      {r.custos.length > 1 && (
        <section className="gs-card">
          <span className="gs-rotulo">Quanto de cada oferta é juros</span>
          <Barras dados={r.custos.map((c) => [c.valor, Math.max(0, c.juros)] as [number, number])} rotulos={validas.map(({ i }) => `Oferta ${i + 1}`)} nomes={['Valor recebido', 'Juros']} rotulo="Valor recebido e juros por oferta" />
        </section>
      )}
      {r.custos.length > 0 && <button type="button" className="gs-btn cheio" style={{ marginTop: 12 }} onClick={() => { configurarAssistente('emprestimos', { ofertas: JSON.stringify(ofertas) }); toast('Comparação salva'); }}>Salvar comparação</button>}
      {r.custos.length === 0 && <p className="gs-mudo">Preencha valor, parcelas e a parcela de pelo menos uma oferta. Peça ao banco também o CET (custo efetivo total).</p>}

      <MaisAjuda>
        <Dica>Compare sempre o total que você paga, não só a parcela. Parcela pequena em muitos meses costuma custar mais.</Dica>
        <p className="gs-sub" style={{ marginBottom: 0 }}>A taxa ao mês é o juro de verdade que você paga a cada mês, já contando todas as parcelas. Dois bancos podem anunciar parcelas parecidas e cobrar taxas bem diferentes. Por isso eu calculo a taxa a partir do valor e das parcelas. Confira também seguro, tarifas e IOF: eles entram no valor da parcela.</p>
      </MaisAjuda>
    </>
  );
}
