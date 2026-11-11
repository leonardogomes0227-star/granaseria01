import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff, Landmark, LayoutGrid, Plus, Receipt } from 'lucide-react';
import { abrirAdicionar } from './AdicionarMov';
import { getName } from '../painel';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesDe, nomeMes } from './datas';
import { contasDoMes, detalheDisponivel } from './selectores';
import { paraSim, simular } from './dividas';
import { planoDeQuitacao } from './caminho';
import { FormRenda } from './Onboarding';
import { ComoCalculei } from './ComoCalculei';
import { Folha } from './ui';
import { definirOculto, mascarar, useOculto } from './privacidade';

/* ---------- Início: um número e três linhas. O resto mora nas abas (Contas, Dívidas, Ferramentas). ---------- */
// O dono achou as versões anteriores bagunçadas. Aqui cabe tudo sem rolar: quanto sobra, e o resumo de contas, dívidas e gastos.

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};

export function Caderno() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const [calc, setCalc] = useState(false);
  const [renda, setRenda] = useState(false);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const abertas = useMemo(() => contasDoMes(e, mes, hoje).filter((c) => c.estado !== 'paga').sort((a, b) => a.dias - b.dias), [e, mes, hoje]);
  const atrasadas = abertas.filter((c) => c.estado === 'atrasada').length;
  const faltaContas = abertas.reduce((t, c) => t + c.valor, 0);
  const dividas = useMemo(() => {
    const ds = paraSim(e.dividas);
    if (ds.length === 0) return null;
    const { pagamento, estrategia } = planoDeQuitacao(e, mes);
    const sim = simular(ds, pagamento, estrategia, mes);
    return { total: ds.reduce((t, d) => t + d.saldo, 0), fim: sim.quita ? sim.dataFinal : null };
  }, [e, mes]);
  const gastoMes = e.lancamentos.filter((l) => mesDe(l.data) === mes).reduce((t, l) => t + l.valor, 0);
  const prox = abertas[0];

  const linhas: { rota: string; nome: string; valor: string; sub: string; tom?: 'perigo' }[] = [
    {
      rota: '/pagar', nome: 'Contas do mês',
      valor: e.gastosFixos.length === 0 ? 'Cadastrar' : abertas.length ? m(brl0(faltaContas)) : 'Tudo pago',
      sub: e.gastosFixos.length === 0 ? 'Aluguel, luz, internet…' : atrasadas ? `${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : prox ? `Próxima: ${prox.gasto.nome}, ${prox.dias === 0 ? 'hoje' : prox.dias === 1 ? 'amanhã' : diaCurto(prox.vencimento)}` : 'Nada a pagar este mês',
      tom: atrasadas ? 'perigo' : undefined,
    },
    {
      rota: '/plano/dividas', nome: 'Dívidas',
      valor: dividas ? m(brl0(dividas.total)) : e.dividas.length ? 'Quitadas' : 'Nenhuma',
      sub: dividas ? (dividas.fim ? `Livre em ${nomeMes(dividas.fim)}` : 'Veja como sair') : 'Toque para anotar uma',
    },
    { rota: '/lancamentos', nome: 'Gastos do mês', valor: m(brl0(gastoMes)), sub: gastoMes > 0 ? 'Ver o que você anotou' : 'Use o + para anotar' },
  ];

  // opções de desenho para o dono escolher (?v=b ou ?v=c); a escolhida vira a única
  const v = new URLSearchParams(window.location.search).get('v') ?? 'a';
  const sobra = disp.modo === 'incompleto' ? null : disp.livre;
  if (v === 'b')
    return (
      <>
        <section className="inb-cartao" aria-label="Quanto sobra no mês">
          <span>{nome ? `Olá, ${nome}` : 'Olá'} · {nomeMes(mes)}</span>
          <small>{sobra !== null && sobra < 0 ? 'Falta neste mês' : 'Sobra neste mês'}</small>
          <b>{sobra === null ? 'R$ —' : m(brl0(Math.abs(sobra)))}</b>
          <em>{sobra !== null && sobra > 0 ? <>Pode gastar {m(brl(disp.porDia))} por dia</> : sobra === null ? 'Informe sua renda para começar' : 'Sem folga para gastos extras'}</em>
        </section>
        <div className="inb-acoes">
          <button type="button" onClick={() => abrirAdicionar()}><i><Plus size={24} aria-hidden="true" /></i>Anotar</button>
          <Link to="/pagar"><i><Receipt size={22} aria-hidden="true" /></i>Contas</Link>
          <Link to="/plano/dividas"><i><Landmark size={22} aria-hidden="true" /></i>Dívidas</Link>
          <Link to="/ferramentas"><i><LayoutGrid size={22} aria-hidden="true" /></i>Mais</Link>
        </div>
        <nav className="ini-linhas" aria-label="Resumo">
          {linhas.map((l) => (
            <Link key={l.rota} to={l.rota} className={`ini-linha ${l.tom ?? ''}`}>
              <span className="ini-nome"><b>{l.nome}</b><small>{l.sub}</small></span>
              <span className="ini-quanto">{l.valor}</span>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </>
    );
  if (v === 'c')
    return (
      <>
        <p className="gs-sub" style={{ margin: '0 0 12px' }}>{nome ? `Olá, ${nome}` : 'Olá'} · {nomeMes(mes)}</p>
        <section className="inc-agora" aria-label="O que fazer agora">
          <small>Faça agora</small>
          <b>{prox ? `Pagar ${prox.gasto.nome}` : dividas ? 'Pagar a parcela das dívidas' : 'Anotar seus gastos de hoje'}</b>
          <span>{prox ? `${m(brl(prox.valor))} · ${prox.estado === 'atrasada' ? 'está atrasada' : prox.dias === 0 ? 'vence hoje' : prox.dias === 1 ? 'vence amanhã' : `vence ${diaCurto(prox.vencimento)}`}` : dividas?.fim ? `Assim você fica livre em ${nomeMes(dividas.fim)}` : 'Leva 5 segundos'}</span>
          {prox ? <Link to="/pagar" className="gs-btn">Pagar agora</Link> : dividas ? <Link to="/plano/dividas" className="gs-btn">Abrir dívidas</Link> : <button type="button" className="gs-btn" onClick={() => abrirAdicionar()}>Anotar gasto</button>}
        </section>
        <div className="inc-tres">
          <Link to="/lancamentos"><small>Sobra no mês</small><b className={sobra !== null && sobra < 0 ? 'neg' : ''}>{sobra === null ? '—' : m(brl0(sobra))}</b></Link>
          <Link to="/pagar"><small>Contas a pagar</small><b>{m(brl0(faltaContas))}</b></Link>
          <Link to="/plano/dividas"><small>Dívidas</small><b>{m(brl0(dividas?.total ?? 0))}</b></Link>
        </div>
        {sobra !== null && sobra > 0 && <p className="cm-mudo" style={{ textAlign: 'center', marginTop: 16 }}>Hoje dá para gastar <b style={{ color: 'var(--cm-tinta)' }}>{m(brl(disp.porDia))}</b></p>}
      </>
    );

  return (
    <>
      <div className="gs-cab">
        <p className="gs-sub" style={{ margin: 0 }}>{nome ? `Olá, ${nome}` : 'Olá'} · {nomeMes(mes)}</p>
        <button type="button" className="gs-icone-btn" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
      </div>

      <section className="ini-numero" aria-label="Quanto sobra no mês">
        {disp.modo === 'incompleto' ? (
          <>
            <span className="ini-rotulo">Para começar</span>
            <b className="ini-valor" style={{ fontSize: 32 }}>Quanto você ganha por mês?</b>
            <button type="button" className="gs-btn" style={{ marginTop: 14 }} onClick={() => setRenda(true)}>Informar minha renda</button>
          </>
        ) : (
          <button type="button" className="ini-toque" onClick={() => setCalc(true)} aria-label="Ver como essa conta foi feita">
            <span className="ini-rotulo">{disp.livre >= 0 ? 'Sobra neste mês' : 'Falta neste mês'}</span>
            <b className={`ini-valor${disp.livre < 0 ? ' neg' : ''}`}>{m(brl0(Math.abs(disp.livre)))}</b>
            <span className="ini-sub">{disp.livre > 0 ? <>Dá para gastar <b>{m(brl(disp.porDia))}</b> por dia</> : 'Este mês não sobra para gastos extras'} · ver a conta <ChevronRight size={14} aria-hidden="true" /></span>
          </button>
        )}
      </section>

      <nav className="ini-linhas" aria-label="Resumo">
        {linhas.map((l) => (
          <Link key={l.rota} to={l.rota} className={`ini-linha ${l.tom ?? ''}`}>
            <span className="ini-nome"><b>{l.nome}</b><small>{l.sub}</small></span>
            <span className="ini-quanto">{l.valor}</span>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </>
  );
}
