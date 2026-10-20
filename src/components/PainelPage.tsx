import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { accountsEnabled } from '../supabase';
import { MessageCircle, LogOut, ShoppingCart, RefreshCw, ArrowRight, ArrowDownLeft, Car, GraduationCap, HeartHandshake, HeartPulse, House, PawPrint, PiggyBank, Receipt, Scissors, ShoppingBag, Ticket, Utensils, type LucideIcon } from 'lucide-react';
import type { ToolId } from '../tools';
import type { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { buildPlan } from '../plan';
import { leaksMonthlyTotal } from '../leaks';
import { getGoals } from '../results';
import { CHECKOUT_READY, isUnlocked } from '../config';
import { ActionPlanView } from './ActionPlanView';
import { PageHead } from './AppShell';
import { clearPainelToken, painelToken, setPainelToken, startPainelSync, type PainelData } from '../painel';
import { waLink } from '../whatsapp';
import { track } from '../analytics';
import { fmtDay } from '../dates';
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

const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);
const day = fmtDay;

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


export function PainelPage({ section, data, onStart, onOpenTool }: { section: 'mes' | 'plano'; data: WizardData; onStart: () => void; onOpenTool: (id: ToolId) => void }) {
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
      navigate(window.location.pathname, { replace: true });
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

  if (section === 'plano')
    return (
      <div className="painel">
        <PageHead title="Seu plano" />
        {plan ? (
          <ActionPlanView plan={plan} locked={!unlocked} onOpenTool={onOpenTool} />
        ) : (
          <EmptyCard text="Responda o diagnóstico (uns 10 minutos) e o seu plano aparece aqui, com valores e datas." cta="Fazer meu diagnóstico" onClick={onStart} />
        )}
      </div>
    );

  return (
    <div className="painel">
      <PageHead title="Meu mês" sub={status === 'ok' ? `O que você anotou no WhatsApp em ${clock.month}.` : undefined} />
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
        <div className="skeleton-stack" aria-label="Carregando">
          <span className="skeleton skeleton-card" />
          <span className="skeleton skeleton-row" />
          <span className="skeleton skeleton-row" />
        </div>
      )}
      {status === 'error' && (
        <p className="field-error">
          Não consegui carregar agora. <button type="button" className="plan-more" onClick={() => window.location.reload()}><RefreshCw size={13} /> Tentar de novo</button>
        </p>
      )}

      {status === 'ok' && painel && (
        <>
          <section className="hero-money month-hero" id="mes" aria-label={`Seu mês de ${clock.month}`}>
            <span className="hero-label">{income > 0 ? 'Saldo' : 'Gastos'} de {clock.month}</span>
            {income > 0 ? (
              <b className={`hero-number ${left < 0 ? 'neg' : ''}`}>
                {left < 0 ? '−' : ''}R$ <CountUp value={Math.abs(left)} format={(n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
              </b>
            ) : (
              <b className="hero-number">{brl(spent)}</b>
            )}
            <span className="hero-sub">
              {income === 0
                ? 'Anote o que entrou (ex.: recebi 3000 salário) pra ver o saldo.'
                : left > 0
                  ? `Dá pra gastar uns ${brl(perDay)} por dia`
                  : 'O que entrou este mês já foi usado'}
            </span>
            <span className="month-flow">Entrou {brl(income)} · Saiu {brl(spent)}</span>
            <a className="btn-primary hero-cta" href={waLink('menu')}><MessageCircle size={16} /> Anotar</a>
          </section>

          <button type="button" className="dir-row soft impulse-row" onClick={() => onOpenTool('impulse')}>
            <span className="tool-icon tone-clay"><ShoppingCart size={20} strokeWidth={1.9} /></span>
            <span className="dir-row-copy">
              <b>Posso comprar isso?</b>
              <span>Veja se cabe no mês antes de comprar.</span>
            </span>
            <ArrowRight size={18} className="dir-row-arrow" />
          </button>

          <div className="painel-two">
            <section className="painel-section stat-card painel-where">
              <p className="section-label">{hasDiag ? 'Quanto ainda dá em cada coisa' : 'Para onde foi o dinheiro'}</p>
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
                          {over && <small className="where-note">passou {brl(w.used - w.limit)}</small>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="painel-section stat-card painel-recent">
              <p className="section-label">Últimos lançamentos</p>
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
          <button type="button" className="month-out" onClick={disconnect}><LogOut size={13} /> Sair da conta</button>
        </>
      )}

    </div>
  );
}

function EmptyCard({ text, cta, onClick }: { text: string; cta: string; onClick: () => void }) {
  return (
    <div className="stat-card empty-card">
      <p>{text}</p>
      <button type="button" className="btn-primary" onClick={onClick}>{cta} <ArrowRight size={16} /></button>
    </div>
  );
}
