import { useMemo, useState } from 'react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesDe, nomeMes, diasNoMes, vencimentoNoMes } from './datas';
import { contasDoMes, faltaPagar } from './selectores';
import { Aprende, Titulo, Vazio } from './ui';
import { BaixaSheet } from './BaixaSheet';

/* ---------- Calendário de contas: o que vence e quando (verde = pago, vermelho = falta) ---------- */

export function Calendario() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [baixa, setBaixa] = useState<string | null>(null);
  const contas = useMemo(() => contasDoMes(e, mes, hoje), [e, mes, hoje]);
  const primeiro = new Date(`${mes}-01T12:00:00Z`).getUTCDay();
  const dias = diasNoMes(mes);
  const porDia = (d: number) => contas.filter((c) => c.vencimento === vencimentoNoMes(mes, d));
  if (e.gastosFixos.length === 0)
    return (
      <>
        <Titulo titulo="Calendário de contas" sub="O que vence e quando." />
        <Vazio titulo="Cadastre suas contas fixas" texto="Aluguel, luz, internet… O calendário mostra cada vencimento e eu te aviso antes." acao="Cadastrar contas" rota="/mes" avatar="contas" />
        <Aprende titulo="Pague no dia certo" texto="Atraso custa multa de 2% e juros de 1% ao mês, além do risco de nome sujo. Um aviso um dia antes resolve a maioria dos atrasos." />
      </>
    );
  return (
    <>
      <Titulo titulo="Calendário de contas" sub={nomeMes(mes)} />
      <section className="gs-card destaque">
        <span className="gs-rotulo">Falta pagar neste mês</span>
        <p className="gs-grande" style={{ margin: '4px 0 0' }}>{brl0(faltaPagar(e, mes))}</p>
        <div className="gs-cal" aria-label="Calendário do mês">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="vazio gs-mudo" style={{ minHeight: 20 }}>{d}</div>)}
          {Array.from({ length: primeiro }, (_, i) => <div key={`v${i}`} className="vazio" />)}
          {Array.from({ length: dias }, (_, i) => {
            const d = i + 1;
            const cs = porDia(d);
            return (
              <div key={d} className={mesDe(hoje) === mes && Number(hoje.slice(8, 10)) === d ? 'hoje' : ''}>
                {d}
                {cs.length > 0 && <i className={cs.every((c) => c.estado === 'paga') ? 'p' : ''} aria-label={cs.map((c) => `${c.gasto.nome} ${c.estado === 'paga' ? 'paga' : 'a pagar'}`).join(', ')} />}
              </div>
            );
          })}
        </div>
      </section>
      <section className="gs-card">
        <span className="gs-rotulo">Contas do mês</span>
        {contas.map((c) => (
          <div className="gs-linha" key={c.gasto.id}>
            <div className="gs-corpo">
              <b>{c.gasto.nome}</b>
              <small>dia {Number(c.vencimento.slice(8, 10))} · {c.estado === 'paga' ? 'paga' : c.estado === 'atrasada' ? `atrasada desde ${diaCurto(c.vencimento)}` : c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : c.dias <= 3 ? `vence em ${c.dias} dias` : 'em dia'}</small>
            </div>
            <span className="gs-valor">{brl(c.valor)}</span>
            {c.estado === 'paga' ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>Paga</span> : <button type="button" className="gs-btn pequeno" onClick={() => setBaixa(c.gasto.id)}>Dar baixa</button>}
          </div>
        ))}
      </section>
      <Aprende titulo="Pague no dia certo" texto="Atraso custa multa de 2% e juros de 1% ao mês, além do risco de nome sujo. Um aviso um dia antes resolve a maioria dos atrasos. É isso que o assistente de contas faz." />
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
    </>
  );
}
