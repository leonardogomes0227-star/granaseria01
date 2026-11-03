import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useEstado } from './store';
import { guardar, removerAporte, salvarConfig, usarReserva } from './acoes';
import { gastoMensalMedio, guardadoNoMes, livreParaGastar, patrimonioGuardado, reservaMeta } from './selectores';
import { Barra, CampoDinheiro, Deslizante, Dica, Folha, Titulo } from './ui';
import { Anel } from './graficos';
import { brl, brl0, diaCurto, mesCurto, mesDe, somaMes } from './datas';
import { toast } from '../components/ui/Toast';
import { useHoje } from './useHoje';
import { acaoReserva, mesesParaMeta, mesesProtegido, MESES_RESERVA, planoMensalReserva } from './reservaLogica';
import { capacidadeDePagamento } from './painelDividas';
import { situacaoAtrasos } from './atrasosLogica';

/* ---------- Reserva de emergência: quantos meses você aguenta, a meta do mês e o que fazer agora ---------- */

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function Reserva() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [saque, setSaque] = useState(false);
  const [valorSaque, setValorSaque] = useState(0);
  const meta = reservaMeta(e, mes);
  const guardado = patrimonioGuardado(e);
  const gasto = gastoMensalMedio(e, mes);
  const protegido = mesesProtegido(e, mes);
  const metaMeses = e.config.reservaMeses ?? 6;
  const plano = planoMensalReserva(e);
  const feito = guardadoNoMes(e, mes);
  const falta = Math.max(0, meta - guardado);
  const completa = meta > 0 && falta <= 0;
  const prontos = mesesParaMeta(falta, plano);
  const acao = acaoReserva(e, mes, hoje);
  const cap = capacidadeDePagamento(e.config.renda, gasto);
  const recentes = [...e.aportes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
  const guardarAgora = (v: number) => {
    const id = guardar(v, 'reserva', 'reserva');
    if (id) toast(`${brl0(v)} guardados`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
  };

  const atrasadas = situacaoAtrasos(e, hoje).anteriores.length;
  return (
    <>
      <Titulo titulo="Reserva de emergência" sub="O dinheiro que segura a sua vida se a renda parar." />

      {meta <= 0 ? (
        <section className="gs-card destaque">
          <span className="gs-rotulo">Primeiro passo</span>
          <p style={{ margin: '6px 0 10px' }}>Pra calcular a sua meta eu preciso saber o quanto você gasta por mês.</p>
          <div className="gs-acoes" style={{ marginTop: 0 }}>
            <Link to="/mes" className="gs-btn">Cadastrar contas fixas</Link>
            <Link to="/mes?aba=dia" className="gs-btn sec">Anotar gastos</Link>
          </div>
        </section>
      ) : (
        <section className="gs-card destaque" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ flex: 'none', width: 104 }}><Anel pct={Math.min(100, (guardado / meta) * 100)} grande={completa ? '✓' : `${Math.round(Math.min(100, (guardado / meta) * 100))}%`} sub="da meta" tamanho={104} cor="var(--success)" /></div>
          <div>
            <span className="gs-rotulo">{completa ? 'Reserva completa' : 'Você aguenta'}</span>
            <p className="gs-grande" style={{ margin: '2px 0' }}>{protegido > 0 && protegido < 1 ? `${Math.max(1, Math.round(protegido * 30))} ${Math.round(protegido * 30) <= 1 ? 'dia' : 'dias'}` : `${fmt1(protegido)} ${protegido === 1 ? 'mês' : 'meses'}`}</p>
            <p className="gs-sub" style={{ margin: 0 }}>{brl0(guardado)} de {brl0(meta)}{!completa && prontos ? ` · pronta em ${mesCurto(somaMes(mes, prontos))}` : ''}</p>
          </div>
        </section>
      )}

      {meta > 0 && (
        <>
          <section className="gs-card">
            <span className="gs-rotulo">O que fazer agora</span>
            {atrasadas > 0 ? (
              <>
                <p style={{ margin: '6px 0 0' }}>Primeiro ponha {atrasadas === 1 ? 'a conta atrasada' : `as ${atrasadas} contas atrasadas`} em dia. A multa e os juros custam mais do que a reserva rende. Depois, a reserva volta a ser a prioridade.</p>
                <Link to="/plano/atrasos" className="gs-btn cheio" style={{ marginTop: 12 }}>Ver o plano do atraso</Link>
              </>
            ) : (
              <p style={{ margin: '6px 0 0' }}>{acao.texto}</p>
            )}
            {atrasadas === 0 && (acao.tipo === 'comecar' || acao.tipo === 'faltam') && acao.valor > 0 && (
              <button type="button" className="gs-btn cheio" style={{ marginTop: 12 }} onClick={() => guardarAgora(acao.valor)}>Guardei {brl0(acao.valor)}</button>
            )}
            {atrasadas === 0 && acao.tipo === 'divida' && <Link to="/plano/dividas" className="gs-btn" style={{ marginTop: 12 }}>Ver minhas dívidas</Link>}
            {atrasadas === 0 && !completa && plano > 0 && <div style={{ marginTop: 14 }}><Barra pct={Math.min(100, (feito / plano) * 100)} tom="ok" rotulo="Meta do mês" /><p className="gs-mudo" style={{ margin: '6px 0 0', fontSize: 13 }}>{brl0(feito)} de {brl0(plano)} neste mês</p></div>}
          </section>

          {completa ? (
            <section className="gs-card">
              <span className="gs-rotulo">E agora?</span>
              {[
                <>Mantenha. Se os seus gastos subirem, a meta sobe junto e eu aviso.</>,
                <>O que passar da meta pode render na aba <Link to="/investir">Investir</Link>.</>,
                <>Se precisar usar a reserva, registre em “Mais ajuda”. A meta volta a ser a prioridade.</>,
              ].map((t, i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0' }}><span className="gs-check" style={{ flex: 'none', fontWeight: 700 }}>{i + 1}</span><span>{t}</span></div>)}
            </section>
          ) : (
            <section className="gs-card">
              <Deslizante rotulo="Quanto guardar por mês" valor={plano} min={50} max={Math.max(2000, Math.ceil((Math.max(plano, cap) * 1.5) / 100) * 100)} passo={50} formato={brl0} onChange={(n) => salvarConfig({ reservaMensal: n })} />
              {prontos ? <Dica icone={<CalendarDays size={18} />}>Guardando {brl0(plano)} por mês, você completa a reserva em <b>{prontos} {prontos === 1 ? 'mês' : 'meses'}</b> ({mesCurto(somaMes(mes, prontos))}).</Dica> : null}
              {e.config.renda > 0 && (plano > cap && cap > 0
                ? <p className="gs-sub" style={{ margin: '8px 0 0' }}>Hoje sobram cerca de {brl0(cap)} por mês. {brl0(plano)} pode apertar.</p>
                : cap > 0 ? <p className="gs-sub" style={{ margin: '8px 0 0' }}>Cabe: hoje sobram cerca de {brl0(cap)} por mês.</p> : null)}
              {livreParaGastar(e, mes) < plano - feito && plano - feito > 0 && <p className="gs-banner" style={{ marginBottom: 0 }}>Este mês só restam {brl0(Math.max(0, livreParaGastar(e, mes)))} livres. Guardar tudo agora deixa o resto do mês apertado.</p>}
            </section>
          )}

          <details className="gs-card" style={{ padding: '4px 20px' }}>
            <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Sua meta: {metaMeses} meses de gasto (mudar)</summary>
            <div className="gs-chips" role="group" aria-label="Meses de segurança" style={{ marginTop: 8 }}>
              {MESES_RESERVA.map((m) => <button key={m} type="button" className={`gs-chip ${metaMeses === m ? 'on' : ''}`} aria-pressed={metaMeses === m} onClick={() => salvarConfig({ reservaMeses: m })}>{m} meses</button>)}
            </div>
            <p className="gs-sub" style={{ margin: '4px 0 0' }}>{metaMeses === 3 ? 'Mínimo, pra quem tem renda bem estável.' : metaMeses === 6 ? 'O mais comum, pra quem tem emprego com carteira.' : 'Pra autônomo ou renda que varia.'} Seu gasto médio é {brl0(gasto)} por mês.</p>
          </details>

        </>
      )}

      <details className="gs-card" style={{ padding: '4px 20px', marginTop: 12 }}>
        <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Mais ajuda</summary>
        <div style={{ paddingBottom: 12 }}>
          <span className="gs-rotulo">Onde deixar</span>
          {[
            ['✓', <><b>Liquidez diária:</b> você precisa do dinheiro rápido e sem susto.</>],
            ['✓', <><b>Baixo risco:</b> poupança, Tesouro Selic ou CDB com liquidez diária. Confira as regras vigentes.</>],
            ['✕', <><b>Nunca aqui:</b> ações, cripto e qualquer coisa que pode cair.</>],
          ].map(([i, t], k) => (
            <div key={k} style={{ display: 'flex', gap: 12, padding: '8px 0' }}><span className="gs-check" style={{ flex: 'none', background: i === '✕' ? 'var(--danger)' : 'var(--success)', color: '#fff' }}>{i}</span><span>{t}</span></div>
          ))}
          <p className="gs-sub">Perder o emprego ou ter um imprevisto grande leva meses pra resolver. Com a reserva, você não precisa pedir empréstimo nem entrar no rotativo do cartão na pior hora.</p>
          <button type="button" className="gs-btn sec" onClick={() => setSaque(true)}>Tive que usar a reserva</button>
          {recentes.length > 0 && (
            <>
              <span className="gs-rotulo" style={{ display: 'block', marginTop: 16 }}>Últimos movimentos</span>
              {recentes.map((a) => (
                <div className="gs-linha" key={a.id}>
                  <div className="gs-corpo"><b>{a.valor < 0 ? `− ${brl(-a.valor)}` : brl(a.valor)}</b><small>{diaCurto(a.data)} · {a.origem === 'saque' ? 'usou a reserva' : a.origem === 'reserva' ? 'reserva' : a.origem === 'meta' ? 'meta' : a.origem === 'extra' ? 'dinheiro extra' : a.origem === 'investimento' ? 'investimento' : 'manual'}</small></div>
                  <button type="button" className="gs-btn link" onClick={() => { removerAporte(a.id); toast('Removido', { acao: { rotulo: 'Desfazer', onClick: () => guardar(a.valor, a.origem, a.agenteId, a.data) } }); }}>Remover</button>
                </div>
              ))}
            </>
          )}
        </div>
      </details>

      <Folha aberta={saque} onFechar={() => setSaque(false)} titulo="Tive que usar a reserva">
        <p className="gs-sub" style={{ marginTop: 0 }}>Sem culpa: ela existe pra isso. Registre quanto você tirou e eu ajusto o plano pra repor.</p>
        <CampoDinheiro rotulo="Quanto você usou?" valor={valorSaque} onChange={setValorSaque} grande />
        <div className="gs-acoes">
          <button type="button" className="gs-btn sec" onClick={() => setSaque(false)}>Cancelar</button>
          <button
            type="button"
            className="gs-btn"
            disabled={!(valorSaque > 0)}
            onClick={() => {
              const id = usarReserva(valorSaque);
              if (id) toast(`${brl0(valorSaque)} registrados`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
              setValorSaque(0);
              setSaque(false);
            }}
          >
            Registrar
          </button>
        </div>
      </Folha>
    </>
  );
}
