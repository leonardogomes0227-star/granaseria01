import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { accountsEnabled } from '../supabase';
import { MessageCircle, LogOut, RefreshCw, ArrowRight } from 'lucide-react';
import type { ToolId } from '../tools';
import type { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { buildPlan } from '../plan';
import { leaksMonthlyTotal } from '../leaks';
import { CHECKOUT_READY, isUnlocked } from '../config';
import { ActionPlanView } from './ActionPlanView';
import { SITE_GOALS } from '../goals';
import { clearPainelToken, painelToken, setPainelToken, startPainelSync, type PainelData } from '../painel';
import { waLink } from '../whatsapp';
import { track } from '../analytics';

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
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

function daysLeftInMonth(): number {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.max(1, last - now.getUTCDate() + 1);
}

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
  const plan = useMemo(() => (hasDiag ? buildPlan(data, { extraMonthly: leaksMonthlyTotal() }) : null), [data, hasDiag]);
  const unlocked = isUnlocked() || !CHECKOUT_READY;

  const expenses = painel?.month.expenses ?? [];
  const incomes = painel?.month.incomes ?? [];
  const spent = sum(expenses);
  const income = sum(incomes);
  const left = income - spent;
  const perDay = left > 0 ? Math.floor(left / daysLeftInMonth()) : 0;
  const recent = [...expenses.map((e) => ({ ...e, kind: 'out' as const, what: e.category })), ...incomes.map((i) => ({ ...i, kind: 'in' as const, what: i.source }))]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  const disconnect = () => {
    clearPainelToken();
    setPainel(null);
    setStatus('none');
  };

  return (
    <div className="page-wrap anim-in painel">
      <div className="kicker"><span className="wedge" />Meu painel</div>
      <h1>Seu dinheiro, tudo num lugar</h1>

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
      {status === 'loading' && <p className="field-hint">Carregando seu painel…</p>}
      {status === 'error' && (
        <p className="field-error">
          Não consegui carregar agora. <button type="button" className="plan-more" onClick={() => window.location.reload()}><RefreshCw size={13} /> Tentar de novo</button>
        </p>
      )}

      {status === 'ok' && painel && (
        <>
          <p className="field-hint painel-who">
            Conectado ao WhatsApp <b>{painel.phone}</b> · tudo o que você muda aqui também vai pra lá.{' '}
            <button type="button" className="plan-more" onClick={disconnect}><LogOut size={13} /> Desconectar</button>
          </p>

          <section className="painel-section">
            <p className="diag-label">Este mês</p>
            <div className="diag-grid">
              <div className="stat-card"><p className="diag-label">📥 Entrou</p><p className="diag-number">{brl(income)}</p></div>
              <div className="stat-card"><p className="diag-label">📤 Saiu</p><p className="diag-number">{brl(spent)}</p></div>
              <div className="stat-card">
                <p className="diag-label">⚖️ Saldo</p>
                <p className={`diag-number ${left < 0 ? 'tone-text-bad' : ''}`}>{brl(left)}</p>
              </div>
              <div className="stat-card"><p className="diag-label">🎯 Por dia até o fim do mês</p><p className="diag-number">{income > 0 ? brl(perDay) : '—'}</p></div>
            </div>
            {income === 0 && <p className="field-hint">Anote o que entrou no WhatsApp (ex.: <i>recebi 3000 salário</i>) pra ver o saldo e quanto dá por dia.</p>}
          </section>

          {hasDiag && (
            <section className="painel-section stat-card">
              <p className="diag-label">Quanto ainda dá pra gastar em cada coisa</p>
              {CATS.map((c) => {
                const limit = data.expenses[c.key];
                const used = sum(expenses.filter((e) => e.category === c.name));
                if (!limit) return null;
                const pct = Math.min(100, (used / limit) * 100);
                return (
                  <div className="bar-row" key={c.key}>
                    <span className="bar-label">{c.label}</span>
                    <div className="bar-track"><div className={`bar-fill ${used > limit ? 'over' : ''}`} style={{ width: `${pct}%` }} /></div>
                    <span className="painel-bar-val">{used > limit ? `passou ${brl(used - limit)}` : `faltam ${brl(limit - used)}`}</span>
                  </div>
                );
              })}
              <p className="field-hint" style={{ marginTop: 4 }}>Os limites são o que você contou no diagnóstico.</p>
            </section>
          )}

          <section className="painel-section stat-card">
            <p className="diag-label">Últimos lançamentos</p>
            {recent.length === 0 ? (
              <p className="field-hint">Nada anotado neste mês ainda. Mande no WhatsApp, por exemplo: <i>mercado 80 no pix</i>.</p>
            ) : (
              <ul className="painel-list">
                {recent.map((r, i) => (
                  <li key={i}>
                    <span className="when">{day(r.created_at)}</span>
                    <span className="what">{r.description} <small>{r.what}{r.method ? ` · ${r.method}` : ''}</small></span>
                    <b className={r.kind === 'in' ? 'tone-text-good' : ''}>{r.kind === 'in' ? '+' : '−'}{brl(r.amount)}</b>
                  </li>
                ))}
              </ul>
            )}
            <a className="btn-outline" href={waLink('menu')} style={{ marginTop: 14 }}><MessageCircle size={15} /> Anotar no WhatsApp</a>
          </section>
        </>
      )}

      <section className="painel-section" style={{ marginTop: 28 }}>
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

      <section className="painel-section" style={{ marginTop: 28 }}>
        <p className="diag-label">Ferramentas pra você</p>
        <div className="goals-grid painel-goals">
          {SITE_GOALS.filter((g) => g.action.kind === 'tool').map((g) => {
            const Icon = g.icon;
            return (
              <button type="button" key={g.id} className="goal-card" onClick={() => g.action.kind === 'tool' && onOpenTool(g.action.tool)}>
                <span className={`tool-icon tone-${g.tone}`}><Icon size={20} strokeWidth={1.9} /></span>
                <span className="goal-copy"><b>{g.title}</b><span>{g.description}</span></span>
                <ArrowRight size={16} className="goal-arrow" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
