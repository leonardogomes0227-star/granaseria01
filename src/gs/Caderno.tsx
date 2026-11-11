import { useMemo, useState } from 'react';
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

/* ---------- Início: o painel ---------- */
// Desenho da referência do dono: saudação e barra de pergunta; 4 números com mini gráfico (o último em dourado);
// o card grande do mês (o que falta pagar, com a curva das contas); dívidas com medidor; a sua nota; e embaixo o
// assistente, os próximos vencimentos e o WhatsApp. As ferramentas moram na aba Mais.

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};
const quando = (c: ContaDoMes) => (c.dias < 0 ? `atrasada há ${-c.dias} ${-c.dias === 1 ? 'dia' : 'dias'}` : c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence em ${c.dias} dias`);

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
  const atrasadas = abertas.filter((c) => c.estado === 'atrasada').length;
  const proximas = abertas.filter((c) => c.dias <= 7).sort((a, b) => a.dias - b.dias);
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

      <nav className="pn-atalhos" aria-label="Ações rápidas">
        <button type="button" onClick={() => abrirAdicionar()}><Wallet size={17} aria-hidden="true" />Anotar gasto</button>
        <Link to="/pagar?nova=1"><Receipt size={17} aria-hidden="true" />Nova conta</Link>
        <Link to="/plano/dividas?nova=1"><Landmark size={17} aria-hidden="true" />Nova dívida</Link>
      </nav>

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

      {/* fileira de números */}
      <div className="pn-stats">
        <Link to="/lancamentos" className="pn-stat">
          <span><small>Gasto no mês</small><b>{m(brl0(gastoMes))}</b></span>
          <MiniBarras valores={seteDias} rotulo="Gasto de cada um dos últimos 7 dias" />
        </Link>
        <Link to="/pagar" className="pn-stat">
          <i aria-hidden="true"><Receipt size={18} /></i>
          <span><small>Contas abertas</small><b>{semContas ? '0' : `${abertas.length} de ${contas.length}`}</b></span>
        </Link>
        <Link to="/guardar" className="pn-stat">
          <i aria-hidden="true" className="ouro"><PiggyBank size={18} /></i>
          <span><small>Guardado</small><b>{m(brl0(guardado))}</b></span>
        </Link>
        <button type="button" className="pn-stat destaque" onClick={() => (sobra === null ? setRenda(true) : setCalc(true))}>
          <span>
            <small>{sobra === null ? 'Para começar' : sobra > 0 ? 'Pode gastar hoje' : 'Falta para fechar o mês'}</small>
            <b>{sobra === null ? 'Informar renda' : sobra > 0 ? m(brl(disp.porDia)) : m(brl0(-sobra))}</b>
            <em>{sobra === null ? 'Leva 10 segundos' : 'Ver a conta'}</em>
          </span>
          {sobra !== null && <MiniLinha valores={seteDias} rotulo="" />}
        </button>
      </div>

      <div className="pn-grade">
        {/* o card grande do mês */}
        <section className="pn-card pn-mes" aria-label="Falta pagar este mês">
          <header>
            <h2>Falta pagar em {mesNome.split(' ')[0]}</h2>
            {status && <span className={`pn-chip ${status.tom}`}>{status.texto}</span>}
          </header>
          <b className="pn-valor">{m(brl0(falta))}</b>
          {semContas ? (
            <>
              <p className="pn-sub">Cadastre suas contas para eu te mostrar o que pagar primeiro.</p>
              <div className="pn-btns"><Link to="/pagar?nova=1" className="gs-btn">Cadastrar minha primeira conta</Link></div>
            </>
          ) : (
            <>
              <div className="pn-metricas">
                <span><small>Já pago</small><b>{m(brl0(pago))}</b><em className="ok">{total > 0 ? Math.round((pago / total) * 100) : 0}%</em></span>
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

        {/* dívidas, com o medidor */}
        <Link to="/plano/dividas" className="pn-card pn-divida">
          <header><h2>Dívidas</h2><ArrowUpRight size={18} aria-hidden="true" /></header>
          {dividas ? (
            <>
              <b className="pn-num">{m(brl0(dividas.total))}</b>
              <p className="pn-sub">{dividas.fim ? `Você fica livre em ${nomeMes(dividas.fim)}.` : 'Com o pagamento de hoje ela não zera. Veja como sair.'}</p>
              <Medidor pct={dividas.pagoPct} rotulo="Dívida já paga" legenda="já pago" />
            </>
          ) : (
            <>
              <b className="pn-num">{e.dividas.length ? 'Quitadas' : 'Nenhuma'}</b>
              <p className="pn-sub">{e.dividas.length ? 'Você zerou todas. Parabéns.' : 'Tem alguma? Cadastre e eu mostro o dia em que você fica livre.'}</p>
              <Medidor pct={e.dividas.length ? 100 : 0} rotulo="Dívida já paga" legenda={e.dividas.length ? 'pago' : 'sem dívidas'} />
            </>
          )}
        </Link>

        {/* você: a nota e os números de hábito */}
        <Link to="/perfil#saude" className="pn-card pn-voce">
          <span className="pn-avatar" aria-hidden="true">{(nome || 'V').charAt(0)}</span>
          <b>{nome || 'Você'}</b>
          <small>{saude ? (saude.nota >= 75 ? 'Finanças saudáveis' : saude.nota >= 40 ? 'No caminho' : 'Hora de cuidar') : 'Informe sua renda para ver sua nota'}</small>
          {saude && saude.nota < 100 && <p className="pn-dica">O que mais pesa agora: <b>{saude.pior.nome.toLowerCase()}</b>. {saude.pior.dica}</p>}
          <div className="pn-duo">
            <span><small>Saúde</small><b>{saude ? saude.nota : '–'}</b></span>
            <span><small>Dias anotando</small><b>{sequencia}</b></span>
          </div>
        </Link>

        {/* o assistente */}
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

        {/* próximos vencimentos */}
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

        {/* WhatsApp */}
        <section className="pn-card pn-zap" aria-label="Anote pelo WhatsApp">
          <i aria-hidden="true"><MessageCircle size={22} /></i>
          <h2>Anote pelo WhatsApp</h2>
          <p className="pn-sub">Mande "gastei 35 no mercado" ou a foto do cupom. Eu anoto aqui.</p>
          <a className="gs-btn" href={waLink('Oi! Quero anotar meus gastos por aqui.')} target="_blank" rel="noreferrer"><ShieldCheck size={16} aria-hidden="true" /> Abrir o WhatsApp</a>
        </section>
      </div>

      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </div>
  );
}
