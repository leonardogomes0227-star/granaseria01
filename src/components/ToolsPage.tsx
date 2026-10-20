import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { LISTED_TOOLS, faturaEnabled, type ToolId } from '../tools';
import { getResults } from '../results';
import { getAnswers, recommend, saveAnswers, type Answers } from '../profile';
import { track } from '../analytics';
import { GROUPS, Quiz, ToolCard } from './HomeSections';
import { PageHead } from './AppShell';

/* ---------- Ferramentas: as indicadas pra você em cima, as outras separadas pelo que resolvem ---------- */

export function ToolsPage({ hasDiagnosis, onStart, onOpenTool }: { hasDiagnosis: boolean; onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  const [results] = useState(getResults);
  const [fatura, setFatura] = useState(false);
  useEffect(() => {
    void faturaEnabled().then(setFatura);
  }, []);
  const [answers, setAnswers] = useState<Answers | null>(getAnswers);
  const [quiz, setQuiz] = useState(false);
  const listed = new Set(LISTED_TOOLS.map((t) => t.id).filter((id) => id !== 'fatura' || fatura));
  const picks = answers ? recommend(answers, hasDiagnosis).map((p) => p.tool).filter((id) => listed.has(id)) : [];
  const groups = GROUPS.map((g) => ({ ...g, tools: g.tools.filter((id) => listed.has(id) && !picks.includes(id)) })).filter((g) => g.tools.length > 0);

  return (
    <>
      <PageHead title="Ferramentas" sub="Cada uma resolve uma coisa. O resultado vai pro seu plano." />

      <button type="button" className={`dir-row ${hasDiagnosis ? 'done' : 'feature'}`} onClick={onStart}>
        <span className="tool-icon tone-gold"><Sparkles size={20} strokeWidth={1.9} /></span>
        <span className="dir-row-copy">
          <b>{hasDiagnosis ? 'Refazer meu diagnóstico' : 'Montar meu plano'}</b>
          <span>{hasDiagnosis ? 'Feito. Refaça quando a renda ou as dívidas mudarem.' : 'Comece por aqui: 10 minutos e você tem o plano com datas.'}</span>
        </span>
        <ArrowRight size={18} className="dir-row-arrow" />
      </button>

      {quiz ? (
        <div className="card" style={{ marginTop: 14 }}>
          <Quiz
            onDone={(a) => {
              saveAnswers(a);
              setAnswers(a);
              setQuiz(false);
              track('perfil_respondido', { ...a });
            }}
          />
        </div>
      ) : picks.length > 0 ? (
        <section className="home-block">
          <div className="block-head">
            <h2>Indicadas pra você</h2>
            <button type="button" className="link-btn" onClick={() => setQuiz(true)}>Refazer perguntas</button>
          </div>
          <div className="dir-list one">
            {picks.map((id) => <ToolCard key={id} id={id} done={results[id]} onOpen={() => onOpenTool(id)} />)}
          </div>
        </section>
      ) : (
        <button type="button" className="card quiz-invite" onClick={() => setQuiz(true)}>
          <b>Não sabe qual usar?</b>
          <span>Responda 6 perguntas de tocar e a gente indica as certas.</span>
          <span className="next-go">Responder <ArrowRight size={16} /></span>
        </button>
      )}

      {groups.map((g) => (
        <section className="home-block" key={g.title}>
          <div className="block-head"><h2>{g.title}</h2></div>
          <div className="dir-list one">
            {g.tools.map((id) => <ToolCard key={id} id={id} done={results[id]} onOpen={() => onOpenTool(id)} />)}
          </div>
        </section>
      ))}
    </>
  );
}
