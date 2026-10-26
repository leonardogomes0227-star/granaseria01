import { useEffect, useState } from 'react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { salvarCartao } from './acoes';
import { Aprende, Barra, CampoDinheiro, CampoNumero, Dica, Titulo } from './ui';
import { brl0, mesCurto, somaMes } from './datas';
import { toast } from '../components/ui/Toast';

/* ---------- Cartão de crédito: fatura, limite e o melhor dia de compra ---------- */

export function CartaoTela() {
  const e = useEstado();
  const hoje = useHoje();
  const c = e.cartao;
  const [limite, setLimite] = useState(c?.limite ?? 0);
  const [usado, setUsado] = useState(c?.usado ?? 0);
  const [fecha, setFecha] = useState<number | ''>(c?.fechaDia ?? '');
  const [vence, setVence] = useState<number | ''>(c?.venceDia ?? '');
  const [editar, setEditar] = useState(!c);
  useEffect(() => {
    if (c) {
      setLimite(c.limite);
      setUsado(c.usado);
      setFecha(c.fechaDia);
      setVence(c.venceDia);
    }
  }, [c]);
  const dia = Number(hoje.slice(8, 10));
  const p = c ? (c.usado / c.limite) * 100 : 0;
  const compraAntesDoFecho = c ? dia <= c.fechaDia : true;
  return (
    <>
      <Titulo titulo="Cartão de crédito" sub="Controle a fatura antes que ela controle você." />
      {c && !editar ? (
        <>
          <section className="gs-card destaque">
            <span className="gs-rotulo">Fatura atual</span>
            <p className="gs-grande" style={{ margin: '4px 0 8px' }}>{brl0(c.usado)}</p>
            <Barra pct={p} tom={p > 80 ? 'perigo' : p > 50 ? '' : 'ok'} rotulo="Uso do limite" />
            <p className="gs-sub" style={{ margin: '8px 0 0' }}>{Math.round(p)}% do limite de {brl0(c.limite)} · fecha dia {c.fechaDia} · vence dia {c.venceDia}</p>
            <div className="gs-acoes"><button type="button" className="gs-btn sec" onClick={() => setEditar(true)}>Atualizar fatura</button></div>
          </section>
          <section className="gs-card">
            <span className="gs-rotulo">Melhor dia de compra</span>
            <p style={{ margin: '6px 0 0' }}>Compre <b>logo depois de fechar a fatura (dia {c.fechaDia >= 31 ? 1 : c.fechaDia + 1})</b>: a compra só entra na fatura do mês seguinte e você ganha até 40 dias pra pagar.</p>
            <Dica>{compraAntesDoFecho ? `Hoje é dia ${dia}: a fatura ainda não fechou. Compras de agora entram nesta fatura, que vence dia ${c.venceDia}.` : `Hoje é dia ${dia}: a fatura já fechou. Compras de agora entram na próxima, que vence em ${mesCurto(somaMes(hoje.slice(0, 7), 1))}.`}</Dica>
          </section>
          <section className="gs-card">
            <span className="gs-rotulo">Regra de ouro</span>
            {[
              <>Use no máximo <b>30% do limite</b> ({brl0(c.limite * 0.3)}) pra não depender dele. Hoje você usa {Math.round(p)}%.</>,
              <>Pague <b>sempre o total</b>. Pagar o mínimo joga o resto no rotativo, a dívida mais cara do país.</>,
              <>Anote a compra parcelada <b>na hora</b>: as parcelas somem da vista e voltam como susto.</>,
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0' }}><span className="gs-check" style={{ flex: 'none', fontWeight: 700 }}>{i + 1}</span><span>{t}</span></div>
            ))}
          </section>
        </>
      ) : (
        <section className="gs-card">
          <CampoDinheiro rotulo="Limite do cartão" valor={limite} onChange={setLimite} />
          <CampoDinheiro rotulo="Fatura atual (quanto já gastou)" valor={usado} onChange={setUsado} />
          <div className="gs-dois">
            <CampoNumero rotulo="Dia que fecha" valor={fecha} onChange={setFecha} min={1} max={31} />
            <CampoNumero rotulo="Dia que vence" valor={vence} onChange={setVence} min={1} max={31} />
          </div>
          <div className="gs-acoes">
            <button type="button" className="gs-btn" disabled={!(limite > 0) || typeof fecha !== 'number' || typeof vence !== 'number'} onClick={() => { salvarCartao({ limite, usado, fechaDia: fecha as number, venceDia: vence as number }); setEditar(false); toast('Cartão salvo'); }}>Salvar</button>
            {c && <button type="button" className="gs-btn sec" onClick={() => setEditar(false)}>Cancelar</button>}
          </div>
        </section>
      )}
      <Aprende titulo="Por que o rotativo é um perigo" texto="Se você paga só o mínimo, o resto vai pro rotativo, que passa de 400% ao ano. Uma fatura de R$ 1.000 vira uma dívida que cresce sozinha. Por isso a regra é pagar o total, ou parcelar com juro menor, nunca deixar rolar." />
    </>
  );
}
