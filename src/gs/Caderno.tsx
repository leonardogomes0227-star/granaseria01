import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronRight, Eye, EyeOff, Landmark, MessageCircle, PiggyBank, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { abrirAdicionar } from './AdicionarMov';
import { getName } from '../painel';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesDe, nomeMes, somaDias } from './datas';
import { contasDoMes, detalheDisponivel, fixosPagos, guardadoNoMes, sequenciaDeDias, totalFixos, type ContaDoMes } from './selectores';
import { paraSim, saldoAtual, simular } from './dividas';
import { planoDeQuitacao } from './caminho';
import { saudeFinanceira } from './saude';
import { FormRenda } from './Onboarding';
import { ComoCalculei } from './ComoCalculei';
import { BaixaSheet } from './BaixaSheet';
import { Folha } from './ui';
import { definirOculto, mascarar, useOculto } from './privacidade';
import { AvisoCopiaMaior } from './RecuperarDados';
import { BarraPerguntar, Orbe, PerguntarSobre, abrirAssistente } from './Assistente';
import { NOME_ASSISTENTE } from './assistenteLocal';
import { LinhaDegraus, Medidor, MiniBarras, MiniLinha } from './graficosMini';
import { waLink } from '../whatsapp';
import { FERRAMENTAS } from './registroFerramentas';
import { ICONES } from './base';

/* ---------- Início: o painel ---------- */
// Saudação, o número do dia, o mês e as ferramentas que a pessoa mais usa — cada uma com a pergunta que responde.
// O resto continua em Mais. Nada daqui some: contas, dívidas, nota, assistente, vencimentos e WhatsApp.

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};
const quando = (c: ContaDoMes) => (c.dias < 0 ? `atrasada há ${-c.dias} ${-c.dias === 1 ? 'dia' : 'dias'}` : c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence em ${c.dias} dias`);

/** As ferramentas do dia a dia, na ordem em que a pessoa pensa: pagar, gastar, guardar. */
const GRUPOS_PAINEL: { titulo: string; ids: string[] }[] = [
  { titulo: 'Pagar', ids: ['contas', 'calendario', 'atrasos', 'dividas', 'cartao'] },
  { titulo: 'Gastar', ids: ['lancamentos', 'orcamento', 'cortar', 'comprar', 'assinaturas'] },
  { titulo: 'Guardar', ids: ['reserva', 'metas', 'investir', 'extras'] },
];

function Secao({ titulo, sub, extra, children }: { titulo: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="pn-secao" aria-label={titulo}>
      <header className="pn-secao-cab">
        <div>
          <h2>{titulo}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {extra}
      </header>
      {children}
    </section>
  );
}

function FerramentasDoPainel() {
  const e = useEstado();
  const hoje = useHoje();
  const grupos = useMemo(() => GRUPOS_PAINEL.map((g) => ({
    titulo: g.titulo,
    itens: g.ids.flatMap((id) => {
      const f = FERRAMENTAS.find((x) => x.id === id);
      return f ? [{ f, st: f.status(e, hoje) }] : [];
    }),
  })), [e, hoje]);
  return (
    <Secao titulo="Ferramentas" sub="A pergunta embaixo do nome diz para que ela serve. Um toque abre." extra={<Link to="/mais">Ver todas</Link>}>
      <div className="pn-ferramentas">
        {grupos.map((g) => (
          <div key={g.titulo}>
            <h3 className="pn-grupo-titulo">{g.titulo}</h3>
            <div className="pn-ftiles">
              {g.itens.map(({ f, st }) => {
                const I = ICONES[f.icone] ?? ChevronRight;
                return (
                  <Link key={f.id} to={f.rota} className={`pn-ftile${st.tom ? ` ${st.tom}` : ''}`}>
                    <i aria-hidden="true"><I size={18} strokeWidth={1.9} /></i>
                    <span><b>{f.titulo}</b><em>{f.resolve}</em></span>
                    <strong className={`pn-fst${st.tom ? ` ${st.tom}` : ''}`}>{st.texto}</strong>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Secao>
  );
}

export function Caderno() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const [calc, setCalc] = useState(false);
  const [renda, setRenda] = useState(false);
  const [baixa, setBaixa] = useState<string | null>(null);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const contas = useMemo(() => contasDoMes(e, mes, hoje), [e, mes, hoje]);
  const abertas = contas.filter((c) => c.estado !== 'paga');
  const falta = abertas.reduce((t, c) => t + c.valor, 0);
  const total = totalFixos(e, mes);
  const pago = fixosPagos(e, mes);
  const pagoPct = total > 0 ? Math.round((pago / total) * 100) : 0;
  const atrasadas = abertas.filter((c) => c.estado === 'atrasada').length;
  const proximas = abertas.filter((c) => c.dias <= 7).sort((a, b) => a.dias - b.dias);
  const paraPagar = proximas[0];
  const pagarPrimeiro = Boolean(paraPagar && paraPagar.estado === 'atrasada');
  const dividas = useMemo(() => {
    const abertasD = e.dividas.filter((d) => saldoAtual(d) > 0);
    if (abertasD.length === 0) return null;
    const ds = paraSim(e.dividas);
    const { pagamento, estrategia } = planoDeQuitacao(e, mes);
    const sim = simular(ds, pagamento, estrategia, mes);
    const original = e.dividas.reduce((t, d) => t + d.saldo, 0);
    const atual = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
    return { total: ds.reduce((t, d) => t + d.saldo, 0), fim: sim.quita ? sim.dataFinal : null, pagoPct: original > 0 ? (1 - atual / original) * 100 : 0 };
  }, [e, mes]);
  const gastoMes = e.lancamentos.filter((l) => mesDe(l.data) === mes).reduce((t, l) => t + l.valor, 0);
  const guardado = guardadoNoMes(e, mes);
  const saude = useMemo(() => (e.config.renda > 0 ? saudeFinanceira(e, mes, hoje) : null), [e, mes, hoje]);
  const sequencia = useMemo(() => sequenciaDeDias(e, hoje), [e, hoje]);
  const sobra = disp.modo === 'incompleto' ? null : disp.livre;
  const semContas = e.gastosFixos.length === 0;
  const semDivida = e.dividas.length === 0;
  const mesNome = nomeMes(mes);
  const diaHoje = Number(hoje.slice(8, 10));

  // gráficos: gasto de cada um dos últimos 7 dias; e quanto das contas do mês vence até cada dia
  const { seteDias, curvaContas } = useMemo(() => {
    const porDia = new Map<string, number>();
    for (const l of e.lancamentos) porDia.set(l.data, (porDia.get(l.data) ?? 0) + l.valor);
    const sete = Array.from({ length: 7 }, (_, i) => porDia.get(somaDias(hoje, i - 6)) ?? 0);
    const diasNoMes = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
    let soma = 0;
    const curva = Array.from({ length: diasNoMes }, (_, i) => (soma += contas.filter((c) => Number(c.vencimento.slice(8, 10)) === i + 1).reduce((t, c) => t + c.valor, 0)));
    return { seteDias: sete, curvaContas: curva };
  }, [e.lancamentos, hoje, mes, contas]);

  // primeiros passos: somem sozinhos quando renda e contas estão cadastradas
  const passos = [
    { feito: e.config.renda > 0, titulo: 'Conte quanto você ganha', ganho: 'Assim eu calculo quanto você pode gastar por dia.', acao: () => setRenda(true), rota: undefined as string | undefined },
    { feito: !semContas, titulo: 'Cadastre suas contas fixas', ganho: 'Assim eu te mostro o que pagar primeiro e te aviso antes de vencer.', acao: undefined, rota: '/pagar?nova=1' },
    { feito: e.dividas.length > 0, titulo: 'Tem dívidas? Cadastre', ganho: 'Assim eu mostro o dia em que você fica livre delas.', acao: undefined, rota: '/plano/dividas?nova=1' },
  ];
  const configurando = !(passos[0].feito && passos[1].feito);
  const proximoPasso = passos.findIndex((p) => !p.feito);
  const status = semContas ? null : atrasadas ? { tom: 'perigo', texto: `${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` } : abertas.length === 0 ? { tom: 'ok', texto: 'Tudo pago' } : { tom: 'ok', texto: 'Em dia' };

  const nota = (
    <>
      <span className="pn-avatar" aria-hidden="true">{(nome || 'V').charAt(0)}</span>
      <b>{nome || 'Você'}</b>
      <small>{saude ? (saude.nota >= 75 ? 'Finanças saudáveis' : saude.nota >= 40 ? 'No caminho' : 'Hora de cuidar') : 'Informe sua renda para ver sua nota'}</small>
      {saude && saude.nota < 100 && <p className="pn-dica">O que mais pesa agora: <b>{saude.pior.nome.toLowerCase()}</b>. {saude.pior.dica}</p>}
      <div className="pn-duo">
        <span><small>Saúde</small><b>{saude ? saude.nota : '–'}</b></span>
        <span><small>Dias anotando</small><b>{sequencia}</b></span>
      </div>
      {!saude && <span className="gs-btn pequeno">Informar renda</span>}
    </>
  );

  return (
    <div className="pn">
      <header className="pn-cab">
        <div className="pn-ola">
          <h1>{nome ? `Olá, ${nome}!` : 'Olá!'}</h1>
          <p>{mesNome.charAt(0).toLocaleUpperCase('pt-BR') + mesNome.slice(1)} · suas contas, dívidas e gastos em um lugar só</p>
        </div>
        <BarraPerguntar />
        <button type="button" className="pn-redondo" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>
      </header>

      <AvisoCopiaMaior />

      {configurando && proximoPasso >= 0 && (
        <section className="ini-config" aria-label="Primeiros passos">
          <span className="cm-eyebrow">Primeiros passos · {passos.filter((p) => p.feito).length} de {passos.length}</span>
          <ol>
            {passos.map((p, i) => (
              <li key={p.titulo} className={p.feito ? 'feito' : i === proximoPasso ? 'atual' : ''}>
                <span className="no" aria-hidden="true">{p.feito ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                <span className="txt"><b>{p.titulo}</b>{!p.feito && <small>{p.ganho}</small>}</span>
                {!p.feito && i === proximoPasso && (p.rota ? <Link to={p.rota} className="gs-btn pequeno">Começar</Link> : <button type="button" className="gs-btn pequeno" onClick={p.acao}>Começar</button>)}
              </li>
            ))}
          </ol>
        </section>
      )}

      <nav className="pn-acoes" aria-label="Ações rápidas">
        {paraPagar && (
          <button type="button" className={`pn-acao${pagarPrimeiro ? ' forte' : ''}`} onClick={() => setBaixa(paraPagar.gasto.id)}>
            <i aria-hidden="true"><Check size={18} strokeWidth={2.4} /></i>
            <span><b>Pagar {paraPagar.gasto.nome}</b><small>{quando(paraPagar)}</small></span>
          </button>
        )}
        <button type="button" className={`pn-acao${pagarPrimeiro ? '' : ' forte'}`} onClick={() => abrirAdicionar()}>
          <i aria-hidden="true"><Wallet size={18} /></i>
          <span><b>Anotar gasto</b><small>Leva 5 segundos</small></span>
        </button>
        <Link to="/pagar?nova=1" className="pn-acao">
          <i aria-hidden="true"><Receipt size={18} /></i>
          <span><b>Nova conta</b><small>Eu aviso antes de vencer</small></span>
        </Link>
        <Link to="/plano/dividas?nova=1" className="pn-acao">
          <i aria-hidden="true"><Landmark size={18} /></i>
          <span><b>Nova dívida</b><small>Veja quando fica livre</small></span>
        </Link>
      </nav>

      <Secao titulo="Seus números" sub="O que você já gastou, o que ainda está aberto e quanto pode gastar hoje.">
        <div className="pn-stats">
          <button type="button" className="pn-stat destaque" onClick={() => (sobra === null ? setRenda(true) : setCalc(true))}>
            <span>
              <small>{sobra === null ? 'Para começar' : sobra > 0 ? 'Pode gastar hoje' : 'Falta para fechar o mês'}</small>
              <b>{sobra === null ? 'Informar renda' : sobra > 0 ? m(brl(disp.porDia)) : m(brl0(-sobra))}</b>
              <em>{sobra === null ? 'Leva 10 segundos' : 'Ver a conta'}</em>
            </span>
            {sobra !== null && <MiniLinha valores={seteDias} rotulo="" />}
          </button>
          <Link to="/lancamentos" className="pn-stat">
            <span><small>Gasto no mês</small><b>{m(brl0(gastoMes))}</b><em>Últimos 7 dias</em></span>
            <MiniBarras valores={seteDias} rotulo="Gasto de cada um dos últimos 7 dias" />
          </Link>
          <Link to="/pagar" className="pn-stat">
            <i aria-hidden="true"><Receipt size={18} /></i>
            <span><small>Contas abertas</small><b>{semContas ? 'Nenhuma' : `${abertas.length} de ${contas.length}`}</b><em>{semContas ? 'Cadastre a primeira' : atrasadas ? 'Tem atraso' : 'Toque para ver'}</em></span>
          </Link>
          <Link to="/guardar" className="pn-stat">
            <i aria-hidden="true" className="ouro"><PiggyBank size={18} /></i>
            <span><small>Guardado</small><b>{m(brl0(guardado))}</b><em>Neste mês</em></span>
          </Link>
        </div>
      </Secao>

      <div className="pn-bloco">
        <section className="pn-card pn-mes" aria-label="Falta pagar este mês">
          <header>
            <h2>Falta pagar em {mesNome.split(' ')[0]}</h2>
            {status && <span className={`pn-chip ${status.tom}`}>{status.texto}</span>}
          </header>
          <b className="pn-valor">{m(brl0(falta))}</b>
          {semContas ? (
            <>
              <p className="pn-sub">Cadastre aluguel, luz, internet. Eu mostro o que pagar primeiro e aviso antes de vencer.</p>
              <div className="pn-btns"><Link to="/pagar?nova=1" className="gs-btn">Cadastrar minha primeira conta</Link></div>
            </>
          ) : (
            <>
              <div className="pn-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pagoPct} aria-label="Quanto das contas do mês já foi pago"><i style={{ width: `${pagoPct}%` }} /></div>
              <div className="pn-metricas">
                <span><small>Já pago</small><b>{m(brl0(pago))}</b><em className="ok">{pagoPct}%</em></span>
                <span><small>Total do mês</small><b>{m(brl0(total))}</b><em>{contas.length} {contas.length === 1 ? 'conta' : 'contas'}</em></span>
              </div>
              <LinhaDegraus valores={curvaContas} hoje={diaHoje} rotulo="Quanto das contas do mês vence até cada dia" />
              <footer><span>dia 1</span><span>o que vence ao longo do mês · a linha marca hoje</span><span>dia {curvaContas.length}</span></footer>
              <div className="pn-btns">
                <Link to="/pagar" className="gs-btn">Ver contas</Link>
                <PerguntarSobre pergunta="O que eu pago primeiro?" rotulo="O que pago primeiro?" />
              </div>
            </>
          )}
        </section>

        {dividas ? (
          <Link to="/plano/dividas" className="pn-card pn-divida">
            <header><h2>Dívidas</h2><ArrowUpRight size={18} aria-hidden="true" /></header>
            <b className="pn-num">{m(brl0(dividas.total))}</b>
            <p className="pn-sub">{dividas.fim ? `Você fica livre em ${nomeMes(dividas.fim)}.` : 'Com o pagamento de hoje ela não zera. Veja como sair.'}</p>
            <Medidor pct={dividas.pagoPct} rotulo="Dívida já paga" legenda="já pago" />
          </Link>
        ) : semDivida ? (
          <section className="pn-card pn-divida pn-vazio">
            <header><h2>Dívidas</h2></header>
            <b className="pn-num">Nenhuma</b>
            <p className="pn-sub">Tem alguma? Cadastre e eu mostro o dia em que você fica livre.</p>
            <Medidor pct={0} rotulo="Dívida já paga" legenda="sem dívidas" />
            <Link to="/plano/dividas?nova=1" className="gs-btn pequeno">Cadastrar dívida</Link>
          </section>
        ) : (
          <Link to="/plano/dividas" className="pn-card pn-divida">
            <header><h2>Dívidas</h2><ArrowUpRight size={18} aria-hidden="true" /></header>
            <b className="pn-num">Quitadas</b>
            <p className="pn-sub">Você zerou todas. Parabéns.</p>
            <Medidor pct={100} rotulo="Dívida já paga" legenda="pago" />
          </Link>
        )}

        {saude ? (
          <Link to="/perfil#saude" className="pn-card pn-voce">{nota}</Link>
        ) : (
          <button type="button" className="pn-card pn-voce" onClick={() => setRenda(true)}>{nota}</button>
        )}
      </div>

      <FerramentasDoPainel />

      <Secao titulo="Ajuda e vencimentos" sub="Pergunte, veja o que vence nos próximos dias e anote pelo WhatsApp.">
        <div className="pn-bloco dois">
          <section className="pn-card pn-midas" aria-label={`Pergunte ao ${NOME_ASSISTENTE}`}>
            <div>
              <h2>Pergunte ao {NOME_ASSISTENTE}</h2>
              <p className="pn-sub">Ele olha os seus números e responde na hora, com o atalho para a tela certa.</p>
              <div className="pn-perguntas">
                {['Quanto posso gastar hoje?', 'Para onde foi meu dinheiro?', 'Quando fico livre das dívidas?'].map((q) => <button key={q} type="button" onClick={() => abrirAssistente(q)}>{q}</button>)}
              </div>
            </div>
            <button type="button" className="pn-orbe" onClick={() => abrirAssistente()} aria-label={`Abrir o ${NOME_ASSISTENTE}`}><Orbe tamanho={92} /></button>
          </section>

          <section className="pn-card pn-venc" aria-label="Próximos vencimentos">
            <header><h2>Próximos vencimentos</h2><Link to="/pagar" aria-label="Ver todas as contas"><ArrowUpRight size={18} aria-hidden="true" /></Link></header>
            {semContas ? <p className="pn-sub">Quando você cadastrar suas contas, o que vence nos próximos 7 dias aparece aqui.</p> : proximas.length === 0 ? <p className="pn-sub">Nada vence nos próximos 7 dias.</p> : (
              <ul>
                {proximas.slice(0, 4).map((c) => (
                  <li key={c.gasto.id} className={c.estado === 'atrasada' ? 'perigo' : c.estado === 'vence-logo' ? 'aviso' : ''}>
                    <span><b>{c.gasto.nome}</b><small>{diaCurto(c.vencimento)} · {quando(c)}</small></span>
                    <button type="button" onClick={() => setBaixa(c.gasto.id)} aria-label={`Pagar ${c.gasto.nome}, ${brl0(c.valor)}`}>{m(brl0(c.valor))}<ChevronRight size={14} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            )}
            {proximas.length > 4 && <Link to="/pagar" className="cm-link">Mais {proximas.length - 4} <ChevronRight size={16} aria-hidden="true" /></Link>}
          </section>

          <section className="pn-card pn-zap" aria-label="Anote pelo WhatsApp">
            <i aria-hidden="true"><MessageCircle size={22} /></i>
            <h2>Anote pelo WhatsApp</h2>
            <p className="pn-sub">Mande "gastei 35 no mercado" ou a foto do cupom. Eu anoto aqui.</p>
            <a className="gs-btn" href={waLink('Oi! Quero anotar meus gastos por aqui.')} target="_blank" rel="noreferrer"><ShieldCheck size={16} aria-hidden="true" /> Abrir o WhatsApp</a>
          </section>
        </div>
      </Secao>

      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </div>
  );
}
