import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { COACHES } from '../coachChat/coaches';
import { coachActions, useCoach } from '../coachChat/store';
import { AgentAvatar } from './AgentPage';
import { AppShell, PageHead } from './AppShell';

/* ---------- /coach: quem vai conversar com você ---------- */

export function CoachPick() {
  const navigate = useNavigate();
  const { coach } = useCoach();
  return (
    <AppShell>
      <PageHead title="Seu coach" sub="Escolha com quem você quer conversar. Você pode trocar quando quiser." />
      <ul className="cp-grid">
        {COACHES.map((c) => {
          const mine = coach === c.id;
          return (
            <li key={c.id} className={`ag-card cp-card ${mine ? 'on' : ''}`}>
              <span className="ag-head"><AgentAvatar id={c.id} name={c.name} hue={c.hue} size={72} /></span>
              <span className="ag-body">
                <b>{c.name}</b>
                <span className="cp-tags"><span>{c.tone}</span><span>Foco: {c.focus}</span></span>
                <small>{c.pitch}</small>
              </span>
              <button
                type="button"
                className={`agent-pick ${mine ? 'on' : ''}`}
                onClick={() => {
                  if (!mine) coachActions.setCoach(c.id);
                  navigate('/coach/chat');
                }}
              >
                {mine ? <><Check size={14} /> Conversar com {c.name}</> : `Escolher ${c.name}`}
              </button>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
