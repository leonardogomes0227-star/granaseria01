import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarClock, ChartLine, ChartPie, ChevronRight, CreditCard, Gift, Landmark, PiggyBank, Receipt, Search, Sprout, Target, Timer, type LucideIcon } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl0, mesCurto, mesDe } from './datas';
import { paraSim, saldoAtual, simular } from './dividas';
import { assinaturasTotal } from './resumos';
import { contasDoMes, patrimonioGuardado, reservaMeta } from './selectores';
import { saudeFinanceira } from './saude';
import { Anel } from './graficos';
import { Titulo } from './ui';
import { prioridades, resumoSemaforo, totalAResolver } from './prioridades';
import { brl } from './datas';
import { linhasDeCategoria } from './orcamento';
import { Metas } from './Metas';
import { Barra } from './ui';
import { iconeDe } from './categorias';
import { situacaoAtrasos } from './atrasosLogica';

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ---------- Ferramentas (rota /plano): as ferramentas, cada uma com o seu estado e um porquê ---------- */

export function Plano() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const total = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
  const sim = e.planoDividas && total > 0 ? simular(paraSim(e.dividas), e.planoDividas.pagamentoMensal, e.planoDividas.estrategia) : null;
  const s = saudeFinanceira(e, mes, hoje);
  const aPagar = contasDoMes(e, mes, hoje).filter((c) => c.estado !== 'paga').length;
  const noLimite = linhasDeCategoria(e, mes).filter((l) => l.tom === 'aviso' || l.tom === 'perigo').length;
  const meta = reservaMeta(e, mes);
  const esperando = e.desejos.filter((d) => d.status === 'esperando').length;
  const atraso = situacaoAtrasos(e, hoje);
  type Item = { rota: string; ic: LucideIcon; titulo: string; texto: string; busca: string };
  const I = (rota: string, ic: LucideIcon, titulo: string, texto: string, busca: string): Item => ({ rota, ic, titulo, texto, busca });
  const grupos: { nome: string; itens: Item[] }[] = [
    {
      nome: 'Sair do aperto',
      itens: [
        I('/plano/atrasos', CalendarClock, 'Sair do atraso', atraso.atrasos.length ? `${atraso.atrasos.length} ${atraso.atrasos.length === 1 ? 'conta atrasada' : 'contas atrasadas'} · ${brl0(atraso.total)}${atraso.plano.emDiaEm && atraso.plano.meses > 1 ? ` · em dia em ${mesCurto(atraso.plano.emDiaEm)}` : ''}` : 'Nenhuma conta atrasada', 'atraso atrasada atrasei parcela atrasada nao consegui pagar bola de neve multa em dia'),
        I('/plano/dividas', Target, 'Quitar dívidas', total > 0 ? `${brl0(total)} em aberto${sim?.dataFinal ? ` · quita em ${mesCurto(sim.dataFinal)}` : ''}` : e.dividas.length ? 'Tudo quitado' : 'Monte o caminho até zerar', 'divida devo juros banco negociar'),
        I('/plano/emprestimos', Landmark, 'Empréstimo', 'Quanto de juros você vai pagar', 'emprestimo financiamento juros oferta taxa parcela quanto custa'),
        I('/plano/cartao', CreditCard, 'Cartão de crédito', e.cartao && e.cartao.limite > 0 ? `${Math.round((e.cartao.usado / e.cartao.limite) * 100)}% do limite` : 'Fatura, limite e melhor dia', 'cartao fatura limite credito'),
      ],
    },
    {
      nome: 'Controlar o mês',
      itens: [
        I('/plano/orcamento', ChartPie, 'Orçamento', e.config.renda > 0 && noLimite ? `${noLimite} categoria${noLimite > 1 ? 's' : ''} no limite` : 'Limite por categoria e 50/30/20', 'orcamento limite categoria gastos 50 30 20'),
        I('/plano/calendario', CalendarDays, 'Calendário de contas', e.gastosFixos.length ? `${aPagar} a pagar · o que sobra até o salário` : 'Do salário até o próximo salário', 'calendario contas vencimento boleto salario'),
        I('/plano/assinaturas', Search, 'Gastos escondidos', assinaturasTotal(e) > 0 ? `${brl0(assinaturasTotal(e))} por mês` : 'Ache o que você paga sem ver', 'assinaturas streaming gastos escondidos'),
      ],
    },
    {
      nome: 'Guardar dinheiro',
      itens: [
        I('/plano/reserva', PiggyBank, 'Reserva de emergência', meta > 0 ? `${brl0(patrimonioGuardado(e))} de ${brl0(meta)}` : 'Guarde antes de gastar', 'reserva emergencia guardar poupar'),
        I('/plano/extras', Gift, 'Dinheiro extra', '13º, bônus: o melhor rumo pra ele', 'extra 13 bonus freela decimo terceiro quitar'),
        I('/plano/renda', Sprout, 'Viver de renda', 'Quando o rendimento paga as suas contas', 'renda liberdade aposentadoria patrimonio viver de renda'),
      ],
    },
    {
      nome: 'Fazer o dinheiro render',
      itens: [I('/investir', ChartLine, 'Investir', 'Um caminho em passos, com dados reais do mercado', 'investir investimento cdi selic bolsa cripto renda fixa')],
    },
    {
      nome: 'Comprar bem',
      itens: [
        I('/plano/comprar', Timer, 'Posso comprar isso?', esperando ? `${esperando} em espera de 72h` : 'Horas de trabalho e veredito', 'comprar compra desejo 72 horas'),
        I('/plano/parcelado', Receipt, 'À vista ou parcelado?', 'O duelo: quem sai mais barato', 'parcelado a vista parcela desconto juros sem juros'),
      ],
    },
  ];
  const [busca, setBusca] = useState('');
  const q = norm(busca.trim());
  const visiveis = grupos.map((g) => ({ ...g, itens: q ? g.itens.filter((i) => norm(`${i.titulo} ${i.busca}`).includes(q)) : g.itens })).filter((g) => g.itens.length > 0);
  return (
    <>
      <Titulo titulo="Planejamento" sub="Contas, cartão e dívidas num só lugar. Resolva primeiro o que está em vermelho." />
      <Prioridades />
      <OrcamentoResumo />
      <h2 className="gs-h2" id="metas">Metas financeiras</h2>
      <Metas />
      <h2 className="gs-h2">Ferramentas</h2>
      <section className="gs-card destaque" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 'none', width: 92 }}><Anel pct={s.nota} grande={String(s.nota)} sub="nota" cor={s.nota >= 70 ? 'var(--success)' : s.nota >= 45 ? 'var(--gold-strong)' : 'var(--danger)'} tamanho={92} /></div>
        <div>
          <b>Comece por aqui</b>
          <p className="gs-mudo" style={{ margin: '2px 0 8px' }}>{s.pior.nome}: {s.pior.detalhe}. {s.pior.dica}</p>
          <Link to={s.pior.rota} className="gs-btn pequeno">Abrir</Link>
        </div>
      </section>
      <label className="gs-campo" style={{ marginTop: 16 }}>
        <span style={{ position: "absolute", left: -9999 }}>Buscar ferramenta</span>
        <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar: dívida, cartão, reserva…" maxLength={40} />
      </label>
      {visiveis.map((g) => (
        <section key={g.nome} aria-label={g.nome}>
          <h2 className="gs-h2">{g.nome}</h2>
          <div className="gs-card" style={{ padding: '4px 16px' }}>
            {g.itens.map((i) => (
              <Link key={i.rota} to={i.rota} className="gs-ferr">
                <span className="ic" aria-hidden="true"><i.ic size={20} strokeWidth={2} /></span>
                <span className="gs-corpo"><b>{i.titulo}</b><small>{i.texto}</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ))}
      {visiveis.length === 0 && <p className="gs-mudo" role="status">Nenhuma ferramenta com “{busca}”. Tente outra palavra.</p>}
    </>
  );
}

const COR = { vermelho: 'var(--danger)', amarelo: '#C98A00', verde: 'var(--success)' } as const;
const NOME = { vermelho: 'atrasado', amarelo: 'atenção', verde: 'em ordem' } as const;

/** O que resolver primeiro: contas, fatura e parcelas com semáforo (vermelho, amarelo, verde). */
function Prioridades() {
  const e = useEstado();
  const hoje = useHoje();
  const lista = prioridades(e, hoje);
  if (lista.length === 0)
    return <p className="gs-nota">Cadastre contas fixas, cartão ou dívidas e eu organizo aqui o que vence primeiro. <Link to="/lancamentos?aba=contas">Cadastrar contas</Link></p>;
  const r = resumoSemaforo(lista);
  const abertas = lista.filter((x) => x.semaforo !== 'verde');
  return (
    <section className="gs-card" aria-label="Prioridades">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b>O que resolver primeiro</b>
        <span className="gs-mudo">{abertas.length ? `${totalAResolver(lista)} a resolver` : 'tudo organizado'} · <Link to="/plano/calendario">calendário</Link></span>
      </div>
      <p className="gs-mudo" style={{ margin: '4px 0 6px' }}>{r.vermelho} atrasado{r.vermelho === 1 ? '' : 's'} · {r.amarelo} em atenção · {r.verde} em ordem</p>
      {lista.slice(0, 6).map((p) => (
        <Link key={p.chave} to={p.rota} className="gs-linha gs-linha-btn">
          <span className="gs-semaforo" style={{ background: COR[p.semaforo] }} role="img" aria-label={NOME[p.semaforo]} />
          <div className="gs-corpo"><b>{p.titulo}</b><small>{p.detalhe}</small></div>
          <span className="gs-valor">{brl(p.valor)}</span>
        </Link>
      ))}
    </section>
  );
}

const ESTADO_ORC = { ok: ['Dentro do orçamento', 'ok'], aviso: ['Perto do limite', 'aviso'], perigo: ['Orçamento ultrapassado', 'erro'] } as const;
/** Orçamento por categoria: quanto já usou do que você planejou, com 3 estados. */
function OrcamentoResumo() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const linhas = linhasDeCategoria(e, mes).filter((l) => l.limite && l.tom !== 'sem');
  return (
    <>
      <h2 className="gs-h2">Orçamento do mês</h2>
      {linhas.length === 0 ? (
        <div className="gs-card">
          <p className="gs-mudo" style={{ margin: 0 }}>Defina um limite para as categorias em que você quer ter mais controle (alimentação, lazer…). Aqui você acompanha quanto já usou de cada uma.</p>
          <Link to="/plano/orcamento" className="gs-btn sec pequeno" style={{ marginTop: 10 }}>Definir orçamento</Link>
        </div>
      ) : (
        <div className="gs-card">
          {linhas.map((l) => { const I = iconeDe(l.categoria); const [txt, tom] = ESTADO_ORC[l.tom as 'ok' | 'aviso' | 'perigo']; return (
            <div key={l.categoria} style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="gs-ic-cat" aria-hidden="true"><I size={18} /></span>
                <div className="gs-corpo" style={{ flex: 1, minWidth: 0 }}><b>{l.categoria}</b><small className="gs-mudo" style={{ display: 'block' }}>{brl0(l.gasto)} de {brl0(l.limite ?? 0)} utilizados</small></div>
                <span className={`gs-badge ${tom}`}>{txt}</span>
              </div>
              <Barra pct={l.pct ?? 0} tom={l.tom === 'perigo' ? 'perigo' : l.tom === 'ok' ? 'ok' : ''} rotulo={`${l.categoria}: ${Math.round(l.pct ?? 0)}% do limite`} />
            </div>
          ); })}
          <Link to="/plano/orcamento" className="gs-btn link">Ajustar limites</Link>
        </div>
      )}
    </>
  );
}
