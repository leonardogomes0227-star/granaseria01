import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { compararOfertas } from './ferramentas';
import { configurarAssistente, salvarDivida } from './acoes';
import { Agora, CampoDinheiro, CampoNumero, Dica, Heroi, MaisAjuda, Titulo } from './ui';
import { Barras } from './graficos';
import { avaliarOferta, custoDoEmprestimo, ofertaComoDivida, porPrazo, TAXAS_TIPICAS } from './emprestimosLogica';
import { capacidadeDePagamento } from './painelDividas';
import { gastoMensalMedio } from './selectores';
import { maiorJuroMensal } from './dividas';
import { brl0, mesDe, pct } from './datas';
import { toast } from '../components/ui/Toast';

/* ---------- Empréstimos: quanto custa um empréstimo (juros, taxa ao mês e ao ano, por prazo) e comparar ofertas ---------- */

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
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'comparar' ? 'comparar' : 'custa';
  return (
    <>
      <Titulo titulo="Empréstimo" sub="Veja quanto ele custa de verdade." />
      <div className="gs-seg" role="tablist" aria-label="Empréstimo" style={{ marginBottom: 14 }}>
        <button type="button" role="tab" aria-selected={aba === 'custa'} className={aba === 'custa' ? 'on' : ''} onClick={() => setParams({})}>Quanto custa</button>
        <button type="button" role="tab" aria-selected={aba === 'comparar'} className={aba === 'comparar' ? 'on' : ''} onClick={() => setParams({ aba: 'comparar' })}>Comparar ofertas</button>
      </div>
      {aba === 'custa' ? <QuantoCusta onComparar={() => setParams({ aba: 'comparar' })} /> : <Comparar />}
    </>
  );
}

/* ---------- quanto custa: valor, prazo e a parcela ou a taxa ---------- */
const PRAZOS = [6, 12, 24, 36, 48];

function QuantoCusta({ onComparar }: { onComparar: () => void }) {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [valor, setValor] = useState(0);
  const [parcelas, setParcelas] = useState<number | ''>(24);
  const [modo, setModo] = useState<'taxa' | 'parcela'>('taxa');
  const [taxa, setTaxa] = useState<number | ''>('');
  const [parcela, setParcela] = useState(0);
  const n = typeof parcelas === 'number' ? parcelas : 0;
  const c = custoDoEmprestimo(modo === 'taxa' ? { valor, parcelas: n, taxaMensalPct: typeof taxa === 'number' ? taxa : undefined } : { valor, parcelas: n, parcela });
  const ctx = { renda: e.config.renda, capacidade: capacidadeDePagamento(e.config.renda, gastoMensalMedio(e, mes)), horasMes: e.config.horasMes, maiorJuroDivida: maiorJuroMensal(e.dividas) };
  const aval = c ? avaliarOferta(c, ctx) : null;
  const tabela = c && c.taxaMensal !== null ? porPrazo(valor, c.taxaMensal, PRAZOS.includes(n) ? PRAZOS : [...PRAZOS, n].sort((a, b) => a - b)) : [];
  const pctRecebe = c ? (c.valor / c.total) * 100 : 100;
  return (
    <>
      <section className="gs-card">
        <CampoDinheiro rotulo="Quanto você quer pegar?" valor={valor} onChange={setValor} grande />
        <span className="gs-rotulo">Em quantas vezes?</span>
        <div className="gs-chips" role="group" aria-label="Parcelas" style={{ marginTop: 6 }}>
          {PRAZOS.map((x) => <button key={x} type="button" className={`gs-chip ${parcelas === x ? 'on' : ''}`} aria-pressed={parcelas === x} onClick={() => setParcelas(x)}>{x}x</button>)}
        </div>
        <CampoNumero rotulo="Outro número de parcelas" valor={parcelas} onChange={setParcelas} min={1} max={480} placeholder="Ex.: 18" />
        <span className="gs-rotulo">O que o banco te disse?</span>
        <div className="gs-seg" role="tablist" aria-label="O que você sabe" style={{ margin: '6px 0 12px' }}>
          <button type="button" role="tab" aria-selected={modo === 'taxa'} className={modo === 'taxa' ? 'on' : ''} onClick={() => setModo('taxa')}>A taxa de juros</button>
          <button type="button" role="tab" aria-selected={modo === 'parcela'} className={modo === 'parcela' ? 'on' : ''} onClick={() => setModo('parcela')}>O valor da parcela</button>
        </div>
        {modo === 'taxa' ? (
          <>
            <CampoNumero rotulo="Taxa" sufixo="% ao mês" valor={taxa} onChange={setTaxa} min={0} max={30} placeholder="Ex.: 3,5" />
            <p className="gs-nota" style={{ marginTop: -6 }}>Não sabe? Toque numa taxa típica (é só ponto de partida, cada banco cobra a sua):</p>
            <div className="gs-chips" role="group" aria-label="Taxas típicas">
              {TAXAS_TIPICAS.map((t) => <button key={t.nome} type="button" className={`gs-chip ${taxa === t.taxa ? 'on' : ''}`} onClick={() => setTaxa(t.taxa)}>{t.nome} · {pct(t.taxa, 1)}</button>)}
            </div>
          </>
        ) : (
          <CampoDinheiro rotulo="Valor de cada parcela" valor={parcela} onChange={setParcela} />
        )}
      </section>

      {c ? (
        <>
          <section className="gs-card destaque">
            <span className="gs-rotulo">Você recebe {brl0(c.valor)} e devolve</span>
            <p className="gs-grande" style={{ margin: '4px 0' }}>{brl0(c.total)}</p>
            <p className="gs-sub" style={{ margin: 0 }}>{c.juros > 0 ? <>São <b>{brl0(c.juros)} de juros</b>: {pct(c.pctJuros, 0)} a mais do que você pegou.</> : 'Sem juros.'}</p>
            <div className="gs-emp-barra" role="img" aria-label={`${brl0(c.valor)} do valor e ${brl0(c.juros)} de juros`}>
              <i style={{ width: `${pctRecebe}%` }}><span>{brl0(c.valor)}</span></i>
              {c.juros > 0 && <b style={{ width: `${100 - pctRecebe}%` }}><span>{brl0(c.juros)}</span></b>}
            </div>
            <div className="gs-emp-legenda"><span><i className="a" /> o que você pegou</span><span><i className="b" /> juros</span></div>
          </section>

          <div className="gs-tres" style={{ margin: '12px 0' }}>
            <div><span className="gs-mudo">Parcela</span><b className="gs-tab">{brl0(c.parcela)}</b></div>
            <div><span className="gs-mudo">Juro ao mês</span><b className="gs-tab">{c.taxaMensal !== null ? pct(c.taxaMensal, 1) : '—'}</b></div>
            <div><span className="gs-mudo">Juro ao ano</span><b className="gs-tab">{c.taxaAnual !== null ? pct(c.taxaAnual, 0) : '—'}</b></div>
          </div>

          {aval && (
            <Agora tom={aval.cabe === false ? 'perigo' : aval.cabe ? 'ok' : 'dica'} texto={aval.cabe === false ? `A parcela de ${brl0(c.parcela)} é maior do que sobra por mês (cerca de ${brl0(ctx.capacidade)}). Vai apertar.` : aval.cabe ? `A parcela de ${brl0(c.parcela)} cabe: hoje sobram cerca de ${brl0(ctx.capacidade)} por mês.` : 'Cadastre sua renda e suas contas pra eu dizer se a parcela cabe.'}>
              {aval.juroDeTrabalho ? <p className="gs-sub" style={{ margin: '8px 0 0' }}>Só os juros custam cerca de <b>{aval.juroDeTrabalho} horas</b> do seu trabalho.</p> : null}
              {aval.trocaCompensa === true && <p className="gs-sub" style={{ margin: '8px 0 0' }}>A taxa é menor que a da sua dívida mais cara ({pct(ctx.maiorJuroDivida, 1)} ao mês): pra quitar ela, compensa.</p>}
            </Agora>
          )}

          {tabela.length > 1 && (
            <section className="gs-card">
              <span className="gs-rotulo">O mesmo empréstimo em outros prazos</span>
              {tabela.map((t) => (
                <div key={t.parcelas} className={`gs-linha ${t.parcelas === c.parcelas ? 'gs-emp-atual' : ''}`} style={{ minHeight: 48 }}>
                  <div className="gs-corpo"><b>{t.parcelas}x de {brl0(t.parcela)}</b><small>{t.parcelas === c.parcelas ? 'o que você está vendo' : t.juros < c.juros ? `${brl0(c.juros - t.juros)} a menos de juros` : `${brl0(t.juros - c.juros)} a mais de juros`}</small></div>
                  <span className="gs-valor" style={{ color: 'var(--danger)' }}>{brl0(t.juros)}</span>
                </div>
              ))}
              <p className="gs-nota">Parcela menor em mais meses parece mais leve, mas sai mais cara. Escolha o menor prazo em que a parcela cabe.</p>
            </section>
          )}

          <div className="gs-acoes">
            <button type="button" className="gs-btn" onClick={() => { if (salvarDivida(ofertaComoDivida(c, 'Empréstimo'))) toast('Anotado em Quitar dívidas. Cadastre o dia do vencimento lá pra eu te avisar.'); }}>Vou contratar</button>
            <button type="button" className="gs-btn sec" onClick={() => { configurarAssistente('emprestimos', { ofertas: JSON.stringify([{ valor: c.valor, parcelas: c.parcelas, parcela: c.parcela }, { ...VAZIA }]) }); onComparar(); }}>Comparar com outra oferta</button>
          </div>
        </>
      ) : (
        <p className="gs-mudo" style={{ margin: '4px 4px 0' }}>Preencha o valor, as parcelas e a taxa (ou a parcela) pra ver quanto custa.</p>
      )}

      <MaisAjuda>
        <Dica>Peça ao banco o <b>CET</b> (custo efetivo total): é a taxa com tudo dentro (juros, seguro, tarifas e IOF). Use ele aqui no lugar da taxa.</Dica>
        <p className="gs-sub" style={{ marginBottom: 0 }}>Juro ao ano não é juro ao mês vezes 12: é juro sobre juro. 4% ao mês viram cerca de 60% ao ano. Por isso empréstimo longo pesa tanto.</p>
      </MaisAjuda>
    </>
  );
}

/* ---------- comparar 2 ou 3 ofertas ---------- */
function Comparar() {
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
      <p className="gs-sub">Coloque 2 ou 3 ofertas. Eu mostro quanto cada uma custa de verdade.</p>
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
