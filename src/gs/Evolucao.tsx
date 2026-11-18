import { useMemo } from 'react';
import { RespostaFerramenta } from './RespostaFerramenta';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl0, mesCurto, mesDe } from './datas';
import { compararMeses, evolucaoDividas, frasesDeEvolucao, gastosPorCategoria, patrimonioPorMes, planejadoXRealizado, serieMensal } from './evolucaoLogica';
import { Linha } from './graficos';
import { corDe } from './categorias';
import { Barra, Titulo, Vazio } from './ui';
import { GraficoPeriodo } from './GraficoPeriodo';
import { abrirAdicionar } from './AdicionarMov';

/* ---------- Evolução: cada gráfico responde uma pergunta. Sem dados suficientes, diz isso em vez de inventar. ---------- */

export function Evolucao() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const serie = useMemo(() => serieMensal(e, hoje).filter((m) => m.temDados || m.mes === mes), [e, hoje, mes]);
  const frases = useMemo(() => frasesDeEvolucao(e, hoje), [e, hoje]);
  const cats = useMemo(() => gastosPorCategoria(e, mes), [e, mes]);
  const plan = useMemo(() => planejadoXRealizado(e, mes), [e, mes]);
  const dividas = useMemo(() => evolucaoDividas(e, hoje), [e, hoje]);
  const patri = useMemo(() => patrimonioPorMes(e, hoje), [e, hoje]);
  const mesesComDados = serie.filter((m) => m.temDados).length;
  const comp = useMemo(() => compararMeses(serie, mes), [serie, mes]);

  if (mesesComDados === 0)
    return (
      <>
        <Titulo titulo="Relatórios" sub="Como seu dinheiro está mudando." />
        <RespostaFerramenta id="relatorios" />
        <Vazio titulo="Ainda não há dados para mostrar" texto="Registre receitas e despesas e os relatórios aparecem aqui." acao="Adicionar movimentação" onAcao={() => abrirAdicionar()} avatar="gastos" />
      </>
    );

  return (
    <>
      <Titulo titulo="Relatórios" />

      {frases.length > 0 ? (
        <section className="gs-card destaque" aria-label="O que eu notei">
          <span className="gs-rotulo">O que eu notei</span>
          {frases.map((f) => <p key={f.id} className={`gs-frase ${f.tom}`}>{f.texto}</p>)}
        </section>
      ) : (
        <p className="gs-nota">Comparações aparecem depois do primeiro mês completo.</p>
      )}

      <h2 className="gs-h2">Receitas e despesas</h2>
      <GraficoPeriodo hoje={hoje} />
      {comp && (
        <>
          <h2 className="gs-h2">{mesCurto(comp.atual.mes)} × {mesCurto(comp.anterior.mes)}</h2>
          <div className="gs-card">
            {([['Receitas', comp.atual.receitas, comp.anterior.receitas], ['Despesas', comp.atual.despesas, comp.anterior.despesas], ['Economia', comp.atual.receitas - comp.atual.despesas, comp.anterior.receitas - comp.anterior.despesas]] as [string, number, number][]).map(([r, a, b]) => (
              <div className="gs-linha" key={r}><div className="gs-corpo"><b>{r}</b><small>{mesCurto(comp.anterior.mes)}: {brl0(b)}</small></div><span className="gs-valor">{brl0(a)}</span></div>
            ))}
          </div>
        </>
      )}

      <h2 className="gs-h2">Gastos por categoria</h2>
      {cats.length > 0 ? (
        <div className="gs-card">
          {cats.map((c) => (
            <div className="gs-linha" key={c.categoria}>
              <span className="gs-ponto" style={{ background: corDe(c.categoria) }} aria-hidden="true" />
              <div className="gs-corpo"><b>{c.categoria}</b><small>{Math.round(c.pct)}% do mês{c.anterior > 0 ? ` · mês passado ${brl0(c.anterior)}` : ''}</small></div>
              <span className="gs-valor">{brl0(c.valor)}</span>
            </div>
          ))}
        </div>
      ) : <p className="gs-nota">Sem gastos do dia a dia neste mês ainda.</p>}

      <h2 className="gs-h2">Planejado × realizado</h2>
      {plan.length > 0 ? (
        <div className="gs-card">
          {plan.map((p) => {
            const pct = (p.realizado / p.planejado) * 100;
            return (
              <div key={p.categoria} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{p.categoria}</span><b className="gs-tab">{brl0(p.realizado)} de {brl0(p.planejado)}</b></div>
                <Barra pct={pct} tom={pct > 100 ? 'perigo' : pct < 80 ? 'ok' : ''} rotulo={`${p.categoria}: ${Math.round(pct)}% do limite`} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="gs-nota">Sem limites definidos. <Link to="/plano/orcamento">Definir limites</Link></p>
      )}

      {dividas && (
        <>
          <h2 className="gs-h2">Dívidas</h2>
          <div className="gs-card">
            <div className="gs-trio">
              <div><span className="gs-rotulo">Falta pagar</span><b className="gs-tab">{brl0(dividas.total)}</b></div>
              <div><span className="gs-rotulo">Já paguei</span><b className="gs-tab">{brl0(dividas.pago)}</b></div>
            </div>
            {dividas.pago > 0 ? <Linha serie={dividas.porMes.map((m) => m.pago)} fim={mesCurto(mes)} rotulo="Quanto você pagou de dívida por mês" /> : <p className="gs-nota">Quando você registrar pagamentos, mostro a evolução aqui.</p>}
            <Link to="/plano/dividas" className="gs-btn link">Ver plano de dívidas</Link>
          </div>
        </>
      )}

      {patri && (
        <>
          <h2 className="gs-h2">Valor guardado</h2>
          <div className="gs-card"><Linha serie={patri.map((p) => p.valor)} fim={brl0(patri[patri.length - 1].valor)} rotulo="Valor guardado ao fim de cada mês" /></div>
        </>
      )}

    </>
  );
}
