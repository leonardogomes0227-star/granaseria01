import { useEffect, useMemo, useState } from 'react';
import { RespostaFerramenta } from './RespostaFerramenta';
import { Link, useSearchParams } from 'react-router-dom';
import { Flame, HandCoins, Percent, Wallet } from 'lucide-react';
import { FaixaKpis, GraficoBarras } from './PainelUI';
import { useEstado } from './store';
import { brl0, mesAtual, mesCurto, somaMes, hoje as hojeSP, pct, mesDe, diasEntre, vencimentoNoMes } from './datas';
import { compararEstrategias, jurosDoMes, linkWhatsApp, ordenar, mensagemParaOBanco, PEDIDOS, type Pedido, paraSim, saldoAtual, simular } from './dividas';
import { desfazerPagamentoDivida, pagarDivida, removerDivida, restaurarDivida, salvarDivida, salvarPlanoDividas } from './acoes';
import { NovaDividaSheet } from './NovaDivida';
import { Barra, Campo, CampoDinheiro, CampoNumero, Deslizante, Dica, Folha, Titulo, Vazio } from './ui';
import { Anel, LinhaDoTempo } from './graficos';
import { gastoMensalMedio } from './selectores';
import { CalculaJuro, MaisRapido, Quitadas, Quitou, TIPOS_DIVIDA } from './DividasExtras';
import { efeitoNaDivida } from './extrasLogica';
import { Amortizacao } from './Amortizacao';
import { FestaQuitou, type Quitada } from './FestaQuitou';
import { capacidadeDePagamento, completarParcelada, economiaDoPlano, pagamentoSugerido, pagoNaDivida, pagoNoMes, planoDoMes, proximaAcao, quitarMaisRapido } from './painelDividas';
import { useHoje } from './useHoje';
import { apagarComDesfazer, toast } from '../components/ui/Toast';
import { useUmaVez } from './umaVez';
import type { Divida } from './tipos';

/* ---------- Quitar dívidas: um painel vivo. Contagem até ficar livre, meta do mês, o que fazer agora e quanto o seu bolso aguenta. ---------- */

export function Dividas() {
  const e = useEstado();
  const [editando, setEditando] = useState<Divida | 'nova' | null>(null);
  const [simples, setSimples] = useState(false);
  const [params, setParams] = useSearchParams();
  const pedido = params.get('nova');
  useEffect(() => {
    if (pedido) {
      setSimples(true);
      if (pedido !== '1') setTipoPedido(pedido);
      setParams({}, { replace: true });
    }
  }, [pedido, setParams]);
  const [tipoPedido, setTipoPedido] = useState<string | undefined>(undefined);
  const [festa, setFesta] = useState<Quitada | null>(null);
  const tem = e.dividas.length > 0;
  return (
    <>
      <div className="dv-cab">
        <Titulo titulo="Dívidas" sub={tem ? 'Seu caminho até ficar livre, com o que pagar este mês.' : 'Descubra quando você fica livre delas.'} />
        {tem && <button type="button" className="gs-btn pequeno" onClick={() => setSimples(true)}>+ Nova dívida</button>}
      </div>
      <RespostaFerramenta id="dividas" />
      {tem ? (
        <Painel onNova={() => setSimples(true)} onEditar={setEditando} onQuitou={setFesta} />
      ) : (
        <section className="gs-card destaque">
          <h2 className="gs-h2" style={{ marginTop: 0 }}>Cadastre sua primeira dívida</h2>
          <p style={{ margin: '0 0 10px' }}>Em 1 minuto você vê:</p>
          {['O dia em que você fica livre das dívidas', 'Quanto cabe no seu bolso por mês', 'Um aviso antes de cada parcela vencer'].map((t) => <div key={t} style={{ display: 'flex', gap: 10, padding: '4px 0' }}><span className="gs-check" style={{ flex: 'none' }}>✓</span><span>{t}</span></div>)}
          <button type="button" className="gs-btn cheio" style={{ marginTop: 14 }} onClick={() => setSimples(true)}>Cadastrar dívida</button>
          <p className="gs-nota">Não sabe o juro ou a parcela? Pode chutar. Você ajusta depois.</p>
        </section>
      )}
      <NovaDividaSheet aberta={simples} tipoInicial={tipoPedido} onFechar={() => { setSimples(false); setTipoPedido(undefined); }} onCompleto={() => setEditando('nova')} />
      <FormDivida valor={editando} onFechar={() => setEditando(null)} />
      <FestaQuitou quitada={festa} onFechar={() => setFesta(null)} />
    </>
  );
}

const anual = (mensalPct: number) => ((1 + mensalPct / 100) ** 12 - 1) * 100;
const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;

function Painel({ onNova, onEditar, onQuitou }: { onNova: () => void; onEditar: (d: Divida) => void; onQuitou: (q: Quitada) => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [pagar, setPagar] = useState<Divida | null>(null);
  const [aba, setAba] = useState<'hoje' | 'caminho' | 'negociar'>('hoje');
  const [adiant, setAdiant] = useState(0);
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  const sim = useMemo(() => paraSim(e.dividas), [e.dividas]);
  const minimo = sim.reduce((t, d) => t + Math.min(d.parcelaMinima, d.saldo), 0);
  const totalAtual = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
  const totalOriginal = e.dividas.reduce((t, d) => t + d.saldo, 0);
  const cap = capacidadeDePagamento(e.config.renda, gastoMensalMedio(e, mes));
  const padrao = { estrategia: 'maior-juro' as const, pagamentoMensal: pagamentoSugerido(minimo, cap, totalAtual), criadoEm: hoje };
  const plano = e.planoDividas ?? padrao;
  useEffect(() => {
    if (!e.planoDividas && sim.length > 0) salvarPlanoDividas(padrao);
  }, [e.planoDividas, sim.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // o plano nunca fica abaixo das parcelas: elas vão ser cobradas de qualquer jeito
  useEffect(() => {
    if (e.planoDividas && minimo > 0 && e.planoDividas.pagamentoMensal < minimo - 0.5) salvarPlanoDividas({ ...e.planoDividas, pagamentoMensal: Math.ceil(minimo) });
  }, [minimo, e.planoDividas]);
  const resultado = useMemo(() => simular(sim, plano.pagamentoMensal, plano.estrategia), [sim, plano.pagamentoMensal, plano.estrategia]);
  const comp = useMemo(() => compararEstrategias(sim, plano.pagamentoMensal), [sim, plano.pagamentoMensal]);
  const mais = useMemo(() => simular(sim, plano.pagamentoMensal + 200, plano.estrategia), [sim, plano.pagamentoMensal, plano.estrategia]);
  const partes = planoDoMes(sim, plano.pagamentoMensal, plano.estrategia);
  const mudar = (patch: Partial<typeof plano>) => salvarPlanoDividas({ ...plano, ...patch });
  if (totalAtual <= 0) return <Quitou onNova={onNova} />;

  const progresso = totalOriginal > 0 ? ((totalOriginal - totalAtual) / totalOriginal) * 100 : 0;
  const eco = economiaDoPlano(sim, plano.pagamentoMensal, plano.estrategia);
  const pagoMes = pagoNoMes(e.dividas, mes);
  const semJuros = sim.every((d) => d.jurosMensal === 0);
  const acao = proximaAcao(abertas, plano.pagamentoMensal, hoje, pagoMes);
  const extra = Math.max(0, Math.round(plano.pagamentoMensal - minimo));
  const mr = quitarMaisRapido(sim, extra, plano.estrategia);
  const ad = adiant > 0 ? efeitoNaDivida(sim, plano.pagamentoMensal, plano.estrategia, adiant) : null;
  const fim = resultado.quita && !resultado.insuficiente ? resultado.dataFinal : null;
  const dias = fim ? Math.max(0, diasEntre(hoje, vencimentoNoMes(fim, 31))) : null;
  // a ordem em que se paga (a estratégia escolhida), não a ordem em que cada dívida termina
  const ordem = ordenar(sim, plano.estrategia).map((d) => d.id);
  const sugerido = pagar ? Math.max(0, (partes.find((p) => p.id === pagar.id)?.valor ?? pagar.parcelaMinima) - pagoNaDivida(pagar, mes)) || pagar.parcelaMinima : 0;

  return (
    <>
      <div className="gs-seg" role="tablist" aria-label="Quitar dívidas" style={{ marginBottom: 14 }}>
        {([['hoje', 'Hoje'], ['caminho', 'Caminho'], ['negociar', 'Negociar']] as const).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? 'on' : ''} onClick={() => setAba(id)}>{nome}</button>
        ))}
      </div>

      {aba === 'hoje' && (
        <>
          <FaixaKpis itens={[
            { rotulo: 'Você deve', valor: totalAtual, icone: Wallet, tom: 'perigo', nota: `${abertas.length} ${abertas.length === 1 ? 'dívida' : 'dívidas'} em aberto` },
            { rotulo: 'Já pago', valor: Math.round(progresso), formato: 'pct', icone: Percent, tom: progresso > 0 ? 'ok' : '', nota: `de ${brl0(totalOriginal)} no total` },
            { rotulo: 'Juros por mês', valor: jurosDoMes(sim), icone: Flame, tom: 'aviso', nota: 'o que a dívida cobra' },
            { rotulo: 'Plano mensal', valor: plano.pagamentoMensal, icone: HandCoins, nota: `pago neste mês: ${brl0(pagoMes)}` },
          ]} />
          <GraficoBarras titulo="Quanto falta em cada dívida" sub="saldo em aberto"
            dados={abertas.map((d) => ({ rotulo: d.nome, valor: saldoAtual(d), tom: d.jurosMensal >= 8 ? 'perigo' : d.jurosMensal >= 3 ? 'aviso' : '', legenda: `${d.nome} · ${d.jurosMensal}% ao mês` }) as const)} />
          <section className="gs-card destaque dv-hero" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {progresso >= 1 && <div style={{ flex: 'none', width: 104 }}><Anel pct={progresso} grande={`${Math.round(progresso)}%`} sub="já pago" tamanho={104} cor="var(--success)" /></div>}
            <div>
              {dias !== null ? (
                <>
                  <span className="gs-rotulo">Você fica livre em</span>
                  <p className="gs-grande" style={{ margin: '2px 0' }}>{dias > 365 ? meses(resultado.meses) : `${dias} ${dias === 1 ? 'dia' : 'dias'}`}</p>
                  <p className="gs-sub" style={{ margin: 0 }}>{mesCurto(fim!)} · você deve {brl0(totalAtual)}</p>
                  <p className="gs-sub" style={{ margin: '4px 0 0' }}>Juros: {brl0(jurosDoMes(sim))} por mês</p>
                </>
              ) : resultado.insuficiente ? (
                <>
                  <p className="gs-grande" style={{ margin: '2px 0' }}>A dívida está crescendo</p>
                  <p className="gs-sub" style={{ margin: 0 }}>Os juros ({brl0(jurosDoMes(sim))} por mês) passam do que você paga ({brl0(plano.pagamentoMensal)}). Pague pelo menos <b>{brl0(resultado.minimoNecessario)}</b> ou negocie.</p>
                  <div className="gs-acoes" style={{ marginTop: 10 }}>
                    {cap >= resultado.minimoNecessario && <button type="button" className="gs-btn pequeno" onClick={() => mudar({ pagamentoMensal: Math.ceil(resultado.minimoNecessario) })}>Pagar {brl0(Math.ceil(resultado.minimoNecessario))}</button>}
                    <button type="button" className="gs-btn pequeno sec" onClick={() => setAba('negociar')}>Negociar</button>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0 }}>Aumente o pagamento mensal pra ver a data.</p>
              )}
            </div>
            <div className="dv-prog" style={{ flexBasis: '100%' }}>
              <Barra pct={progresso} tom="ok" rotulo="Quanto da dívida já foi paga" />
              <small>{Math.round(progresso)}% pago · faltam {brl0(totalAtual)} de {brl0(totalOriginal)}</small>
            </div>
          </section>

          <section className="gs-card">
            <span className="gs-rotulo">Pague este mês</span>
            {acao.tipo === 'vence' && <p className="gs-banner" style={{ margin: '8px 0 0' }}>{acao.texto}</p>}
            {partes.map((pt) => {
              const d = abertas.find((x) => x.id === pt.id);
              if (!d || pt.valor <= 0) return null;
              const jaPagou = pagoNaDivida(d, mes);
              const feito = jaPagou >= pt.valor - 0.005;
              return (
                <div key={pt.id} className="gs-linha">
                  <div className="gs-corpo">
                    <b>{feito ? '✓ ' : ''}{d.nome}</b>
                    <small>{feito ? `Pago: ${brl0(jaPagou)}` : `${brl0(pt.valor - jaPagou)}${d.venceDia ? ` · vence dia ${d.venceDia}` : ''}`}</small>
                  </div>
                  {!feito && <button type="button" className="gs-btn pequeno" onClick={() => setPagar(d)}>Paguei</button>}
                </div>
              );
            })}
            <Barra pct={plano.pagamentoMensal > 0 ? (pagoMes / plano.pagamentoMensal) * 100 : 0} tom="ok" rotulo="Meta do mês" />
            <p className="gs-mudo" style={{ margin: '6px 0 0', fontSize: 13 }}>{brl0(pagoMes)} de {brl0(plano.pagamentoMensal)} neste mês</p>
          </section>

          <h2 className="cm-h2">{abertas.length > 1 ? `Suas ${abertas.length} dívidas` : 'Sua dívida'}</h2>
          <div className="dv-lista">
            {[...abertas].sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id)).map((d) => {
              const q = resultado.quitaEm[d.id];
              const pos = ordem.indexOf(d.id);
              const pago = d.saldo - saldoAtual(d);
              const pctPago = d.saldo > 0 ? (pago / d.saldo) * 100 : 0;
              return (
                <article key={d.id} className="dv-card">
                  <div className="dv-topo">
                    <div className="gs-corpo">
                      {abertas.length > 1 && pos >= 0 && <span className="dv-pos">{pos + 1}ª a pagar</span>}
                      <b>{d.nome}</b>
                      {anual(d.jurosMensal) >= 100 && <span className="gs-etiqueta perigo" style={{ marginTop: 4 }}>juro muito alto</span>}
                    </div>
                    <strong className="dv-saldo">{brl0(saldoAtual(d))}</strong>
                  </div>
                  <small>{d.jurosMensal > 0 ? `${pct(d.jurosMensal, 1)} ao mês` : 'sem juros'}{q ? ` · quita ${mesCurto(somaMes(mesAtual(), q))}` : ''}{d.venceDia ? ` · vence dia ${d.venceDia}` : ''}</small>
                  <Barra pct={pctPago} tom="ok" rotulo={`Quanto já pagou de ${d.nome}`} />
                  <div className="dv-pe">
                    <span>{pago > 0 ? `${Math.round(pctPago)}% pago` : 'Nenhum pagamento ainda'}</span>
                    <button type="button" className="gs-btn link" onClick={() => onEditar(d)}>{d.parcelaMinima <= 0 ? 'Informar a parcela' : 'Editar'}</button>
                  </div>
                </article>
              );
            })}
          </div>

          <Quitadas />
        </>
      )}

      {aba === 'caminho' && (
        <>
          {eco && eco.economia > 0 && <p className="gs-banner" style={{ marginTop: 0 }}>Seu plano economiza <b>{brl0(eco.economia)}</b> de juros, comparado a pagar só a parcela.</p>}
          {eco?.semPlano && <p className="gs-banner" style={{ marginTop: 0 }}>Pagando só a parcela, {abertas.length > 1 ? 'essas dívidas nunca zeram' : 'essa dívida nunca zera'}. Seu plano resolve.</p>}
          {resultado.quita && !resultado.insuficiente && resultado.meses > 0 && (
            <section className="gs-card">
              <span className="gs-rotulo">Quando cada dívida zera</span>
              <LinhaDoTempo
                rotulo="Quando cada dívida zera"
                barras={ordem.map((id) => abertas.find((d) => d.id === id)).filter((d): d is Divida => Boolean(d) && resultado.quitaEm[d!.id] !== undefined).map((d) => ({ id: d.id, nome: d.nome, meses: resultado.quitaEm[d.id], fim: mesCurto(somaMes(mesAtual(), resultado.quitaEm[d.id])), perigo: anual(d.jurosMensal) >= 100 }))}
              />
            </section>
          )}
          {cap > 0 && plano.pagamentoMensal > cap && (
            <p className="gs-banner" role="note" style={{ marginTop: 0 }}>
              Seu plano ({brl0(plano.pagamentoMensal)}) passa do que sobra por mês ({brl0(cap)}).{' '}
              {cap >= minimo && <button type="button" className="gs-btn link" onClick={() => mudar({ pagamentoMensal: Math.max(minimo, Math.floor(cap / 10) * 10) })}>Usar {brl0(Math.max(minimo, Math.floor(cap / 10) * 10))}</button>}
            </p>
          )}
          {!semJuros && minimo > 0 && (
            <section className="gs-card">
              <span className="gs-rotulo">E se eu pagar a mais?</span>
              <Deslizante rotulo="A mais por mês, além da parcela" valor={extra} min={0} max={Math.max(1000, Math.ceil((Math.max(cap - minimo, extra) * 1.2) / 100) * 100)} passo={50} formato={(n) => `+ ${brl0(n)}`} onChange={(n) => mudar({ pagamentoMensal: Math.ceil(minimo) + n })} />
              {mr && (
                <div className="gs-tres" style={{ marginTop: 12, gap: 8 }}>
                  <div className="gs-mini"><small>Só a parcela</small><b>{mr.base.fim ? mesCurto(mr.base.fim) : 'não zera'}</b><small>{mr.base.fim ? `${brl0(mr.base.juros)} de juros` : 'não cobre os juros'}</small></div>
                  <div className="gs-mini m"><small>{extra > 0 ? `Com + ${brl0(extra)}` : 'Seu plano'}</small><b>{mr.com.fim ? mesCurto(mr.com.fim) : '-'}</b><small>{brl0(mr.com.juros)} de juros</small></div>
                  <div className="gs-mini"><small>Plano + R$ 200</small><b>{mais.quita && mais.dataFinal ? mesCurto(mais.dataFinal) : '-'}</b><small>{mais.quita && resultado.quita && resultado.meses > mais.meses ? `${meses(resultado.meses - mais.meses)} antes` : ''}</small></div>
                </div>
              )}
              {mr && mr.mesesAntes > 0 && <p className="gs-banner" style={{ marginBottom: 0 }}>Você termina <b>{meses(mr.mesesAntes)} antes</b> e economiza <b>{brl0(mr.economia)}</b> de juros.</p>}
              {abertas.length > 1 && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Mudar a ordem de pagamento</summary>
                  <div className="gs-chips" role="group" aria-label="Ordem de pagamento">
                    {(['bola-de-neve', 'maior-juro'] as const).map((id) => <button key={id} type="button" className={`gs-chip ${plano.estrategia === id ? 'on' : ''}`} aria-pressed={plano.estrategia === id} onClick={() => mudar({ estrategia: id })}>{id === 'maior-juro' ? 'Maior juro primeiro' : 'Menor dívida primeiro'}</button>)}
                  </div>
                  {comp.economia >= 1 && <p className="gs-nota">{comp.melhor === 'maior-juro' ? 'Maior juro primeiro' : 'Menor dívida primeiro'} economiza {brl0(comp.economia)} em juros.</p>}
                </details>
              )}
            </section>
          )}
          {!semJuros && (
            <section className="gs-card">
              <span className="gs-rotulo">Entrou um dinheiro extra?</span>
              <CampoDinheiro rotulo="Quanto você pode usar na dívida" valor={adiant} onChange={setAdiant} />
              {ad && (ad.meses > 0 || ad.economia > 0) && <p className="gs-banner" style={{ marginTop: 0 }}>Você termina <b>{meses(ad.meses)} antes</b> e economiza <b>{brl0(ad.economia)}</b> de juros.</p>}
              <p className="gs-nota">Pra dividir entre dívida, reserva e você, use o <Link to="/plano/extras">Dinheiro extra</Link>.</p>
            </section>
          )}
        </>
      )}

      {aba === 'negociar' && (
        <>
          <PassoProposta mensal={plano.pagamentoMensal} />
          <MaisRapido sim={sim} pagamento={plano.pagamentoMensal} estrategia={plano.estrategia} />
          <details className="gs-card" style={{ padding: '4px 20px' }}>
            <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Quanto da parcela é juro (avançado)</summary>
            <Amortizacao />
          </details>
        </>
      )}
      <PagarSheet divida={pagar} sugerido={sugerido} onFechar={() => setPagar(null)} onQuitou={onQuitou} />
    </>
  );
}
function PagarSheet({ divida, sugerido, onFechar, onQuitou }: { divida: Divida | null; sugerido: number; onFechar: () => void; onQuitou: (q: Quitada) => void }) {
  const [v, setV] = useState(0);
  const envio = useUmaVez();
  useEffect(() => { envio.soltar(); setV(divida ? Math.min(sugerido || 0, saldoAtual(divida)) : 0); }, [divida, sugerido, envio]);
  return (
    <Folha aberta={Boolean(divida)} onFechar={onFechar} titulo={divida ? `Pagamento em ${divida.nome}` : ''}>
      <CampoDinheiro rotulo="Quanto você pagou?" valor={v} onChange={setV} grande />
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button
          type="button"
          className="gs-btn"
          disabled={!(v > 0)}
          onClick={() => {
            envio.tentar(() => {
              if (!divida || !(v > 0)) return false;
              const data = hojeSP();
              const valor = v;
              const id = divida.id;
              const quita = valor >= saldoAtual(divida) - 0.005;
              if (!pagarDivida(id, valor, data)) return false;
              if (quita) {
                onQuitou({ nome: divida.nome, valor: divida.saldo, libera: divida.parcelaMinima, desfazer: () => desfazerPagamentoDivida(id, data, valor) });
              }
              else toast(`Pagamento de ${brl0(valor)} registrado`, { acao: { rotulo: 'Desfazer', onClick: () => desfazerPagamentoDivida(id, data, valor) } });
              onFechar();
              return true;
            });
          }}
        >
          Registrar pagamento
        </button>
      </div>
    </Folha>
  );
}

/* ---------- assistente de 4 passos ---------- */
function FormDivida({ valor, onFechar }: { valor: Divida | 'nova' | null; onFechar: () => void }) {
  const edit = valor && valor !== 'nova' ? valor : null;
  const [tipo, setTipo] = useState<'parcelada' | 'rotativa'>('parcelada');
  const [nome, setNome] = useState('');
  const [saldo, setSaldo] = useState(0);
  const [juros, setJuros] = useState<number | ''>('');
  const [min, setMin] = useState(0);
  const [faltam, setFaltam] = useState<number | ''>('');
  const [dia, setDia] = useState<number | ''>('');
  const [tentou, setTentou] = useState(false);
  useEffect(() => {
    if (!valor) return;
    setTipo(edit?.tipo ?? (edit ? 'rotativa' : 'parcelada'));
    setNome(edit?.nome ?? '');
    setSaldo(edit ? saldoAtual(edit) : 0);
    setJuros(edit ? edit.jurosMensal : '');
    setMin(edit?.parcelaMinima ?? 0);
    setFaltam(edit?.parcelasRestantes ?? '');
    setDia(edit?.venceDia ?? '');
    setTentou(false);
  }, [valor, edit]);
  const parcelada = tipo === 'parcelada';
  // prévia do que o app vai completar sozinho
  const previa = parcelada && min > 0 && typeof faltam === 'number' && faltam > 0 ? completarParcelada({ parcela: min, n: faltam, saldo, juros }) : null;
  const salvar = () => {
    setTentou(true);
    let s = saldo;
    let j = juros;
    if (parcelada) {
      if (!(min > 0) || typeof faltam !== 'number' || !(faltam > 0)) return;
      const c = completarParcelada({ parcela: min, n: faltam, saldo, juros });
      s = c.saldo;
      j = c.juros;
    } else if (juros === '' || !(saldo > 0)) return;
    // ao editar, o saldo digitado vira o novo saldo e os pagamentos antigos já estão abatidos nele
    const ok = salvarDivida({ id: edit?.id, nome, saldo: edit ? s + edit.pagamentos.reduce((t, p) => t + p.valor, 0) : s, jurosMensal: j as number, parcelaMinima: min, venceDia: typeof dia === 'number' ? dia : undefined, tipo, parcelasRestantes: parcelada && typeof faltam === 'number' ? faltam : undefined });
    if (ok) onFechar();
  };
  return (
    <Folha aberta={Boolean(valor)} onFechar={onFechar} titulo={edit ? 'Editar dívida' : 'Nova dívida'}>
      <div className="gs-seg" role="tablist" aria-label="Como você paga essa dívida" style={{ marginBottom: 12 }}>
        <button type="button" role="tab" aria-selected={parcelada} className={parcelada ? 'on' : ''} onClick={() => setTipo('parcelada')}>Parcela fixa</button>
        <button type="button" role="tab" aria-selected={!parcelada} className={!parcelada ? 'on' : ''} onClick={() => setTipo('rotativa')}>Cartão / cheque especial</button>
      </div>
      {!edit && (
        <div className="gs-chips" role="group" aria-label="Tipo de dívida">
          {TIPOS_DIVIDA.filter((t) => t.tipo === tipo).map((t) => <button key={t.nome} type="button" className="gs-chip" onClick={() => { if (!nome.trim()) setNome(t.nome); if (juros === '') setJuros(t.juros); }}>{t.nome}</button>)}
        </div>
      )}
      <Campo rotulo="Nome ou credor" valor={nome} onChange={setNome} placeholder={parcelada ? 'Ex.: Financiamento do carro' : 'Ex.: Cartão do banco'} maxLength={60} erro={tentou && !nome.trim() ? 'Dê um nome.' : undefined} />
      {parcelada ? (
        <>
          <div className="gs-dois">
            <CampoDinheiro rotulo="Valor da parcela" valor={min} onChange={setMin} erro={tentou && !(min > 0) ? 'Digite a parcela.' : undefined} />
            <CampoNumero rotulo="Parcelas que faltam" valor={faltam} onChange={setFaltam} min={1} max={480} placeholder="Ex.: 36" erro={tentou && !(typeof faltam === 'number' && faltam > 0) ? 'Quantas faltam?' : undefined} />
          </div>
          <p className="gs-nota" style={{ marginTop: -6, marginBottom: 12 }}>Os dois de baixo são opcionais. Sabendo um deles, eu calculo o outro.</p>
          <div className="gs-dois">
            <CampoDinheiro rotulo="Quanto deve hoje (saldo)" valor={saldo} onChange={setSaldo} placeholder="Opcional" />
            <CampoNumero rotulo="Juros ao mês" sufixo="%" valor={juros} onChange={setJuros} min={0} max={30} placeholder="Opcional" />
          </div>
          {previa && <p className="gs-banner" style={{ marginTop: 0 }}>Saldo de <b>{brl0(previa.saldo)}</b> a <b>{pct(previa.juros, 2)} ao mês</b>. Termina em {faltam} {faltam === 1 ? 'mês' : 'meses'} só com a parcela.</p>}
        </>
      ) : (
        <>
          <CampoDinheiro rotulo="Quanto você deve hoje" valor={saldo} onChange={setSaldo} erro={tentou && !(saldo > 0) ? 'Digite o saldo.' : undefined} />
          <CalculaJuro onResultado={setJuros} />
          <div className="gs-dois">
            <CampoNumero rotulo="Juros ao mês" sufixo="%" valor={juros} onChange={setJuros} min={0} max={30} placeholder="Ex.: 12" erro={tentou && juros === '' ? 'Digite (0 se não tem).' : undefined} />
            <CampoDinheiro rotulo="Pagamento mínimo" valor={min} onChange={setMin} placeholder="R$ 0,00" />
          </div>
        </>
      )}
      <CampoNumero rotulo="Dia do vencimento (pra eu te avisar)" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 10 (opcional)" />
      {typeof juros === 'number' && juros >= 15 && <p className="gs-banner" role="note">Juro muito alto. Confira se digitou certo. Se for isso mesmo, vale tentar renegociar.</p>}
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button type="button" className="gs-btn" onClick={salvar}>Salvar</button>
      </div>
      {edit && <button type="button" className="gs-btn link" onClick={() => { removerDivida(edit.id); apagarComDesfazer(`${edit.nome} excluída`, () => restaurarDivida(edit)); onFechar(); }}>Excluir esta dívida</button>}
    </Folha>
  );
}

function PassoProposta({ mensal }: { mensal: number }) {
  const e = useEstado();
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  const [id, setId] = useState(abertas[0]?.id ?? '');
  const d = abertas.find((x) => x.id === id) ?? abertas[0];
  const [nome, setNome] = useState(e.config.nome ?? '');
  const [protocolo, setProtocolo] = useState('');
  const [numero, setNumero] = useState('');
  const [entrada, setEntrada] = useState(0);
  const [parcela, setParcela] = useState(0);
  const [texto, setTexto] = useState('');
  const [editado, setEditado] = useState(false);
  const [pedido, setPedido] = useState<Pedido>('desconto');
  useEffect(() => {
    if (d && entrada === 0) setEntrada(Math.round(saldoAtual(d) * 0.4));
    if (d && parcela === 0) setParcela(Math.round(Math.max(d.parcelaMinima, mensal / Math.max(1, abertas.length))));
  }, [d, mensal, abertas.length, entrada, parcela]);
  const gerado = d ? mensagemParaOBanco({ nome, credor: d.nome, protocolo, saldo: saldoAtual(d), entrada, parcela, pedido }) : '';
  useEffect(() => {
    if (!editado) setTexto(gerado);
  }, [gerado, editado]);
  if (!d) return <Vazio titulo="Sem dívidas abertas" texto="Quando cadastrar uma dívida, eu escrevo a proposta pro banco." avatar="dividas" />;
  return (
    <>
      <h2 className="gs-h2" style={{ marginTop: 0 }}>Falar com o banco</h2>
      {abertas.length > 1 && (
        <div className="gs-chips">{abertas.map((x) => <button key={x.id} type="button" className={`gs-chip ${x.id === d.id ? 'on' : ''}`} onClick={() => { setId(x.id); setEditado(false); setEntrada(0); setParcela(0); }}>{x.nome}</button>)}</div>
      )}
      <div className="gs-chips" role="group" aria-label="O que pedir">
        {PEDIDOS.map((x) => <button key={x.id} type="button" className={`gs-chip ${pedido === x.id ? 'on' : ''}`} aria-pressed={pedido === x.id} onClick={() => { setPedido(x.id); setEditado(false); }}>{x.nome}</button>)}
      </div>
      <Dica>Peça sempre a proposta por escrito. Anote o protocolo do atendimento.</Dica>
      <div className="gs-card">
        <div className="gs-dois">
          <CampoDinheiro rotulo="Entrada à vista" valor={entrada} onChange={(n) => { setEntrada(n); setEditado(false); }} />
          <CampoDinheiro rotulo="Parcela por mês" valor={parcela} onChange={(n) => { setParcela(n); setEditado(false); }} />
        </div>
        <div className="gs-dois">
          <Campo rotulo="Seu nome (opcional)" valor={nome} onChange={(s) => { setNome(s); setEditado(false); }} />
          <Campo rotulo="Nº no credor (opcional)" valor={protocolo} onChange={(s) => { setProtocolo(s); setEditado(false); }} />
        </div>
        <label className="gs-campo"><span>Mensagem (pode editar)</span><textarea value={texto} onChange={(ev) => { setTexto(ev.target.value); setEditado(true); }} /></label>
        <Campo rotulo="WhatsApp do credor (opcional)" valor={numero} onChange={setNumero} tipo="tel" placeholder="(11) 98888-7777" />
        <div className="gs-acoes">
          <a className="gs-btn" href={linkWhatsApp(texto, numero)} target="_blank" rel="noreferrer">Abrir no WhatsApp</a>
          <button type="button" className="gs-btn sec" onClick={() => void navigator.clipboard?.writeText(texto).then(() => toast('Mensagem copiada'), () => toast('Não consegui copiar. Selecione o texto e copie.'))}>Copiar mensagem</button>
        </div>
      </div>
    </>
  );
}
