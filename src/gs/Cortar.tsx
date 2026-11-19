import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { gastosRecorrentes } from './coachExtras';
import { DIA_ESSENCIAL, ondeCortar } from './recuperacaoLogica';
import { brl0, mesDe, mesCurto } from './datas';
import { iconeDe } from './categorias';
import { Titulo, Vazio } from './ui';
import { ImpactoNoCaminho } from './Impacto';
import { mascarar, useOculto } from './privacidade';
import { Flame, Repeat, Scissors, Wallet } from 'lucide-react';
import { FaixaKpis, GraficoBarras } from './PainelUI';

/* ---------- Onde cortar: o que você paga todo mês, o que se repete e o que mais pesa, com a economia somada ---------- */

export function Cortar() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const [pct, setPct] = useState(30);
  const corte = useMemo(() => ondeCortar(e, mes), [e, mes]);
  const recorrentes = useMemo(() => gastosRecorrentes(e, hoje).slice(0, 5), [e, hoje]);
  const maiores = useMemo(() => e.lancamentos.filter((l) => mesDe(l.data) === mes && !DIA_ESSENCIAL.includes(l.categoria)).sort((a, b) => b.valor - a.valor).slice(0, 5), [e, mes]);
  const superfluos = useMemo(() => e.lancamentos.filter((l) => mesDe(l.data) === mes && !DIA_ESSENCIAL.includes(l.categoria)).reduce((t, l) => t + l.valor, 0), [e, mes]);
  const base = superfluos + corte.assinaturas.total;
  const vazio = base === 0 && recorrentes.length === 0;

  return (
    <>
      <Titulo titulo="Onde cortar" sub={`O que dá para reduzir primeiro, em ${mesCurto(mes)}.`} />
      {vazio ? (
        <Vazio titulo="Ainda não há o que mostrar" texto="Anote seus gastos e cadastre suas assinaturas. Eu mostro aqui o que mais pesa e o que se repete." acao="Cadastrar assinaturas" rota="/plano/assinaturas" avatar="gastos" />
      ) : (
        <>
          <FaixaKpis mascara={m} itens={[
            { rotulo: 'Dá pra economizar', valor: Math.round((base * pct) / 100), icone: Scissors, tom: 'ok', nota: `por mês, cortando ${pct}%` },
            { rotulo: 'Gastos reduzíveis', valor: base, icone: Wallet, nota: 'supérfluos + assinaturas' },
            { rotulo: 'Assinaturas', valor: corte.assinaturas.total, icone: Repeat, tom: corte.assinaturas.n ? 'aviso' : '', nota: `${corte.assinaturas.n} ativas` },
            { rotulo: 'Se repetem', valor: recorrentes.length, formato: 'int', icone: Flame, nota: 'gastos que voltam todo mês' },
          ]} />
          {corte.categorias.length > 0 && <GraficoBarras titulo="O que mais pesa" sub="supérfluos do mês" mascara={m} dados={corte.categorias.map((c) => ({ rotulo: c.categoria, valor: c.valor, tom: 'aviso', legenda: c.categoria }) as const)} />}
          <section className="gs-card gs-plano-topo" aria-label="Economia possível">
            <span className="gs-rotulo">Se eu cortar {pct}%</span>
            <p className="gs-grande" style={{ margin: '2px 0' }}>{m(brl0((base * pct) / 100))}</p>
            <p className="gs-mudo" style={{ margin: 0 }}>por mês, de {m(brl0(base))} em gastos que dá para reduzir (supérfluos do mês e assinaturas). É uma simulação, não uma garantia.</p>
            <label className="gs-campo" style={{ marginTop: 10 }}><span>Quanto cortar</span><input type="range" min={10} max={100} step={10} value={pct} onChange={(ev) => setPct(Number(ev.target.value))} aria-label="Percentual de corte" /></label>
          </section>

          <ImpactoNoCaminho mudanca={base > 0 ? { tipo: 'corte', porMes: Math.round((base * pct) / 100) } : null} passo={{ titulo: `Cortar ${brl0((base * pct) / 100)} por mês`, detalhe: `${pct}% dos gastos que dá para reduzir. O que sobrar vai para o seu destino.`, rota: '/plano/cortar', origem: 'cortar' }} />

          {corte.assinaturas.n > 0 && (
            <section className="gs-card" aria-label="Assinaturas">
              <span className="gs-rotulo">Assinaturas ativas</span>
              <p style={{ margin: '4px 0 8px' }}><b>{m(brl0(corte.assinaturas.total))}</b> por mês em {corte.assinaturas.n} {corte.assinaturas.n === 1 ? 'assinatura' : 'assinaturas'}, {m(brl0(corte.assinaturas.total * 12))} por ano.</p>
              <Link to="/plano/assinaturas" className="gs-btn cheio">Revisar e cancelar</Link>
            </section>
          )}

          {recorrentes.length > 0 && (
            <section className="gs-card" aria-label="Gastos que se repetem">
              <span className="gs-rotulo">Gastos que se repetem</span>
              {recorrentes.map((r) => (
                <div className="gs-linha" key={r.nome}>
                  <div className="gs-corpo"><b>{r.nome}</b><small>apareceu em {r.meses} meses · {m(brl0(r.valor * 12))} por ano</small></div>
                  <span className="gs-valor">{m(brl0(r.valor))}</span>
                </div>
              ))}
              <p className="gs-nota">Vale conferir se você ainda usa e se compensa.</p>
            </section>
          )}

          {maiores.length > 0 && (
            <section className="gs-card" aria-label="Maiores gastos supérfluos">
              <span className="gs-rotulo">Maiores gastos do mês (fora o essencial)</span>
              {maiores.map((l) => { const I = iconeDe(l.categoria); return (
                <div className="gs-linha" key={l.id}>
                  <span className="gs-ic-cat" aria-hidden="true"><I size={18} /></span>
                  <div className="gs-corpo"><b>{l.descricao}</b><small>{l.categoria}</small></div>
                  <span className="gs-valor">{m(brl0(l.valor))}</span>
                </div>
              ); })}
              <Link to="/plano/orcamento" className="gs-btn link">Definir limite por categoria</Link>
            </section>
          )}
        </>
      )}
    </>
  );
}
