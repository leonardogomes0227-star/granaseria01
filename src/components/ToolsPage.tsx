import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { faturaEnabled, type ToolId } from '../tools';
import { getResults } from '../results';
import { getAnswers, recommend } from '../profile';
import { isThirteenthSeason, ToolCard } from './HomeSections';
import { PageHead } from './AppShell';

/* ---------- Ferramentas: uma lista só, sem grupos ---------- */
// As 6 que resolvem os problemas mais comuns, na ordem do que serve pra pessoa. O acompanhamento e o viver de renda
// ficam no Plano; o "posso comprar?" em Meu mês; o 13º só aparece na época; a fatura, só quando a IA está ligada.

const CORE: ToolId[] = ['bills', 'debts', 'leaks', 'goal', 'rights', 'loan'];

export function ToolsPage({ hasDiagnosis, onOpenTool }: { hasDiagnosis: boolean; onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  const [results] = useState(getResults);
  const [fatura, setFatura] = useState(false);
  useEffect(() => {
    void faturaEnabled().then(setFatura);
  }, []);
  const answers = getAnswers();
  const picks = answers ? recommend(answers, hasDiagnosis).map((p) => p.tool) : [];
  const list: ToolId[] = [...(isThirteenthSeason() ? (['extra'] as ToolId[]) : []), ...CORE, ...(fatura ? (['fatura'] as ToolId[]) : [])];
  const ordered = [...list].sort((a, b) => (picks.indexOf(a) === -1 ? 99 : picks.indexOf(a)) - (picks.indexOf(b) === -1 ? 99 : picks.indexOf(b)));

  return (
    <>
      <PageHead title="Ferramentas" sub="Pra quando você precisa resolver algo específico." />
      <div className="dir-list one">
        {ordered.map((id) => <ToolCard key={id} id={id} done={results[id]} onOpen={() => onOpenTool(id)} />)}
      </div>
      <Link to="/conselheiros" className="dir-row soft" style={{ marginTop: 18 }}>
        <span className="tool-icon tone-gold"><MessageCircle size={20} strokeWidth={1.9} /></span>
        <span className="dir-row-copy">
          <b>Prefere conversar?</b>
          <span>Um conselheiro te ajuda a montar o seu plano.</span>
        </span>
        <ArrowRight size={18} className="dir-row-arrow" />
      </Link>
    </>
  );
}
