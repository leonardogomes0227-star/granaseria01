import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Check, ChevronRight, ClipboardList, Flame, MessageCircle, Plus, Receipt, Users } from 'lucide-react';
import { fetchPainel, getName, painelToken, type PainelData } from '../painel';
import { formatBRL } from '../calculations';
import { todayBRT, type CoachTask } from '../coach';
import { AGENTS, CUSTOM_AGENTS_KEY, customPlan, loadChosen, type CustomAgent } from '../agents';
import { markTaskDone } from '../results';
import { fmtDue } from '../dates';
import { faturaEnabled, getTool, type ToolId } from '../tools';
import { useTasks } from './CoachPanel';
import { PageHead } from './AppShell';
import { FixedBills, fixedSummary, useBills, useMonthIncome, useSaved } from './FixedBills';
import { Snowball } from './Snowball';
import { useCoach } from '../coachChat/store';
import { lerEu, primeiroNome } from '../eu';
import { useArmazem } from '../lib/armazem';
import { MissaoDeHoje, MissoesAtivas } from './missoes/HomeMissoes';
import { lerMissoes, ativas as ativasMissoes, andamento } from '../missoes';
import { quantoPossoGastarHoje } from '../lib/financas';
import { addMonths, dayAbbr, daysInMonth } from '../coachChat/months';
import { CountUp } from './motion';
import { loadSavedData, openDebts } from '../debts';
import { buildPlan } from '../plan';
import { SAVE_SHARE } from '../bills';
import { monthOf, monthStatus, paidThisMonth, savedThisMonth } from '../bills';
import { abrirAnotar } from '../lib/anotar';
import { Guilloche } from './ui/Guilloche';
import { Medalhao } from './ui/Medalhao';
import { Valor } from './ui/Valor';
import { mesesGuardados, sequencia } from '../lib/sequencia';
import { mensagemDaSemana } from '../lib/mensagemSemana';
import { fraseAgente } from '../lib/mensagensAgente';
import { ehAgente, infoAgente } from '../chat/agentes';
import { statusTexto, proximoLembrete } from '../chat/statusTexto';

/* ---------- Início ---------- */
// Logado: o dia de hoje (o saldo do mês, o próximo passo e os conselheiros). Ainda não: o que é, em 3 linhas, e um botão.

const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);

function QuickActions() {
  return (
    <div className="quick-actions">
      <button type="button" className="qa primary" onClick={() => abrirAnotar({ origem: 'inicio' })}>
        <span className="qa-circle"><Plus size={22} /></span>
        <span>Anotar</span>
      </button>
      <Link className="qa" to="/mes#gastos-fixos">
        <span className="qa-circle"><Receipt size={21} /></span>
        <span>Gastos fixos</span>
      </Link>
      <Link className="qa" to="/conselheiros">
        <span className="qa-circle"><Users size={21} /></span>
        <span>Agentes</span>
      </Link>
    </div>
  );
}

/** A conta do "quanto posso gastar hoje" (src/lib/financas.ts), com o que o card e a mensagem da semana usam. */
function useContaDoMes(painel: PainelData | null) {
  const income = painel ? sum(painel.month.incomes) : 0;
  const expenses = painel?.month.expenses ?? [];
  const bills = useBills();
  const saved = useSaved();
  const eu = useArmazem(lerEu);
  const missoes = useArmazem(lerMissoes);
  const hojeISO = todayBRT();
  const mes = monthOf(hojeISO);
  const andando = ativasMissoes(missoes);
  const gastos = sum(expenses.filter((e) => e.category !== 'Guardado'));
  // a conta da spec: com renda declarada, reserva as contas do mês e o que vai pras missões
  const conta = quantoPossoGastarHoje({
    hoje: hojeISO,
    rendaDeclarada: eu.renda ?? 0,
    entradasAnotadas: income,
    gastosAnotados: gastos,
    guardadoAnotado: sum(expenses.filter((e) => e.category === 'Guardado')),
    contasDoMes: monthStatus(bills, mes, hojeISO).reduce((t, s) => t + Math.max(s.bill.amount, s.paid), 0),
    contasPagas: paidThisMonth(bills, mes),
    guardadoNoApp: savedThisMonth(saved, mes),
    aportesPlanejados: andando.filter((m) => m.tipo === 'reserva' || m.tipo === 'investir').reduce((t, m) => t + m.valorMensal, 0),
    parcelasPlanejadas: andando.filter((m) => m.tipo === 'divida').reduce((t, m) => t + m.valorMensal, 0),
  });
  // quanto do dinheiro de gastar do mês já foi: o que já saiu sobre o que saiu mais o que sobra
  const usado = gastos + Math.max(0, conta.disponivel) > 0 ? gastos / (gastos + Math.max(0, conta.disponivel)) : 0;
  return { conta, income, mes, usado, semDados: conta.modo === 'real' && income === 0 };
}

function MonthCard({ painel, loaded }: { painel: PainelData | null; loaded: boolean }) {
  const { conta, mes, usado, semDados } = useContaDoMes(painel);
  const fim = `${mes}-${String(daysInMonth(mes)).padStart(2, '0')}`;
  if (loaded && conta.estourou)
    return (
      <section className="home-hero cofre estourou" aria-label="Quanto posso gastar hoje">
        <Guilloche />
        <Link to="/mes" className="home-hero-top">
          <span className="sobrelinha">Quanto posso gastar hoje</span>
          <span className="home-hero-more">Ver mês <ChevronRight size={15} /></span>
        </Link>
        <b className="home-hero-number"><Valor valor={0} /></b>
        <span className="home-hero-sub">Você passou {formatBRL(conta.passou)} do limite do mês</span>
        <div className="home-hero-nomasir">
          <Medalhao id="nomasir" nome="Nomasir" tamanho={34} />
          <span>Vamos ver onde dá pra segurar até o dia {daysInMonth(mes)}?</span>
          <Link to="/mes" className="btn-primary">Ver gastos</Link>
        </div>
        <QuickActions />
      </section>
    );
  return (
    <section className="home-hero cofre" aria-label="Quanto posso gastar hoje">
      <Guilloche />
      <Link to="/mes" className="home-hero-top">
        <span className="sobrelinha">Quanto posso gastar hoje</span>
        <span className="home-hero-more">Ver mês <ChevronRight size={15} /></span>
      </Link>
      {!loaded ? (
        <span className="skeleton skeleton-hero" aria-label="Carregando" />
      ) : (
        <b className="home-hero-number">{semDados ? '—' : <CountUp value={conta.porDia} duration={600} format={(n) => formatBRL(n)} render={(n) => <Valor valor={n} />} />}</b>
      )}
      <span className="home-hero-sub">
        {!loaded ? ' ' : semDados ? 'Anote o que entrou e o que saiu pra ver.' : conta.disponivel > 0 ? `Sobram ${formatBRL(conta.disponivel)} até ${dayAbbr(fim)}` : 'O que entrou este mês já foi usado.'}
      </span>
      {loaded && !semDados && (
        <span className="home-hero-barra" role="img" aria-label={`${Math.round(usado * 100)}% do dinheiro de gastar do mês já foi`}>
          <i style={{ width: `${Math.min(100, Math.round(usado * 100))}%` }} />
        </span>
      )}
      <QuickActions />
    </section>
  );
}

/** "N meses guardando", ao lado do "Oi". */
function ChipSequencia() {
  const missoes = useArmazem(lerMissoes);
  const saved = useSaved();
  const n = sequencia(mesesGuardados(missoes, saved), todayBRT());
  if (n < 1) return null;
  return (
    <span className="chip-sequencia" title="Meses seguidos em que você guardou alguma coisa">
      <Flame size={15} aria-hidden="true" /> {n === 1 ? '1 mês guardando' : `${n} meses guardando`}
    </span>
  );
}

/** Mensagem da semana: o agente principal comenta o progresso real (src/lib/mensagemSemana.ts). */
function MensagemSemana({ painel }: { painel: PainelData | null }) {
  const eu = useArmazem(lerEu);
  const missoes = useArmazem(lerMissoes);
  const saved = useSaved();
  const { conta, mes } = useContaDoMes(painel);
  const hoje = todayBRT();
  const andando = ativasMissoes(missoes);
  const principal = eu.agentePrincipal ?? andando[0]?.agente ?? 'arkad';
  const info = infoAgente(principal);
  // guardado no mês: o "guardei" do app (a reserva grava aqui também) e o que foi pro investimento
  const guardadoEm = (m: string) => savedThisMonth(saved, m) + missoes.filter((x) => x.tipo === 'investir' && !x.deletedAt).reduce((t, x) => t + x.registros.filter((r) => r.mes === m).reduce((a, r) => a + r.valor, 0), 0);
  // o agente principal cuida das dívidas: a mensagem fala delas
  const divida = andando.find((m) => m.tipo === 'divida' && m.agente === principal) ?? null;
  const quase = andando.filter((m) => m.tipo !== 'contas' && m.tipo !== 'gastos' && m.metaValor > 0).map((m) => ({ m, a: andamento(m, hoje) })).find((x) => x.a.pct >= 80 && x.a.pct < 100);
  const texto = mensagemDaSemana({
    guardadoMes: guardadoEm(mes),
    guardadoMesPassado: guardadoEm(addMonths(mes, -1)),
    sequencia: sequencia(mesesGuardados(missoes, saved), hoje),
    estourou: conta.estourou,
    passou: conta.passou,
    quaseLa: quase ? { titulo: quase.m.titulo, falta: quase.a.falta } : null,
    cumpridas: missoes.filter((m) => m.status === 'concluida' && !m.deletedAt).length,
    temMissao: andando.length > 0,
    dividas: divida ? { pagoMes: divida.registros.filter((r) => r.mes === mes).reduce((t, r) => t + r.valor, 0), falta: andamento(divida, hoje).falta } : null,
  });
  const dica = useMemo(() => fraseAgente(principal, 'dica'), [principal]);
  return (
    <section className="semana" aria-label="Mensagem da semana">
      <Medalhao id={principal} nome={info.nome} tamanho={44} />
      <div className="semana-balao">
        <small className="sobrelinha">Mensagem da semana</small>
        <p>{texto ?? dica}</p>
        <span>{info.nome}</span>
      </div>
    </section>
  );
}

/* ---------- Seus agentes: quem está de olho nas suas finanças ---------- */
// Cada conselheiro vigia o que a pessoa montou com ele (os passos dele, com data) e avisa no WhatsApp no dia.
// Quem ainda não tem nada ativo aparece apagado, com o convite pra conversar. Os criados pela pessoa entram também.

function loadCustom(): CustomAgent[] {
  try {
    const v = JSON.parse(localStorage.getItem(CUSTOM_AGENTS_KEY) || '[]') as CustomAgent[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

interface Watcher {
  id: string;
  name: string;
  role: string;
  does: string;
  hue: number;
  extra: ToolId[]; // outras telas que ele abre
  tool: ToolId | null; // a tela de cálculo dele (null = criado pela pessoa)
  custom: boolean;
  tasks: CoachTask[]; // os avisos abertos, do mais perto pro mais longe
}

function buildWatchers(tasks: CoachTask[], custom: CustomAgent[], chosen: string[]): Watcher[] {
  const open = tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
  const own = (source: string) => open.filter((t) => t.source === source || (source === 'tracker' && t.source === 'plano'));
  const list: Watcher[] = AGENTS.filter((a) => chosen.includes(a.id) || own(a.tool).length > 0).map((a) => ({ id: a.id, name: a.name, role: a.role, does: a.does, extra: a.extra ?? [], hue: a.hue, tool: a.tool, custom: false, tasks: own(a.tool) }));
  const goals = open.filter((t) => t.source === 'goal');
  custom.forEach((c) => list.push({ id: c.id, name: c.name, role: customPlan(c).lines[0], does: customPlan(c).lines[0], extra: [], hue: 45, tool: null, custom: true, tasks: goals }));
  // quem está vigiando vem primeiro, e dentro deles o aviso mais próximo
  return list.sort((x, y) => (x.tasks.length ? 0 : 1) - (y.tasks.length ? 0 : 1) || (x.tasks[0]?.due ?? '9').localeCompare(y.tasks[0]?.due ?? '9'));
}

function AgentsPanel({ painel, hasDiagnosis, onStart, onOpenTool }: { painel: PainelData | null; hasDiagnosis: boolean; onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  const navigate = useNavigate();
  const tasks = useTasks();
  const today = todayBRT();
  const [mine, setMine] = useState<string[]>(loadChosen);
  useEffect(() => {
    const on = () => setMine(loadChosen());
    window.addEventListener('gs-agentes', on);
    return () => window.removeEventListener('gs-agentes', on);
  }, []);
  const watchers = buildWatchers(tasks, loadCustom(), mine);
  const active = watchers.filter((w) => w.tasks.length > 0).length;
  const [sel, setSel] = useState<string | null>(null);
  const bills = useBills();
  const cats = useMemo(() => {
    const by = new Map<string, number>();
    for (const e of painel?.month.expenses ?? []) by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
    return [...by.entries()].sort((a, b) => b[1] - a[1]);
  }, [painel]);
  const missoes = useArmazem(lerMissoes);
  const fixed = fixedSummary(monthStatus(bills, monthOf(today), today));
  const saved = useSaved();
  const income = useMonthIncome();
  const savedNow = savedThisMonth(saved, monthOf(today));
  const target = Math.round(income * SAVE_SHARE);
  // dívidas e valor mensal do diagnóstico (se a pessoa já fez), pra o Dabasir mostrar a bola de neve
  const saveData = useMemo(() => loadSavedData(), []);
  const debtList = useMemo(() => openDebts(saveData), [saveData]);
  const debtPower = useMemo(() => (saveData && debtList.length > 0 ? buildPlan(saveData).monthlyPower : 0), [saveData, debtList]);
  const smallest = [...debtList].sort((a, b) => a.value - b.value)[0];
  // o que o agente mostra no cartão é o dado que ele controla, não só o que ele faz
  const liveLine = (id: string, fallback: string): string => {
    if (id === 'bansir') return fixed.total === 0 ? 'Cadastre seus gastos fixos' : fixed.left > 0 ? `${fixed.total - fixed.paid} a pagar · faltam ${formatBRL(fixed.left)}` : 'Todos os gastos fixos pagos';
    if (id === 'arkad') return target > 0 ? (savedNow >= target - 1 ? `Guardou ${formatBRL(savedNow)} este mês` : `Falta guardar ${formatBRL(target - savedNow)} (10%)`) : fallback;
    if (id === 'dabasir') return smallest ? `Próxima: ${smallest.description}, ${formatBRL(smallest.value)}` : fallback;
    if (id === 'nomasir') return cats[0] ? `Mais gastou: ${cats[0][0]}, ${formatBRL(cats[0][1])}` : fallback;
    return fallback;
  };
  const [fatura, setFatura] = useState(false);
  useEffect(() => {
    void faturaEnabled().then(setFatura);
  }, []);
  const chosen = watchers.find((w) => w.id === sel) ?? null;
  const meta = (t: CoachTask) => `${fmtDue(t.due, today)}${t.repeat === 'monthly' ? ' · todo mês' : ''}`;
  const go = (t: CoachTask) => (t.source === 'plano' ? navigate('/plano') : onOpenTool(t.source as ToolId));
  return (
    <section className="home-block agents-panel" aria-label="Seus agentes">
      <div className="block-head">
        <h2>Seus agentes ativos</h2>
        <span className="agents-count">{active === 0 ? 'nenhum ainda' : `${active} de olho`}</span>
      </div>
      {watchers.length === 0 && <p className="agents-hint">Adicione um agente. Ele cuida de uma coisa por você e avisa no WhatsApp.</p>}
      <div className="agent-strip live">
        {watchers.map((w) => {
          const on = w.tasks.length > 0;
          const st = !w.custom && ehAgente(w.id) ? statusTexto(w.id, missoes, mine, bills, today, liveLine(w.id, w.does)) : null;
          const estado = st?.estado ?? (on ? 'ativo' : 'disponivel');
          const lembrete = !w.custom && ehAgente(w.id) ? proximoLembrete(w.id, tasks, today) : on ? `Próximo lembrete: ${fmtDue(w.tasks[0].due, today)}` : null;
          const abrir = () => navigate(w.custom || !ehAgente(w.id) ? '/conselheiros' : `/agentes/${w.id}/chat`);
          return (
            <div key={w.id} className={`agent-live ${estado === 'ativo' ? 'on' : 'off'} ${estado} ${sel === w.id ? 'sel' : ''}`} style={{ ['--cor-agente' as string]: `var(--ag-${w.id}, var(--cofre-800))` }}>
              <button type="button" className="agent-live-main" onClick={abrir} aria-label={`Conversar com ${w.name}`}>
                <span className="agent-live-art">
                  <Medalhao id={w.id} nome={w.name} tamanho={60} sepia={estado === 'disponivel'} />
                  {estado === 'ativo' && <i className="live-dot" aria-label="Ativo" />}
                </span>
                <b>{w.name}</b>
                <small className="live-line">{st?.texto ?? liveLine(w.id, w.does)}</small>
              </button>
              <button type="button" className={`live-when ${lembrete ? '' : 'idle'}`} aria-expanded={sel === w.id} onClick={() => setSel(sel === w.id ? null : w.id)}>
                <Bell size={12} /> {lembrete ?? (estado === 'em_espera' ? 'Em espera' : estado === 'disponivel' ? 'Disponível' : 'Sem lembrete')}
              </button>
            </div>
          );
        })}
        <button type="button" className="agent-live create" onClick={() => navigate('/conselheiros')}>
          <span className="agent-live-art"><Plus size={26} /></span>
          <b>Adicionar agente</b>
          <small className="live-line">Escolha os que fazem sentido pra você</small>
        </button>
      </div>

      {chosen && (
        <div className="card agent-detail">
          <div className="agent-detail-head">
            <span>
              <b>{chosen.name}</b>
              <small>{chosen.does}</small>
            </span>
          </div>
          {chosen.id === 'nomasir' && cats.length > 0 && (
            <ul className="cat-list">
              {cats.slice(0, 4).map(([name, value]) => (
                <li key={name}>
                  <span>{name}</span>
                  <b>{formatBRL(value)}</b>
                </li>
              ))}
            </ul>
          )}
          {chosen.id === 'bansir' ? (
            <FixedBills />
          ) : chosen.id === 'arkad' && target > 0 ? (
            <FixedBills savingOnly />
          ) : chosen.id === 'dabasir' && debtList.length > 0 && debtPower > 0 ? (
            <Snowball debts={debtList} power={debtPower} compact />
          ) : chosen.tasks.length > 0 ? (
            <ul className="focus-list">
              {chosen.tasks.map((t) => (
                <li key={t.id}>
                  <button type="button" className="task-check" aria-label={`Marcar como feito: ${t.text}`} onClick={() => markTaskDone(t.id)}>
                    <Check size={15} />
                  </button>
                  <button type="button" className="task-copy" onClick={() => go(t)}>
                    <b>{t.text}</b>
                    <small>{meta(t)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="focus-meta">Ainda não está vigiando nada. Converse com ele e ele monta os seus avisos.</p>
          )}
          <div className="agent-detail-actions">
            <Link className="btn-outline" to={chosen.custom ? '/conselheiros' : `/conselheiros/${chosen.id}`}>
              <MessageCircle size={15} /> {chosen.tasks.length > 0 ? 'Conversar' : `Conversar com ${chosen.name}`}
            </Link>
            {(chosen.tool ? [chosen.tool] : []).filter((id) => id !== 'fatura' || fatura).map((id) => (
              <button key={id} type="button" className="link-btn" onClick={() => onOpenTool(id)}>
                {getTool(id).title}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasDiagnosis && (
        <button type="button" className="dir-row soft" style={{ marginTop: 14 }} onClick={onStart}>
          <span className="tool-icon tone-gold"><ClipboardList size={20} strokeWidth={1.9} /></span>
          <span className="dir-row-copy">
            <b>Quer um plano completo de uma vez?</b>
            <span>10 minutos e você recebe o que fazer, quanto e até quando.</span>
          </span>
          <ArrowRight size={18} className="dir-row-arrow" />
        </button>
      )}
    </section>
  );
}

const FAQ: [string, string][] = [
  ['É de graça?', 'Sim. O plano, os conselheiros e as ferramentas são gratuitos. Você entra com o seu WhatsApp, sem senha.'],
  ['O que eu faço no WhatsApp?', 'Anota o que gastou e o que entrou, do seu jeito (ex.: mercado 80 no pix), por texto, áudio ou foto do cupom.'],
  ['Meus dados ficam onde?', 'Na sua conta, ligada ao seu número. Só você vê. Pra apagar tudo, mande "apagar meus dados" no WhatsApp.'],
  ['É consultoria financeira?', 'Não. É educação financeira, com as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre.'],
];

function Welcome({ resume, onStart, onResume }: { resume: number | null; onStart: () => void; onResume: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <section className="welcome">
        <span className="welcome-tag">Grátis · entra com o WhatsApp</span>
        <h1>Saia das dívidas com um plano que cabe no seu bolso</h1>
        <p>Você anota no WhatsApp, a gente monta o plano e um conselheiro te lembra do próximo passo.</p>
        <div className="welcome-cta">
          {resume !== null ? (
            <button type="button" className="btn-primary" onClick={onResume}>Continuar meu plano (etapa {resume} de 7) <ArrowRight size={16} /></button>
          ) : (
            <button type="button" className="btn-primary" onClick={onStart}>Montar meu plano <ArrowRight size={16} /></button>
          )}
          <Link className="btn-outline" to="/entrar">Já uso, entrar</Link>
        </div>
      </section>

      <section className="home-block how">
        {[
          [MessageCircle, 'Anote no WhatsApp', '"mercado 80 no pix", um áudio ou a foto do cupom.'],
          [ClipboardList, 'Receba o seu plano', 'Quanto pagar, guardar e cortar, com datas.'],
          [Users, 'Siga com um conselheiro', 'Ele monta os passos e te lembra no dia.'],
        ].map(([Icon, title, text], i) => {
          const I = Icon as typeof MessageCircle;
          return (
            <div key={i} className="how-row">
              <span className="how-icon"><I size={20} /></span>
              <span>
                <b>{title as string}</b>
                <small>{text as string}</small>
              </span>
            </div>
          );
        })}
      </section>

      <section className="home-block">
        <div className="block-head"><h2>Dúvidas</h2></div>
        <div className="faq-list">
          {FAQ.map(([q, a], i) => (
            <div key={q} className={`faq-row ${open === i ? 'open' : ''}`}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                {q} <Plus size={18} />
              </button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** Entrada do coach em chat: um recurso extra, que não substitui nenhuma tela. */
function CoachEntry() {
  const { plano } = useCoach();
  const eu = useArmazem(lerEu);
  const feito = Boolean(eu.onboardingConcluido);
  return (
    <div className="coach-entry">
      <Link to="/coach" className="dir-row">
        <span className="tool-icon round"><MessageCircle size={20} strokeWidth={1.9} /></span>
        <span className="dir-row-copy">
          <b>{feito ? 'Refazer meu plano' : 'Montar plano com o coach'}</b>
          <span>{feito ? 'Seu plano atual continua valendo até a conversa nova terminar.' : 'Uma conversa rápida e o seu plano fica pronto.'}</span>
        </span>
        <ArrowRight size={18} className="dir-row-arrow" />
      </Link>
      {plano && <Link className="link-btn" to="/coach/plano">Ver o plano do coach</Link>}
    </div>
  );
}

export function HomePage({
  savedProgress,
  onStart,
  onResume,
  onOpenTool,
}: {
  savedProgress: { step: number } | null;
  onStart: () => void;
  onResume: () => void;
  onOpenTool: (id: ToolId) => void;
}) {
  const logged = Boolean(painelToken());
  const hasDiagnosis = Boolean(savedProgress && savedProgress.step >= 7);
  const resume = savedProgress && savedProgress.step > 0 && savedProgress.step < 7 ? savedProgress.step : null;
  if (!logged) return <Welcome resume={resume} onStart={onStart} onResume={onResume} />;
  return <Inicio resume={resume} hasDiagnosis={hasDiagnosis} onStart={onStart} onResume={onResume} onOpenTool={onOpenTool} />;
}

function Inicio({ resume, hasDiagnosis, onStart, onResume, onOpenTool }: { resume: number | null; hasDiagnosis: boolean; onStart: () => void; onResume: () => void; onOpenTool: (id: ToolId) => void }) {
  const [painel, setPainel] = useState<PainelData | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void fetchPainel()
      .then(setPainel)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);
  const name = primeiroNome(getName());
  return (
    <>
      <PageHead title={name ? `Oi, ${name}` : 'Oi!'} right={<ChipSequencia />} />
      {resume !== null && (
        <button type="button" className="card next-card" onClick={onResume}>
          <span className="card-label">Você parou no meio</span>
          <b>Continuar o meu plano</b>
          <span className="next-go">Continuar (etapa {resume} de 7) <ArrowRight size={16} /></span>
        </button>
      )}
      <div className="home-stack">
        <MonthCard painel={painel} loaded={loaded} />
        <MissaoDeHoje />
        <CoachEntry />
        <MissoesAtivas />
        {resume === null && <AgentsPanel painel={painel} hasDiagnosis={hasDiagnosis} onStart={onStart} onOpenTool={onOpenTool} />}
        <MensagemSemana painel={painel} />
      </div>
    </>
  );
}
