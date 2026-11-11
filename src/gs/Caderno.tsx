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

  const sobra = disp.modo === 'incompleto' ? null : disp.livre;
  return (
    <>
      <section className="inb-hero" aria-label="Quanto sobra no mês">
        <div className="inb-topo">
          <span>{nome ? `Olá, ${nome}` : 'Olá'}</span>
          <button type="button" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
        </div>
        {sobra === null ? (
          <>
            <small>Para começar</small>
            <b style={{ fontSize: 30 }}>Quanto você ganha por mês?</b>
            <button type="button" className="inb-conta" onClick={() => setRenda(true)}>Informar minha renda <ChevronRight size={16} aria-hidden="true" /></button>
          </>
        ) : (
          <>
            <small>{sobra < 0 ? 'Falta em' : 'Sobra em'} {nomeMes(mes).split(' ')[0]}</small>
            <b className={sobra < 0 ? 'neg' : ''}>{m(brl0(Math.abs(sobra)))}</b>
            <em>{sobra > 0 ? <>{m(brl(disp.porDia))} por dia até o fim do mês</> : 'Sem folga para gastos extras'}</em>
            <button type="button" className="inb-conta" onClick={() => setCalc(true)}>Ver a conta <ChevronRight size={16} aria-hidden="true" /></button>
          </>
        )}
      </section>
      <div className="inb-acoes">
        <button type="button" onClick={() => abrirAdicionar()}><i><Plus size={24} aria-hidden="true" /></i>Anotar</button>
        <Link to="/pagar"><i><Receipt size={22} aria-hidden="true" /></i>Contas</Link>
        <Link to="/plano/dividas"><i><Landmark size={22} aria-hidden="true" /></i>Dívidas</Link>
        <Link to="/ferramentas"><i><LayoutGrid size={22} aria-hidden="true" /></i>Ferramentas</Link>
      </div>
      <nav className="inb-linhas" aria-label="Resumo">
        {linhas.map((l) => (
          <Link key={l.rota} to={l.rota} className={l.tom ?? ''}>
            <span><b>{l.nome}</b><small>{l.sub}</small></span>
            <strong>{l.valor}</strong>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </>
  );
}
