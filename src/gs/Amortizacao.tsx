import { useMemo, useState } from 'react';
import { useEstado } from './store';
import { saldoAtual } from './dividas';
import { amortizacaoExtra, mesDaVirada, tabelaAmortizacao, totalJurosTabela } from './amortizacao';
import { brl, brl0, mesAtual, mesCurto, pct, somaMes } from './datas';
import { CampoDinheiro, Dica } from './ui';

/* ---------- Amortização: pra onde vai a sua parcela (juro x abatimento), a tabela e o que o extra muda ---------- */

export function Amortizacao() {
  const e = useEstado();
  const lista = e.dividas.filter((d) => saldoAtual(d) > 0 && d.parcelaMinima > 0);
  const [id, setId] = useState(lista[0]?.id ?? '');
  const [extra, setExtra] = useState(0);
  const d = lista.find((x) => x.id === id) ?? lista[0];
  const saldo = d ? saldoAtual(d) : 0;
  const tab = useMemo(() => (d ? tabelaAmortizacao(saldo, d.jurosMensal, d.parcelaMinima) : null), [d, saldo]);
  const ex = useMemo(() => (d && extra > 0 ? amortizacaoExtra(saldo, d.jurosMensal, d.parcelaMinima, extra) : null), [d, saldo, extra]);
  if (!d) return null;
  const jaAbateu = Math.max(0, d.saldo - saldo);
  const pctAbateu = d.saldo > 0 ? (jaAbateu / d.saldo) * 100 : 0;
  const primeira = tab?.[0];
  const virada = tab ? mesDaVirada(tab) : null;
  return (
    <section className="gs-card" style={{ marginTop: 12 }}>
      <span className="gs-rotulo">Amortização</span>
      <p style={{ margin: '6px 0 10px' }}>Da sua parcela, quanto é <b>juro</b> e quanto realmente <b>abate a dívida</b>.</p>
      {lista.length > 1 && (
        <div className="gs-chips" role="group" aria-label="Dívida" style={{ marginBottom: 8 }}>
          {lista.map((x) => <button key={x.id} type="button" className={`gs-chip ${x.id === d.id ? 'on' : ''}`} aria-pressed={x.id === d.id} onClick={() => setId(x.id)}>{x.nome}</button>)}
        </div>
      )}

      {!tab || !primeira ? (
        <p className="gs-banner" style={{ margin: 0 }}>A parcela de {brl0(d.parcelaMinima)} não cobre nem os juros do mês ({brl0(saldo * (d.jurosMensal / 100))}). A dívida cresce em vez de diminuir. Pague mais, ou renegocie.</p>
      ) : (
        <>
          <div style={{ display: 'flex', height: 26, borderRadius: 13, overflow: 'hidden', background: 'var(--bg-2)' }} role="img" aria-label={`Da parcela de ${brl0(primeira.parcela)}, ${brl0(primeira.juros)} é juro e ${brl0(primeira.amort)} abate a dívida`}>
            <div style={{ width: `${(primeira.juros / primeira.parcela) * 100}%`, background: 'var(--danger)' }} />
            <div style={{ flex: 1, background: 'var(--success)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14 }}>
            <span><b style={{ color: 'var(--danger)' }}>{brl0(primeira.juros)}</b> de juro</span>
            <span><b style={{ color: 'var(--success)' }}>{brl0(primeira.amort)}</b> abatem a dívida</span>
          </div>
          <p className="gs-sub" style={{ margin: '8px 0 0' }}>
            {virada ? `No começo o juro pesa mais. A partir da parcela ${virada} (${mesCurto(somaMes(mesAtual(), virada - 1))}) o abatimento passa a ser maior.` : 'Desde a primeira parcela o abatimento é maior que o juro.'}
            {' '}No total você paga <b>{brl0(totalJurosTabela(tab))}</b> de juros ({pct(d.jurosMensal, 1)} ao mês).
          </p>

          <div style={{ marginTop: 12 }}>
            <span className="gs-rotulo">Já abateu</span>
            <p style={{ margin: '4px 0 0' }}><b>{brl0(jaAbateu)}</b> de {brl0(d.saldo)} <span className="gs-mudo">({Math.round(pctAbateu)}%)</span></p>
          </div>

          <div style={{ marginTop: 14 }}>
            <CampoDinheiro rotulo="Se eu amortizar a mais, de uma vez" valor={extra} onChange={setExtra} placeholder="Ex.: R$ 5.000" />
            {ex && (
              <div className="gs-dois">
                <div className="gs-mini m">
                  <small>Reduzir o prazo</small>
                  <b>{ex.prazo ? (ex.prazo.meses === 0 ? 'quita tudo' : `${ex.prazo.mesesAntes} meses antes`) : '-'}</b>
                  <small>economiza {brl0(ex.prazo?.economia ?? 0)}</small>
                </div>
                <div className="gs-mini">
                  <small>Reduzir a parcela</small>
                  <b>{ex.parcela && ex.parcela.nova > 0 ? brl0(ex.parcela.nova) : 'quita tudo'}</b>
                  <small>economiza {brl0(ex.parcela?.economia ?? 0)}</small>
                </div>
              </div>
            )}
            {ex && <Dica>Reduzir o <b>prazo</b> costuma economizar mais juros. Reduzir a <b>parcela</b> alivia o mês. Peça ao banco o desconto proporcional dos juros ao antecipar.</Dica>}
          </div>

          <details style={{ marginTop: 12 }}>
            <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 700 }}>Tabela mês a mês</summary>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', minWidth: 330 }}>
                <thead><tr>{['Mês', 'Juro', 'Abate', 'Saldo'].map((h) => <th key={h} scope="col" style={{ textAlign: h === 'Mês' ? 'left' : 'right', padding: '6px 4px', color: 'var(--ink-muted)', fontWeight: 700 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {tab.filter((_, k) => k < 12 || k === tab.length - 1).map((r) => (
                    <tr key={r.mes} style={{ borderTop: '1px solid var(--line)' }}>
                      <th scope="row" style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>{r.mes}ª · {mesCurto(somaMes(mesAtual(), r.mes - 1))}</th>
                      <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--danger)' }}>{brl(r.juros)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--success)' }}>{brl(r.amort)}</td>
                      <td style={{ textAlign: 'right', padding: '6px 4px' }}>{brl(r.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tab.length > 13 && <p className="gs-nota">Mostrando as 12 primeiras parcelas e a última. Total de {tab.length} parcelas.</p>}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
