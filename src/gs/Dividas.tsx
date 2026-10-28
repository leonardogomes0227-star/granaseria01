import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { brl, brl0, mesAtual, mesCurto, somaMes, hoje as hojeSP, pct, mesDe, diasEntre, vencimentoNoMes } from './datas';
import { compararEstrategias, linkWhatsApp, mensagemParaOBanco, PEDIDOS, type Pedido, paraSim, passoDoMes, saldoAtual, simular } from './dividas';
import { desfazerPagamentoDivida, pagarDivida, removerDivida, restaurarDivida, salvarDivida, salvarPlanoDividas } from './acoes';
import { Barra, Campo, CampoDinheiro, CampoNumero, Deslizante, Dica, Folha, Titulo, Vazio } from './ui';
import { Anel, Linha } from './graficos';
import { gastoMensalMedio, livreParaGastar } from './selectores';
import { CalculaJuro, MaisRapido, Quitadas, Quitou, TIPOS_DIVIDA } from './DividasExtras';
import { capacidadeDePagamento, conquistas, economiaDoPlano, mesesSeguidos, pagamentoSugerido, pagoNoMes, proximaAcao } from './painelDividas';
import { useHoje } from './useHoje';
import { apagarComDesfazer, toast } from '../components/ui/Toast';
import type { Divida } from './tipos';

/* ---------- Quitar dívidas: um painel vivo. Contagem até ficar livre, meta do mês, o que fazer agora e quanto o seu bolso aguenta. ---------- */

export function Dividas() {
  const e = useEstado();
  const [vista, setVista] = useState<'painel' | 'banco'>('painel');
  const [editando, setEditando] = useState<Divida | 'nova' | null>(null);
  const tem = e.dividas.length > 0;
  return (
    <>
      <Titulo titulo="Quitar dívidas" sub="Descubra o dia em que você fica livre delas." />
      {vista === 'banco' ? (
        <PassoProposta mensal={e.planoDividas?.pagamentoMensal ?? 0} onVoltar={() => setVista('painel')} onFim={() => setVista('painel')} />
      ) : tem ? (
        <Painel onNova={() => setEditando('nova')} onEditar={setEditando} onBanco={() => setVista('banco')} />
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

function Painel({ onNova, onEditar, onBanco }: { onNova: () => void; onEditar: (d: Divida) => void; onBanco: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [pagar, setPagar] = useState<Divida | null>(null);
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
  const resultado = useMemo(() => simular(sim, plano.pagamentoMensal, plano.estrategia), [sim, plano.pagamentoMensal, plano.estrategia]);
  const comp = useMemo(() => compararEstrategias(sim, plano.pagamentoMensal), [sim, plano.pagamentoMensal]);
  const passo = passoDoMes(sim, plano.pagamentoMensal, plano.estrategia);
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
  const acao = proximaAcao(abertas, plano.pagamentoMensal, hoje);
  const alvoPagar = acao.divida ?? e.dividas.find((d) => d.id === passo?.divida.id) ?? abertas[0];
  const fim = resultado.quita && !resultado.insuficiente ? resultado.dataFinal : null;
  const dias = fim ? Math.max(0, diasEntre(hoje, vencimentoNoMes(fim, 31))) : null;
  const ordem = Object.entries(resultado.quitaEm).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const feitas = conquistas({ pct: progresso, quitadas, pagamentos: nPagamentos, sequencia }).filter((c) => c.feita);

  return (
    <>
      <section className="gs-card destaque" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ flex: 'none', width: 104 }}><Anel pct={progresso} grande={`${Math.round(progresso)}%`} sub="já pago" tamanho={104} cor="var(--success)" /></div>
        <div>
          <span className="gs-rotulo">Você fica livre em</span>
          {dias !== null ? (
            <>
              <p className="gs-grande" style={{ margin: '2px 0' }}>{dias} {dias === 1 ? 'dia' : 'dias'}</p>
              <p className="gs-sub" style={{ margin: 0 }}>{mesCurto(fim!)} · {meses(resultado.meses)}</p>
            </>
          ) : (
            <p style={{ margin: '4px 0 0' }}>{resultado.insuficiente ? `Pague pelo menos ${brl0(resultado.minimoNecessario)} por mês pra a dívida diminuir.` : 'Aumente o pagamento mensal pra ver a data.'}</p>
          )}
        </div>
      </section>
      <section className="gs-card">
        <div className="gs-tres">
          <div><span className="gs-mudo">Você deve</span><b className="gs-tab">{brl0(totalAtual)}</b></div>
          <div><span className="gs-mudo">Já pagou</span><b className="gs-tab">{brl0(totalOriginal - totalAtual)}</b></div>
          <div><span className="gs-mudo">Meses em dia</span><b className="gs-tab">{sequencia}</b></div>
        </div>
        {eco && eco.economia > 0 && <p className="gs-banner" style={{ marginBottom: 0 }}>Esse plano economiza <b>{brl0(eco.economia)}</b> em juros, comparado a pagar só o mínimo.</p>}
        {eco?.semPlano && <p className="gs-banner" style={{ marginBottom: 0 }}>Pagando só o mínimo essa dívida <b>nunca zera</b>. Seu plano resolve.</p>}
      </section>

      <section className="gs-card">
        <span className="gs-rotulo">O que fazer agora</span>
        <p style={{ margin: '6px 0 10px' }}>{acao.texto}</p>
        <Barra pct={plano.pagamentoMensal > 0 ? (pagoMes / plano.pagamentoMensal) * 100 : 0} tom={acao.tipo === 'vence' ? 'perigo' : 'ok'} rotulo="Meta do mês" />
        <p className="gs-mudo" style={{ margin: '6px 0 0', fontSize: 13 }}>{brl0(pagoMes)} de {brl0(plano.pagamentoMensal)} neste mês</p>
        {acao.tipo !== 'cumprida' && alvoPagar && <button type="button" className="gs-btn cheio" style={{ marginTop: 12 }} onClick={() => setPagar(alvoPagar)}>Paguei {alvoPagar.nome}</button>}
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

      {feitas.length > 0 && (
        <div className="gs-chips" aria-label="Conquistas">
          {feitas.map((c) => <span key={c.id} className="gs-etiqueta ok">★ {c.nome}</span>)}
        </div>
      )}

      {longa && (
        <section className="gs-card">
          <span className="gs-rotulo">Seu caminho até zerar</span>
          <Linha serie={serie} fim={mesCurto(resultado.dataFinal!)} rotulo="Saldo das dívidas caindo mês a mês" />
          <div style={{ marginTop: 12 }}>
            <Deslizante rotulo="Quanto você paga por mês" valor={plano.pagamentoMensal} min={Math.max(50, Math.floor(minimo / 50) * 50)} max={Math.max(3000, Math.ceil((Math.max(cap, plano.pagamentoMensal) * 1.5) / 100) * 100)} passo={50} formato={brl0} extra={`mínimo ${brl0(minimo)}`} onChange={(n) => mudar({ pagamentoMensal: n })} />
          </div>
          {abertas.length > 1 && (
            <div className="gs-chips" role="group" aria-label="Ordem de pagamento" style={{ marginTop: 10 }}>
              {(['bola-de-neve', 'maior-juro'] as const).map((id) => <button key={id} type="button" className={`gs-chip ${plano.estrategia === id ? 'on' : ''}`} aria-pressed={plano.estrategia === id} onClick={() => mudar({ estrategia: id })}>{id === 'bola-de-neve' ? 'Menor dívida primeiro' : 'Maior juro primeiro'}</button>)}
            </div>
          )}
          {abertas.length > 1 && comp.economia >= 1 && <Dica>{comp.melhor === 'maior-juro' ? 'Maior juro primeiro' : 'Menor dívida primeiro'} economiza <b>{brl0(comp.economia)}</b> em juros.</Dica>}
        </section>
      )}

      <section className="gs-card">
        <span className="gs-rotulo">{abertas.length > 1 ? 'Pague nesta ordem' : 'Sua dívida'}</span>
        {abertas.map((d) => {
          const q = resultado.quitaEm[d.id];
          const pos = ordem.indexOf(d.id);
          return (
            <div key={d.id} className="gs-linha" style={{ flexWrap: 'wrap' }}>
              <div className="gs-corpo">
                <b>{abertas.length > 1 && pos >= 0 ? `${pos + 1}ª · ` : ''}{d.nome}</b>
                <small>
                  {brl(saldoAtual(d))}
                  {q ? ` · quita em ${mesCurto(somaMes(mesAtual(), q))}` : ''}
                  {d.jurosMensal > 0 ? ` · ${pct(d.jurosMensal, 1)} ao mês` : ' · sem juros'}
                  {d.venceDia ? ` · vence dia ${d.venceDia}` : ''}
                </small>
                {anual(d.jurosMensal) >= 100 && <span className="gs-etiqueta perigo" style={{ marginTop: 4 }}>juro muito alto</span>}
              </div>
              <button type="button" className="gs-btn pequeno" onClick={() => setPagar(d)}>Paguei</button>
              <div style={{ flexBasis: '100%', display: 'flex', gap: 4 }}>
                <button type="button" className="gs-btn link" onClick={() => onEditar(d)}>Editar</button>
                <button type="button" className="gs-btn link" onClick={() => { removerDivida(d.id); apagarComDesfazer(`${d.nome} excluída`, () => restaurarDivida(d)); }}>Excluir</button>
              </div>
            </div>
          );
        })}
      </section>

      <div className="gs-acoes" style={{ marginTop: 0 }}>
        <button type="button" className="gs-btn sec" onClick={onNova}>+ Nova dívida</button>
        <button type="button" className="gs-btn sec" onClick={onBanco}>Falar com o banco</button>
      </div>

      <Quitadas />
      <details className="gs-card" style={{ padding: '4px 20px', marginTop: 12 }}>
        <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>Mais ajuda</summary>
        <div style={{ paddingBottom: 12 }}>
          <MaisRapido sim={sim} pagamento={plano.pagamentoMensal} estrategia={plano.estrategia} simples={!longa} />
        </div>
      </details>
      <PagarSheet divida={pagar} sugerido={passo && pagar && passo.divida.id === pagar.id ? passo.valor : pagar?.parcelaMinima ?? 0} onFechar={() => setPagar(null)} />
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
  const [nome, setNome] = useState('');
  const [saldo, setSaldo] = useState(0);
  const [juros, setJuros] = useState<number | ''>('');
  const [min, setMin] = useState(0);
  const [dia, setDia] = useState<number | ''>('');
  const [tentou, setTentou] = useState(false);
  useEffect(() => {
    if (!valor) return;
    setNome(edit?.nome ?? '');
    setSaldo(edit ? saldoAtual(edit) : 0);
    setJuros(edit ? edit.jurosMensal : '');
    setMin(edit?.parcelaMinima ?? 0);
    setDia(edit?.venceDia ?? '');
    setTentou(false);
  }, [valor, edit]);
  return (
    <Folha aberta={Boolean(valor)} onFechar={onFechar} titulo={edit ? 'Editar dívida' : 'Nova dívida'}>
      {!edit && (
        <div className="gs-chips" role="group" aria-label="Tipo de dívida">
          {TIPOS_DIVIDA.map((t) => <button key={t.nome} type="button" className="gs-chip" onClick={() => { if (!nome.trim()) setNome(t.nome); setJuros(t.juros); }}>{t.nome}</button>)}
        </div>
      )}
      {!edit && <p className="gs-nota" style={{ marginTop: 4, marginBottom: 12 }}>Não tem o número exato? Pode chutar. Você ajusta depois. Os tipos já sugerem um juro médio.</p>}
      <Campo rotulo="Nome ou credor" valor={nome} onChange={setNome} placeholder="Ex.: Cartão do banco" maxLength={60} erro={tentou && !nome.trim() ? 'Dê um nome.' : undefined} />
      <CampoDinheiro rotulo="Quanto você deve hoje" valor={saldo} onChange={setSaldo} erro={tentou && !(saldo > 0) ? 'Digite o saldo.' : undefined} />
      <CalculaJuro onResultado={setJuros} />
      <div className="gs-dois">
        <CampoNumero rotulo="Juros ao mês" sufixo="%" valor={juros} onChange={setJuros} min={0} max={30} placeholder="Ex.: 8" erro={tentou && juros === '' ? 'Digite (0 se não tem).' : undefined} />
        <CampoDinheiro rotulo="Parcela mínima" valor={min} onChange={setMin} placeholder="R$ 0,00" />
      </div>
      <CampoNumero rotulo="Dia do vencimento (pra eu te avisar)" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 10 (opcional)" />
      {typeof juros === 'number' && juros >= 15 && <p className="gs-banner" role="note">Juro muito alto. Confira se digitou certo. Se for isso mesmo, vale tentar renegociar.</p>}
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button
          type="button"
          className="gs-btn"
          onClick={() => {
            setTentou(true);
            if (juros === '') return;
            // ao editar, o saldo digitado vira o novo saldo e os pagamentos antigos já estão abatidos nele
            const ok = salvarDivida({ id: edit?.id, nome, saldo: edit ? saldo + edit.pagamentos.reduce((t, p) => t + p.valor, 0) : saldo, jurosMensal: juros, parcelaMinima: min, venceDia: typeof dia === 'number' ? dia : undefined });
            if (ok) onFechar();
          }}
        >
          Salvar
        </button>
      </div>
    </Folha>
  );
}

function PassoProposta({ mensal, onVoltar, onFim }: { mensal: number; onVoltar: () => void; onFim: () => void }) {
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
      <h2 className="gs-h2" style={{ marginTop: 0 }}>4. Proposta pro banco</h2>
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
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onVoltar}>Voltar</button>
        <button type="button" className="gs-btn" onClick={onFim}>Pronto</button>
      </div>
    </>
  );
}
