import { useState } from 'react';
import { useEstado } from './store';
import { guardar, removerAporte, salvarConfig } from './acoes';
import { gastoMensalMedio, patrimonioGuardado, reservaMeta } from './selectores';
import { Aprende, Barra, CampoNumero, Deslizante, Dica, Titulo } from './ui';
import { brl, brl0, diaCurto, mesCurto, mesDe, somaMes } from './datas';
import { toast } from '../components/ui/Toast';
import { useHoje } from './useHoje';
import { progressoRenda } from './ferramentas';

/* ---------- Reserva: pague-se primeiro. Separe uma parte do salário antes de gastar. ---------- */

export function Reserva() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const sugerido = Math.round((e.config.renda * e.config.reservaPct) / 100);
  const [valor, setValor] = useState(0);
  const [pct, setPct] = useState<number | ''>(e.config.reservaPct);
  const meta = reservaMeta(e, mes);
  const guardado = patrimonioGuardado(e);
  const falta = Math.max(0, meta - guardado);
  const usar = valor > 0 ? valor : sugerido;
  const recentes = [...e.aportes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
  const mesesProntos = meta > 0 ? Math.ceil(falta / Math.max(1, usar)) : 0;
  const gastoMes = gastoMensalMedio(e, mes);
  const marcos = [1, 3, 6];
  return (
    <>
      <Titulo titulo="Reserva de emergência" sub="Guarde primeiro, gaste o resto. Assim a reserva cresce sem esforço." />
      <section className="gs-card destaque">
        <span className="gs-rotulo">Guardado até hoje</span>
        <p className="gs-grande" style={{ margin: '4px 0 10px' }}>{brl0(guardado)} {meta > 0 && <small className="gs-mudo" style={{ fontFamily: 'var(--sans)', fontSize: 15 }}>de {brl0(meta)}</small>}</p>
        {meta > 0 ? (
          <>
            <Barra pct={progressoRenda(guardado, meta)} tom="ok" rotulo="Reserva de emergência" />
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {marcos.map((m) => (
                <div key={m} style={{ flex: 1, textAlign: 'center' }}>
                  <Barra pct={Math.max(0, Math.min(100, ((guardado - gastoMes * (m === 6 ? 3 : m === 3 ? 1 : 0)) / (gastoMes * (m === 6 ? 3 : m === 3 ? 2 : 1))) * 100))} tom={guardado >= gastoMes * m ? 'ok' : ''} rotulo={`${m} meses`} />
                  <small className="gs-mudo">{m} {m === 1 ? 'mês' : 'meses'}</small>
                </div>
              ))}
            </div>
            <p className="gs-sub" style={{ margin: '12px 0 0' }}>Seu gasto médio é {brl0(gastoMes)} por mês. Seis meses disso cobrem desemprego ou imprevisto sem dívida nova.{falta <= 0 ? ' Meta batida: agora o dinheiro pode render, veja a aba Investir.' : ''}</p>
          </>
        ) : (
          <p className="gs-sub" style={{ margin: 0 }}>Cadastre suas contas fixas pra eu calcular a meta (6 meses de gastos).</p>
        )}
      </section>
      <section className="gs-card">
        <Deslizante rotulo="Quanto guardar por mês" valor={usar} min={50} max={Math.max(2000, Math.ceil((sugerido * 2) / 100) * 100)} passo={50} formato={brl0} onChange={(n) => setValor(n)} />
        {meta > 0 && falta > 0 && <Dica icone="📅">Guardando {brl0(usar)} por mês, você completa a reserva em <b>{mesesProntos} {mesesProntos === 1 ? 'mês' : 'meses'}</b> ({mesCurto(somaMes(mes, mesesProntos))}).</Dica>}
        <div className="gs-acoes">
          <button
            type="button"
            className="gs-btn"
            disabled={!(usar > 0)}
            onClick={() => {
              const id = guardar(usar, 'reserva', 'reserva');
              if (id) toast(`${brl0(usar)} guardados`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
            }}
          >
            Guardei {brl0(usar)} este mês
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          <CampoNumero rotulo="Percentual sugerido quando o salário cai" sufixo="%" valor={pct} onChange={(n) => { setPct(n); if (typeof n === 'number' && n > 0) salvarConfig({ reservaPct: n }); }} min={1} max={100} />
        </div>
      </section>
      <section className="gs-card">
        <span className="gs-rotulo">Onde deixar</span>
        {[
          ['✓', <><b>Liquidez diária:</b> você precisa do dinheiro rápido e sem susto.</>],
          ['✓', <><b>Baixo risco:</b> poupança, Tesouro Selic ou CDB com liquidez diária. Confira as regras vigentes.</>],
          ['✕', <><b>Nunca aqui:</b> ações, cripto e qualquer coisa que pode cair.</>],
        ].map(([i, t], k) => (
          <div key={k} style={{ display: 'flex', gap: 12, padding: '8px 0' }}><span className="gs-check" style={{ flex: 'none', background: i === '✕' ? 'var(--danger)' : 'var(--success)', color: '#fff' }}>{i}</span><span>{t}</span></div>
        ))}
      </section>
      {recentes.length > 0 && (
        <section className="gs-card">
          <span className="gs-rotulo">Últimos guardados</span>
          {recentes.map((a) => (
            <div className="gs-linha" key={a.id}>
              <div className="gs-corpo"><b>{brl(a.valor)}</b><small>{diaCurto(a.data)} · {a.origem === 'reserva' ? 'reserva' : a.origem === 'meta' ? 'meta' : a.origem === 'extra' ? 'dinheiro extra' : a.origem === 'investimento' ? 'investimento' : 'manual'}</small></div>
              <button type="button" className="gs-btn link" onClick={() => { removerAporte(a.id); toast('Removido', { acao: { rotulo: 'Desfazer', onClick: () => guardar(a.valor, a.origem, a.agenteId, a.data) } }); }}>Remover</button>
            </div>
          ))}
        </section>
      )}
      <Aprende titulo="Por que seis meses" texto="Perder o emprego ou ter um imprevisto grande leva meses pra resolver. Com seis meses guardados, você não precisa pedir empréstimo nem entrar no rotativo do cartão na pior hora. A reserva é o que deixa o resto do plano de pé." />
    </>
  );
}
