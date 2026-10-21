import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { lerEu } from '../eu';
import { infoAgente } from '../chat/agentes';
import type { AgenteId } from '../chat/engine';
import { ONBOARDING } from '../chat/roteiros';
import { AgentArt } from './AgentArt';
import { AppShell, PageHead } from './AppShell';

/* ---------- /coach: escolha do agente principal, antes do chat (spec v2, 6.1) ---------- */

const OPCOES: { id: AgenteId; quero: string }[] = [
  { id: 'arkad', quero: 'Quero começar a guardar' },
  { id: 'dabasir', quero: 'Quero sair das dívidas' },
  { id: 'nomasir', quero: 'Quero parar de perder dinheiro no mês' },
];

export function CoachPick() {
  const navigate = useNavigate();
  const eu = lerEu();
  const refazer = Boolean(eu.onboardingConcluido);
  return (
    <AppShell>
      <PageHead
        title={refazer ? 'Refazer meu plano' : 'Montar meu plano'}
        sub={refazer ? 'Seu plano atual continua valendo até você terminar a conversa nova.' : 'Escolha por onde começar. Você conversa com o agente e ele monta o plano com você.'}
      />
      <ul className="onb-grid">
        {OPCOES.map(({ id, quero }) => {
          const a = infoAgente(id);
          const principal = eu.agentePrincipal === id;
          return (
            <li key={id}>
              <button type="button" className={`onb-card ${principal ? 'on' : ''}`} onClick={() => navigate(`/agentes/${id}/chat?roteiro=${ONBOARDING}`)}>
                <span className="onb-art">
                  <AgentArt id={id} hue={a.hue} />
                </span>
                <span className="onb-copy">
                  <b className="onb-quero">{quero}</b>
                  <span className="onb-quem">
                    {a.nome} · {a.titulo}
                  </span>
                  {principal && <small className="onb-tag">Seu agente principal</small>}
                </span>
                <ChevronRight size={20} className="onb-arrow" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
