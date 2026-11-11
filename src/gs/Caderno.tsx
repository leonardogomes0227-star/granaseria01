import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Eye, EyeOff, Plus } from 'lucide-react';
import { getName } from '../painel';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl, brl0, diaCurto, mesCurto, mesDe, nomeMes, somaMes } from './datas';
import { contasDoMes, detalheDisponivel } from './selectores';
import { paraSim, saldoAtual, simular } from './dividas';
import { planoDeQuitacao } from './caminho';
import { FERRAMENTAS } from './registroFerramentas';
import { abrirAdicionar } from './AdicionarMov';
import { BaixaSheet } from './BaixaSheet';
import { NovaDividaSheet } from './NovaDivida';
import { FormRenda } from './Onboarding';
import { ComoCalculei } from './ComoCalculei';
import { Folha } from './ui';
import { ICONES } from './base';
import { definirOculto, mascarar, useOculto } from './privacidade';

/* ---------- Início: o caderno. Entrou, saiu, sobrou; as contas do mês; as dívidas; os gastos; e as ferramentas. ---------- */
// Tudo em uma tela, como a pessoa faria no papel. Os números saem dos mesmos cálculos de sempre (selectores, dividas).

const primeiroNome = (n: string) => {
  const p = n.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
};

/** As ferramentas que aparecem no Início, na ordem do que mais se usa. As outras ficam em "Todas as ferramentas". */
const ATALHOS = ['cartao', 'atrasos', 'orcamento', 'comprar', 'reserva', 'metas', 'extras', 'emprestimos', 'parcelado', 'cortar', 'relatorios', 'coach'];
const ROTULO: Record<string, string> = { renda: 'Salário e entradas', saldo: 'Saldo que você informou', fixos: 'Contas fixas', parcelas: 'Parcelas de dívidas', fatura: 'Fatura do cartão', reserva: 'Guardar para a reserva', atraso: 'Contas atrasadas', gastos: 'Gastos do dia a dia' };
const DESCRICAO: Record<string, string> = { comprar: 'Veja se cabe no mês antes de comprar', coach: 'Pergunte do seu jeito, eu respondo com os seus números', atrasos: 'O que pagar primeiro e quando fica em dia', cartao: 'Fatura, limite e parcelas' };
const NOME_CURTO: Record<string, string> = { coach: 'Tirar uma dúvida', atrasos: 'Contas atrasadas', comprar: 'Posso comprar?', relatorios: 'Relatórios', orcamento: 'Orçamento', reserva: 'Reserva', extras: 'Dinheiro extra', emprestimos: 'Empréstimo', parcelado: 'À vista ou parcelado', cortar: 'Onde cortar', cartao: 'Cartão de crédito', metas: 'Metas' };

export function Caderno() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const oculto = useOculto();
  const m = (t: string) => mascarar(t, oculto);
  const [calc, setCalc] = useState(false);
  const [renda, setRenda] = useState(false);
  const [baixa, setBaixa] = useState<string | null>(null);
  const [novaDivida, setNovaDivida] = useState(false);
  const nome = primeiroNome(e.config.nome || getName() || '');
  const disp = useMemo(() => detalheDisponivel(e, mes, hoje), [e, mes, hoje]);
  const contas = useMemo(() => contasDoMes(e, mes, hoje), [e, mes, hoje]);
  const abertas = contas.filter((c) => c.estado !== 'paga').sort((a, b) => a.dias - b.dias);
  const pagas = contas.filter((c) => c.estado === 'paga');
  const faltaContas = abertas.reduce((t, c) => t + c.valor, 0);

  // dívidas: quanto falta em cada uma e quando acaba, no plano de pagamento de hoje
  const dividas = useMemo(() => {
    const ds = paraSim(e.dividas);
    if (ds.length === 0) return { lista: [], total: 0, fim: null as string | null, porMes: 0 };
    const { pagamento, estrategia } = planoDeQuitacao(e, mes);
    const sim = simular(ds, pagamento, estrategia, mes);
    return {
      lista: e.dividas.filter((d) => saldoAtual(d) > 0).map((d) => ({ d, falta: saldoAtual(d), fim: sim.quita && sim.quitaEm[d.id] ? somaMes(mes, sim.quitaEm[d.id]) : null })),
      total: ds.reduce((t, d) => t + d.saldo, 0),
      fim: sim.quita ? sim.dataFinal : null,
      porMes: pagamento,
    };
  }, [e, mes]);

  const ultimos = useMemo(() => [...e.lancamentos].filter((l) => mesDe(l.data) === mes).sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id)).slice(0, 5), [e.lancamentos, mes]);
  const gastoMes = e.lancamentos.filter((l) => mesDe(l.data) === mes).reduce((t, l) => t + l.valor, 0);
  const atalhos = ATALHOS.map((id) => FERRAMENTAS.find((f) => f.id === id)).filter(Boolean) as typeof FERRAMENTAS;

  return (
    <>
      <div className="gs-cab">
        <div>
          <h1 className="gs-titulo">{nome ? `Olá, ${nome}` : 'Seu caderno'}</h1>
          <p className="gs-sub" style={{ margin: 0 }}>{nomeMes(mes).charAt(0).toUpperCase() + nomeMes(mes).slice(1)}</p>
        </div>
        <button type="button" className="gs-icone-btn" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
      </div>

      {/* 1. a conta do mês, como no papel */}
      <section className="cd-folha" aria-label="A conta do mês">
        <h2 className="cd-titulo">A conta do mês</h2>
        {disp.modo === 'incompleto' ? (
          <>
            <p className="cm-mudo" style={{ margin: '0 0 12px' }}>Comece dizendo quanto você recebe por mês. Com isso eu faço a conta.</p>
            <button type="button" className="gs-btn" onClick={() => setRenda(true)}>Informar minha renda</button>
          </>
        ) : (
          <>
            <dl className="cd-conta">
              {disp.linhas.map((l) => (
                <div key={l.id} className={l.sinal === '+' ? 'entra' : 'sai'}>
                  <dt>{ROTULO[l.id] ?? l.rotulo}{l.confianca === 'estimado' ? <small> · estimado</small> : null}</dt>
                  <dd>{l.sinal === '+' ? '+ ' : '− '}{m(brl0(l.valor))}</dd>
                </div>
              ))}
              <div className="total">
                <dt>{disp.livre >= 0 ? 'Sobra no mês' : 'Falta no mês'}</dt>
                <dd className={disp.livre < 0 ? 'neg' : ''}>{m(brl0(Math.abs(disp.livre)))}</dd>
              </div>
            </dl>
            <p className="cd-dia">{disp.livre > 0 ? <>Dá para gastar <b>{m(brl(disp.porDia))} por dia</b> até o fim do mês ({disp.diasRestantes} {disp.diasRestantes === 1 ? 'dia' : 'dias'}).</> : <>Este mês não sobra para gastos extras. Veja <Link to="/plano/cortar">onde cortar</Link>.</>}</p>
            <button type="button" className="cm-link" onClick={() => setCalc(true)}>Como fiz essa conta <ChevronRight size={16} aria-hidden="true" /></button>
          </>
        )}
      </section>

      {/* 2. as contas do mês, para ir riscando */}
      <section className="cd-folha" aria-label="Contas do mês">
        <h2 className="cd-titulo">Contas do mês{contas.length > 0 && <small>{abertas.length ? `faltam ${m(brl0(faltaContas))}` : 'todas pagas'}</small>}</h2>
        {contas.length === 0 ? (
          <p className="cm-mudo" style={{ margin: 0 }}>Nenhuma conta cadastrada. <Link to="/lancamentos?aba=contas">Cadastrar aluguel, luz, internet…</Link></p>
        ) : (
          <ul className="cd-lista">
            {abertas.map((c) => (
              <li key={c.gasto.id} className={c.estado}>
                <button type="button" className="cd-check" aria-label={`Marcar ${c.gasto.nome} como paga`} onClick={() => setBaixa(c.gasto.id)} />
                <span className="cd-nome"><b>{c.gasto.nome}</b><small>{c.estado === 'atrasada' ? `atrasada desde ${diaCurto(c.vencimento)}` : c.dias === 0 ? 'vence hoje' : c.dias === 1 ? 'vence amanhã' : `vence ${diaCurto(c.vencimento)}`}</small></span>
                <span className="cd-valor">{m(brl(c.valor))}</span>
              </li>
            ))}
            {pagas.map((c) => (
              <li key={c.gasto.id} className="paga">
                <span className="cd-check feito" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>
                <span className="cd-nome"><b>{c.gasto.nome}</b><small>paga</small></span>
                <span className="cd-valor">{m(brl(c.valor))}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/lancamentos?aba=contas" className="cm-link">Adicionar ou editar contas <ChevronRight size={16} aria-hidden="true" /></Link>
      </section>

      {/* 3. as dívidas */}
      <section className="cd-folha" aria-label="Dívidas">
        <h2 className="cd-titulo">Dívidas{dividas.lista.length > 0 && <small>{m(brl0(dividas.total))} no total</small>}</h2>
        {dividas.lista.length === 0 ? (
          <p className="cm-mudo" style={{ margin: '0 0 10px' }}>{e.dividas.length ? 'Todas quitadas. Parabéns!' : 'Nenhuma dívida anotada.'}</p>
        ) : (
          <>
            <ul className="cd-lista">
              {dividas.lista.map(({ d, falta, fim }) => (
                <li key={d.id}>
                  <span className="cd-nome"><b>{d.nome}</b><small>{d.parcelaMinima > 0 ? `${m(brl0(d.parcelaMinima))} por mês` : 'sem parcela definida'}{fim ? ` · acaba em ${mesCurto(fim)}` : ''}{d.estimado ? ' · valor estimado' : ''}</small></span>
                  <span className="cd-valor">{m(brl0(falta))}</span>
                </li>
              ))}
            </ul>
            <p className="cd-dia">{dividas.fim ? <>Pagando {m(brl0(dividas.porMes))} por mês, você fica <b>livre de todas em {nomeMes(dividas.fim)}</b>.</> : <>Com o que você paga hoje, os juros crescem mais rápido. <Link to="/plano/dividas">Veja como sair</Link>.</>}</p>
          </>
        )}
        <div className="gs-acoes">
          <button type="button" className="gs-btn sec pequeno" onClick={() => setNovaDivida(true)}><Plus size={16} aria-hidden="true" /> Anotar dívida</button>
          {dividas.lista.length > 0 && <Link to="/plano/dividas" className="cm-link">Plano para quitar <ChevronRight size={16} aria-hidden="true" /></Link>}
        </div>
      </section>

      {/* 4. os gastos do dia a dia */}
      <section className="cd-folha" aria-label="Gastos do mês">
        <h2 className="cd-titulo">Gastos do dia a dia{gastoMes > 0 && <small>{m(brl0(gastoMes))} no mês</small>}</h2>
        {ultimos.length === 0 ? (
          <p className="cm-mudo" style={{ margin: '0 0 10px' }}>Nada anotado neste mês. Anote aqui ou mande pelo WhatsApp: <i>gastei 35 no mercado</i>.</p>
        ) : (
          <ul className="cd-lista">
            {ultimos.map((l) => (
              <li key={l.id}>
                <span className="cd-nome"><b>{l.descricao || l.categoria}</b><small>{diaCurto(l.data)} · {l.categoria}{l.serverId !== undefined ? ' · via WhatsApp' : ''}</small></span>
                <span className="cd-valor">{m(brl(l.valor))}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="gs-acoes">
          <button type="button" className="gs-btn" onClick={() => abrirAdicionar()}><Plus size={18} aria-hidden="true" /> Anotar gasto</button>
          {ultimos.length > 0 && <Link to="/lancamentos" className="cm-link">Ver todos <ChevronRight size={16} aria-hidden="true" /></Link>}
        </div>
      </section>

      {/* 5. as ferramentas, à vista */}
      <section aria-label="Ferramentas">
        <h2 className="cd-titulo" style={{ marginTop: 28 }}>Ferramentas<Link to="/ferramentas" className="cm-link">Ver todas</Link></h2>
        <div className="cd-ferramentas">
          {atalhos.map((f) => {
            const I = ICONES[f.icone] ?? ChevronRight;
            return (
              <Link key={f.id} to={f.rota} className="cd-ferr">
                <span className="ic" aria-hidden="true"><I size={22} strokeWidth={1.9} /></span>
                <b>{NOME_CURTO[f.id] ?? f.titulo}</b>
                <small>{DESCRICAO[f.id] ?? f.resolve}</small>
              </Link>
            );
          })}
        </div>
      </section>

      <ComoCalculei aberta={calc} onFechar={() => setCalc(false)} d={disp} />
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <NovaDividaSheet aberta={novaDivida} onFechar={() => setNovaDivida(false)} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </>
  );
}
