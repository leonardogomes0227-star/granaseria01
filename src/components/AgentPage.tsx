import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bell, Send } from 'lucide-react';
import type { WizardData } from '../types';
import { agentPlan, type Agent } from '../agents';
import { faturaEnabled, getTool, type ToolId } from '../tools';
import { setToolTasks } from '../results';
import { painelToken } from '../painel';
import { track } from '../analytics';
import { AgentArt, hasAgentArt } from './AgentArt';

/* ---------- Conversa com um conselheiro ---------- */
// Ele se apresenta, faz 3 perguntas de tocar, monta o plano dele com os números da pessoa e cria os próximos
// passos do coach (com lembrete). Depois dá pra perguntar o que quiser (IA, em /api/conselheiro).

type Msg = { from: 'agent' | 'me'; text: string };

export function AgentAvatar({ id, name, hue, size = 56 }: { id?: string; name: string; hue: number; size?: number }) {
  if (id && hasAgentArt(id))
    return (
      <span className="agent-avatar art" style={{ width: size, height: size }} aria-hidden="true">
        <AgentArt id={id} hue={hue} variant="avatar" />
      </span>
    );
  return (
    <span
      className="agent-avatar"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(150deg, hsl(${hue} 55% 42%), hsl(${(hue + 30) % 360} 45% 22%))` }}
      aria-hidden="true"
    >
      {name.charAt(0)}
    </span>
  );
}

function storageKey(id: string) {
  return `gs-conversa-${id}`;
}

export function AgentPage({ agent, data, onOpenTool }: { agent: Agent; data: WizardData; onOpenTool: (id: ToolId) => void }) {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey(agent.id)) || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  });
  const step = agent.questions.findIndex((q) => !answers[q.key]);
  const done = step === -1;
  const plan = done ? agentPlan(agent, answers, data) : null;
  const [extra, setExtra] = useState<Msg[]>([]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [fatura, setFatura] = useState(false);
  useEffect(() => {
    void faturaEnabled().then(setFatura);
  }, []);
  const others = (agent.extra ?? []).filter((id) => id !== 'fatura' || fatura);
  const endRef = useRef<HTMLDivElement>(null);
  const tool = getTool(agent.tool);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [step, extra.length]);

  // terminou as perguntas: o plano vira próximos passos do coach (o resultado da ferramenta fica intacto)
  useEffect(() => {
    if (!plan) return;
    setToolTasks(agent.tool, plan.tasks);
    track('conselheiro_plano', { conselheiro: agent.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez quando a conversa termina
  }, [done]);

  const answer = (key: string, value: string) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    try {
      localStorage.setItem(storageKey(agent.id), JSON.stringify(next));
    } catch {
      // segue sem salvar
    }
  };
  const restart = () => {
    setAnswers({});
    setExtra([]);
    try {
      localStorage.removeItem(storageKey(agent.id));
    } catch {
      // nada
    }
  };

  const send = async () => {
    const q = ask.trim();
    if (!q || busy) return;
    setAsk('');
    const history = [...extra, { from: 'me' as const, text: q }];
    setExtra(history);
    setBusy(true);
    try {
      const res = await fetch('/api/conselheiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(painelToken() ? { Authorization: `Bearer ${painelToken()}` } : {}) },
        body: JSON.stringify({
          agent: agent.id,
          question: q,
          history: history.slice(-6),
          context: { income: data.monthlyIncome, saving: data.currentSavings, expenses: data.expenses, debts: data.debts.map((d) => ({ name: d.description, value: d.value, installment: d.installment ?? 0 })), reserve: data.emergencyFund, answers, plan: plan?.lines ?? [] },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      setExtra([...history, { from: 'agent', text: body.reply ?? body.error ?? 'Não consegui responder agora. Tenta de novo daqui a pouco.' }]);
    } catch {
      setExtra([...history, { from: 'agent', text: 'Não consegui responder agora. Tenta de novo daqui a pouco.' }]);
    } finally {
      setBusy(false);
    }
  };

  const shown = agent.questions.slice(0, done ? agent.questions.length : step + 1);

  return (
    <div className="page-wrap agent-page anim-in">
      <button type="button" className="btn-ghost agent-back" onClick={() => navigate('/conselheiros')}>
        <ArrowLeft size={16} /> Conselheiros
      </button>
      <header className="agent-head">
        <AgentAvatar id={agent.id} name={agent.name} hue={agent.hue} size={84} />
        <div>
          <h1>{agent.name}</h1>
          <p className="agent-role">{agent.role}</p>
          <p className="agent-story">{agent.story}</p>
        </div>
      </header>

      <div className="chat">
        <p className="bubble agent">{agent.intro}</p>
        {shown.map((q) => (
          <div key={q.key} className="chat-turn">
            <p className="bubble agent">{q.q}</p>
            {answers[q.key] ? (
              <p className="bubble me">{q.options.find(([v]) => v === answers[q.key])?.[1]}</p>
            ) : (
              <div className="chat-options">
                {q.options.map(([v, label]) => (
                  <button key={v} type="button" onClick={() => answer(q.key, v)}>{label}</button>
                ))}
              </div>
            )}
          </div>
        ))}

        {plan && (
          <div className="bubble agent agent-plan">
            <b>Seu plano comigo</b>
            <ol>
              {plan.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
            <p className="agent-plan-tasks"><Bell size={14} /> Criei {plan.tasks.length} {plan.tasks.length === 1 ? 'próximo passo' : 'próximos passos'} com lembrete no WhatsApp.</p>
            <div className="agent-plan-actions">
              <button type="button" className="btn-primary" onClick={() => onOpenTool(agent.tool)}>
                Fazer as contas em {tool.title} <ArrowRight size={15} />
              </button>
              <Link className="btn-outline" to="/">Ver meus próximos passos</Link>
            </div>
            {others.length > 0 && (
              <p className="agent-plan-more">
                Também posso te ajudar com:{' '}
                {others.map((id) => (
                  <button key={id} type="button" className="link-btn" onClick={() => onOpenTool(id)}>{getTool(id).title}</button>
                ))}
              </p>
            )}
          </div>
        )}

        {extra.map((m, i) => (
          <p key={i} className={`bubble ${m.from}`}>{m.text}</p>
        ))}
        {busy && <p className="bubble agent typing">{agent.name} está escrevendo…</p>}
        <div ref={endRef} />
      </div>

      {done && (
        <form className="chat-ask" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input className="field-input" placeholder={`Pergunte qualquer coisa pro ${agent.name}`} value={ask} maxLength={400} onChange={(e) => setAsk(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={!ask.trim() || busy} aria-label="Enviar"><Send size={16} /></button>
        </form>
      )}
      {done && (
        <button type="button" className="plan-more" onClick={restart} style={{ marginTop: 12 }}>Responder de novo</button>
      )}
    </div>
  );
}
