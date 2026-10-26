import { useMemo, useState } from 'react';
import { useEstado } from './store';
import { compararOfertas } from './ferramentas';
import { configurarAssistente } from './acoes';
import { Aprende, CampoDinheiro, CampoNumero, Dica, Titulo } from './ui';
import { Barras } from './graficos';
import { brl, brl0, pct } from './datas';
import { toast } from '../components/ui/Toast';

/* ---------- Empréstimos: compare ofertas pelo custo real (o que você paga a mais) ---------- */

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
  const [ofertas, setOfertas] = useState<Of[]>(() => carregar(e));
  const validas = ofertas.map((o, i) => ({ o, i })).filter(({ o }) => o.valor > 0 && typeof o.parcelas === 'number' && o.parcelas > 0 && o.parcela > 0);
  const r = useMemo(() => compararOfertas(validas.map(({ o }) => ({ valor: o.valor, parcelas: o.parcelas as number, parcela: o.parcela }))), [validas.length, JSON.stringify(ofertas)]); // eslint-disable-line react-hooks/exhaustive-deps
  const muda = (i: number, p: Partial<Of>) => setOfertas((os) => os.map((o, k) => (k === i ? { ...o, ...p } : o)));
  return (
    <>
      <Titulo titulo="Empréstimos" sub="Coloque 2 ou 3 ofertas. Eu mostro quanto cada uma custa de verdade." />
      {ofertas.map((o, i) => (
        <section className="gs-card" key={i}>
          <p className="gs-rotulo">Oferta {i + 1}</p>
          <CampoDinheiro rotulo="Valor que você recebe" valor={o.valor} onChange={(n) => muda(i, { valor: n })} />
          <div className="gs-dois">
            <CampoNumero rotulo="Parcelas" valor={o.parcelas} onChange={(n) => muda(i, { parcelas: n })} min={1} max={480} placeholder="Ex.: 24" />
            <CampoDinheiro rotulo="Valor da parcela" valor={o.parcela} onChange={(n) => muda(i, { parcela: n })} />
          </div>
        </section>
      ))}
      {ofertas.length < 3 && <button type="button" className="gs-btn sec cheio" onClick={() => setOfertas((os) => [...os, { ...VAZIA }])}>+ Terceira oferta</button>}
      {r.custos.length > 0 ? (
        <>
          <h2 className="gs-h2">O custo de cada uma</h2>
          {r.custos.map((c, k) => (
            <div className={`gs-card ${k === r.melhor && r.custos.length > 1 ? 'destaque' : ''}`} key={k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b className="gs-medio" style={{ fontSize: 20 }}>Oferta {validas[k].i + 1}</b>
                {k === r.melhor && r.custos.length > 1 && <span className="gs-etiqueta ok">Mais barata</span>}
              </div>
              <p className="gs-sub" style={{ margin: '6px 0 0' }}>
                Você paga {brl0(c.total)} no total: <b>{brl0(c.juros)} só de juros</b>{c.taxaMensal !== null ? `, ${pct(c.taxaMensal, 2)} ao mês` : ''}.
              </p>
            </div>
          ))}
          <section className="gs-card">
            <span className="gs-rotulo">Quanto de cada oferta é juros</span>
            <Barras dados={r.custos.map((c) => [c.valor, Math.max(0, c.juros)] as [number, number])} rotulos={validas.map(({ i }) => `Oferta ${i + 1}`)} nomes={['Valor recebido', 'Juros']} rotulo="Valor recebido e juros por oferta" />
          </section>
          {r.custos.length > 1 && r.diferenca > 0 && <p className="gs-banner">A mais barata economiza <b>{brl(r.diferenca)}</b> em relação à mais cara.</p>}
          <button type="button" className="gs-btn cheio" onClick={() => { configurarAssistente('emprestimos', { ofertas: JSON.stringify(ofertas) }); toast('Comparação salva'); }}>Salvar comparação</button>
        </>
      ) : (
        <p className="gs-mudo">Preencha valor, parcelas e a parcela de pelo menos uma oferta.</p>
      )}
      <Dica>Compare sempre o total que você paga, não só a parcela. Parcela pequena em muitos meses costuma custar mais.</Dica>
      <Aprende titulo="O que é a taxa ao mês?" texto="É o juro de verdade que você paga a cada mês, já contando todas as parcelas. Dois bancos podem anunciar parcelas parecidas e cobrar taxas bem diferentes. Por isso eu calculo a taxa a partir do valor e das parcelas." />
    </>
  );
}
