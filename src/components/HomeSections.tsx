import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MessageCircle, Sparkles } from 'lucide-react';
import { LISTED_TOOLS, faturaEnabled, getTool, type ToolId } from '../tools';
import { getResults, type ToolResult } from '../results';
import { QUESTIONS, getAnswers, recommend, saveAnswers, type Answers } from '../profile';
import { track } from '../analytics';
import { fetchPainel, painelToken, type PainelData } from '../painel';
import { formatBRL } from '../calculations';
import { WhatsAppButton } from './ContinueWhatsApp';
import { openWhatsApp } from '../whatsapp';
import { ToolIcon } from './Layout';
import { CountUp } from './motion';

/* ---------- Começo: 3 passos, com o próximo sempre em destaque ---------- */

export function StartSteps({ hasDiagnosis, onDiagnosis }: { hasDiagnosis: boolean; onDiagnosis: () => void }) {
  const [answered, setAnswered] = useState(() => Boolean(getAnswers()));
  const [noted, setNoted] = useState(false);
  useEffect(() => {
    const on = () => setAnswered(Boolean(getAnswers()));
    window.addEventListener('gs-perfil', on);
    if (painelToken()) void fetchPainel().then((d) => setNoted(Boolean(d && d.month.expenses.length + d.month.incomes.length > 0))).catch(() => undefined);
    return () => window.removeEventListener('gs-perfil', on);
  }, []);
  const steps = [
    { done: answered, title: 'Responda 6 perguntas', text: 'Pra gente saber quais ferramentas são pra você. Leva 30 segundos.', action: () => document.getElementById('ferramentas')?.scrollIntoView({ behavior: 'smooth' }), cta: 'Responder' },
    { done: hasDiagnosis, title: 'Faça o diagnóstico', text: 'Sua nota e o seu plano de ação, com valores e datas. Uns 10 minutos.', action: onDiagnosis, cta: 'Fazer agora' },
    { done: noted, title: 'Anote no WhatsApp', text: 'Mande "mercado 80 no pix" e o seu mês aparece aqui.', action: () => void openWhatsApp('inicio').catch(() => undefined), cta: 'Abrir o WhatsApp' },
  ];
  const next = steps.findIndex((st) => !st.done);
  if (next === -1) return null;
  return (
    <div className="start-steps">
      <p className="start-head">
        <b>Comece por aqui</b>
        <span>{steps.filter((st) => st.done).length} de 3 feitos</span>
      </p>
      <ol>
        {steps.map((st, i) => (
          <li key={i} className={st.done ? 'done' : i === next ? 'next' : ''}>
            <span className="start-n">{st.done ? '✓' : i + 1}</span>
            <span className="start-copy">
              <b>{st.title}</b>
              <small>{st.text}</small>
            </span>
            {i === next && (
              <button type="button" className="wallet-cta" onClick={st.action}>
                {st.cta} <ArrowRight size={15} />
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- Topo: o dia a dia no WhatsApp ---------- */
// Logado: o mês de verdade (o que entrou e saiu pelo WhatsApp). Ainda não: como funciona, com uma conversa de exemplo.

const sum = (rows: { amount: number }[]) => rows.reduce((t, r) => t + r.amount, 0);

export function DailyTop() {
  const logged = Boolean(painelToken());
  const [painel, setPainel] = useState<PainelData | null>(null);
  useEffect(() => {
    if (logged) void fetchPainel().then(setPainel).catch(() => undefined);
  }, [logged]);

  if (logged && painel) {
    const income = sum(painel.month.incomes);
    const spent = sum(painel.month.expenses);
    const left = income - spent;
    return (
      <div className="daily wallet">
        <div className="wallet-top">
          <span className="wallet-month">Seu mês, anotado no WhatsApp</span>
        </div>
        <p className={`wallet-balance ${left < 0 ? 'neg' : ''}`}>
          {left < 0 ? '−' : ''}R$ <CountUp value={Math.abs(left)} format={(n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
        </p>
        <div className="wallet-flow">
          <span><small>📥 Entrou</small><b>{formatBRL(income)}</b></span>
          <span><small>📤 Saiu</small><b>{formatBRL(spent)}</b></span>
        </div>
        <div className="wallet-actions">
          <WhatsAppButton label="Anotar no WhatsApp" origin="inicio" className="wallet-cta" />
          <Link className="wallet-out" to="/painel">Ver meu painel <ArrowRight size={13} /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="daily daily-intro">
      <div className="daily-copy">
        <p className="daily-label"><MessageCircle size={15} /> Controle do dia a dia</p>
        <h2>Anote o que entra e o que sai, direto no WhatsApp</h2>
        <p>Mande do seu jeito. O assistente soma, separa por categoria e mostra quanto ainda dá pra gastar no mês. Tudo aparece no seu painel aqui.</p>
        <WhatsAppButton label="Começar no WhatsApp" origin="inicio" className="btn-primary btn-shine" />
      </div>
      <div className="daily-chat" aria-hidden="true">
        <p className="me">mercado 80 no pix</p>
        <p className="bot">✅ R$ 80,00 em 🍽️ Alimentação · Pix{'\n'}Saldo do mês: R$ 1.420{'\n'}🎯 uns R$ 109 por dia</p>
        <p className="me">recebi 3000 salário</p>
        <p className="bot">💰 Entrada anotada: R$ 3.000,00{'\n'}🟢 Saldo do mês: R$ 4.420</p>
      </div>
    </div>
  );
}

/* ---------- Todas as ferramentas, separadas pelo que a pessoa quer fazer ---------- */

const GROUPS: { title: string; text: string; tools: ToolId[] }[] = [
  { title: 'Organizar e planejar', text: 'Seu plano de ação e o acompanhamento dele.', tools: ['tracker', 'goal', 'richdad'] },
  { title: 'Dívidas e banco', text: 'Sair das dívidas pagando menos juros.', tools: ['debts', 'rights', 'loan', 'fatura'] },
  { title: 'Economizar', text: 'Achar dinheiro e gastar com cabeça.', tools: ['leaks', 'extra', 'impulse'] },
];

// de outubro a dezembro o 13º está chegando: a ferramenta dele sobe pro topo
const isThirteenthSeason = () => [9, 10, 11].includes(new Date().getMonth()); // out a dez: a 1ª parcela sai até 30/11


function ToolCard({ id, done, why, onOpen }: { id: ToolId; done?: ToolResult; why?: string; onOpen: () => void }) {
  const t = getTool(id);
  return (
<button type="button" className={`dir-card ${done ? 'done' : ''} ${why ? 'picked' : ''}`} onClick={onOpen}>
                  {why && <span className="dir-why">💡 {why}</span>}
                  <span className="dir-card-head">
                    <ToolIcon tool={t} />
                    <b>{t.title}</b>
                  </span>
                  {done?.card ? (
                    <span className="dir-done">
                      <span className="dir-done-tag"><CheckCircle2 size={13} /> Você já usou</span>
                      <small>{done.card.label}</small>
                      <strong>{done.card.big}</strong>
                      {done.card.rows.slice(0, 2).map(([k, v], i) => (
                        <span className="dir-done-row" key={i}><em>{k}</em><b>{v}</b></span>
                      ))}
                    </span>
                  ) : (
                    <>
                      <span className="dir-serve">{t.guide.serve}</span>
                      <span className="dir-get">
                        {done ? (
                          <><CheckCircle2 size={13} /> {done.summary}</>
                        ) : (
                          <>Você recebe: {t.guide.recebe}</>
                        )}
                      </span>
                    </>
                  )}
                  <span className="dir-open">{done ? 'Abrir de novo' : 'Abrir'} <ArrowRight size={14} /></span>
                </button>
  );
}

/** As perguntas da entrada, uma por vez: é só tocar. */
function Quiz({ onDone }: { onDone: (a: Answers) => void }) {
  const [i, setI] = useState(0);
  const [a, setA] = useState<Partial<Answers>>({});
  const q = QUESTIONS[i];
  const pick = (v: string) => {
    const next = { ...a, [q.id]: v } as Partial<Answers>;
    setA(next);
    if (i + 1 < QUESTIONS.length) setI(i + 1);
    else onDone(next as Answers);
  };
  return (
    <div className="quiz">
      <p className="quiz-step">Pergunta {i + 1} de {QUESTIONS.length}</p>
      <div className="quiz-bar"><i style={{ width: `${(i / QUESTIONS.length) * 100}%` }} /></div>
      <h3>{q.q}</h3>
      <div className="quiz-options">
        {q.options.map(([v, label]) => (
          <button key={v} type="button" onClick={() => pick(v)}>{label}</button>
        ))}
      </div>
      {i > 0 && (
        <button type="button" className="plan-more" onClick={() => setI(i - 1)}>← Voltar</button>
      )}
    </div>
  );
}

export function ToolsDirectory({ onStart, onOpenTool, hasDiagnosis }: { onStart: () => void; onOpenTool: (id: ToolId) => void; hasDiagnosis: boolean }) {
  const [results] = useState(getResults);
  const [fatura, setFatura] = useState(false);
  useEffect(() => {
    void faturaEnabled().then(setFatura);
  }, []);
  const listed = new Set(LISTED_TOOLS.map((t) => t.id));
  const groups = GROUPS.map((g) => ({ ...g, tools: g.tools.filter((id) => listed.has(id) && (id !== 'fatura' || fatura)) }));
  const season = isThirteenthSeason();
  const [answers, setAnswers] = useState<Answers | null>(getAnswers);
  const [showOthers, setShowOthers] = useState(false);
  const picks = answers ? recommend(answers, hasDiagnosis).filter((p) => listed.has(p.tool) && (p.tool !== 'fatura' || fatura)) : [];
  const picked = new Set(picks.map((p) => p.tool));
  const others = groups.map((g) => ({ ...g, tools: g.tools.filter((id) => !picked.has(id)) })).filter((g) => g.tools.length > 0);
  const finish = (a: Answers) => {
    saveAnswers(a);
    setAnswers(a);
    track('perfil_respondido', { ...a });
  };
  const redo = () => {
    saveAnswers(null);
    setAnswers(null);
  };
  return (
    <section className="section tools-dir" id="ferramentas">
      <div className="section-head center">
        <div className="kicker"><span className="wedge" />Ferramentas</div>
        <h2>{answers ? 'Suas ferramentas' : 'Vamos achar as ferramentas certas pra você'}</h2>
        <p>{answers ? 'Escolhidas pelas suas respostas. O que você faz em uma fica salvo e entra no seu plano.' : '6 perguntas rápidas, é só tocar. Depois a gente mostra só o que vai te ajudar.'}</p>
      </div>

      {!answers ? (
        <Quiz onDone={finish} />
      ) : (
        <>
          <div className="dir-grid dir-picks">
            {picks.map((p) => (
              <ToolCard key={p.tool} id={p.tool} done={results[p.tool]} why={p.why} onOpen={() => onOpenTool(p.tool)} />
            ))}
          </div>
          <div className="dir-actions">
            <button type="button" className="btn-outline" aria-expanded={showOthers} onClick={() => setShowOthers((v) => !v)}>
              {showOthers ? 'Esconder as outras' : 'Outras ferramentas, caso precise'}
            </button>
            <button type="button" className="plan-more" onClick={redo}>Refazer as perguntas</button>
          </div>
        </>
      )}

      {hasDiagnosis && (
      <button type="button" className={`dir-diag ${hasDiagnosis ? 'done' : ''}`} onClick={onStart}>
        <span className="tool-icon lg tone-gold"><Sparkles size={24} strokeWidth={1.9} /></span>
        <span className="dir-copy">
          <em className="pick-badge">{hasDiagnosis ? 'Feito · refazer quando quiser' : 'Comece por aqui'}</em>
          <b>Diagnóstico e plano de ação</b>
          <span>Umas perguntas sobre renda, gastos e dívidas. Você recebe sua nota e um plano com valores e datas, que as outras ferramentas usam.</span>
        </span>
        <ArrowRight size={20} className="pick-arrow" />
      </button>
      )}

      {season && (
        <button type="button" className="dir-season" onClick={() => onOpenTool('extra')}>
          🎁 <span><b>O 13º está chegando.</b> Veja onde colocar cada real e quantos meses ele adianta no seu plano.</span>
          <ArrowRight size={18} />
        </button>
      )}

      {answers && showOthers && others.map((g) => (
        <div className="dir-group" key={g.title}>
          <h3>{g.title}{g.text && <small> · {g.text}</small>}</h3>
          <div className="dir-grid">
            {g.tools.map((id) => <ToolCard key={id} id={id} done={results[id]} onOpen={() => onOpenTool(id)} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
