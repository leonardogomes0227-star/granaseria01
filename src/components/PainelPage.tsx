import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { accountsEnabled } from '../supabase';
import { MessageCircle, LogOut, RefreshCw, ArrowRight, ArrowDownLeft, Bell, Car, ClipboardList, GraduationCap, HeartHandshake, HeartPulse, House, Landmark, PawPrint, PiggyBank, Receipt, Scissors, ShoppingBag, Ticket, Utensils, Wallet, Wrench, type LucideIcon } from 'lucide-react';
import type { ToolId } from '../tools';
import type { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { buildPlan } from '../plan';
import { leaksMonthlyTotal } from '../leaks';
import { getGoals, getResults, type ToolResult } from '../results';
import { CHECKOUT_READY, isUnlocked } from '../config';
import { ActionPlanView } from './ActionPlanView';
import { LISTED_TOOLS, getTool } from '../tools';
import { todayBRT } from '../coach';
import { ToolIcon } from './Layout';
import { RichDadCard } from './RichDadCard';
import { CoachPanel, useTasks } from './CoachPanel';
import { clearPainelToken, getName, painelToken, setPainelToken, startPainelSync, type PainelData } from '../painel';
import { waLink } from '../whatsapp';
import { track } from '../analytics';
import { CountUp } from './motion';

/* ---------- Meu painel: o app da pessoa, ligado ao WhatsApp ---------- */
// Mostra o mês (o que ela anotou no WhatsApp), quanto ainda dá pra gastar em cada coisa, o plano de ação do
// diagnóstico e as ferramentas. Tudo fica salvo pelo número: o que muda aqui aparece no WhatsApp e vice-versa.

const CATS: { key: keyof WizardData['expenses']; name: string; label: string }[] = [
  { key: 'moradia', name: 'Moradia', label: 'Casa' },
  { key: 'alimentacao', name: 'Alimentação', label: 'Comida' },
  { key: 'transporte', name: 'Transporte', label: 'Transporte' },
  { key: 'lazer', name: 'Lazer', label: 'Lazer' },
];

const brl = (n: number) => formatBRL(n);

type Tab = 'coach' | 'mes' | 'plano' | 'pairico' | 'ferramentas';
const TABS: [Tab, string, LucideIcon][] = [
  ['coach', 'Próximos passos', Bell],
  ['mes', 'Meu mês', Wallet],
  ['plano', 'Meu plano', ClipboardList],
  ['pairico', 'Viver de renda', Landmark],
  ['ferramentas', 'Minhas ferramentas', Wrench],
];

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

/** O cartão de uma ferramenta: o resultado em destaque e o que a pessoa colocou, igual ao do mês. */
function ToolResultCard({ id, result, onOpen }: { id: ToolId; result: ToolResult; onOpen: () => void }) {
  const t = getTool(id);
  const c = result.card;
  return (
    <article className="tool-result">
      <header>
        <ToolIcon tool={t} />
        <span>
          <b>{t.title}</b>
          <small>Atualizado em {dayMonth(result.at)}</small>
        </span>
      </header>
      {c ? (
        <>
          <p className="tool-result-label">{c.label}</p>
          <p className="tool-result-big">{c.big}</p>
          {c.rows.length > 0 && (
            <dl>
              {c.rows.map(([k, v], i) => (
                <div key={i}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      ) : (
        <p className="tool-result-summary">{result.summary}</p>
      )}
      <button type="button" className="btn-outline" onClick={onOpen}>
        Abrir de novo <ArrowRight size={15} />
      </button>
    </article>
  );
}
const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

// mesmos emojis do assistente (server/whatsapp/parse.ts), pra pessoa reconhecer o que anotou lá
const CAT_ICON: Record<string, LucideIcon> = {
  Alimentação: Utensils,
  Transporte: Car,
  Moradia: House,
  Saúde: HeartPulse,
  Lazer: Ticket,
  Compras: ShoppingBag,
  Educação: GraduationCap,
  Pets: PawPrint,
  'Cuidados pessoais': Scissors,
  Doações: HeartHandshake,
  Guardado: PiggyBank,
};
function CatIcon({ category, size = 16 }: { category: string; size?: number }) {
  const Icon = CAT_ICON[category] ?? Receipt;
  return <Icon size={size} />;
}

/** Dia de hoje e último dia do mês, no horário de Brasília. */
function monthClock(): { today: number; last: number; month: string } {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const month = now.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  return { today: now.getUTCDate(), last, month };
}

const lastDigits = (phone: string) => phone.replace(/\D/g, '').slice(-4);

export function PainelPage({ data, onStart, onOpenTool }: { data: WizardData; onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [painel, setPainel] = useState<PainelData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'none' | 'error'>(painelToken() || params.get('t') ? 'loading' : 'none');

  useEffect(() => {
    const t = params.get('t');
    if (t) {
      // o link do WhatsApp: guarda o token e tira da barra de endereço
      setPainelToken(t);
      track('painel_conectado');
      navigate('/painel', { replace: true });
    }
    if (!painelToken()) return setStatus('none');
    startPainelSync()
      .then((d) => {
        setPainel(d);
        setStatus(d ? 'ok' : 'none');
      })
      .catch(() => setStatus('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez ao abrir
  }, []);

  const hasDiag = data.monthlyIncome > 0;
  const plan = useMemo(() => (hasDiag ? buildPlan(data, { extraMonthly: leaksMonthlyTotal(), goals: getGoals() }) : null), [data, hasDiag]);
  const unlocked = isUnlocked() || !CHECKOUT_READY;

  const expenses = painel?.month.expenses ?? [];
  const incomes = painel?.month.incomes ?? [];
  const spent = sum(expenses);
  const income = sum(incomes);
  const left = income - spent;
  const clock = monthClock();
  const perDay = left > 0 ? Math.floor(left / Math.max(1, clock.last - clock.today + 1)) : 0;
  const recent = [...expenses.map((e) => ({ ...e, kind: 'out' as const, what: e.category })), ...incomes.map((i) => ({ ...i, kind: 'in' as const, what: i.source }))]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);
  const name = getName();
  const done = (Object.entries(getResults()) as [ToolId, ToolResult][]).sort((x, y) => y[1].at.localeCompare(x[1].at));
  const coachTasks = useTasks();
  const dueCount = coachTasks.filter((t) => !t.done && t.due <= todayBRT()).length;
  const unused = LISTED_TOOLS.filter((t) => !done.some(([id]) => id === t.id));
  // cada coisa no seu lugar: uma aba por vez (o #mes, #plano… do endereço abre a aba certa)
  const [tab, setTab] = useState<Tab>(() => {
    const h = window.location.hash.slice(1) as Tab;
    return TABS.some(([id]) => id === h) ? h : 'coach';
  });
  const pickTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const show = (t: Tab) => status !== 'ok' || tab === t;

  // para onde foi o dinheiro: o que foi anotado no mês e, com diagnóstico, os limites de cada coisa
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  if (hasDiag) for (const c of CATS) if (data.expenses[c.key] && !byCategory.has(c.name)) byCategory.set(c.name, 0);
  const biggest = Math.max(1, ...byCategory.values());
  const where = [...byCategory.entries()]
    .map(([cat, used]) => {
      const key = CATS.find((c) => c.name === cat)?.key;
      // o limite é o do plano (já com o corte), o mesmo que o WhatsApp usa
      const limit = hasDiag && key ? (plan?.cuts.find((c) => c.key === key)?.ceiling ?? data.expenses[key]) : 0;
      return { cat, used, limit, label: CATS.find((c) => c.name === cat)?.label ?? cat };
    })
    .sort((a, b) => b.used - a.used || b.limit - a.limit);

  const disconnect = () => {
    clearPainelToken();
    setPainel(null);
    setStatus('none');
  };

  return (
    <div className="page-wrap anim-in painel">
      <div className="kicker"><span className="wedge" />Meu painel</div>
      <h1>{name ? `Oi, ${name}!` : 'Seu dinheiro, tudo num lugar'}</h1>
      {status === 'ok' && (
        <>
          <p className="painel-sub">Seu plano, seus gastos e o que entrou. O que você anota no WhatsApp aparece aqui na hora.</p>
          <nav className="painel-tabs" role="tablist" aria-label="Seções do painel">
            {TABS.map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => pickTab(id)}>
                <Icon size={15} /> {label}
                {id === 'ferramentas' && done.length > 0 ? ` (${done.length})` : ''}
                {id === 'coach' && dueCount > 0 ? <span className="tab-badge">{dueCount}</span> : null}
              </button>
            ))}
          </nav>
        </>
      )}

      {status === 'none' && (
        <div className="stat-card painel-connect">
          <p className="diag-label"><MessageCircle size={14} style={{ verticalAlign: '-2px' }} /> Entrar com seu WhatsApp</p>
          <p className="account-line">
            Seu login é o seu WhatsApp: sem senha e sem e-mail. Toque no botão, envie a mensagem que já vem escrita e o assistente te responde com o seu
            link de acesso. Abrindo o link, seu plano, seus gastos e suas entradas ficam salvos aqui e no WhatsApp.
          </p>
          <a className="btn-primary btn-shine" href={waLink('painel')}>
            <MessageCircle size={16} /> Entrar com WhatsApp
          </a>
          {accountsEnabled && (
            <p className="field-hint" style={{ marginTop: 10 }}>
              Prefere e-mail? <Link to="/conta">Entrar com e-mail</Link>
            </p>
          )}
        </div>
      )}
      {status === 'loading' && (
        <div className="wallet wallet-loading" aria-label="Carregando seu painel">
          <span /><span /><span />
        </div>
      )}
      {status === 'error' && (
        <p className="field-error">
          Não consegui carregar agora. <button type="button" className="plan-more" onClick={() => window.location.reload()}><RefreshCw size={13} /> Tentar de novo</button>
        </p>
      )}

      {status === 'ok' && tab === 'coach' && <CoachPanel onOpenTool={onOpenTool} onOpenPlan={() => pickTab('plano')} />}

      {status === 'ok' && painel && tab === 'mes' && (
        <>
          <section className="wallet" id="mes" aria-label={`Seu mês de ${clock.month}`}>
            <div className="wallet-top">
              <span className="wallet-month">{income > 0 ? 'Saldo' : 'Gastos'} de {clock.month}</span>
              <span className="wallet-phone"><MessageCircle size={13} /> WhatsApp final {lastDigits(painel.phone)}</span>
            </div>
            {income > 0 ? (
              <p className={`wallet-balance ${left < 0 ? 'neg' : ''}`}>
                {left < 0 ? '−' : ''}R$ <CountUp value={Math.abs(left)} format={(n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
              </p>
            ) : (
              <p className="wallet-balance">Saiu {brl(spent)}</p>
            )}
            <div className="wallet-flow">
              <span><small>Entrou</small><b>{brl(income)}</b></span>
              <span><small>Saiu</small><b>{brl(spent)}</b></span>
            </div>
            <div className="wallet-clock">
              <div className="wallet-clock-track"><i style={{ width: `${(clock.today / clock.last) * 100}%` }} /></div>
              <small>Dia {clock.today} de {clock.last}</small>
            </div>
            <p className="wallet-perday">
              {income === 0
                ? <>Anote o que entrou no WhatsApp (ex.: <i>recebi 3000 salário</i>) pra ver o saldo e quanto dá por dia.</>
                : left > 0
                  ? <>Dá pra gastar uns <b>{brl(perDay)} por dia</b> até o fim do mês.</>
                  : <>O mês passou do que entrou. Antes da próxima compra, mande <i>posso comprar</i> no WhatsApp.</>}
            </p>
            <div className="wallet-actions">
              <a className="wallet-cta" href={waLink('menu')}><MessageCircle size={16} /> Anotar no WhatsApp</a>
              <button type="button" className="wallet-out" onClick={disconnect}><LogOut size={13} /> Sair</button>
            </div>
          </section>

          <div className="painel-two">
            <section className="painel-section stat-card painel-where">
              <p className="diag-label">{hasDiag ? 'Quanto ainda dá em cada coisa' : 'Para onde foi o dinheiro'}</p>
              {where.length === 0 ? (
                <p className="field-hint">Ainda nada neste mês. Cada gasto que você manda no WhatsApp entra aqui, já separado.</p>
              ) : (
                <ul className="where-list">
                  {where.map((w) => {
                    const over = w.limit > 0 && w.used > w.limit;
                    const pct = w.limit > 0 ? Math.min(100, (w.used / w.limit) * 100) : (w.used / biggest) * 100;
                    return (
                      <li key={w.cat}>
                        <span className="where-icon" aria-hidden="true"><CatIcon category={w.cat} /></span>
                        <span className="where-body">
                          <span className="where-head">
                            <b>{w.label}</b>
                            <span>{brl(w.used)}{w.limit > 0 && <small> de {brl(w.limit)}</small>}</span>
                          </span>
                          <span className="where-track"><i className={over ? 'over' : w.limit > 0 && pct >= 80 ? 'warn' : ''} style={{ width: `${Math.max(pct, w.used > 0 ? 3 : 0)}%` }} /></span>
                          {w.limit > 0 && (
                            <small className={`where-note ${over ? 'tone-text-bad' : ''}`}>
                              {over ? `passou ${brl(w.used - w.limit)}` : w.used === w.limit ? 'bateu o limite do mês' : `faltam ${brl(w.limit - w.used)}`}
                            </small>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hasDiag && <p className="field-hint where-foot">Os limites são os do seu plano de ação (com os cortes).</p>}
            </section>

            <section className="painel-section stat-card painel-recent">
              <p className="diag-label">Últimos lançamentos</p>
              {recent.length === 0 ? (
                <p className="field-hint">Nada anotado neste mês ainda. Mande no WhatsApp, por exemplo: <i>mercado 80 no pix</i>.</p>
              ) : (
                <ul className="painel-list">
                  {recent.map((r, i) => (
                    <li key={i}>
                      <span className={`entry-icon ${r.kind}`} aria-hidden="true">{r.kind === 'in' ? <ArrowDownLeft size={16} /> : <CatIcon category={r.what} />}</span>
                      <span className="what">
                        {r.description}
                        <small>{r.what}{r.method ? ` · ${r.method}` : ''} · {day(r.created_at)}</small>
                      </span>
                      <b className={r.kind === 'in' ? 'tone-text-good' : ''}>{r.kind === 'in' ? '+' : '−'}{brl(r.amount)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {show('pairico') && (
        <section className="painel-section">
          {hasDiag ? (
            <>
              <RichDadCard data={data} />
              <button type="button" className="btn-outline" style={{ marginTop: 14 }} onClick={() => onOpenTool('richdad')}>
                Ver quanto tempo falta <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <div className="stat-card">
              <p className="account-line">Faça o diagnóstico e veja seu placar do Pai Rico, Pai Pobre: quanto tempo você viveria sem trabalhar.</p>
              <button type="button" className="btn-primary" onClick={onStart}>Fazer meu diagnóstico <ArrowRight size={16} /></button>
            </div>
          )}
        </section>
      )}

      {show('plano') && (
      <section className="painel-section painel-anchor" id="plano" style={{ marginTop: 28 }}>
        <p className="diag-label">Seu plano de ação</p>
        {plan ? (
          <>
            <h3 className="plan-heading">O que fazer, quanto e até quando</h3>
            <ActionPlanView plan={plan} locked={!unlocked} onOpenTool={onOpenTool} />
          </>
        ) : (
          <div className="stat-card">
            <p className="account-line">Faça o diagnóstico (uns 10 minutos) e seu plano de ação aparece aqui, salvo junto com o seu WhatsApp.</p>
            <button type="button" className="btn-primary" onClick={onStart}>Fazer meu diagnóstico <ArrowRight size={16} /></button>
          </div>
        )}
      </section>
      )}

      {show('ferramentas') && (
      <section className="painel-section painel-anchor" id="ferramentas" style={{ marginTop: 28 }}>
        <p className="diag-label">Minhas ferramentas</p>
        {done.length === 0 ? (
          <p className="field-hint">Ainda nada. Cada ferramenta que você usar ganha um cartão aqui, com o que você colocou e o resultado.</p>
        ) : (
          <div className="tool-results">
            {done.map(([id, r]) => (
              <ToolResultCard key={id} id={id} result={r} onOpen={() => onOpenTool(id)} />
            ))}
          </div>
        )}
        {unused.length > 0 && (
          <>
            <p className="diag-label" style={{ marginTop: 22 }}>Ainda não usou</p>
            <div className="unused-tools">
              {unused.map((t) => (
                <button key={t.id} type="button" onClick={() => onOpenTool(t.id)}>
                  <ToolIcon tool={t} size="sm" /> {t.title}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
      )}
    </div>
  );
}
