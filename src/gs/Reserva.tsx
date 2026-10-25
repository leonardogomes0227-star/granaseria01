import { useState } from 'react';
import { useEstado } from './store';
import { guardar, removerAporte, salvarConfig } from './acoes';
import { gastoMensalMedio, guardadoNoMes, patrimonioGuardado, reservaMeta } from './selectores';
import { Barra, CampoDinheiro, CampoNumero, Titulo } from './ui';
import { brl, brl0, diaCurto, mesDe } from './datas';
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
  return (
    <>
      <Titulo titulo="Reserva" sub="Guarde primeiro, gaste o resto. Assim a reserva cresce sem esforço." />
      <section className="gs-card destaque">
        <span className="gs-rotulo">Guardado até hoje</span>
        <p className="gs-grande" style={{ margin: '4px 0 10px' }}>{brl0(guardado)}</p>
        {meta > 0 ? (
          <>
            <Barra pct={progressoRenda(guardado, meta)} tom="ok" rotulo="Reserva de emergência" />
            <p className="gs-sub" style={{ margin: '10px 0 0' }}>
              {falta > 0 ? `Meta de emergência: ${brl0(meta)} (6 meses de gastos). Faltam ${brl0(falta)}.` : `Meta de ${brl0(meta)} batida. Agora o dinheiro pode render: veja a aba Investir.`}
            </p>
          </>
        ) : (
          <p className="gs-sub" style={{ margin: 0 }}>Cadastre suas contas fixas pra eu calcular a meta (6 meses de gastos).</p>
        )}
        <p className="gs-mudo" style={{ margin: '8px 0 0' }}>Gasto médio por mês: {brl0(gastoMensalMedio(e, mes))}. Guardado este mês: {brl0(guardadoNoMes(e, mes))}.</p>
      </section>
      <section className="gs-card">
        <CampoDinheiro rotulo={`Quanto guardar agora? (sugestão: ${e.config.reservaPct}% = ${brl0(sugerido)})`} valor={valor} onChange={setValor} grande placeholder={sugerido > 0 ? brl(sugerido) : 'R$ 0,00'} />
        <button
          type="button"
          className="gs-btn cheio"
          disabled={!(usar > 0)}
          onClick={() => {
            const id = guardar(usar, 'reserva', 'reserva');
            if (id) {
              toast(`${brl0(usar)} guardados`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
              setValor(0);
            }
          }}
        >
          Guardar {usar > 0 ? brl0(usar) : ''}
        </button>
        <div style={{ marginTop: 14 }}>
          <CampoNumero rotulo="Percentual sugerido quando o salário cai" sufixo="%" valor={pct} onChange={(n) => { setPct(n); if (typeof n === 'number' && n > 0) salvarConfig({ reservaPct: n }); }} min={1} max={100} />
        </div>
      </section>
      {recentes.length > 0 && (
        <>
          <h2 className="gs-h2">Últimos guardados</h2>
          <div className="gs-card">
            {recentes.map((a) => (
              <div className="gs-linha" key={a.id}>
                <div className="gs-corpo"><b>{brl(a.valor)}</b><small>{diaCurto(a.data)} · {a.origem === 'reserva' ? 'reserva' : a.origem === 'meta' ? 'meta' : a.origem === 'extra' ? 'dinheiro extra' : a.origem === 'investimento' ? 'investimento' : 'manual'}</small></div>
                <button type="button" className="gs-btn link" onClick={() => { removerAporte(a.id); toast('Removido', { acao: { rotulo: 'Desfazer', onClick: () => guardar(a.valor, a.origem, a.agenteId, a.data) } }); }}>Remover</button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
