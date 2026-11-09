import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl0, mesCurto, mesDe } from './datas';
import { compararMeses, evolucaoDividas, frasesDeEvolucao, gastosPorCategoria, patrimonioPorMes, planejadoXRealizado, serieMensal } from './evolucaoLogica';
import { Linha, Rosquinha } from './graficos';
import { corDe } from './categorias';
import { Barra, Titulo, Vazio } from './ui';
import { Metas } from './Metas';
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
  const atual = serie.find((m) => m.mes === mes);
  const fixas = atual?.fixas ?? 0;
  const variaveis = atual?.variaveis ?? 0;

  if (mesesComDados === 0)
    return (
      <>
        <Titulo titulo="Relatórios" sub="Aqui você acompanha como seu dinheiro está mudando." />
        <Vazio titulo="Ainda não há dados para mostrar" texto="Registre receitas e despesas por alguns dias e eu monto sua evolução, sem inventar nada." acao="Adicionar movimentação" onAcao={() => abrirAdicionar()} avatar="gastos" />
        <h2 className="gs-h2">Suas metas</h2>
        <Metas />
      </>
    );

  return (
    <>
      <Titulo titulo="Relatórios" sub="O que mudou no seu dinheiro, em linguagem simples." />

      {frases.length > 0 ? (
        <section className="gs-card" aria-label="O que eu notei">
          <span className="gs-rotulo">O que eu notei</span>
          {frases.map((f) => <p key={f.id} className={`gs-frase ${f.tom}`}>{f.texto}</p>)}
        </section>
      ) : (
        <p className="gs-nota">Ainda não tenho dados suficientes para comparar períodos. Continue registrando: com pelo menos um mês anterior, as comparações aparecem aqui.</p>
      )}

      <h2 className="gs-h2">Recebi mais do que gastei?</h2>
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

      <h2 className="gs-h2">Para onde vai meu dinheiro?</h2>
      {cats.length > 0 ? (
        <div className="gs-card">
          <Rosquinha fatias={cats.map((c) => ({ id: c.categoria, cor: corDe(c.categoria), valor: c.valor }))} centro={brl0(cats.reduce((t, c) => t + c.valor, 0))} sub="no dia a dia" />
          {cats.map((c) => (
            <div className="gs-linha" key={c.categoria}>
              <span className="gs-ponto" style={{ background: corDe(c.categoria) }} aria-hidden="true" />
              <div className="gs-corpo"><b>{c.categoria}</b><small>{Math.round(c.pct)}% do mês{c.anterior > 0 ? ` · mês passado ${brl0(c.anterior)}` : ''}</small></div>
              <span className="gs-valor">{brl0(c.valor)}</span>
            </div>
          ))}
        </div>
      ) : <p className="gs-nota">Sem gastos do dia a dia neste mês ainda.</p>}

      <h2 className="gs-h2">Fixo ou variável?</h2>
      {fixas + variaveis > 0 ? (
        <div className="gs-card">
          <div className="gs-trio">
            <div><span className="gs-rotulo">Fixas pagas</span><b className="gs-tab">{brl0(fixas)}</b></div>
            <div><span className="gs-rotulo">Variáveis</span><b className="gs-tab">{brl0(variaveis)}</b></div>
            <div><span className="gs-rotulo">% fixo</span><b className="gs-tab">{Math.round((fixas / (fixas + variaveis)) * 100)}%</b></div>
          </div>
          <p className="gs-nota">Gastos fixos são mais difíceis de mudar; os variáveis são onde você tem mais controle.</p>
        </div>
      ) : <p className="gs-nota">Nenhuma despesa registrada neste mês.</p>}

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
        <p className="gs-nota">Você ainda não definiu limites por categoria. <Link to="/plano/orcamento">Definir no orçamento</Link> para comparar o planejado com o realizado.</p>
      )}

      {dividas && (
        <>
          <h2 className="gs-h2">Minhas dívidas estão diminuindo?</h2>
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
          <h2 className="gs-h2">Quanto tenho guardado?</h2>
          <div className="gs-card"><Linha serie={patri.map((p) => p.valor)} fim={brl0(patri[patri.length - 1].valor)} rotulo="Valor guardado ao fim de cada mês" /></div>
        </>
      )}

      <h2 className="gs-h2">Minhas metas</h2>
      <Metas />
    </>
  );
}
