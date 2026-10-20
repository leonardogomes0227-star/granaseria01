import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Send } from 'lucide-react';
import { getCoach, type Coach } from '../coachChat/coaches';
import { askOf, check, labelOf, lines, replay, type Answers, type Ask, type HistoryEntry, type Script, type Step } from '../coachChat/engine';
import { PLANO_SCRIPT, toAnswers } from '../coachChat/scripts/plano';
import { checkinScriptId, checkinValue, makeCheckinScript, type CheckinContext } from '../coachChat/scripts/checkin';
import { buildPlan, type Plan } from '../coachChat/plan';
import { checkinMonths, currentMonth, monthName } from '../coachChat/months';
import { coachActions, useCoach } from '../coachChat/store';
import { AgentAvatar } from './AgentPage';
import { PlanItems } from './PlanCard';

/* ---------- O chat do coach: roteiro (sem IA), "digitando…", resposta à direita e input que muda por passo ---------- */

interface Line {
  id: number;
  who: 'coach' | 'me';
  text: string;
}

const TYPING_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let uid = 0;

/** O input fixo embaixo: valor em R$ com máscara, botões ou texto curto. */
function Composer({ ask, error, onSubmit }: { ask: Ask; error: string | null; onSubmit: (v: number | string) => void }) {
  const [digits, setDigits] = useState('');
  const [text, setText] = useState('');
  useEffect(() => {
    setDigits('');
    setText('');
  }, [ask]);
  if (!ask) return null;

  if (ask.kind === 'buttons') {
    return (
      <div className="cc-composer">
        {error && <p className="cc-error" role="alert">{error}</p>}
        <div className="cc-options">
          {ask.options.map((o) => (
            <button key={o.value} type="button" onClick={() => onSubmit(o.value)}>{o.label}</button>
          ))}
        </div>
      </div>
    );
  }

  if (ask.kind === 'money') {
    const cents = digits === '' ? null : parseInt(digits, 10);
    const shown = cents === null ? '' : `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return (
      <form className="cc-composer" onSubmit={(e) => { e.preventDefault(); if (cents !== null) onSubmit(cents / 100); }}>
        {error && <p className="cc-error" role="alert">{error}</p>}
        <div className="cc-row">
          <input
            className="field-input cc-input"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            aria-label="Valor em reais"
            placeholder={ask.placeholder ?? 'R$ 0,00'}
            value={shown}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10))}
          />
          <button type="submit" className="btn-primary cc-send" disabled={cents === null} aria-label="Enviar"><Send size={18} /></button>
        </div>
      </form>
    );
  }

  return (
    <form className="cc-composer" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit(text.trim()); }}>
      {error && <p className="cc-error" role="alert">{error}</p>}
      <div className="cc-row">
        <input className="field-input cc-input" autoFocus aria-label="Sua resposta" placeholder={ask.placeholder ?? 'Escreva aqui'} maxLength={ask.maxLength ?? 60} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn-primary cc-send" disabled={!text.trim()} aria-label="Enviar"><Send size={18} /></button>
      </div>
    </form>
  );
}

export function CoachChat() {
  const [params] = useSearchParams();
  const view = useCoach();
  const coach = getCoach(view.coach);
  const kind = params.get('s'); // 'checkin' | 'plano' | nada (menu, quando já existe plano)
  const mes = params.get('m');
  // o modo fica fixo depois que o servidor responde: salvar o plano não pode trocar a conversa pelo menu
  const mode = useRef<string | null>(null);
  if (mode.current === null && view.status !== 'loading') mode.current = kind ?? (view.plano ? 'menu' : 'plano');
  const lastKind = useRef(kind);
  if (lastKind.current !== kind) {
    lastKind.current = kind;
    mode.current = kind ?? (view.plano ? 'menu' : 'plano');
  }

  if (mode.current === null) return <div className="cc-page"><p className="cc-loading">Carregando…</p></div>;
  if (!coach) return <RedirectTo to="/coach" />;
  if (mode.current === 'checkin') {
    if (!view.plano) return <RedirectTo to="/coach/chat?s=plano" />;
    if (!mes || !checkinMonths(view.plano.criadoEm).includes(mes)) return <RedirectTo to="/inicio" />;
    const ctx: CheckinContext = { mes, plan: view.plano, aportes: view.aportes };
    return <Conversation key={`c-${mes}`} coach={coach} kind="checkin" ctx={ctx} />;
  }
  if (mode.current === 'plano' || !view.plano) return <Conversation key="plano" coach={coach} kind="plano" />;
  return <Menu coach={coach} plan={view.plano} aportes={view.aportes.map((a) => a.mes)} />;
}

function RedirectTo({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => navigate(to, { replace: true }), [navigate, to]);
  return null;
}

function Header({ coach, onBack, canBack, backLabel }: { coach: Coach; onBack?: () => void; canBack?: boolean; backLabel?: string }) {
  return (
    <header className="cc-head">
      <Link to="/inicio" className="cc-close" aria-label="Voltar ao início"><ArrowLeft size={20} /></Link>
      <AgentAvatar id={coach.id} name={coach.name} hue={coach.hue} size={38} />
      <span className="cc-who"><b>{coach.name}</b><small>{coach.tone} · foco em {coach.focus.toLowerCase()}</small></span>
      {onBack && (
        <button type="button" className="cc-undo" onClick={onBack} disabled={!canBack} aria-label={backLabel ?? 'Voltar e corrigir a última resposta'}>
          <RotateCcw size={15} /> Voltar
        </button>
      )}
    </header>
  );
}

/** Quando já existe plano: o coach pergunta o que a pessoa quer fazer. */
function Menu({ coach, plan, aportes }: { coach: Coach; plan: Plan; aportes: string[] }) {
  const navigate = useNavigate();
  const months = checkinMonths(plan.criadoEm);
  const options: { value: string; label: string }[] = [
    ...months.map((m) => ({ value: `checkin:${m}`, label: `${aportes.includes(m) ? 'Corrigir' : 'Fazer'} o check-in de ${monthName(m)}` })),
    { value: 'plano', label: 'Refazer o meu plano' },
  ];
  const hi = coach.id === 'nomasir' ? 'O que vamos resolver?' : 'O que você quer fazer agora?';
  return (
    <div className="cc-page">
      <Header coach={coach} />
      <div className="cc-scroll">
        <div className="cc-msgs">
          <p className="cc-bubble coach">{hi}</p>
        </div>
      </div>
      <Composer
        ask={{ kind: 'buttons', options }}
        error={null}
        onSubmit={(v) => {
          const s = String(v);
          if (s === 'plano') {
            coachActions.saveChat('plano', []);
            navigate('/coach/chat?s=plano');
          } else navigate(`/coach/chat?s=checkin&m=${s.slice(8)}`);
        }}
      />
    </div>
  );
}

function Conversation({ coach, kind, ctx }: { coach: Coach; kind: 'plano' | 'checkin'; ctx?: CheckinContext }) {
  const navigate = useNavigate();
  const view = useCoach();
  const script: Script = useMemo(() => (kind === 'plano' ? PLANO_SCRIPT : makeCheckinScript(ctx as CheckinContext)), [kind, ctx]);
  const storeKey = kind === 'plano' ? 'plano' : checkinScriptId((ctx as CheckinContext).mes);

  const [msgs, setMsgs] = useState<Line[]>([]);
  const [typing, setTyping] = useState(false);
  const [awaiting, setAwaiting] = useState<{ step: Step; answers: Answers } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [finished, setFinished] = useState<Answers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  const push = useCallback((who: Line['who'], text: string) => setMsgs((m) => [...m, { id: ++uid, who, text }]), []);

  /** Grava o resultado quando o roteiro termina. Na retomada (instantânea) só grava o que ainda não existe. */
  const finish = useCallback(
    (answers: Answers, fresh: boolean) => {
      if (kind === 'plano') {
        if (fresh || !view.plano) coachActions.savePlano(buildPlan(toAnswers(answers), currentMonth()), answers);
      } else {
        const c = ctx as CheckinContext;
        if (fresh || !view.aportes.some((a) => a.mes === c.mes)) coachActions.saveAporte(c.mes, checkinValue(c, answers));
      }
      setFinished(answers);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o estado do store é lido só na retomada
    [kind, ctx]
  );

  /** O coach fala o passo (com "digitando…" quando é novo) e abre o input. */
  const play = useCallback(
    async (step: Step, answers: Answers, animate: boolean, fresh = true) => {
      const id = ++run.current;
      setAwaiting(null);
      setFinished(null);
      for (const text of lines(step, answers, coach.id)) {
        if (animate) {
          setTyping(true);
          await sleep(TYPING_MS);
          if (run.current !== id) return;
          setTyping(false);
        }
        push('coach', text);
      }
      if (run.current !== id) return;
      if (askOf(step, answers) === null) finish(answers, fresh);
      else setAwaiting({ step, answers });
    },
    [coach.id, push, finish]
  );

  // abre a conversa: retoma de onde parou (histórico salvo) ou começa do zero
  useEffect(() => {
    const saved = view.chats[storeKey] ?? [];
    const { step, valid } = replay(script, saved);
    const built: Line[] = [];
    for (let i = 0; i < valid.length; i++) {
      const before = replay(script, valid.slice(0, i));
      if (before.step) {
        for (const t of lines(before.step, before.answers, coach.id)) built.push({ id: ++uid, who: 'coach', text: t });
        built.push({ id: ++uid, who: 'me', text: labelOf(before.step, valid[i].value, before.answers) });
      }
    }
    setMsgs(built);
    setHistory(valid);
    if (step) void play(step, replay(script, valid).answers, valid.length === 0, false);
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez ao abrir
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, typing, awaiting, finished]);

  const submit = (value: number | string) => {
    if (!awaiting) return;
    const { step, answers } = awaiting;
    const err = check(step, value, answers);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const nextHistory = [...history, { step: step.id, value }];
    setHistory(nextHistory);
    coachActions.saveChat(storeKey, nextHistory);
    setAwaiting(null);
    push('me', labelOf(step, value, answers));
    const next = replay(script, nextHistory);
    if (next.step) void play(next.step, next.answers, true);
  };

  /** Desfaz a última resposta: o coach volta a fazer aquela pergunta, e a pessoa corrige. */
  const back = () => {
    if (history.length === 0 || typing) return;
    run.current++;
    setTyping(false);
    setError(null);
    const prev = history.slice(0, -1);
    setHistory(prev);
    coachActions.saveChat(storeKey, prev);
    const built: Line[] = [];
    for (let i = 0; i < prev.length; i++) {
      const before = replay(script, prev.slice(0, i));
      if (before.step) {
        for (const t of lines(before.step, before.answers, coach.id)) built.push({ id: ++uid, who: 'coach', text: t });
        built.push({ id: ++uid, who: 'me', text: labelOf(before.step, prev[i].value, before.answers) });
      }
    }
    setMsgs(built);
    const next = replay(script, prev);
    if (next.step) void play(next.step, next.answers, false, false);
  };

  const ask = awaiting ? askOf(awaiting.step, awaiting.answers) : null;
  const plan = kind === 'plano' ? view.plano : null;

  return (
    <div className="cc-page">
      <Header coach={coach} onBack={back} canBack={history.length > 0 && !typing} />
      <div className="cc-scroll">
        <div className="cc-msgs" aria-live="polite">
          {msgs.map((m) => (
            <p key={m.id} className={`cc-bubble ${m.who}`}>{m.text}</p>
          ))}
          {typing && <p className="cc-bubble coach typing" aria-label={`${coach.name} está digitando`}><i /><i /><i /></p>}
          {finished && kind === 'plano' && plan && (
            <div className="cc-card">
              <b>Seu plano</b>
              <PlanItems plan={plan} />
              <button type="button" className="btn-primary" onClick={() => navigate('/inicio')}>Começar</button>
            </div>
          )}
          {finished && kind === 'checkin' && (
            <div className="cc-card slim">
              <button type="button" className="btn-primary" onClick={() => navigate('/inicio')}>Ver meu plano</button>
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>
      {ask && <Composer ask={ask} error={error} onSubmit={submit} />}
    </div>
  );
}
