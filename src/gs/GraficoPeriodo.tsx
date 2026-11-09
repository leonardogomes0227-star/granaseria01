import { useMemo, useState } from 'react';
import { useEstado } from './store';
import { compararMeses, economiaAcumulada, serieMensal } from './evolucaoLogica';
import { Barras, Linha } from './graficos';
import { brl0, mesCurto, mesDe } from './datas';
import { mascarar, useOculto } from './privacidade';

/** Receitas × despesas por período (3, 6 ou 12 meses), economia acumulada e a comparação com o mês anterior. */
export function GraficoPeriodo({ hoje, inicial = 6, compacto = false }: { hoje: string; inicial?: 3 | 6 | 12; compacto?: boolean }) {
  const e = useEstado();
  const [n, setN] = useState<3 | 6 | 12>(inicial);
  const oculto = useOculto();
  const mes = mesDe(hoje);
  const serie = useMemo(() => serieMensal(e, hoje, n).filter((m) => m.temDados || m.mes === mes), [e, hoje, n, mes]);
  const comDados = serie.filter((m) => m.temDados).length;
  const acum = useMemo(() => economiaAcumulada(serie), [serie]);
  const comp = useMemo(() => compararMeses(serie, mes), [serie, mes]);
  return (
    <div className="gs-card">
      <div className="gs-chips" role="group" aria-label="Período do gráfico" style={{ marginBottom: 8 }}>
        {([3, 6, 12] as const).map((k) => <button key={k} type="button" className={`gs-chip ${n === k ? 'on' : ''}`} aria-pressed={n === k} onClick={() => setN(k)}>{k} meses</button>)}
      </div>
      {comDados < 2 ? (
        <p className="gs-mudo">Preciso de pelo menos dois meses com registros para desenhar a evolução. Continue anotando suas receitas e despesas.</p>
      ) : (
        <>
          {oculto ? <p className="gs-mudo" role="status">Valores ocultos. Toque no olho para mostrar o gráfico.</p> : <Barras dados={serie.map((m) => [m.receitas, m.despesas])} rotulos={serie.map((m) => mesCurto(m.mes).slice(0, 3))} nomes={['Receitas', 'Despesas']} rotulo="Receitas versus despesas por mês" />}
          {serie.some((m) => m.receitaEstimada) && <p className="gs-nota">Meses sem receita registrada usam a renda informada (estimativa).</p>}
          {comp && (
            <p className="gs-mudo" style={{ margin: '10px 0 0' }}>
              Em relação a {mesCurto(comp.anterior.mes)}: despesas {comp.dDespesas === null ? 'sem base para comparar' : `${comp.dDespesas > 0 ? '+' : ''}${comp.dDespesas}%`}, receitas {comp.dReceitas === null ? 'sem base para comparar' : `${comp.dReceitas > 0 ? '+' : ''}${comp.dReceitas}%`}.
            </p>
          )}
          {!compacto && acum.length >= 2 && !oculto && (
            <>
              <span className="gs-rotulo" style={{ display: 'block', marginTop: 14 }}>Economia acumulada</span>
              <Linha serie={acum.map((a) => Math.max(0, a.valor))} fim={mascarar(brl0(acum[acum.length - 1].valor), oculto)} rotulo="Economia acumulada: receitas menos despesas, mês a mês" />
            </>
          )}
        </>
      )}
    </div>
  );
}
