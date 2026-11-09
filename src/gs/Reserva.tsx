import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Flame, Lock, Medal, Trophy } from 'lucide-react';
import { useEstado } from './store';
import { guardar, removerAporte, salvarConfig, usarReserva } from './acoes';
import { gastoMensalMedio, guardadoNoMes, livreParaGastar, patrimonioGuardado, reservaMeta } from './selectores';
import { Barra, CampoDinheiro, Deslizante, Dica, Folha, Titulo } from './ui';
import { brl, brl0, diaCurto, mesCurto, mesDe, somaMes } from './datas';
import { toast } from '../components/ui/Toast';
import { useHoje } from './useHoje';
import { acaoReserva, conquistasReserva, jogoDaReserva, mesesGuardando, mesesParaMeta, mesesProtegido, MESES_RESERVA, planoMensalReserva } from './reservaLogica';
import { confete, vibrar } from '../lib/celebrar';
import { getEstado } from './store';
import { capacidadeDePagamento } from './painelDividas';
import { situacaoAtrasos } from './atrasosLogica';

/* ---------- Reserva de emergência como um jogo: fases até a meta, a missão do mês, sequência e conquistas ---------- */

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMesCurto = (mes: string) => MESES_NOME[Number(mes.slice(5, 7)) - 1];

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
  const jogo = jogoDaReserva(e, mes);
  const sequencia = mesesGuardando(e, mes);
  const missaoFeita = plano > 0 && feito >= plano - 0.005;
  const conquistas = conquistasReserva(protegido, sequencia, completa);
  const guardarAgora = (v: number) => {
    const antes = jogoDaReserva(getEstado(), mes).nivel;
    const id = guardar(v, 'reserva', 'reserva');
    if (!id) return;
    const depois = jogoDaReserva(getEstado(), mes);
    vibrar(40);
    if (depois.nivel > antes) {
      confete('grande');
      toast(`Subiu de fase! ${depois.fases[depois.nivel - 1].nome}`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
    } else {
      confete('pequeno');
      toast(`+${brl0(v)} na reserva`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
    }
  };

  const atrasadas = situacaoAtrasos(e, hoje).anteriores.length;
  return (
    <>
      <Titulo titulo="Reserva de emergência" sub="O dinheiro que segura a sua vida se a renda parar." />

      {meta <= 0 ? (
        <section className="gs-card destaque">
          <span className="gs-rotulo">Primeiro passo</span>
          <p style={{ margin: '6px 0 10px' }}>Pra montar as fases da sua reserva eu preciso saber quanto você gasta por mês.</p>
          <div className="gs-acoes" style={{ marginTop: 0 }}>
            <Link to="/lancamentos?aba=contas" className="gs-btn">Cadastrar contas fixas</Link>
            <Link to="/lancamentos?aba=dia" className="gs-btn sec">Anotar gastos</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="gs-card destaque gs-jogo">
            {completa ? (
              <>
                <span className="gs-rotulo">Todas as fases completas</span>
                <p className="gs-grande" style={{ margin: '4px 0' }}><Trophy size={30} style={{ verticalAlign: '-4px', marginRight: 8, color: '#D8B060' }} />Reserva completa</p>
                <p className="gs-sub" style={{ margin: 0 }}>{brl0(guardado)} guardados. Você aguenta {fmt1(protegido)} meses sem renda.</p>
              </>
            ) : (
              <>
                <span className="gs-rotulo">Fase {jogo.nivel + 1} de {jogo.fases.length}</span>
                <p className="gs-grande" style={{ margin: '4px 0 2px', fontSize: 'clamp(24px, 7vw, 32px)' }}>{jogo.proxima!.nome}</p>
                <p className="gs-sub" style={{ margin: 0 }}>{jogo.proxima!.porque}</p>
                <div className="gs-xp" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(jogo.pct)} aria-label="Progresso da fase">
                  <i style={{ width: `${Math.max(3, jogo.pct)}%` }} />
                  <span>{brl0(guardado)} / {brl0(jogo.proxima!.alvo)}</span>
                </div>
                <p className="gs-sub" style={{ margin: 0 }}>
                  Faltam <b>{brl0(jogo.falta)}</b> pra passar de fase{jogo.proxima!.quando ? ` · no seu ritmo, em ${mesCurto(jogo.proxima!.quando)}` : ''}. Hoje você aguenta {protegido > 0 && protegido < 1 ? `${Math.max(1, Math.round(protegido * 30))} ${Math.round(protegido * 30) <= 1 ? 'dia' : 'dias'}` : `${fmt1(protegido)} ${protegido === 1 ? 'mês' : 'meses'}`} sem renda.
                </p>
              </>
            )}
          </section>

          {!completa && (
            <section className={`gs-card gs-missao ${missaoFeita ? 'feita' : ''}`}>
              <span className="gs-rotulo">Missão de {nomeMesCurto(mes)}</span>
              {atrasadas > 0 ? (
                <>
                  <p style={{ margin: '6px 0 0' }}><b>Missão pausada.</b> Primeiro ponha {atrasadas === 1 ? 'a conta atrasada' : `as ${atrasadas} contas atrasadas`} em dia: a multa custa mais do que a reserva rende. Depois a missão volta.</p>
                  <Link to="/plano/atrasos" className="gs-btn cheio" style={{ marginTop: 12 }}>Ver o plano do atraso</Link>
                </>
              ) : acao.tipo === 'divida' ? (
                <>
                  <p style={{ margin: '6px 0 0' }}>{acao.texto}</p>
                  <Link to="/plano/dividas" className="gs-btn" style={{ marginTop: 12 }}>Ver minhas dívidas</Link>
                </>
              ) : (
                <>
                  <p className="gs-medio" style={{ margin: '6px 0 8px', fontSize: 20 }}>{missaoFeita ? <><Check size={20} style={{ verticalAlign: '-3px', color: 'var(--success)' }} /> Missão cumprida: {brl0(feito)} guardados</> : `Guardar ${brl0(plano)}`}</p>
                  <Barra pct={plano > 0 ? Math.min(100, (feito / plano) * 100) : 0} tom="ok" rotulo="Missão do mês" />
                  <p className="gs-mudo" style={{ margin: '6px 0 0', fontSize: 13 }}>{brl0(feito)} de {brl0(plano)}{!missaoFeita && e.config.diaSalario ? ` · guarde assim que o salário cair (dia ${e.config.diaSalario})` : ''}</p>
                  {!missaoFeita && acao.valor > 0 && <button type="button" className="gs-btn cheio" style={{ marginTop: 12 }} onClick={() => guardarAgora(acao.valor)}>Guardei {brl0(acao.valor)}</button>}
                  {livreParaGastar(e, mes) < 0 && !missaoFeita && <p className="gs-nota">Este mês está sem folga. Guarde o que der: até R$ 50 conta e mantém a sequência.</p>}
                </>
              )}
              {sequencia >= 1 && <p className="gs-sequencia"><Flame size={16} /> {sequencia} {sequencia === 1 ? 'mês' : 'meses'} seguidos guardando</p>}
            </section>
          )}

          <h2 className="gs-h2">O mapa até a meta</h2>
          <ol className="gs-fases">
            {jogo.fases.map((f, i) => {
              const estado = f.feita ? 'feita' : i === jogo.nivel ? 'atual' : 'bloqueada';
              return (
                <li key={f.n} className={`gs-fase ${estado}`}>
                  <span className="gs-fase-no" aria-hidden="true">{f.feita ? <Check size={16} /> : estado === 'bloqueada' ? <Lock size={14} /> : f.n}</span>
                  <div className="gs-corpo">
                    <b>{f.nome}</b>
                    <small>{f.porque}</small>
                    <small className="gs-fase-meta">{brl0(f.alvo)} · {f.feita ? 'conquistada' : f.quando ? `chega em ${mesCurto(f.quando)}` : 'defina quanto guardar por mês'}</small>
                  </div>
                </li>
              );
            })}
          </ol>

          <section className="gs-card">
            <span className="gs-rotulo">A sua meta, e por quê</span>
            <p className="gs-medio" style={{ margin: '6px 0 4px', fontSize: 19 }}>{metaMeses} meses × {brl0(gasto)} = {brl0(meta)}</p>
            <p className="gs-sub" style={{ margin: '0 0 10px' }}>{brl0(gasto)} é o que você gasta por mês (contas fixas + a média do dia a dia). A meta é aguentar {metaMeses} meses sem renda: tempo pra se reorganizar se perder o emprego ou ficar doente, sem pegar empréstimo nem entrar no rotativo do cartão.</p>
            <div className="gs-chips" role="group" aria-label="Meses de segurança">
              {MESES_RESERVA.map((m) => <button key={m} type="button" className={`gs-chip ${metaMeses === m ? 'on' : ''}`} aria-pressed={metaMeses === m} onClick={() => salvarConfig({ reservaMeses: m })}>{m} meses</button>)}
            </div>
            <p className="gs-nota" style={{ margin: '0 0 16px' }}>{metaMeses === 3 ? '3 meses: o mínimo, pra quem tem renda bem estável.' : metaMeses === 6 ? '6 meses: o mais comum, pra quem tem emprego com carteira.' : '12 meses: pra autônomo ou renda que varia.'}</p>
            {!completa && (
              <>
                <Deslizante rotulo="Quanto guardar por mês" valor={plano} min={50} max={Math.max(2000, Math.ceil((Math.max(plano, cap) * 1.5) / 100) * 100)} passo={50} formato={brl0} onChange={(n) => salvarConfig({ reservaMensal: n })} />
                {prontos ? <Dica icone={<CalendarDays size={18} />}>Guardando {brl0(plano)} por mês, a reserva fica completa em <b>{prontos} {prontos === 1 ? 'mês' : 'meses'}</b> ({mesCurto(somaMes(mes, prontos))}).{prontos > 24 && jogo.proxima ? ` Parece longe? Foque na próxima fase: ${jogo.proxima.nome.toLowerCase()}${jogo.proxima.quando ? `, em ${mesCurto(jogo.proxima.quando)}` : ''}.` : ''}</Dica> : null}
                {e.config.renda > 0 && cap > 0 && <p className="gs-sub" style={{ margin: '8px 0 0' }}>{plano > cap ? `Hoje sobram cerca de ${brl0(cap)} por mês: ${brl0(plano)} pode apertar.` : `Cabe: hoje sobram cerca de ${brl0(cap)} por mês.`}</p>}
              </>
            )}
            {completa && <p className="gs-sub" style={{ margin: '8px 0 0' }}>O que passar da meta pode render na aba <Link to="/investir">Investir</Link>. Se os seus gastos subirem, a meta sobe junto e eu aviso.</p>}
          </section>

          <section className="gs-card">
            <span className="gs-rotulo">Conquistas · {conquistas.filter((c) => c.feita).length} de {conquistas.length}</span>
            <div className="gs-medalhas">
              {conquistas.map((c) => (
                <div key={c.id} className={`gs-medalha ${c.feita ? 'on' : ''}`} title={c.nome}>
                  <span aria-hidden="true">{c.feita ? <Medal size={20} /> : <Lock size={16} />}</span>
                  <small>{c.nome}</small>
                </div>
              ))}
            </div>
          </section>
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
