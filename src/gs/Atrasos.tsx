import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { getEstado, useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesCurto, mesDe, nomeMes } from './datas';
import { linkWhatsApp } from './dividas';
import { atrasosAbertos, NIVEIS, PEDIDOS_ATRASO, mensagemAtraso, situacaoAtrasos, deOndeSai, type Atraso, type PedidoAtraso } from './atrasosLogica';
import { definirPorMesAtraso, ignorarAtraso, liberarSeparado, marcarJaPago, pagarAtraso, separarParaAtraso, desfazerSeparar, voltarAtraso } from './acoes';
import { faltaPagar, patrimonioGuardado } from './selectores';
import { Agora, Aprende, Campo, CampoDinheiro, Deslizante, Dica, Folha, MaisAjuda, Titulo } from './ui';
import { toast } from '../components/ui/Toast';

/* ---------- Sair do atraso: o que ficou pra trás, o que pagar primeiro e quando tudo fica em dia ---------- */

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;

export function Atrasos() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const s = useMemo(() => situacaoAtrasos(e, hoje), [e, hoje]);
  const [pagar, setPagar] = useState<{ a: Atraso; valor: number } | null>(null);

  if (s.atrasos.length === 0) return <EmDia separado={s.separado} />;

  const passo = s.plano.passos[0];
  const aPagarAgora = new Set(passo?.pagar.map((p) => p.chave));
  const valorAgora = (a: Atraso) => passo?.pagar.find((p) => p.chave === a.chave)?.valor ?? a.total;
  const separarAgora = Math.max(0, Math.min(s.porMes - s.saiuNoMes, (passo?.guardado ?? 0) - s.separado));
  const proxima = s.plano.passos.findIndex((p) => p.pagar.length > 0);
  const contasDoMes = faltaPagar(e, mes) - s.atrasos.filter((a) => a.mes === mes && a.fonte === 'conta').reduce((t, a) => t + a.valor, 0);
  const reserva = patrimonioGuardado(e);
  const tom = s.plano.emDiaEm ? (s.plano.meses <= 2 ? 'ok' : 'aviso') : 'perigo';

  return (
    <>
      <Titulo titulo="Sair do atraso" sub="Conta que ficou pra trás não some. A gente põe tudo em dia, um passo de cada vez." />

      <section className={`gs-card ${tom === 'perigo' ? 'perigo' : 'destaque'}`}>
        <span className="gs-rotulo">Atrasado hoje</span>
        <p className="gs-grande" style={{ margin: '4px 0' }}>{brl0(s.total)}</p>
        <p className="gs-sub" style={{ margin: 0 }}>
          {s.atrasos.length} {s.atrasos.length === 1 ? 'conta' : 'contas'}, com multa e juros estimados.{' '}
          {s.plano.emDiaEm ? (
            s.plano.meses <= 1 ? <b>Dá pra pôr tudo em dia este mês.</b> : <>Tirando {brl0(s.porMes)} por mês, fica tudo em dia em <b>{nomeMes(s.plano.emDiaEm)}</b>.</>
          ) : (
            <b>Com o que sobra hoje, não dá pra pôr em dia sozinho. Dá pra negociar.</b>
          )}
        </p>
      </section>

      <Agora
        tom={passo?.pagar.length ? 'aviso' : s.porMes <= 0 ? 'perigo' : 'dica'}
        texto={
          passo?.pagar.length
            ? `Pague primeiro ${passo.pagar[0].nome} de ${mesCurto(passo.pagar[0].mesRef)}.`
            : s.porMes <= 0
              ? 'Do jeito que está, não sobra nada pra tirar o atraso. Escolha abaixo quanto dá pra separar por mês, nem que seja pouco, ou negocie.'
              : separarAgora > 0
                ? proxima >= 0
                  ? `Este mês ainda não dá pra pagar a atrasada. Separando ${brl0(s.porMes)} por mês, em ${mesCurto(s.plano.passos[proxima].mes)} você paga ${s.plano.passos[proxima].pagar[0].nome}.`
                  : 'Este mês ainda não dá pra pagar a atrasada. Comece separando o que der.'
                : `Você já separou o deste mês. Guardado pro atraso: ${brl0(s.separado)}.`
        }
      >
        <ol className="gs-passos-lista">
          {contasDoMes > 0.5 && <li>Pague as contas deste mês em dia ({brl0(contasDoMes)}). É isso que impede a bola de crescer.</li>}
          {passo?.pagar.map((p) => {
            const a = s.atrasos.find((x) => x.chave === p.chave)!;
            return (
              <li key={p.chave}>
                <span>Pague {p.nome} de {mesCurto(p.mesRef)}: cerca de <b>{brl0(p.valor)}</b>.</span>{' '}
                <button type="button" className="gs-btn pequeno" onClick={() => setPagar({ a, valor: p.valor })}><Check size={16} /> Paguei</button>
              </li>
            );
          })}
          {separarAgora > 0 && (
            <li>
              <span>Separe <b>{brl0(separarAgora)}</b> e não mexa. Ele é do atraso.</span>{' '}
              <button
                type="button"
                className="gs-btn pequeno sec"
                onClick={() => {
                  const v = separarAgora;
                  if (separarParaAtraso(v, mes)) toast(`${brl0(v)} separados pro atraso`, { acao: { rotulo: 'Desfazer', onClick: () => desfazerSeparar(v, mes) } });
                }}
              >
                Separei
              </button>
            </li>
          )}
        </ol>
        {s.separado > 0 && <p className="gs-mudo" style={{ margin: '8px 0 0', fontSize: 13 }}>Já separado: {brl0(s.separado)}. Quando você pagar um atraso aqui, ele sai primeiro daí.</p>}
      </Agora>

      <section className="gs-card">
        <Deslizante
          rotulo="Quanto tirar por mês pro atraso"
          valor={s.porMes}
          min={0}
          max={Math.max(100, Math.ceil(Math.max(s.porMesSugerido, s.total) / 50) * 50)}
          passo={10}
          onChange={(v) => definirPorMesAtraso(v)}
          formato={brl0}
        />
        {s.folga.renda > 0 ? (
          <p className="gs-mudo" style={{ margin: '8px 0 0', fontSize: 13 }}>
            Sua renda ({brl0(s.folga.renda)}) − gastos do mês ({brl0(s.folga.gastos)}){s.folga.parcelas > 0 ? ` − parcelas das dívidas (${brl0(s.folga.parcelas)})` : ''} ={' '}
            {s.folga.folga >= 0 ? `sobram ${brl0(s.folga.folga)}` : `faltam ${brl0(-s.folga.folga)}`}.
            {e.atrasos?.porMes !== undefined && s.porMes !== s.porMesSugerido && (
              <> <button type="button" className="gs-btn link" onClick={() => definirPorMesAtraso(undefined)}>Usar a sobra</button></>
            )}
          </p>
        ) : (
          <p className="gs-mudo" style={{ margin: '8px 0 0', fontSize: 13 }}>Informe sua renda no <Link to="/">Início</Link> e eu calculo quanto sobra.</p>
        )}
      </section>

      <h2 className="gs-h2">O que ficou pra trás</h2>
      <p className="gs-mudo" style={{ margin: '-4px 4px 10px', fontSize: 13 }}>Na ordem de pagar. Se você já pagou e só não marcou, toque em “Já tinha pago”.</p>
      <div className="gs-card">
        {s.atrasos.map((a, i) => (
          <div key={a.chave} className="gs-conta">
            <div className="gs-conta-topo">
              <span className="gs-bolinha" aria-hidden="true" />
              <div className="gs-corpo">
                <b>{s.atrasos.length > 1 ? `${i + 1}ª · ` : ''}{a.nome} · {mesCurto(a.mes)}</b>
                <small>Venceu {diaCurto(a.vencimento)} · {dias(a.dias)} de atraso</small>
                <small>{NIVEIS[a.nivel].motivo}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="gs-valor">{brl0(a.total)}</div>
                <span className={`gs-etiqueta ${aPagarAgora.has(a.chave) ? 'aviso' : ''}`}>{aPagarAgora.has(a.chave) ? 'Pagar agora' : NIVEIS[a.nivel].nome}</span>
              </div>
            </div>
            <div className="gs-conta-acoes" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="gs-btn pequeno" onClick={() => setPagar({ a, valor: valorAgora(a) })}>Paguei</button>
              <button
                type="button"
                className="gs-btn pequeno sec"
                onClick={() => {
                  const d = marcarJaPago(a);
                  toast(`${a.nome} de ${mesCurto(a.mes)} marcada como paga`, { acao: { rotulo: 'Desfazer', onClick: d.desfazer } });
                }}
              >
                Já tinha pago
              </button>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="gs-btn link"
                onClick={() => {
                  ignorarAtraso(a.chave);
                  toast(`${a.nome} de ${mesCurto(a.mes)} saiu da lista`, { acao: { rotulo: 'Desfazer', onClick: () => voltarAtraso(a.chave) } });
                }}
              >
                Não devo essa
              </button>
            </div>
          </div>
        ))}
      </div>

      <Caminho s={s} />

      {reserva > 0 && (
        <Dica>
          Você tem {brl0(reserva)} na reserva de emergência. Ela existe pra isso: usar uma parte pra sair do atraso evita mais multa. <Link to="/plano/reserva" className="gs-btn link">Abrir a reserva</Link>
        </Dica>
      )}
      {e.planoDividas && e.dividas.length > 0 && (
        <Dica>Enquanto tiver conta atrasada, pague só a parcela normal das outras dívidas. O dinheiro extra vem primeiro pra cá.</Dica>
      )}

      <Negociar atrasos={s.atrasos} porMes={s.porMes} />

      <MaisAjuda titulo="Pra entender">
        <Aprende titulo="Por que vira bola de neve" texto="Quando uma parcela atrasa, o mês seguinte chega com duas: a atrasada e a do mês. Se você paga só uma, a outra continua atrasada e cobra multa e juros de novo. O jeito de sair é ter uma sobra, mesmo pequena, só pra isso, e não deixar a conta do mês atrasar." />
        <p className="gs-nota" style={{ marginTop: 10 }}>
          A ordem: primeiro onde você mora, depois luz, água e gás (podem ser cortadas), depois financiamento de carro ou moto (o banco pode tomar o bem), e por último cartão e empréstimos, que dá pra negociar. Da mesma conta, sempre a parcela mais antiga primeiro.
        </p>
        <p className="gs-nota">Multa de 2% e juros de 1% ao mês são uma estimativa. O valor certo vem no boleto atualizado. No aluguel, a multa do contrato pode ser maior.</p>
      </MaisAjuda>

      <PagarSheet item={pagar} separado={s.separado} mes={mes} hoje={hoje} onFechar={() => setPagar(null)} />
    </>
  );
}

function EmDia({ separado }: { separado: number }) {
  return (
    <>
      <Titulo titulo="Sair do atraso" sub="Conta que ficou pra trás não some. A gente põe tudo em dia, um passo de cada vez." />
      <section className="gs-card destaque">
        <span className="gs-rotulo">Tudo em dia</span>
        <p className="gs-grande" style={{ margin: '4px 0' }}>Nenhuma conta atrasada</p>
        <p className="gs-sub" style={{ margin: 0 }}>Se uma conta fixa ou parcela passar do vencimento sem baixa, ela aparece aqui, com o que pagar primeiro e quando fica em dia.</p>
      </section>
      {separado > 0 && (
        <section className="gs-card">
          <p style={{ margin: 0 }}>Sobrou {brl0(separado)} do que você separou pro atraso. Ele volta pro seu mês.</p>
          <div className="gs-acoes">
            <button type="button" className="gs-btn" onClick={() => { const v = liberarSeparado(); toast(`${brl0(v)} de volta pro mês`); }}>Liberar {brl0(separado)}</button>
          </div>
        </section>
      )}
      <div className="gs-acoes">
        <Link to="/mes" className="gs-btn sec">Ver as contas do mês</Link>
      </div>
    </>
  );
}

function Caminho({ s }: { s: ReturnType<typeof situacaoAtrasos> }) {
  const passos = s.plano.passos;
  if (passos.length <= 1 && s.plano.emDiaEm) return null;
  const mostrar = passos.slice(0, 12);
  return (
    <>
      <h2 className="gs-h2">O caminho, mês a mês</h2>
      <div className="gs-card">
        {mostrar.map((p) => (
          <div key={p.mes} className="gs-linha">
            <div className="gs-corpo">
              <b>{mesCurto(p.mes)}</b>
              <small>
                {p.pagar.length > 0 ? `Pagar ${p.pagar.map((x) => `${x.nome} (${mesCurto(x.mesRef)})`).join(' e ')}` : p.entra > 0 ? `Separar ${brl0(p.entra)}` : 'Nada novo entra'}
                {p.guardado > 0 ? ` · fica separado ${brl0(p.guardado)}` : ''}
              </small>
            </div>
            {p.pagar.length > 0 && <span className="gs-valor">{brl0(p.pagar.reduce((t, x) => t + x.valor, 0))}</span>}
          </div>
        ))}
        {s.plano.emDiaEm ? (
          <div className="gs-linha">
            <span className="gs-check" aria-hidden="true"><Check size={16} /></span>
            <div className="gs-corpo"><b>{mesCurto(s.plano.emDiaEm)} · tudo em dia</b><small>Daqui pra frente, uma parcela por mês.</small></div>
          </div>
        ) : (
          <p className="gs-banner" style={{ margin: '10px 0 0' }}>Em {meses(passos.length)} ainda não fica em dia. Separe um pouco mais por mês ou negocie com quem você deve (logo abaixo).</p>
        )}
      </div>
    </>
  );
}

function PagarSheet({ item, separado, mes, hoje, onFechar }: { item: { a: Atraso; valor: number } | null; separado: number; mes: string; hoje: string; onFechar: () => void }) {
  const [v, setV] = useState(0);
  useEffect(() => setV(item ? item.valor : 0), [item]);
  const a = item?.a;
  const uso = a ? deOndeSai(v, separado, a.mes, mes) : null;
  return (
    <Folha aberta={Boolean(item)} onFechar={onFechar} titulo={a ? `Pagar ${a.nome} de ${mesCurto(a.mes)}` : ''}>
      <p className="gs-sub">Peça o boleto atualizado e ajuste o valor se for outro. Original: {a ? brl(a.valor) : ''}.</p>
      <CampoDinheiro rotulo="Quanto você pagou?" valor={v} onChange={setV} grande />
      {uso && uso.doSeparado > 0 && <p className="gs-nota">{brl0(uso.doSeparado)} saem do que você já separou{uso.doMes > 0 ? ` e ${brl0(uso.doMes)} do dinheiro deste mês` : ''}.</p>}
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button
          type="button"
          className="gs-btn"
          disabled={!(v > 0)}
          onClick={() => {
            if (!a) return;
            const d = pagarAtraso(a, v, hoje);
            if (!d) return;
            const emDia = atrasosAbertos(getEstado(), hoje).length === 0;
            toast(emDia ? 'Pronto: você está em dia!' : `${a.nome} de ${mesCurto(a.mes)} paga: ${brl(v)}`, { acao: { rotulo: 'Desfazer', onClick: d.desfazer } });
            onFechar();
          }}
        >
          Confirmar pagamento
        </button>
      </div>
    </Folha>
  );
}

function Negociar({ atrasos, porMes }: { atrasos: Atraso[]; porMes: number }) {
  const e = useEstado();
  const grupos = useMemo(() => {
    const m = new Map<string, { refId: string; nome: string; valor: number; meses: number; nivel: number }>();
    for (const a of atrasos) {
      const g = m.get(a.refId) ?? { refId: a.refId, nome: a.nome, valor: 0, meses: 0, nivel: a.nivel };
      g.valor += a.total;
      g.meses += 1;
      m.set(a.refId, g);
    }
    return [...m.values()];
  }, [atrasos]);
  const [id, setId] = useState(grupos[0]?.refId ?? '');
  const g = grupos.find((x) => x.refId === id) ?? grupos[0];
  const padrao: PedidoAtraso = g && (g.nivel === 1 || g.nivel === 3) ? 'fim' : g?.nivel === 5 ? 'multa' : 'dividir';
  const [pedido, setPedido] = useState<PedidoAtraso | null>(null);
  const [nome, setNome] = useState(e.config.nome ?? '');
  const [numero, setNumero] = useState('');
  const [texto, setTexto] = useState('');
  const [editado, setEditado] = useState(false);
  const p = pedido ?? padrao;
  const gerado = g ? mensagemAtraso({ nome, credor: g.nome, valor: g.valor, meses: g.meses, pedido: p, porMes: Math.max(50, Math.round(porMes / 10) * 10) }) : '';
  useEffect(() => {
    if (!editado) setTexto(gerado);
  }, [gerado, editado]);
  if (!g) return null;
  return (
    <MaisAjuda titulo="Falar com quem você deve">
      <p className="gs-sub" style={{ marginTop: 0 }}>Banco e financeira preferem receber a tomar o bem. Em financiamento, dá pra pedir pra jogar a parcela atrasada pro fim do contrato.</p>
      {grupos.length > 1 && (
        <div className="gs-chips" role="group" aria-label="Qual conta">
          {grupos.map((x) => <button key={x.refId} type="button" className={`gs-chip ${x.refId === g.refId ? 'on' : ''}`} aria-pressed={x.refId === g.refId} onClick={() => { setId(x.refId); setPedido(null); setEditado(false); }}>{x.nome}</button>)}
        </div>
      )}
      <div className="gs-chips" role="group" aria-label="O que pedir">
        {PEDIDOS_ATRASO.map((x) => <button key={x.id} type="button" className={`gs-chip ${p === x.id ? 'on' : ''}`} aria-pressed={p === x.id} onClick={() => { setPedido(x.id); setEditado(false); }}>{x.nome}</button>)}
      </div>
      <Campo rotulo="Seu nome (opcional)" valor={nome} onChange={(t) => { setNome(t); setEditado(false); }} />
      <label className="gs-campo"><span>Mensagem (pode editar)</span><textarea value={texto} onChange={(ev) => { setTexto(ev.target.value); setEditado(true); }} /></label>
      <Campo rotulo="WhatsApp de quem você deve (opcional)" valor={numero} onChange={setNumero} tipo="tel" placeholder="(11) 98888-7777" />
      <Dica>Peça sempre a proposta por escrito e anote o protocolo do atendimento.</Dica>
      <div className="gs-acoes">
        <a className="gs-btn" href={linkWhatsApp(texto, numero)} target="_blank" rel="noreferrer">Abrir no WhatsApp</a>
        <button type="button" className="gs-btn sec" onClick={() => void navigator.clipboard?.writeText(texto).then(() => toast('Mensagem copiada'), () => toast('Não consegui copiar. Selecione o texto e copie.'))}>Copiar mensagem</button>
      </div>
    </MaisAjuda>
  );
}
