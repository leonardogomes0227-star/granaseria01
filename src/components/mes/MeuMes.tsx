import { useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, LogOut, Plus, RefreshCw, ShoppingCart } from 'lucide-react';
import { formatBRL } from '../../calculations';
import { currentMonth } from '../../coachChat/months';
import { loadBills, paidThisMonth, saveBills, savedThisMonth } from '../../bills';
import { abrirAnotar, avisarLancamentos, type Lancamento } from '../../lib/anotar';
import { CATEGORIAS_SAIDA, GUARDADO, iconeCategoria, rotuloCategoria } from '../../lib/categorias';
import { barra, gravarLimite, lerLimites, limiteDe, limitesDaMissao, type Limites } from '../../lib/limites';
import { useArmazem } from '../../lib/armazem';
import { ativas, lerMissoes } from '../../missoes';
import { poucoMovimento } from '../../lib/celebrar';
import type { PainelData } from '../../painel';
import { PageHead } from '../AppShell';
import { CountUp } from '../motion';
import { FixedBills, useBills, useSaved } from '../FixedBills';
import { Guilloche } from '../ui/Guilloche';
import { Medalhao } from '../ui/Medalhao';
import { Valor } from '../ui/Valor';
import { apagarComDesfazer, toast } from '../ui/Toast';
import { DecimalInput } from '../DecimalInput';
import { apagar, restaurar } from './api';
import { useContaDoMes, useLancamentosDoMes } from './dados';
import { LinhaDeslizante } from './LinhaDeslizante';
import { PossoComprarChat } from './PossoComprarChat';
import { agruparPorDia, brlCentavos, diaDe, mesesParaEscolher, nomeDoMes } from './mes';

/* ---------- Meu mês (spec v2, 7.2): o mês escolhido, o saldo, os limites e os lançamentos ---------- */
// O mês atual e os que passaram (nunca o futuro). Entrou/Saiu/Contas pagas/Guardado filtram a lista. Cada lançamento
// edita e apaga ali mesmo (deslizar no celular, ⋯ no PC), com "Desfazer". Anotar abre a folha (AnotarSheet).

const soma = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);
const maiuscula = (s: string) => s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1);
const chave = (l: Lancamento) => `${l.kind}:${l.id}`;
const POR_PAGINA = 30;

type Filtro = 'in' | 'out' | 'contas' | 'guardado';
const NOME_FILTRO: Record<Filtro, string> = { in: 'Entradas', out: 'Saídas', contas: 'Contas pagas', guardado: 'Guardado' };

interface Linha {
  chave: string;
  tipo: Filtro;
  valor: number;
  quando: string; // ISO
  dia: string; // 'AAAA-MM-DD'
  descricao: string;
  categoria: string;
  forma: string | null;
  lancamento?: Lancamento; // editável e apagável pela API
  pagamento?: { contaId: string; nome: string; month: string; paidOn: string; amount: number }; // conta fixa marcada como paga
}

/** O que veio no /api/painel (só o mês atual), pra quando a lista do mês não carrega. */
function doPainel(p: PainelData | null): Lancamento[] | null {
  if (!p) return null;
  return [
    ...p.month.expenses.map((e) => ({ id: e.id ?? 0, kind: 'out' as const, amount: e.amount, category: e.category, description: e.description, method: e.method, created_at: e.created_at })),
    ...p.month.incomes.map((e) => ({ id: e.id ?? 0, kind: 'in' as const, amount: e.amount, category: e.source, description: e.description, method: e.method, created_at: e.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function MeuMes({ painel, limitesDiagnostico, onOpenTool, onSair }: { painel: PainelData | null; limitesDiagnostico: Limites; onOpenTool: (id: 'impulse') => void; onSair: () => void }) {
  const atual = currentMonth();
  const [mes, setMes] = useState(atual);
  const ehAtual = mes === atual;
  const nome = nomeDoMes(mes, atual);
  const doAtual = useLancamentosDoMes(atual, true);
  const doEscolhido = useLancamentosDoMes(mes, !ehAtual);
  const reserva = useMemo(() => doPainel(painel), [painel]);
  const [escondidos, setEscondidos] = useState<Set<string>>(() => new Set());
  const visivel = (lista: Lancamento[] | null) => lista?.filter((l) => !escondidos.has(chave(l))) ?? null;
  const itensAtual = visivel(doAtual.itens ?? (doAtual.erro ? reserva : null));
  const itens = ehAtual ? itensAtual : visivel(doEscolhido.itens);
  const erro = ehAtual ? (itensAtual ? null : doAtual.erro) : doEscolhido.erro;
  const carregando = itens === null && !erro;

  const bills = useBills();
  const saved = useSaved();
  const { conta, entrada, hoje, semDados } = useContaDoMes(itensAtual);

  // os números do mês escolhido (o "Guardado" anotado no WhatsApp conta como guardado, não como gasto)
  const lista = itens ?? [];
  const income = soma(lista.filter((l) => l.kind === 'in'));
  const spent = soma(lista.filter((l) => l.kind === 'out' && l.category !== GUARDADO));
  const billsPaid = paidThisMonth(bills, mes);
  const putAside = Math.round((savedThisMonth(saved, mes) + soma(lista.filter((l) => l.kind === 'out' && l.category === GUARDADO))) * 100) / 100;
  const left = income - spent - billsPaid - putAside;

  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const listaRef = useRef<HTMLElement>(null);
  const alternar = (f: Filtro) => {
    const novo = filtro === f ? null : f;
    setFiltro(novo);
    if (novo) window.setTimeout(() => listaRef.current?.scrollIntoView({ behavior: poucoMovimento() ? 'auto' : 'smooth', block: 'start' }), 30);
  };
  const [comprar, setComprar] = useState(false);

  const mudarMes = (m: string) => {
    setMes(m);
    setFiltro(null);
  };

  // as linhas: lançamentos + contas fixas pagas + o "Guardei" do pague-se primeiro
  const linhas: Linha[] = useMemo(() => {
    const out: Linha[] = (itens ?? []).map((l) => ({
      chave: chave(l),
      tipo: l.kind === 'in' ? 'in' : l.category === GUARDADO ? 'guardado' : 'out',
      valor: l.amount,
      quando: l.created_at,
      dia: diaDe(l.created_at),
      descricao: l.description || (l.kind === 'in' ? l.category : rotuloCategoria(l.category)),
      categoria: l.kind === 'in' ? l.category : rotuloCategoria(l.category),
      forma: l.method,
      lancamento: l.id > 0 ? l : undefined,
    }));
    for (const b of bills)
      b.payments.forEach((p, i) => {
        if (p.paidOn.slice(0, 7) !== mes) return;
        out.push({ chave: `conta:${b.id}:${i}`, tipo: 'contas', valor: p.amount, quando: `${p.paidOn}T15:00:00Z`, dia: p.paidOn, descricao: b.name, categoria: 'Conta fixa', forma: null, pagamento: { contaId: b.id, nome: b.name, ...p } });
      });
    saved.forEach((e, i) => {
      if (e.on.slice(0, 7) !== mes) return;
      out.push({ chave: `guardado:${i}`, tipo: 'guardado', valor: e.amount, quando: `${e.on}T15:00:00Z`, dia: e.on, descricao: 'Pague-se primeiro', categoria: 'Guardado', forma: null });
    });
    return out.sort((a, b) => b.dia.localeCompare(a.dia) || b.quando.localeCompare(a.quando));
  }, [itens, bills, saved, mes]);

  const apagarLancamento = (l: Lancamento) => {
    const k = chave(l);
    const mostrar = () =>
      setEscondidos((s) => {
        const n = new Set(s);
        n.delete(k);
        return n;
      });
    setEscondidos((s) => new Set(s).add(k));
    const pedido = apagar(l.kind, l.id);
    pedido.then(() => avisarLancamentos({ acao: 'apagou', lancamento: l })).catch(() => {
      mostrar();
      toast('Não consegui apagar agora. Ele continua na lista.');
    });
    apagarComDesfazer(`Apagado: ${l.description || rotuloCategoria(l.category)}`, () => {
      mostrar();
      void pedido
        .then(() => restaurar(l))
        .then(() => avisarLancamentos({ acao: 'voltou', lancamento: l }))
        .catch(() => toast('Não consegui desfazer agora. Dá pra anotar de novo pelo +.'));
    });
  };

  const apagarPagamento = (p: NonNullable<Linha['pagamento']>) => {
    const todas = loadBills();
    const b = todas.find((x) => x.id === p.contaId);
    const i = b ? b.payments.findIndex((x) => x.month === p.month && x.paidOn === p.paidOn && x.amount === p.amount) : -1;
    if (!b || i < 0) return;
    const pag = b.payments[i];
    saveBills(todas.map((x) => (x.id === b.id ? { ...x, payments: x.payments.filter((_, j) => j !== i) } : x)));
    apagarComDesfazer(`Pagamento de ${b.name} desmarcado`, () => {
      saveBills(loadBills().map((x) => (x.id === b.id ? { ...x, payments: [...x.payments, pag] } : x)));
    });
  };

  // o que aparece embaixo do número grande
  const sub = (() => {
    if (!ehAtual) {
      if (income === 0) return `Nada de entrada anotada em ${nome}.`;
      return left >= 0 ? `Sobraram ${formatBRL(left)} em ${nome}.` : `Saiu ${formatBRL(-left)} a mais do que entrou.`;
    }
    if (semDados) return 'Anote o que entrou (ex.: recebi 3000 salário) pra ver o saldo.';
    if (conta.estourou) return `Você passou ${formatBRL(conta.passou)} do limite do mês.`;
    return conta.porDia > 0 ? `Dá pra gastar uns ${formatBRL(conta.porDia)} por dia` : 'O que entrou este mês já foi usado';
  })();

  const stat = (f: Filtro, rotulo: string, valor: number) => (
    <button key={f} type="button" className={filtro === f ? 'on' : ''} aria-pressed={filtro === f} onClick={() => alternar(f)}>
      <small>{rotulo}</small>
      <b>{formatBRL(valor)}</b>
    </button>
  );

  return (
    <div className="painel mes-pagina">
      <PageHead title="Meu mês" sub={ehAtual ? `O que você anotou em ${nome}.` : `O que você anotou em ${nome}. Dá pra corrigir o que ficou errado.`} />
      <SeletorMes mes={mes} atual={atual} onMudar={mudarMes} />

      <section className="home-hero cofre month-card mes-saldo" id="mes" aria-label={`Seu mês de ${nome}`}>
        <Guilloche />
        <span className="home-hero-top">
          <span className="sobrelinha">{income > 0 ? 'Saldo' : 'Gastos'} de {nome}</span>
        </span>
        {carregando ? (
          <span className="skeleton skeleton-hero" aria-label="Carregando" />
        ) : (
          <b className="home-hero-number">
            <CountUp value={income > 0 ? left : spent} duration={600} format={(n) => formatBRL(n)} render={(n) => <Valor valor={n} />} />
          </b>
        )}
        <span className="home-hero-sub">{carregando ? ' ' : sub}</span>
        <div className="month-stats mes-filtros" role="group" aria-label="Filtrar os lançamentos">
          {stat('in', 'Entrou', income)}
          {stat('out', 'Saiu', spent)}
          {(billsPaid > 0 || filtro === 'contas') && stat('contas', 'Contas pagas', billsPaid)}
          {(putAside > 0 || filtro === 'guardado') && stat('guardado', 'Guardado', putAside)}
        </div>
        <div className="quick-actions">
          <button type="button" className="qa primary" onClick={() => abrirAnotar({ origem: 'mes' })}>
            <span className="qa-circle"><Plus size={22} /></span>
            <span>Anotar</span>
          </button>
        </div>
      </section>

      {ehAtual && <FixedBills />}

      {ehAtual &&
        (comprar ? (
          <PossoComprarChat conta={conta} hoje={hoje} gastosDoMes={entrada.gastosAnotados} semDados={semDados} onFechar={() => setComprar(false)} onVerDetalhes={() => onOpenTool('impulse')} />
        ) : (
          <button type="button" className="dir-row soft impulse-row" onClick={() => setComprar(true)}>
            <span className="tool-icon round"><ShoppingCart size={20} strokeWidth={1.9} /></span>
            <span className="dir-row-copy">
              <b>Posso comprar isso?</b>
              <span>Pergunte ao Nomasir se cabe no mês antes de comprar.</span>
            </span>
            <ArrowRight size={18} className="dir-row-arrow" />
          </button>
        ))}

      <div className="painel-two">
        <QuantoDa lista={lista} carregando={carregando} limitesDiagnostico={limitesDiagnostico} />

        <section ref={listaRef} className="painel-section stat-card painel-recent mes-lancamentos" id="lancamentos" aria-label="Últimos lançamentos">
          <p className="section-label">Últimos lançamentos</p>
          {filtro && (
            <p className="mes-mostrando" role="status">
              Mostrando: <b>{NOME_FILTRO[filtro]}</b> ·{' '}
              <button type="button" className="link-btn" onClick={() => setFiltro(null)}>
                Limpar
              </button>
            </p>
          )}
          <Lancamentos
            linhas={filtro ? linhas.filter((l) => l.tipo === filtro) : linhas}
            hoje={hoje}
            carregando={carregando}
            erro={erro}
            nome={nome}
            filtrando={Boolean(filtro)}
            onTentar={() => (ehAtual ? doAtual.recarregar() : doEscolhido.recarregar())}
            onApagar={apagarLancamento}
            onApagarPagamento={apagarPagamento}
          />
        </section>
      </div>
      <button type="button" className="month-out" onClick={onSair}>
        <LogOut size={13} /> Sair da conta
      </button>
    </div>
  );
}

/* ---------- seletor de mês: o atual e os que passaram ---------- */

function SeletorMes({ mes, atual, onMudar }: { mes: string; atual: string; onMudar: (m: string) => void }) {
  const meses = mesesParaEscolher(atual);
  const i = meses.indexOf(mes);
  return (
    <div className="mes-seletor" role="group" aria-label="Escolher o mês">
      <button type="button" aria-label="Mês anterior" disabled={i >= meses.length - 1} onClick={() => onMudar(meses[i + 1])}>
        <ChevronLeft size={18} />
      </button>
      <span className="mes-seletor-nome">
        <select aria-label="Mês" value={mes} onChange={(e) => onMudar(e.target.value)}>
          {meses.map((m) => (
            <option key={m} value={m}>
              {maiuscula(nomeDoMes(m, atual))}
              {m === atual ? ' (este mês)' : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
      <button type="button" aria-label="Próximo mês" disabled={mes === atual} onClick={() => onMudar(meses[Math.max(0, i - 1)])}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/* ---------- quanto ainda dá em cada coisa ---------- */

function QuantoDa({ lista, carregando, limitesDiagnostico }: { lista: Lancamento[]; carregando: boolean; limitesDiagnostico: Limites }) {
  const proprios = useArmazem(lerLimites);
  const missoes = useArmazem(lerMissoes);
  const doNomasir = useMemo(() => limitesDaMissao(ativas(missoes).find((m) => m.tipo === 'gastos')?.limites), [missoes]);
  const [editando, setEditando] = useState<string | null>(null); // a categoria, ou '' pra escolher uma nova

  const usados = new Map<string, number>();
  for (const l of lista) if (l.kind === 'out' && l.category !== GUARDADO) usados.set(l.category, (usados.get(l.category) ?? 0) + l.amount);
  const fontes = { proprios, missao: doNomasir, diagnostico: limitesDiagnostico };
  const nomes = new Set([...usados.keys(), ...Object.keys(proprios), ...Object.keys(doNomasir), ...Object.keys(limitesDiagnostico)]);
  nomes.delete(GUARDADO);
  const linhas = [...nomes]
    .map((cat) => {
      const usado = Math.round((usados.get(cat) ?? 0) * 100) / 100;
      const lim = limiteDe(cat, fontes);
      return { cat, usado, lim, b: barra(usado, lim?.valor) };
    })
    .sort((a, b) => b.usado - a.usado || (b.lim?.valor ?? 0) - (a.lim?.valor ?? 0) || a.cat.localeCompare(b.cat));
  const livres = CATEGORIAS_SAIDA.map((c) => c.nome).filter((c) => c !== GUARDADO && !nomes.has(c));

  const salvar = (cat: string, valor: number) => {
    gravarLimite(cat, valor);
    setEditando(null);
    toast(`Limite salvo: ${rotuloCategoria(cat)} até ${formatBRL(valor)} por mês. A barra avisa quando chegar perto.`);
  };
  const tirar = (cat: string) => {
    const antes = proprios[cat];
    gravarLimite(cat, null);
    setEditando(null);
    toast(`Limite de ${rotuloCategoria(cat)} tirado.`, { acao: { rotulo: 'Desfazer', onClick: () => gravarLimite(cat, antes) } });
  };

  return (
    <section className="painel-section stat-card painel-where mes-limites" aria-label="Quanto ainda dá em cada coisa">
      <p className="section-label">Quanto ainda dá em cada coisa</p>
      {carregando ? (
        <div className="skeleton-stack" aria-label="Carregando">
          <span className="skeleton skeleton-row" />
          <span className="skeleton skeleton-row" />
        </div>
      ) : linhas.length === 0 && editando === null ? (
        <div className="mes-vazio">
          <Medalhao id="nomasir" nome="Nomasir" tamanho={52} />
          <p>Ainda nada neste mês. Cada gasto anotado entra aqui, já separado por coisa.</p>
          <button type="button" className="btn-outline" onClick={() => setEditando('')}>
            Definir um limite
          </button>
        </div>
      ) : (
        <ul className="mes-limite-lista">
          {linhas.map(({ cat, usado, lim, b }, i) => {
            const Icone = iconeCategoria(cat);
            const rotulo = rotuloCategoria(cat);
            return (
              <li key={cat} className={`mes-limite ${b.tom}`} style={{ ['--i' as string]: Math.min(i, 10) }}>
                <span className="where-icon" aria-hidden="true"><Icone size={16} /></span>
                <span className="mes-limite-corpo">
                  <span className="mes-limite-topo">
                    <b>{rotulo}</b>
                    <span className="mes-limite-valor">
                      {formatBRL(usado)}
                      {lim && (
                        <>
                          {' '}
                          <button type="button" className="mes-limite-de" aria-label={`Mudar o limite de ${rotulo} (${formatBRL(lim.valor)})`} onClick={() => setEditando(editando === cat ? null : cat)}>
                            de {formatBRL(lim.valor)}
                          </button>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="mes-trilha" role="img" aria-label={lim ? `${Math.round(b.pct)}% do limite` : 'Sem limite'}>
                    <i style={{ width: `${b.pct}%` }} />
                  </span>
                  {lim ? (
                    <small className="mes-limite-nota">{b.tom === 'estourou' ? `Passou ${formatBRL(b.passou)}` : b.resta > 0 ? `Ainda dá ${formatBRL(b.resta)}` : 'Chegou no limite'}</small>
                  ) : (
                    <button type="button" className="mes-limite-definir" onClick={() => setEditando(editando === cat ? null : cat)}>
                      Sem limite · <u>Definir</u>
                    </button>
                  )}
                  {editando === cat && (
                    <EditorLimite
                      categoria={cat}
                      inicial={lim?.valor ?? 0}
                      sugestao={lim && lim.origem !== 'proprio' ? lim : null}
                      podeTirar={proprios[cat] > 0}
                      onSalvar={salvar}
                      onTirar={() => tirar(cat)}
                      onCancelar={() => setEditando(null)}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!carregando && editando === '' && <EditorLimite categoria={null} opcoes={livres} inicial={0} onSalvar={salvar} onCancelar={() => setEditando(null)} />}
      {!carregando && linhas.length > 0 && editando !== '' && livres.length > 0 && (
        <button type="button" className="link-btn mes-limite-outra" onClick={() => setEditando('')}>
          <Plus size={14} /> Limite pra outra coisa
        </button>
      )}
    </section>
  );
}

function EditorLimite({
  categoria,
  opcoes = [],
  inicial,
  sugestao = null,
  podeTirar = false,
  onSalvar,
  onTirar,
  onCancelar,
}: {
  categoria: string | null; // null: a pessoa escolhe a categoria
  opcoes?: string[];
  inicial: number;
  sugestao?: { valor: number; origem: 'proprio' | 'missao' | 'diagnostico' } | null;
  podeTirar?: boolean;
  onSalvar: (cat: string, valor: number) => void;
  onTirar?: () => void;
  onCancelar: () => void;
}) {
  const [cat, setCat] = useState(categoria ?? opcoes[0] ?? '');
  const [valor, setValor] = useState(inicial);
  const id = `limite-${(categoria ?? 'nova').replace(/\W+/g, '-')}`;
  return (
    <div
      className="mes-limite-editor"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancelar();
        }
      }}
    >
      {categoria === null && (
        <div className="field-group">
          <label className="field-label" htmlFor={`${id}-cat`}>Limite pra quê?</label>
          <select id={`${id}-cat`} className="field-input" value={cat} onChange={(e) => setCat(e.target.value)}>
            {opcoes.map((c) => (
              <option key={c} value={c}>{rotuloCategoria(c)}</option>
            ))}
          </select>
        </div>
      )}
      <div className="field-group">
        <label className="field-label" htmlFor={id}>Quanto no máximo por mês{categoria ? ` em ${rotuloCategoria(categoria)}` : ''}</label>
        <div className="input-prefix">
          <span>R$</span>
          <DecimalInput
            id={id}
            placeholder="0"
            autoFocus
            value={valor}
            onChange={setValor}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valor > 0 && cat) onSalvar(cat, valor);
            }}
          />
        </div>
        {sugestao && <p className="field-hint">{sugestao.origem === 'missao' ? 'Esse é o que você combinou com o Nomasir.' : 'Esse veio do seu diagnóstico.'} Mude se quiser.</p>}
      </div>
      <div className="mes-limite-acoes">
        <button type="button" className="btn-primary" disabled={!(valor > 0) || !cat} onClick={() => onSalvar(cat, valor)}>
          Salvar limite
        </button>
        <button type="button" className="btn-ghost" onClick={onCancelar}>
          Cancelar
        </button>
        {podeTirar && onTirar && (
          <button type="button" className="link-btn" onClick={onTirar}>
            Tirar limite
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- últimos lançamentos, por dia ---------- */

function Lancamentos({
  linhas,
  hoje,
  carregando,
  erro,
  nome,
  filtrando,
  onTentar,
  onApagar,
  onApagarPagamento,
}: {
  linhas: Linha[];
  hoje: string;
  carregando: boolean;
  erro: string | null;
  nome: string;
  filtrando: boolean;
  onTentar: () => void;
  onApagar: (l: Lancamento) => void;
  onApagarPagamento: (p: NonNullable<Linha['pagamento']>) => void;
}) {
  const [quantos, setQuantos] = useState(POR_PAGINA);
  if (carregando)
    return (
      <div className="skeleton-stack" aria-label="Carregando">
        <span className="skeleton skeleton-row" />
        <span className="skeleton skeleton-row" />
        <span className="skeleton skeleton-row" />
      </div>
    );
  if (erro && linhas.length === 0)
    return (
      <p className="field-error">
        Não consegui carregar {nome} agora.{' '}
        <button type="button" className="plan-more" onClick={onTentar}>
          <RefreshCw size={13} /> Tentar de novo
        </button>
      </p>
    );
  if (linhas.length === 0)
    return (
      <div className="mes-vazio">
        <Medalhao id="arkad" nome="Arkad" tamanho={52} />
        <p>{filtrando ? 'Nada desse tipo neste mês.' : `Nada anotado em ${nome} ainda. Cada moeda anotada é uma moeda que você controla.`}</p>
        {!filtrando && (
          <button type="button" className="btn-outline" onClick={() => abrirAnotar({ origem: 'mes' })}>
            <Plus size={16} /> Anotar o primeiro
          </button>
        )}
      </div>
    );
  const grupos = agruparPorDia(linhas.slice(0, quantos), hoje);
  let n = 0;
  return (
    <>
      <p className="mes-dica-toque">Deslize a linha: pra esquerda apaga, pra direita corrige.</p>
      {grupos.map((g) => (
        <div key={g.dia} className="mes-dia-grupo">
          <h3 className="sobrelinha mes-dia">{g.titulo}</h3>
          <ul className="mes-lista">
            {g.itens.map((r) => {
              const Icone = r.tipo === 'contas' ? iconeCategoria('Outros') : iconeCategoria(r.lancamento?.category ?? (r.tipo === 'guardado' ? GUARDADO : r.categoria), r.tipo === 'in' ? 'in' : 'out');
              const l = r.lancamento;
              const p = r.pagamento;
              const i = n++;
              return (
                <LinhaDeslizante
                  key={r.chave}
                  nome={r.descricao}
                  className={`mes-linha ${r.tipo}`}
                  style={{ ['--i' as string]: Math.min(i, 10) }}
                  onEditar={l ? () => abrirAnotar({ editar: l, origem: 'mes' }) : undefined}
                  onApagar={l ? () => onApagar(l) : p ? () => onApagarPagamento(p) : undefined}
                >
                  <span className={`entry-icon ${r.tipo === 'in' ? 'in' : ''}`} aria-hidden="true">
                    <Icone size={16} />
                  </span>
                  <span className="mes-linha-texto">
                    <b>{r.descricao}</b>
                    <small>
                      {r.categoria}
                      {r.forma ? ` · ${r.forma}` : ''}
                    </small>
                  </span>
                  <b className={`mes-linha-valor ${r.tipo === 'in' ? 'entrou' : ''}`}>
                    {r.tipo === 'in' ? '+' : '−'}
                    {brlCentavos(r.valor)}
                  </b>
                </LinhaDeslizante>
              );
            })}
          </ul>
        </div>
      ))}
      {linhas.length > quantos && (
        <button type="button" className="btn-outline mes-mais" onClick={() => setQuantos((q) => q + POR_PAGINA)}>
          Mostrar mais ({linhas.length - quantos})
        </button>
      )}
    </>
  );
}
