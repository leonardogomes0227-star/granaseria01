import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesDe, nomeMes, diasNoMes } from './datas';
import { livreParaGastar } from './selectores';
import { Agora, Conquistas, Heroi, MaisAjuda, Titulo, Vazio } from './ui';
import { BaixaSheet } from './BaixaSheet';
import { acaoCalendario, eventosDoMes, faltaDoMes, mesesEmDia } from './calendarioLogica';

/* ---------- Calendário de contas: contas, parcelas de dívida e fatura do cartão, num lugar só ---------- */

export function Calendario() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [baixa, setBaixa] = useState<string | null>(null);
  const ev = useMemo(() => eventosDoMes(e, mes, hoje), [e, mes, hoje]);
  const primeiro = new Date(`${mes}-01T12:00:00Z`).getUTCDay();
  const dias = diasNoMes(mes);
  const dot = (d: number) => ev.filter((x) => Number(x.data.slice(8, 10)) === d);
  if (ev.length === 0)
    return (
      <>
        <Titulo titulo="Calendário de contas" sub="O que vence e quando." />
        <Vazio titulo="Cadastre suas contas fixas" texto="Aluguel, luz, internet… O calendário mostra cada vencimento, junto com as parcelas das dívidas e a fatura do cartão, e eu te aviso antes." acao="Cadastrar contas" rota="/mes" avatar="contas" />
      </>
    );
  const pagas = ev.filter((x) => x.paga).length;
  const falta = faltaDoMes(ev);
  const acao = acaoCalendario(ev, livreParaGastar(e, mes));
  const proximo = ev.find((x) => !x.paga);
  const seguidos = mesesEmDia(e, mes);
  const conquistas = [pagas === ev.length ? 'Mês em dia' : '', seguidos >= 1 ? `${seguidos} ${seguidos === 1 ? 'mês' : 'meses'} sem atraso` : ''].filter(Boolean);
  const sete = ev.filter((x) => !x.paga && x.dias >= 0 && x.dias <= 7);
  return (
    <>
      <Titulo titulo="Calendário de contas" sub={nomeMes(mes)} />
      <Heroi pct={(pagas / ev.length) * 100} anel={`${pagas}/${ev.length}`} anelSub="pagas" rotulo="Falta pagar" grande={brl0(falta)} sub={proximo ? `Próxima: ${proximo.nome}, ${proximo.dias < 0 ? 'atrasada' : proximo.dias === 0 ? 'hoje' : `em ${proximo.dias} ${proximo.dias === 1 ? 'dia' : 'dias'}`}` : 'Tudo pago neste mês'} cor={acao.tom === 'perigo' ? 'var(--danger)' : 'var(--success)'} />
      <Agora tom={acao.tom} texto={acao.texto}>
        {acao.evento && (
          <div className="gs-acoes">
            {acao.evento.tipo === 'conta' ? <button type="button" className="gs-btn" onClick={() => setBaixa(acao.evento!.id.slice(2))}>Dar baixa</button> : <Link to={acao.evento.rota!} className="gs-btn">Abrir</Link>}
          </div>
        )}
      </Agora>
      <Conquistas lista={conquistas} />

      {sete.length > 0 && (
        <section className="gs-card">
          <span className="gs-rotulo">Próximos 7 dias · {brl0(sete.reduce((t, x) => t + x.valor, 0))}</span>
          {sete.map((x) => (
            <div className="gs-linha" key={x.id}>
              <div className="gs-corpo"><b>{x.nome}</b><small>{x.dias === 0 ? 'hoje' : x.dias === 1 ? 'amanhã' : diaCurto(x.data)}{x.tipo === 'divida' ? ' · parcela da dívida' : x.tipo === 'cartao' ? ' · fatura' : ''}</small></div>
              <span className="gs-valor">{brl(x.valor)}</span>
            </div>
          ))}
        </section>
      )}

      <section className="gs-card">
        <span className="gs-rotulo">O mês</span>
        <div className="gs-cal" aria-label="Calendário do mês">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="vazio gs-mudo" style={{ minHeight: 20 }}>{d}</div>)}
          {Array.from({ length: primeiro }, (_, i) => <div key={`v${i}`} className="vazio" />)}
          {Array.from({ length: dias }, (_, i) => {
            const d = i + 1;
            const cs = dot(d);
            return (
              <div key={d} className={Number(hoje.slice(8, 10)) === d ? 'hoje' : ''}>
                {d}
                {cs.length > 0 && <i role="img" className={cs.every((c) => c.paga) ? 'p' : ''} aria-label={cs.map((c) => `${c.nome} ${c.paga ? 'paga' : 'a pagar'}`).join(', ')} />}
              </div>
            );
          })}
        </div>
      </section>

      <MaisAjuda titulo="Todas as contas do mês">
        {ev.map((x) => (
          <div className="gs-linha" key={x.id}>
            <div className="gs-corpo">
              <b>{x.nome}</b>
              <small>dia {Number(x.data.slice(8, 10))} · {x.paga ? 'paga' : x.dias < 0 ? `atrasada desde ${diaCurto(x.data)}` : x.dias === 0 ? 'vence hoje' : x.dias === 1 ? 'vence amanhã' : x.dias <= 3 ? `vence em ${x.dias} dias` : 'em dia'}</small>
            </div>
            <span className="gs-valor">{brl(x.valor)}</span>
            {x.paga ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>Paga</span> : x.tipo === 'conta' ? <button type="button" className="gs-btn pequeno" onClick={() => setBaixa(x.id.slice(2))}>Dar baixa</button> : <Link to={x.rota!} className="gs-btn pequeno sec">Abrir</Link>}
          </div>
        ))}
        <p className="gs-sub" style={{ marginBottom: 0 }}>Atraso custa multa de 2% e juros de 1% ao mês, além do risco de nome sujo. Um aviso um dia antes resolve a maioria dos atrasos.</p>
      </MaisAjuda>
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
    </>
  );
}
