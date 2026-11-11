import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Eye, EyeOff, FileText, Landmark, PiggyBank, Receipt, Wallet } from 'lucide-react';
import { abrirAdicionar } from './AdicionarMov';
import { getName } from '../painel';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesDe, nomeMes } from './datas';
import { contasDoMes, detalheDisponivel, fixosPagos, guardadoNoMes, totalFixos, type ContaDoMes } from './selectores';
import { paraSim, saldoAtual, simular } from './dividas';
import { planoDeQuitacao } from './caminho';
import { FormRenda } from './Onboarding';
import { ComoCalculei } from './ComoCalculei';
import { BaixaSheet } from './BaixaSheet';
import { Folha } from './ui';
import { definirOculto, mascarar, useOculto } from './privacidade';

/* ---------- Início: o centro do app ---------- */
// De cima para baixo: quem é você e que mês é; quanto falta pagar; o que vence esta semana; o que dá para fazer agora;
// e o resumo do mês. As ferramentas avançadas moram na aba Mais.

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
  // próximos 7 dias: o que já atrasou vem primeiro, depois por data
  const proximas = abertas.filter((c) => c.dias <= 7).sort((a, b) => a.dias - b.dias);
  const dividas = useMemo(() => {
    const abertasD = e.dividas.filter((d) => saldoAtual(d) > 0);
    if (abertasD.length === 0) return null;
    const ds = paraSim(e.dividas);
    const { pagamento, estrategia } = planoDeQuitacao(e, mes);
    const sim = simular(ds, pagamento, estrategia, mes);
    return { total: ds.reduce((t, d) => t + d.saldo, 0), fim: sim.quita ? sim.dataFinal : null, n: abertasD.length };
  }, [e, mes]);
  const gastoMes = e.lancamentos.filter((l) => mesDe(l.data) === mes).reduce((t, l) => t + l.valor, 0);
  const guardado = guardadoNoMes(e, mes);
  const sobra = disp.modo === 'incompleto' ? null : disp.livre;
  const semContas = e.gastosFixos.length === 0;
  const mesNome = nomeMes(mes);

  // primeiros passos: somem sozinhos quando renda e contas estão cadastradas
  const passos = [
    { feito: e.config.renda > 0, titulo: 'Conte quanto você ganha', ganho: 'Assim eu calculo quanto você pode gastar por dia.', acao: () => setRenda(true), rota: undefined as string | undefined },
    { feito: !semContas, titulo: 'Cadastre suas contas fixas', ganho: 'Assim eu te mostro o que pagar primeiro e te aviso antes de vencer.', acao: undefined, rota: '/pagar?nova=1' },
    { feito: e.dividas.length > 0, titulo: 'Tem dívidas? Cadastre', ganho: 'Assim eu mostro o dia em que você fica livre delas.', acao: undefined, rota: '/plano/dividas?nova=1' },
  ];
  const configurando = !(passos[0].feito && passos[1].feito);
  const proximoPasso = passos.findIndex((p) => !p.feito);

  return (
    <>
      <header className="ini-cab">
        <div>
          <small>{mesNome.charAt(0).toLocaleUpperCase('pt-BR') + mesNome.slice(1)}</small>
          <h1>{nome ? `Olá, ${nome}` : 'Olá'}</h1>
        </div>
        <button type="button" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
      </header>

      <section className="ini-destaque" aria-label="Falta pagar este mês">
        <span className="cm-eyebrow">Falta pagar este mês</span>
        {semContas ? (
          <>
            <b className="ini-valor">{m(brl0(0))}</b>
            <p>Cadastre suas contas para eu te mostrar o que pagar primeiro.</p>
            <Link to="/pagar?nova=1" className="gs-btn">Cadastrar minha primeira conta</Link>
          </>
        ) : (
          <>
            <b className="ini-valor">{m(brl0(falta))}</b>
            <p>
              {abertas.length === 0 ? 'Tudo pago por aqui. Pode respirar.' : atrasadas ? `${atrasadas} ${atrasadas === 1 ? 'conta atrasada' : 'contas atrasadas'}. Comece por ${atrasadas === 1 ? 'ela' : 'elas'}.` : `${abertas.length} ${abertas.length === 1 ? 'conta' : 'contas'} ainda em aberto, de ${m(brl0(total))} no mês.`}
            </p>
            {total > 0 && <div className="cm-prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((pago / total) * 100)} aria-label="Quanto das contas do mês já foi pago"><i style={{ width: `${Math.min(100, (pago / total) * 100)}%` }} /></div>}
          </>
        )}
        <div className="ini-sobra">
          {sobra === null ? (
            <button type="button" onClick={() => setRenda(true)}>Informar minha renda <ChevronRight size={16} aria-hidden="true" /></button>
          ) : (
            <>
              <span>{sobra > 0 ? <>Pode gastar <b>{m(brl(disp.porDia))}</b> por dia</> : <>Faltam <b>{m(brl0(-sobra))}</b> para fechar o mês</>}</span>
              <button type="button" onClick={() => setCalc(true)}>Ver a conta <ChevronRight size={16} aria-hidden="true" /></button>
            </>
          )}
        </div>
      </section>

      {configurando && proximoPasso >= 0 && (
        <section className="ini-config" aria-label="Primeiros passos">
          <span className="cm-eyebrow">Primeiros passos · {passos.filter((p) => p.feito).length} de {passos.length}</span>
          <ol>
            {passos.map((p, i) => (
              <li key={p.titulo} className={p.feito ? 'feito' : i === proximoPasso ? 'atual' : ''}>
                <span className="no" aria-hidden="true">{p.feito ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                <span className="txt">
                  <b>{p.titulo}</b>
                  {!p.feito && <small>{p.ganho}</small>}
                </span>
                {!p.feito && i === proximoPasso && (p.rota ? <Link to={p.rota} className="gs-btn pequeno">Começar</Link> : <button type="button" className="gs-btn pequeno" onClick={p.acao}>Começar</button>)}
              </li>
            ))}
          </ol>
        </section>
      )}

      <h2 className="cm-h2">Próximos vencimentos<Link to="/pagar">Ver contas</Link></h2>
      {semContas ? (
        <p className="ini-vazio">Quando você cadastrar suas contas, o que vence nos próximos 7 dias aparece aqui.</p>
      ) : proximas.length === 0 ? (
        <p className="ini-vazio">Nada vence nos próximos 7 dias. {abertas.length > 0 ? 'As contas em aberto vencem mais para a frente.' : ''}</p>
      ) : (
        <div className="ini-linhas" role="list">
          {proximas.map((c) => (
            <div key={c.gasto.id} className={`ini-linha ${c.estado === 'atrasada' ? 'perigo' : c.estado === 'vence-logo' ? 'aviso' : ''}`} role="listitem">
              <span className="dia" aria-hidden="true"><b>{c.vencimento.slice(8, 10)}</b><small>{diaCurto(c.vencimento).split(' ').pop()}</small></span>
              <span className="ini-nome"><b>{c.gasto.nome}</b><small>{quando(c)}</small></span>
              <span className="ini-quanto">{m(brl0(c.valor))}</span>
              <button type="button" className={`gs-btn pequeno${c.estado === 'em-dia' ? ' sec' : ''}`} onClick={() => setBaixa(c.gasto.id)}>Pagar</button>
            </div>
          ))}
        </div>
      )}

      <h2 className="cm-h2">O que você quer fazer?</h2>
      <div className="ini-cards">
        <button type="button" onClick={() => abrirAdicionar()}><i><Wallet size={24} aria-hidden="true" /></i><b>Anotar gasto</b><small>Veja para onde vai o dinheiro</small></button>
        <Link to="/pagar?nova=1"><i><Receipt size={24} aria-hidden="true" /></i><b>Cadastrar conta</b><small>Eu aviso antes de vencer</small></Link>
        <Link to="/plano/dividas?nova=1"><i><Landmark size={24} aria-hidden="true" /></i><b>Cadastrar dívida</b><small>Descubra quando fica livre</small></Link>
        <Link to="/plano/cartao#importar"><i><FileText size={24} aria-hidden="true" /></i><b>Importar fatura</b><small>PDF, foto ou texto do banco</small></Link>
      </div>

      <h2 className="cm-h2">Resumo de {mesNome.split(' ')[0]}</h2>
      <div className="ini-resumo">
        <Link to="/lancamentos">
          <Wallet size={20} aria-hidden="true" />
          <small>Gastos</small>
          <b>{m(brl0(gastoMes))}</b>
          <em>{gastoMes > 0 ? 'Ver o que anotou' : 'Nada anotado'}</em>
        </Link>
        <Link to="/plano/dividas">
          <Landmark size={20} aria-hidden="true" />
          <small>Dívidas</small>
          <b>{dividas ? m(brl0(dividas.total)) : e.dividas.length ? 'Quitadas' : 'Nenhuma'}</b>
          <em>{dividas ? (dividas.fim ? `Livre em ${nomeMes(dividas.fim).split(' ')[0]}` : 'Veja como sair') : 'Toque para anotar'}</em>
        </Link>
        <Link to="/guardar">
          <PiggyBank size={20} aria-hidden="true" />
          <small>Guardado</small>
          <b>{m(brl0(guardado))}</b>
          <em>{guardado > 0 ? 'Neste mês' : 'Comece pequeno'}</em>
        </Link>
      </div>

      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </>
  );
}
