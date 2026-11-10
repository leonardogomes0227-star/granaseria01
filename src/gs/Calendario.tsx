import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Check } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl0, diaCurto, diasNoMes, mesDe, nomeMes } from './datas';
import { Agora, CampoNumero, Dica, MaisAjuda, Titulo, Vazio } from './ui';
import { BaixaSheet } from './BaixaSheet';
import { eventosDoMes, linhaDoCiclo, mesesEmDia, pedidoDeVencimento, vencemAntesDoSalario, type PassoDoCiclo } from './calendarioLogica';
import { salvarConfig } from './acoes';
import { linkWhatsApp } from './dividas';
import { toast } from '../components/ui/Toast';

/* ---------- Calendário de contas: do salário até o próximo salário, o que vence e quanto sobra depois de cada conta ---------- */

export function Calendario() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [baixa, setBaixa] = useState<{ id: string; mes: string } | null>(null);
  const linha = useMemo(() => linhaDoCiclo(e, hoje), [e, hoje]);
  const antes = useMemo(() => vencemAntesDoSalario(e), [e]);
  const temContas = e.gastosFixos.length > 0 || e.dividas.some((d) => d.venceDia) || Boolean(e.cartao?.usado);

  if (!temContas)
    return (
      <>
        <Titulo titulo="Calendário de contas" sub="O que vence e quanto sobra até o próximo salário." />
        <Vazio titulo="Cadastre suas contas fixas" texto="Aluguel, luz, internet… Eu ponho cada uma na ordem em que vence, depois do seu salário, e mostro quanto sobra depois de cada uma." acao="Cadastrar contas" rota="/lancamentos?aba=contas" avatar="contas" />
      </>
    );

  if (!linha) return <PerguntaSalario />;

  const { ciclo, passos } = linha;
  const atrasada = passos.find((p) => !p.paga && p.dias < 0);
  const proxima = passos.find((p) => !p.paga && p.dias >= 0);
  const seguidos = mesesEmDia(e, mes);
  // a linha "hoje" entra entre o que já venceu e o que vem
  const iHoje = passos.findIndex((p) => p.data > hoje);

  return (
    <>
      <Titulo titulo="Calendário de contas" sub="O que vence e quanto sobra até o próximo salário." />

      <section className={`gs-card ${linha.sobra < 0 ? 'perigo' : 'destaque'}`}>
        <span className="gs-rotulo">Até o próximo salário ({diaCurto(ciclo.proximo)})</span>
        <p className="gs-grande" style={{ margin: '4px 0', fontSize: 'clamp(26px, 8vw, 40px)' }}>{linha.falta > 0 ? `Faltam ${brl0(linha.falta)}` : 'Tudo pago'}</p>
        <p className="gs-sub" style={{ margin: 0 }}>
          {passos.length} {passos.length === 1 ? 'conta' : 'contas'} nesse período, {brl0(linha.total)} no total{linha.pago > 0 ? `, ${brl0(linha.pago)} já pagos` : ''}.{' '}
          {linha.sobra >= 0 ? <>Depois delas, sobram <b>{brl0(linha.sobra)}</b> do salário.</> : <b>As contas passam o salário em {brl0(-linha.sobra)}.</b>}
        </p>
      </section>

      <Agora
        tom={atrasada ? 'perigo' : proxima && proxima.dias <= 3 ? 'aviso' : 'ok'}
        texto={
          atrasada
            ? `${atrasada.nome} está atrasada há ${-atrasada.dias} ${-atrasada.dias === 1 ? 'dia' : 'dias'}. Pague hoje pra parar a multa.`
            : proxima
              ? `Próxima: ${proxima.nome}, ${proxima.dias === 0 ? 'hoje' : proxima.dias === 1 ? 'amanhã' : `dia ${Number(proxima.data.slice(8, 10))}`} (${brl0(proxima.valor)}).${proxima.dias > 3 ? ' Nada vence nos próximos 3 dias.' : ''}`
              : `Tudo pago até o próximo salário.${seguidos >= 1 ? ` ${seguidos} ${seguidos === 1 ? 'mês' : 'meses'} seguidos sem atraso.` : ''}`
        }
      >
        {(atrasada ?? (proxima && proxima.dias <= 3 ? proxima : null))?.tipo === 'conta' && (
          <div className="gs-acoes"><button type="button" className="gs-btn" onClick={() => { const p = atrasada ?? proxima!; setBaixa({ id: p.id.slice(2), mes: p.data.slice(0, 7) }); }}><Check size={16} /> Dar baixa</button></div>
        )}
      </Agora>

      <h2 className="gs-h2">A linha do tempo</h2>
      <ol className="gs-tempo">
        <li className="gs-tempo-salario">
          <span className="gs-tempo-dia">{diaCurto(ciclo.inicio)}</span>
          <span className="gs-tempo-ponto" aria-hidden="true"><Banknote size={14} /></span>
          <span className="gs-corpo"><b>Salário cai</b><small>começa o ciclo</small></span>
          <span className="gs-valor" style={{ color: 'var(--success)' }}>+{brl0(linha.renda)}</span>
        </li>
        {passos.map((p, i) => (
          <PassoTempo key={p.id + p.data} p={p} hoje={hoje} marcaHoje={i === iHoje} onBaixa={() => setBaixa({ id: p.id.slice(2), mes: p.data.slice(0, 7) })} />
        ))}
        {iHoje === -1 && <li className="gs-tempo-hoje"><span>hoje</span></li>}
        <li className="gs-tempo-salario fim">
          <span className="gs-tempo-dia">{diaCurto(ciclo.proximo)}</span>
          <span className="gs-tempo-ponto" aria-hidden="true"><Banknote size={14} /></span>
          <span className="gs-corpo"><b>Próximo salário</b><small>sobra das contas pro dia a dia: {brl0(Math.max(0, linha.sobra))}</small></span>
        </li>
      </ol>

      {antes.length > 0 && (
        <section className="gs-card">
          <span className="gs-rotulo">Vencem antes do salário</span>
          <p style={{ margin: '6px 0 4px' }}>{antes.length === 1 ? 'Essa conta vence' : 'Essas contas vencem'} antes do dia {e.config.diaSalario}, quando o dinheiro ainda não caiu. É o que mais aperta no fim do mês. A maioria das empresas deixa mudar o dia do vencimento.</p>
          {antes.map((a) => (
            <div key={a.id} className="gs-linha" style={{ minHeight: 52 }}>
              <div className="gs-corpo"><b>{a.nome}</b><small>vence dia {a.dia} · peça pro dia {a.sugerido}</small></div>
              <a className="gs-btn pequeno sec" href={linkWhatsApp(pedidoDeVencimento(a.nome, a.sugerido))} target="_blank" rel="noreferrer">Pedir mudança</a>
            </div>
          ))}
        </section>
      )}

      <MaisAjuda titulo="Ver o mês em calendário">
        <Grade />
      </MaisAjuda>
      <MaisAjuda titulo="Mudar o dia do salário">
        <DiaSalario />
      </MaisAjuda>

      <BaixaSheet gasto={baixa ? e.gastosFixos.find((g) => g.id === baixa.id) ?? null : null} mes={baixa?.mes ?? mes} onFechar={() => setBaixa(null)} />
    </>
  );
}

function PassoTempo({ p, hoje, marcaHoje, onBaixa }: { p: PassoDoCiclo; hoje: string; marcaHoje: boolean; onBaixa: () => void }) {
  const estado = p.paga ? 'paga' : p.dias < 0 ? 'atrasada' : p.dias <= 3 ? 'logo' : '';
  return (
    <>
      {marcaHoje && <li className="gs-tempo-hoje"><span>hoje · {diaCurto(hoje)}</span></li>}
      <li className={`gs-tempo-conta ${estado}`}>
        <span className="gs-tempo-dia">{diaCurto(p.data)}</span>
        <span className="gs-tempo-ponto" aria-hidden="true">{p.paga ? <Check size={12} /> : null}</span>
        <span className="gs-corpo">
          <b>{p.nome}</b>
          <small>
            {p.paga ? 'paga' : p.dias < 0 ? 'atrasada' : p.dias === 0 ? 'vence hoje' : p.dias === 1 ? 'vence amanhã' : `em ${p.dias} dias`}
            {p.tipo === 'divida' ? ' · parcela' : p.tipo === 'cartao' ? ' · fatura' : ''} · depois sobram {brl0(p.sobra)}
          </small>
          {!p.paga && p.tipo === 'conta' && <button type="button" className="gs-btn link" onClick={onBaixa}>Dar baixa</button>}
          {!p.paga && p.tipo !== 'conta' && p.rota && <Link to={p.rota} className="gs-btn link">Abrir</Link>}
        </span>
        <span className="gs-valor">−{brl0(p.valor)}</span>
      </li>
    </>
  );
}

function PerguntaSalario() {
  return (
    <>
      <Titulo titulo="Calendário de contas" sub="O que vence e quanto sobra até o próximo salário." />
      <section className="gs-card destaque">
        <span className="gs-rotulo">Uma pergunta antes</span>
        <p className="gs-grande" style={{ margin: '4px 0 6px', fontSize: 26 }}>Que dia o seu salário cai?</p>
        <p className="gs-sub" style={{ marginTop: 0 }}>Com ele eu ponho as contas na ordem em que vencem depois do salário e mostro quanto sobra depois de cada uma.</p>
      </section>
      <section className="gs-card"><DiaSalario /></section>
    </>
  );
}

function DiaSalario() {
  const e = useEstado();
  const [dia, setDia] = useState<number | ''>(e.config.diaSalario ?? '');
  return (
    <>
      <CampoNumero rotulo="Dia do salário" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 5" />
      <p className="gs-nota" style={{ marginTop: -6 }}>Recebe em mais de uma data? Use o dia do maior valor.</p>
      <div className="gs-acoes">
        <button type="button" className="gs-btn" disabled={!(typeof dia === 'number' && dia >= 1)} onClick={() => { salvarConfig({ diaSalario: dia as number }); toast('Dia do salário salvo'); }}>Salvar</button>
      </div>
    </>
  );
}

function Grade() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const ev = eventosDoMes(e, mes, hoje);
  const primeiro = new Date(`${mes}-01T12:00:00Z`).getUTCDay();
  const dias = diasNoMes(mes);
  const dot = (d: number) => ev.filter((x) => Number(x.data.slice(8, 10)) === d);
  return (
    <>
      <p className="gs-rotulo" style={{ margin: '0 0 8px' }}>{nomeMes(mes)}</p>
      <div className="gs-cal" aria-label="Calendário do mês">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="vazio gs-mudo" style={{ minHeight: 20 }}>{d}</div>)}
        {Array.from({ length: primeiro }, (_, i) => <div key={`v${i}`} className="vazio" />)}
        {Array.from({ length: dias }, (_, i) => {
          const d = i + 1;
          const cs = dot(d);
          const salario = e.config.diaSalario === d;
          return (
            <div key={d} className={`${Number(hoje.slice(8, 10)) === d ? 'hoje' : ''} ${salario ? 'salario' : ''}`}>
              {d}
              {cs.length > 0 && <i role="img" className={cs.every((c) => c.paga) ? 'p' : ''} aria-label={cs.map((c) => `${c.nome} ${c.paga ? 'paga' : 'a pagar'}`).join(', ')} />}
            </div>
          );
        })}
      </div>
      <Dica>Bolinha vermelha: conta a pagar. Verde: paga. Dia com borda verde: o dia do salário.</Dica>
    </>
  );
}
