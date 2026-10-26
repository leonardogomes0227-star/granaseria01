import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useEstado } from './store';
import { brl, brl0, mesAtual, mesCurto, somaMes, hoje as hojeSP, pct } from './datas';
import { compararEstrategias, linkWhatsApp, mensagemParaOBanco, PEDIDOS, type Pedido, paraSim, passoDoMes, saldoAtual, simular } from './dividas';
import { desfazerPagamentoDivida, pagarDivida, removerDivida, restaurarDivida, salvarDivida, salvarPlanoDividas } from './acoes';
import { Barra, Campo, CampoDinheiro, CampoNumero, Deslizante, Dica, Folha, Titulo, Vazio } from './ui';
import { Linha } from './graficos';
import { livreParaGastar } from './selectores';
import { CalculaJuro, MaisRapido, Marcos, Quitou, TIPOS_DIVIDA } from './DividasExtras';
import { mesDe } from './datas';
import { useHoje } from './useHoje';
import { apagarComDesfazer, toast } from '../components/ui/Toast';
import type { Divida, Estrategia } from './tipos';

/* ---------- Quitar dívidas: 4 passos, salvos e retomáveis. Com plano feito, mostra o estado dele. ---------- */

export function Dividas() {
  const e = useEstado();
  const [editarPlano, setEditarPlano] = useState(false);
  const tem = e.dividas.length > 0;
  const plano = e.planoDividas;
  return (
    <>
      <Titulo titulo="Quitar dívidas" sub="Cadastre o que você deve e eu mostro o caminho mais curto até zerar." />
      {plano && tem && !editarPlano ? <Acompanhamento onEditar={() => setEditarPlano(true)} /> : <Assistente onFim={() => setEditarPlano(false)} />}
    </>
  );
}

const anual = (mensalPct: number) => ((1 + mensalPct / 100) ** 12 - 1) * 100;

/* ---------- acompanhamento: o plano vivo, com gráfico, controle de quanto pagar e a comparação das estratégias ---------- */
function Acompanhamento({ onEditar }: { onEditar: () => void }) {
  const e = useEstado();
  const plano = e.planoDividas!;
  const [pagar, setPagar] = useState<Divida | null>(null);
  const hojeISO = useHoje();
  const sim = useMemo(() => paraSim(e.dividas), [e.dividas]);
  const resultado = useMemo(() => simular(sim, plano.pagamentoMensal, plano.estrategia), [sim, plano]);
  const comp = useMemo(() => compararEstrategias(sim, plano.pagamentoMensal), [sim, plano.pagamentoMensal]);
  const passo = passoDoMes(sim, plano.pagamentoMensal, plano.estrategia);
  const minimo = sim.reduce((t, d) => t + Math.min(d.parcelaMinima, d.saldo), 0);
  const totalOriginal = e.dividas.reduce((t, d) => t + d.saldo, 0);
  const totalAtual = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
  const progresso = totalOriginal > 0 ? ((totalOriginal - totalAtual) / totalOriginal) * 100 : 0;
  const serie = useMemo(() => [totalAtual, ...resultado.cronograma.map((m) => m.saldoTotal)], [resultado, totalAtual]);
  const livre = livreParaGastar(e, mesDe(hojeISO));
  const maisPagando = useMemo(
    () => [100, 200, 500].map((m) => {
      const r = simular(sim, plano.pagamentoMensal + m, plano.estrategia);
      return { m, meses: resultado.meses - r.meses, juros: resultado.totalJuros - r.totalJuros };
    }),
    [sim, plano, resultado],
  );
  const mudar = (patch: Partial<typeof plano>) => salvarPlanoDividas({ ...plano, ...patch });
  if (totalAtual <= 0) return <Quitou />;
  const semJuros = sim.every((d) => d.jurosMensal === 0);
  const longa = !resultado.insuficiente && resultado.quita && !semJuros && resultado.meses > 2;
  const ordem = Object.entries(resultado.quitaEm).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;
  const frase = resultado.insuficiente
    ? `Com ${brl0(plano.pagamentoMensal)} por mês a dívida cresce. Pague pelo menos ${brl0(resultado.minimoNecessario)}.`
    : !resultado.quita
      ? 'Com esse valor a dívida não zera. Aumente o pagamento.'
      : livre >= totalAtual && resultado.meses <= 2
        ? `Dá pra quitar agora: você tem ${brl0(livre)} livre este mês.`
        : `Pagando ${brl0(plano.pagamentoMensal)} por mês, você termina em ${meses(resultado.meses)} (${mesCurto(resultado.dataFinal!)}).`;
  return (
    <>
      <section className="gs-card destaque">
        <span className="gs-rotulo">Você deve</span>
        <p className="gs-grande" style={{ margin: '4px 0 6px' }}>{brl0(totalAtual)}</p>
        <p style={{ margin: 0 }}>{frase}</p>
        {longa && <Linha serie={serie} fim={mesCurto(resultado.dataFinal!)} rotulo="Saldo das dívidas caindo mês a mês" />}
        {progresso > 0 && <div style={{ marginTop: 10 }}><Barra pct={progresso} tom="ok" rotulo="Quanto já foi pago" /></div>}
      </section>
      <Marcos progresso={progresso} quitadas={e.dividas.filter((d) => saldoAtual(d) <= 0).length} />

      <section className="gs-card">
        <span className="gs-rotulo">{abertas.length > 1 ? 'Pague nesta ordem' : 'Sua dívida'}</span>
        {abertas.map((d) => {
          const q = resultado.quitaEm[d.id];
          const pos = ordem.indexOf(d.id);
          return (
            <div key={d.id} className="gs-linha">
              <div className="gs-corpo">
                <b>{abertas.length > 1 && pos >= 0 ? `${pos + 1}ª · ` : ''}{d.nome}</b>
                <small>
                  {brl(saldoAtual(d))}
                  {q ? ` · quita em ${mesCurto(somaMes(mesAtual(), q))}` : ''}
                  {d.jurosMensal > 0 ? ` · ${pct(d.jurosMensal, 1)} ao mês` : ' · sem juros'}
                </small>
                {anual(d.jurosMensal) >= 100 && <span className="gs-etiqueta perigo" style={{ marginTop: 4 }}>juro muito alto</span>}
              </div>
              <button type="button" className="gs-btn pequeno" onClick={() => setPagar(d)}>Paguei</button>
            </div>
          );
        })}
      </section>

      {longa && passo && (
        <section className="gs-card">
          <span className="gs-rotulo">Este mês</span>
          <p style={{ margin: '6px 0 0' }}>Pague o mínimo de todas ({brl0(minimo)}) e coloque o resto na <b>{passo.divida.nome}</b>.</p>
        </section>
      )}

      {longa && (
        <section className="gs-card">
          <Deslizante rotulo="Quanto você paga por mês" valor={plano.pagamentoMensal} min={Math.max(100, Math.floor(minimo / 50) * 50)} max={Math.max(3000, Math.ceil((plano.pagamentoMensal * 1.5) / 100) * 100)} passo={50} formato={brl0} extra={`mínimo ${brl0(minimo)}`} onChange={(n) => mudar({ pagamentoMensal: n })} />
          <p className="gs-sub" style={{ margin: '6px 0 0' }}>
            {e.config.renda > 0 ? `${Math.round((plano.pagamentoMensal / e.config.renda) * 100)}% da sua renda. ` : ''}
            {maisPagando[1].meses > 0 ? `Com +${brl0(200)} por mês você termina ${meses(maisPagando[1].meses)} antes e economiza ${brl0(maisPagando[1].juros)}.` : ''}
          </p>
          {abertas.length > 1 && (
            <div className="gs-chips" role="group" aria-label="Ordem de pagamento" style={{ marginTop: 10 }}>
              {(['bola-de-neve', 'maior-juro'] as const).map((id) => <button key={id} type="button" className={`gs-chip ${plano.estrategia === id ? 'on' : ''}`} aria-pressed={plano.estrategia === id} onClick={() => mudar({ estrategia: id })}>{id === 'bola-de-neve' ? 'Menor dívida primeiro' : 'Maior juro primeiro'}</button>)}
            </div>
          )}
          {abertas.length > 1 && comp.economia >= 1 && <Dica>{comp.melhor === 'maior-juro' ? 'Maior juro primeiro' : 'Menor dívida primeiro'} economiza <b>{brl0(comp.economia)}</b> em juros.</Dica>}
        </section>
      )}

      <div className="gs-acoes" style={{ marginTop: 0 }}>
        <button type="button" className="gs-btn sec" onClick={() => { salvarPlanoDividas({ ...plano, passo: 1 }); onEditar(); }}>+ Nova dívida</button>
        <button type="button" className="gs-btn sec" onClick={() => { salvarPlanoDividas({ ...plano, passo: 4 }); onEditar(); }}>Falar com o banco</button>
      </div>

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
function Assistente({ onFim }: { onFim: () => void }) {
  const e = useEstado();
  const [passo, setPasso] = useState(() => Math.min(4, Math.max(1, e.planoDividas?.passo ?? 1)));
  const [mensal, setMensal] = useState(e.planoDividas?.pagamentoMensal ?? 0);
  const [estrategia, setEstrategia] = useState<Estrategia>(e.planoDividas?.estrategia ?? 'bola-de-neve');
  const sim = useMemo(() => paraSim(e.dividas), [e.dividas]);
  const somaMin = sim.reduce((t, d) => t + Math.min(d.parcelaMinima, d.saldo), 0);
  useEffect(() => {
    if (mensal === 0 && somaMin > 0) setMensal(Math.ceil(somaMin));
  }, [mensal, somaMin]);
  const ir = (p: number) => {
    setPasso(p);
    salvarPlanoDividas({ estrategia, pagamentoMensal: mensal, criadoEm: e.planoDividas?.criadoEm ?? hojeSP(), passo: p });
  };
  const comp = useMemo(() => compararEstrategias(sim, mensal), [sim, mensal]);
  const atual = estrategia === 'maior-juro' ? comp.juro : comp.bola;

  return (
    <>
      <div className="gs-passos" aria-label={`Passo ${passo} de 4`}>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= passo ? 'on' : ''} />)}</div>
      {passo === 1 && <PassoDividas mensal={mensal} setMensal={setMensal} somaMin={somaMin} onProximo={() => ir(2)} />}
      {passo === 2 && (
        <>
          <h2 className="gs-h2" style={{ marginTop: 0 }}>2. Como pagar?</h2>
          <div className="gs-grade">
            {(['bola-de-neve', 'maior-juro'] as const).map((id) => (
              <button key={id} type="button" className={`gs-card ${estrategia === id ? 'destaque' : ''}`} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }} aria-pressed={estrategia === id} onClick={() => setEstrategia(id)}>
                <b className="gs-medio" style={{ fontSize: 20 }}>{id === 'bola-de-neve' ? 'Bola de neve' : 'Maior juro'}</b>
                <p className="gs-sub" style={{ margin: '4px 0 8px' }}>{id === 'bola-de-neve' ? 'Quita a menor dívida primeiro. Você sente a vitória logo.' : 'Quita a de juro mais alto primeiro. Você paga menos no total.'}</p>
                <span className="gs-mudo">Ordem: {(id === 'bola-de-neve' ? comp.bola : comp.juro).ordem.join(' → ') || '—'}</span>
              </button>
            ))}
          </div>
          <div className="gs-acoes">
            <button type="button" className="gs-btn sec" onClick={() => ir(1)}>Voltar</button>
            <button type="button" className="gs-btn" onClick={() => ir(3)}>Ver resultado</button>
          </div>
        </>
      )}
      {passo === 3 && (
        <>
          <h2 className="gs-h2" style={{ marginTop: 0 }}>3. O resultado</h2>
          {atual.insuficiente ? (
            <div className="gs-card perigo">
              <p className="gs-medio" style={{ fontSize: 20 }}>Com {brl0(mensal)}/mês a dívida cresce.</p>
              <p className="gs-sub">Você precisa de pelo menos <b>{brl0(atual.minimoNecessario)}</b> por mês pra começar a diminuir.</p>
              <button type="button" className="gs-btn" onClick={() => ir(1)}>Ajustar valor</button>
            </div>
          ) : (
            <div className="gs-card destaque">
              <span className="gs-rotulo">{estrategia === 'maior-juro' ? 'Maior juro' : 'Bola de neve'}</span>
              <p className="gs-grande" style={{ margin: '4px 0' }}>{atual.meses} {atual.meses === 1 ? 'mês' : 'meses'}</p>
              <p className="gs-sub" style={{ margin: 0 }}>{atual.quita ? `Você quita tudo em ${mesCurto(atual.dataFinal!)}, pagando ${brl0(atual.totalJuros)} de juros.` : 'Com esse valor a dívida não zera. Aumente o pagamento.'}</p>
              {comp.economia >= 1 && <p className="gs-banner" style={{ margin: '12px 0 0' }}>{comp.melhor === 'maior-juro' ? 'Maior juro' : 'Bola de neve'} economiza {brl0(comp.economia)} em juros.</p>}
              {(() => {
                const p = passoDoMes(sim, mensal, estrategia);
                return p ? <p className="gs-banner" style={{ margin: '12px 0 0' }}>Este mês pague <b>{brl0(p.valor)}</b> na dívida <b>{p.divida.nome}</b>.</p> : null;
              })()}
            </div>
          )}
          <div className="gs-card">
            <p className="gs-rotulo">Mês a mês</p>
            {atual.cronograma.slice(0, 12).map((m) => (
              <div className="gs-linha" key={m.mes} style={{ minHeight: 44 }}>
                <div className="gs-corpo"><b>Mês {m.mes}{m.quitadas.length ? ` · quita ${m.quitadas.join(', ')}` : ''}</b><small>Foco: {m.alvo ?? '—'}</small></div>
                <span className="gs-valor">{brl0(m.saldoTotal)}</span>
              </div>
            ))}
            {atual.cronograma.length > 12 && <p className="gs-nota">Mostrando os 12 primeiros meses.</p>}
          </div>
          <div className="gs-acoes">
            <button type="button" className="gs-btn sec" onClick={() => ir(2)}>Voltar</button>
            <button type="button" className="gs-btn" onClick={() => ir(4)}>Proposta pro banco</button>
          </div>
        </>
      )}
      {passo === 4 && <PassoProposta mensal={mensal} onVoltar={() => ir(3)} onFim={() => { salvarPlanoDividas({ estrategia, pagamentoMensal: mensal, criadoEm: e.planoDividas?.criadoEm ?? hojeSP(), passo: 4 }); toast('Plano salvo. Ele aparece nas suas próximas ações.'); onFim(); }} />}
    </>
  );
}

function PassoDividas({ mensal, setMensal, somaMin, onProximo }: { mensal: number; setMensal: (n: number) => void; somaMin: number; onProximo: () => void }) {
  const e = useEstado();
  const [editando, setEditando] = useState<Divida | 'nova' | null>(null);
  return (
    <>
      <h2 className="gs-h2" style={{ marginTop: 0 }}>1. Suas dívidas</h2>
      {e.dividas.length === 0 ? (
        <Vazio titulo="Nenhuma dívida cadastrada" texto="Se não deve nada, ótimo. Se deve, cadastre pra eu montar o caminho." acao="Cadastrar dívida" onAcao={() => setEditando('nova')} avatar="dividas" />
      ) : (
        <div className="gs-card">
          {e.dividas.map((d) => (
            <div className="gs-linha" key={d.id}>
              <div className="gs-corpo"><b>{d.nome}</b><small>{brl(saldoAtual(d))} · {pct(d.jurosMensal, 1)} ao mês · mínima {brl0(d.parcelaMinima)}</small></div>
              <button type="button" className="gs-menu-pontos" aria-label={`Editar ${d.nome}`} onClick={() => setEditando(d)}><Pencil size={17} /></button>
              <button type="button" className="gs-menu-pontos" aria-label={`Excluir ${d.nome}`} onClick={() => { removerDivida(d.id); apagarComDesfazer(`${d.nome} excluída`, () => restaurarDivida(d)); }}><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
      )}
      {e.dividas.length > 0 && <button type="button" className="gs-btn sec cheio" onClick={() => setEditando('nova')}>+ Outra dívida</button>}
      {e.dividas.length > 0 && (
        <div className="gs-card" style={{ marginTop: 16 }}>
          <CampoDinheiro rotulo="Quanto você consegue pagar por mês, no total?" valor={mensal} onChange={setMensal} grande />
          <p className="gs-nota" style={{ marginTop: -6 }}>As parcelas mínimas somam {brl0(somaMin)}. Pagando mais que isso, você sai mais rápido.</p>
          <button type="button" className="gs-btn cheio" disabled={!(mensal > 0)} onClick={onProximo}>Escolher estratégia</button>
        </div>
      )}
      <FormDivida valor={editando} onFechar={() => setEditando(null)} />
    </>
  );
}

function FormDivida({ valor, onFechar }: { valor: Divida | 'nova' | null; onFechar: () => void }) {
  const edit = valor && valor !== 'nova' ? valor : null;
  const [nome, setNome] = useState('');
  const [saldo, setSaldo] = useState(0);
  const [juros, setJuros] = useState<number | ''>('');
  const [min, setMin] = useState(0);
  const [tentou, setTentou] = useState(false);
  useEffect(() => {
    if (!valor) return;
    setNome(edit?.nome ?? '');
    setSaldo(edit ? saldoAtual(edit) : 0);
    setJuros(edit ? edit.jurosMensal : '');
    setMin(edit?.parcelaMinima ?? 0);
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
            const ok = salvarDivida({ id: edit?.id, nome, saldo: edit ? saldo + edit.pagamentos.reduce((t, p) => t + p.valor, 0) : saldo, jurosMensal: juros, parcelaMinima: min });
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
        <button type="button" className="gs-btn" onClick={onFim}>Salvar plano</button>
      </div>
    </>
  );
}
