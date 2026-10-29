import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { brl, brl0, mesAtual, mesCurto, somaMes, hoje as hojeSP, pct, mesDe, diasEntre, vencimentoNoMes } from './datas';
import { compararEstrategias, custoPorDia, jurosDoMes, linkWhatsApp, ordenar, mensagemParaOBanco, PEDIDOS, type Pedido, paraSim, saldoAtual, simular } from './dividas';
import { desfazerPagamentoDivida, pagarDivida, removerDivida, restaurarDivida, salvarDivida, salvarPlanoDividas } from './acoes';
import { Barra, Campo, CampoDinheiro, CampoNumero, Deslizante, Dica, Folha, Titulo, Vazio } from './ui';
import { Anel, Linha } from './graficos';
import { gastoMensalMedio, livreParaGastar } from './selectores';
import { CalculaJuro, MaisRapido, Quitadas, Quitou, TIPOS_DIVIDA } from './DividasExtras';
import { efeitoNaDivida } from './extrasLogica';
import { Amortizacao } from './Amortizacao';
import { capacidadeDePagamento, completarParcelada, conquistas, economiaDoPlano, mesesSeguidos, pagamentoSugerido, pagoNaDivida, pagoNoMes, planoDoMes, proximaAcao, quitarMaisRapido } from './painelDividas';
import { useHoje } from './useHoje';
import { apagarComDesfazer, toast } from '../components/ui/Toast';
import type { Divida } from './tipos';

/* ---------- Quitar dívidas: um painel vivo. Contagem até ficar livre, meta do mês, o que fazer agora e quanto o seu bolso aguenta. ---------- */

export function Dividas() {
  const e = useEstado();
  const [editando, setEditando] = useState<Divida | 'nova' | null>(null);
  const tem = e.dividas.length > 0;
  return (
    <>
      <Titulo titulo="Quitar dívidas" sub="Descubra o dia em que você fica livre delas." />
      {tem ? (
        <Painel onNova={() => setEditando('nova')} onEditar={setEditando} />
      ) : (
        <section className="gs-card destaque">
          <h2 className="gs-h2" style={{ marginTop: 0 }}>Cadastre sua primeira dívida</h2>
          <p style={{ margin: '0 0 10px' }}>Em 1 minuto você vê:</p>
          {['O dia em que você fica livre das dívidas', 'Quanto cabe no seu bolso por mês', 'Um aviso antes de cada parcela vencer'].map((t) => <div key={t} style={{ display: 'flex', gap: 10, padding: '4px 0' }}><span className="gs-check" style={{ flex: 'none' }}>✓</span><span>{t}</span></div>)}
          <button type="button" className="gs-btn cheio" style={{ marginTop: 14 }} onClick={() => setEditando('nova')}>Cadastrar dívida</button>
          <p className="gs-nota">Não sabe o juro ou a parcela? Pode chutar. Você ajusta depois.</p>
        </section>
      )}
      <FormDivida valor={editando} onFechar={() => setEditando(null)} />
    </>
  );
}

const anual = (mensalPct: number) => ((1 + mensalPct / 100) ** 12 - 1) * 100;
const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;

function Painel({ onNova, onEditar }: { onNova: () => void; onEditar: (d: Divida) => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [pagar, setPagar] = useState<Divida | null>(null);
  const [aba, setAba] = useState<'hoje' | 'caminho' | 'negociar'>('hoje');
  const [adiant, setAdiant] = useState(0);
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  const sim = useMemo(() => paraSim(e.dividas), [e.dividas]);
  const minimo = sim.reduce((t, d) => t + Math.min(d.parcelaMinima, d.saldo), 0);
  const totalOriginal = e.dividas.reduce((t, d) => t + d.saldo, 0);
  const totalAtual = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
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
  const partes = planoDoMes(sim, plano.pagamentoMensal, plano.estrategia);
  const serie = useMemo(() => [totalAtual, ...resultado.cronograma.map((m) => m.saldoTotal)], [resultado, totalAtual]);
  const mudar = (patch: Partial<typeof plano>) => salvarPlanoDividas({ ...plano, ...patch });
  if (totalAtual <= 0) return <Quitou onNova={onNova} />;

  const progresso = totalOriginal > 0 ? ((totalOriginal - totalAtual) / totalOriginal) * 100 : 0;
  const quitadas = e.dividas.filter((d) => saldoAtual(d) <= 0).length;
  const nPagamentos = e.dividas.reduce((t, d) => t + d.pagamentos.length, 0);
  const sequencia = mesesSeguidos(e.dividas, mes, Math.min(plano.pagamentoMensal, minimo || plano.pagamentoMensal));
  const eco = economiaDoPlano(sim, plano.pagamentoMensal, plano.estrategia);
  const pagoMes = pagoNoMes(e.dividas, mes);
  const falta = Math.max(0, plano.pagamentoMensal - pagoMes);
  const livre = livreParaGastar(e, mes);
  const semJuros = sim.every((d) => d.jurosMensal === 0);
  const longa = !resultado.insuficiente && resultado.quita && !semJuros && resultado.meses > 2;
  const acao = proximaAcao(abertas, plano.pagamentoMensal, hoje, pagoMes);
  const extra = Math.max(0, Math.round(plano.pagamentoMensal - minimo));
  const mr = quitarMaisRapido(sim, extra, plano.estrategia);
  const ad = adiant > 0 ? efeitoNaDivida(sim, plano.pagamentoMensal, plano.estrategia, adiant) : null;
  const temParcelada = abertas.some((d) => d.tipo === 'parcelada');
  const fim = resultado.quita && !resultado.insuficiente ? resultado.dataFinal : null;
  const dias = fim ? Math.max(0, diasEntre(hoje, vencimentoNoMes(fim, 31))) : null;
  // a ordem em que se paga (a estratégia escolhida), não a ordem em que cada dívida termina
  const ordem = ordenar(sim, plano.estrategia).map((d) => d.id);
  const sugerido = pagar ? Math.max(0, (partes.find((p) => p.id === pagar.id)?.valor ?? pagar.parcelaMinima) - pagoNaDivida(pagar, mes)) || pagar.parcelaMinima : 0;
  const feitas = conquistas({ pct: progresso, quitadas, pagamentos: nPagamentos, sequencia }).filter((c) => c.feita);

  return (
    <>
      <div className="gs-seg" role="tablist" aria-label="Quitar dívidas" style={{ marginBottom: 14 }}>
        {([['hoje', 'Hoje'], ['caminho', 'Caminho'], ['negociar', 'Negociar']] as const).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? 'on' : ''} onClick={() => setAba(id)}>{nome}</button>
        ))}
      </div>

      {aba === 'hoje' && (
        <>
      <section className="gs-card destaque" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {progresso >= 1 && <div style={{ flex: 'none', width: 104 }}><Anel pct={progresso} grande={`${Math.round(progresso)}%`} sub="já pago" tamanho={104} cor="var(--success)" /></div>}
        <div>
          <span className="gs-rotulo">Você fica livre em</span>
          {dias !== null ? (
            <>
              <p className="gs-grande" style={{ margin: '2px 0' }}>{dias > 365 ? meses(resultado.meses) : `${dias} ${dias === 1 ? 'dia' : 'dias'}`}</p>
              <p className="gs-sub" style={{ margin: 0 }}>{mesCurto(fim!)} · {dias > 365 ? `${dias} dias` : meses(resultado.meses)}</p>
              <p className="gs-sub" style={{ margin: '4px 0 0' }}>As dívidas cobram {brl0(jurosDoMes(sim))} de juros por mês ({brl0(custoPorDia(sim))} por dia).</p>
            </>
          ) : (
            <p style={{ margin: '4px 0 0' }}>{resultado.insuficiente ? `Pague pelo menos ${brl0(resultado.minimoNecessario)} por mês pra a dívida diminuir.` : 'Aumente o pagamento mensal pra ver a data.'}</p>
          )}
        </div>
      </section>
      <section className="gs-card">
        <span className="gs-rotulo">O que pagar este mês</span>
        <p style={{ margin: '6px 0 10px' }}>{acao.texto}</p>
        {partes.map((pt) => {
          const d = abertas.find((x) => x.id === pt.id);
          if (!d || pt.valor <= 0) return null;
          const jaPagou = pagoNaDivida(d, mes);
          const feito = jaPagou >= pt.valor - 0.005;
          return (
            <div key={pt.id} className="gs-linha">
              <div className="gs-corpo">
                <b>{feito ? '✓ ' : ''}{d.nome}</b>
                <small>{feito ? `Pago: ${brl0(jaPagou)}` : `Pague ${brl0(pt.valor - jaPagou)}`}{d.venceDia ? ` · vence dia ${d.venceDia}` : ''}</small>
              </div>
              {!feito && <button type="button" className="gs-btn pequeno" onClick={() => setPagar(d)}>Paguei</button>}
            </div>
          );
        })}
        <Barra pct={plano.pagamentoMensal > 0 ? (pagoMes / plano.pagamentoMensal) * 100 : 0} tom={acao.tipo === 'vence' ? 'perigo' : 'ok'} rotulo="Meta do mês" />
        <p className="gs-mudo" style={{ margin: '6px 0 0', fontSize: 13 }}>{brl0(pagoMes)} de {brl0(plano.pagamentoMensal)} neste mês</p>
      </section>

      <section className="gs-card">
        <span className="gs-rotulo">{abertas.length > 1 ? 'Suas dívidas, na ordem de pagamento' : 'Sua dívida'}</span>
        {[...abertas].sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id)).map((d) => {
          const q = resultado.quitaEm[d.id];
          const pos = ordem.indexOf(d.id);
          return (
            <div key={d.id} className="gs-linha" style={{ flexWrap: 'wrap' }}>
              <div className="gs-corpo">
                <b>{abertas.length > 1 && pos >= 0 ? `${pos + 1}ª · ` : ''}{d.nome}</b>
                <small>
                  {brl(saldoAtual(d))}
                  {q ? ` · quita em ${mesCurto(somaMes(mesAtual(), q))}` : ''}
                  {d.tipo === 'parcelada' && d.parcelaMinima > 0 ? ` · parcela ${brl0(d.parcelaMinima)}` : ''}
                  {d.jurosMensal > 0 ? ` · ${pct(d.jurosMensal, 1)} ao mês` : ' · sem juros'}
                  {d.venceDia ? ` · vence dia ${d.venceDia}` : ''}
                </small>
                {d.jurosMensal > 0 && <small>Cobra {brl0((saldoAtual(d) * d.jurosMensal) / 100)} de juros por mês</small>}
                {anual(d.jurosMensal) >= 100 && <span className="gs-etiqueta perigo" style={{ marginTop: 4 }}>juro muito alto</span>}
              </div>
              {d.saldo > 0 && <div style={{ flexBasis: '100%' }}><Barra pct={((d.saldo - saldoAtual(d)) / d.saldo) * 100} tom={anual(d.jurosMensal) >= 100 ? 'perigo' : 'ok'} rotulo={`Quanto já pagou de ${d.nome}`} /></div>}
              <div style={{ flexBasis: '100%', display: 'flex', gap: 4 }}>
                {d.parcelaMinima <= 0 ? <button type="button" className="gs-btn link" onClick={() => onEditar(d)}>Informar a parcela</button> : <button type="button" className="gs-btn link" onClick={() => onEditar(d)}>Editar</button>}
                <button type="button" className="gs-btn link" onClick={() => { removerDivida(d.id); apagarComDesfazer(`${d.nome} excluída`, () => restaurarDivida(d)); }}>Excluir</button>
              </div>
            </div>
          );
        })}
      </section>
      {feitas.length > 0 && (
        <div className="gs-chips" aria-label="Conquistas">
          {feitas.map((c) => <span key={c.id} className="gs-etiqueta ok">★ {c.nome}</span>)}
        </div>
      )}
      <div className="gs-acoes" style={{ marginTop: 0 }}>
        <button type="button" className="gs-btn sec" onClick={onNova}>+ Nova dívida</button>
        <button type="button" className="gs-btn sec" onClick={() => setAba('negociar')}>Falar com o banco</button>
      </div>
          <Quitadas />
        </>
      )}
      {aba === 'caminho' && (
        <>
      <section className="gs-card">
        <div className="gs-tres">
          <div><span className="gs-mudo">Você deve</span><b className="gs-tab">{brl0(totalAtual)}</b></div>
          <div><span className="gs-mudo">Já pagou</span><b className="gs-tab">{brl0(totalOriginal - totalAtual)}</b></div>
          {sequencia > 0 ? <div><span className="gs-mudo">Meses em dia</span><b className="gs-tab">{sequencia}</b></div> : <div><span className="gs-mudo">Juros por mês</span><b className="gs-tab">{brl0(jurosDoMes(sim))}</b></div>}
        </div>
        {eco && eco.economia > 0 && <p className="gs-banner" style={{ marginBottom: 0 }}>Esse plano economiza <b>{brl0(eco.economia)}</b> em juros, comparado a pagar só o mínimo.</p>}
        {eco?.semPlano && <p className="gs-banner" style={{ marginBottom: 0 }}>Pagando só o mínimo essa dívida <b>nunca zera</b>. Seu plano resolve.</p>}
      </section>
      <section className="gs-card">
        <span className="gs-rotulo">Cabe no seu bolso?</span>
        {e.config.renda > 0 ? (
          <>
            <p style={{ margin: '6px 0 0' }}>Pelas suas contas e gastos, sobram cerca de <b>{brl0(cap)}</b> por mês.</p>
            {cap > 0 && plano.pagamentoMensal > cap ? (
              <>
                <p className="gs-sub" style={{ margin: '6px 0 0' }}>Seu plano ({brl0(plano.pagamentoMensal)}) passa do que sobra. Pode apertar o mês.</p>
                {cap >= minimo && <button type="button" className="gs-btn sec" style={{ marginTop: 10 }} onClick={() => mudar({ pagamentoMensal: Math.max(minimo, Math.floor(cap / 10) * 10) })}>Usar {brl0(Math.max(minimo, Math.floor(cap / 10) * 10))}</button>}
              </>
            ) : cap > 0 ? <p className="gs-sub" style={{ margin: '6px 0 0' }}>Seu plano de {brl0(plano.pagamentoMensal)} cabe.</p> : <p className="gs-sub" style={{ margin: '6px 0 0' }}>Suas contas já usam toda a renda. Veja o <Link to="/plano/orcamento">Orçamento</Link>.</p>}
            {falta > 0 && livre < falta && <p className="gs-banner" style={{ marginBottom: 0 }}>Este mês só restam {brl0(Math.max(0, livre))} livres e faltam {brl0(falta)} da meta. Cuidado com gastos novos.</p>}
          </>
        ) : (
          <p style={{ margin: '6px 0 0' }}>Diga sua renda em <Link to="/dados">Meus dados</Link> pra eu ver quanto você aguenta pagar.</p>
        )}
      </section>
      {!semJuros && (
        <section className="gs-card">
          <span className="gs-rotulo">Quitar mais rápido</span>
          {minimo > 0 ? (
            <>
              <p style={{ margin: '6px 0 10px' }}>{abertas.length > 1 ? 'Suas parcelas somam' : 'Sua parcela é'} <b>{brl0(minimo)}</b> por mês. Quanto você consegue pôr <b>a mais</b>?</p>
              <Deslizante rotulo="A mais por mês, além da parcela" valor={extra} min={0} max={Math.max(1000, Math.ceil((Math.max(cap - minimo, extra) * 1.2) / 100) * 100)} passo={50} formato={(n) => `+ ${brl0(n)}`} onChange={(n) => mudar({ pagamentoMensal: Math.ceil(minimo) + n })} />
              <div className="gs-chips" role="group" aria-label="Valores rápidos" style={{ marginTop: 8 }}>
                {[0, 100, 200, 500].map((v) => <button key={v} type="button" className={`gs-chip ${extra === v ? 'on' : ''}`} aria-pressed={extra === v} onClick={() => mudar({ pagamentoMensal: Math.ceil(minimo) + v })}>{v === 0 ? 'Só a parcela' : `+ ${brl0(v)}`}</button>)}
              </div>
              {mr && (
                <div className="gs-dois" style={{ marginTop: 12 }}>
                  <div className="gs-mini"><small>Só a parcela</small><b>{mr.base.fim ? mesCurto(mr.base.fim) : 'não zera'}</b><small>{mr.base.fim ? `${brl0(mr.base.juros)} de juros` : 'a parcela não cobre os juros'}</small></div>
                  <div className={`gs-mini ${extra > 0 ? 'm' : ''}`}><small>{extra > 0 ? `Com + ${brl0(extra)}` : 'Seu plano'}</small><b>{mr.com.fim ? mesCurto(mr.com.fim) : '-'}</b><small>{brl0(mr.com.juros)} de juros</small></div>
                </div>
              )}
              {mr && mr.mesesAntes > 0 && <p className="gs-banner" style={{ marginBottom: 0 }}>Você termina <b>{meses(mr.mesesAntes)} antes</b> e economiza <b>{brl0(mr.economia)}</b> de juros.</p>}
              {mr && extra === 0 && <p className="gs-nota">Arraste pra ver quanto você ganha pondo um pouco a mais todo mês.</p>}
            </>
          ) : (
            <Deslizante rotulo="Quanto você paga por mês" valor={plano.pagamentoMensal} min={50} max={Math.max(3000, Math.ceil((Math.max(cap, plano.pagamentoMensal) * 1.5) / 100) * 100)} passo={50} formato={brl0} onChange={(n) => mudar({ pagamentoMensal: n })} />
          )}
          {longa && <Linha serie={serie} fim={mesCurto(resultado.dataFinal!)} rotulo="Saldo das dívidas caindo mês a mês" />}
          {abertas.length > 1 && (
            <div className="gs-chips" role="group" aria-label="Ordem de pagamento" style={{ marginTop: 10 }}>
              {(['bola-de-neve', 'maior-juro'] as const).map((id) => <button key={id} type="button" className={`gs-chip ${plano.estrategia === id ? 'on' : ''}`} aria-pressed={plano.estrategia === id} onClick={() => mudar({ estrategia: id })}>{id === 'bola-de-neve' ? 'Menor dívida primeiro' : 'Maior juro primeiro'}</button>)}
            </div>
          )}
          {abertas.length > 1 && comp.economia >= 1 && <Dica>{comp.melhor === 'maior-juro' ? 'Maior juro primeiro' : 'Menor dívida primeiro'} economiza <b>{brl0(comp.economia)}</b> em juros.</Dica>}
        </section>
      )}
      {!semJuros && (
        <section className="gs-card">
          <span className="gs-rotulo">Adiantar com um dinheiro extra</span>
          <p style={{ margin: '6px 0 10px' }}>Entrou 13º, bônus ou uma venda? Veja o que acontece se você usar pra abater a dívida.</p>
          <CampoDinheiro rotulo="Quanto você pode adiantar" valor={adiant} onChange={setAdiant} />
          {ad && (ad.meses > 0 || ad.economia > 0) && <p className="gs-banner" style={{ marginTop: 0 }}>Você termina <b>{meses(ad.meses)} antes</b> e economiza <b>{brl0(ad.economia)}</b> de juros.</p>}
          {temParcelada && <Dica>No financiamento e no empréstimo, peça pra o adiantamento <b>reduzir o prazo</b> (abater as últimas parcelas). A lei garante desconto proporcional dos juros quando você antecipa.</Dica>}
        </section>
      )}

        </>
      )}
      {aba === 'negociar' && (
        <>
          <PassoProposta mensal={plano.pagamentoMensal} />
      <Amortizacao />
      <details className="gs-card" style={{ padding: '4px 20px', marginTop: 12 }}>
        <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Mais ajuda</summary>
        <div style={{ paddingBottom: 12 }}>
          <MaisRapido sim={sim} pagamento={plano.pagamentoMensal} estrategia={plano.estrategia} simples={!longa} />
        </div>
      </details>
        </>
      )}
      <PagarSheet divida={pagar} sugerido={sugerido} onFechar={() => setPagar(null)} />
    </>
  );
}
function PagarSheet({ divida, sugerido, onFechar }: { divida: Divida | null; sugerido: number; onFechar: () => void }) {
  const [v, setV] = useState(0);
  useEffect(() => setV(divida ? Math.min(sugerido || 0, saldoAtual(divida)) : 0), [divida, sugerido]);
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
            if (!divida) return;
            const data = hojeSP();
            const valor = v;
            const id = divida.id;
            const quita = valor >= saldoAtual(divida) - 0.005;
            if (pagarDivida(id, valor, data)) toast(quita ? `${divida.nome} quitada! O valor dela agora vai pra próxima dívida.` : `Pagamento de ${brl0(valor)} registrado`, { acao: { rotulo: 'Desfazer', onClick: () => desfazerPagamentoDivida(id, data, valor) } });
            onFechar();
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
