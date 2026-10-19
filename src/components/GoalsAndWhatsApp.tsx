import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { MAIN_GOALS, SITE_GOALS, type SiteGoal } from '../goals';
import { TOOLS, type ToolId } from '../tools';
import { openWhatsApp } from '../whatsapp';
import { track } from '../analytics';
import { ToolIcon } from './Layout';

/* ---------- "O que você quer fazer?": a primeira coisa do site ---------- */
// Seis caminhos claros logo de cara. As outras ferramentas ficam guardadas em "Mais ferramentas", pra não poluir.

export function GoalsSection({ onStart, onOpenTool, first = 'organizar' }: { onStart: () => void; onOpenTool: (id: ToolId) => void; first?: 'organizar' | 'painel' }) {
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const pick = (g: SiteGoal) => {
    track('objetivo_escolhido', { objetivo: g.id });
    if (g.action.kind === 'diag') onStart();
    else if (g.action.kind === 'painel') navigate('/painel');
    else if (g.action.kind === 'tool') onOpenTool(g.action.tool);
    else void openWhatsApp('objetivo').catch(() => undefined);
  };
  // quem já entrou continua do painel; quem chegou agora começa pelo diagnóstico
  const top = SITE_GOALS.slice(0, MAIN_GOALS);
  const main = [...top.filter((g) => g.id === first), ...top.filter((g) => g.id !== first)];
  const rest = SITE_GOALS.slice(MAIN_GOALS);
  // as ferramentas que nenhum objetivo abre (plano mês a mês, fatura, longo prazo…) entram em "Mais ferramentas"
  const covered = new Set(SITE_GOALS.flatMap((g) => (g.action.kind === 'tool' ? [g.action.tool] : [])));
  const others = TOOLS.filter((t) => !covered.has(t.id));

  return (
    <div className="picker" id="ferramentas">
      <div className="picker-grid">
        {main.map((g, i) => {
          const Icon = g.icon;
          return (
            <button
              type="button"
              key={g.id}
              className={`pick-card ${i === 0 ? 'is-first' : ''}`}
              style={{ ['--i' as string]: i }}
              onClick={() => pick(g)}
            >
              <span className={`tool-icon tone-${g.tone}`}><Icon size={22} strokeWidth={1.9} /></span>
              <span className="pick-copy">
                {i === 0 && <em className="pick-badge">{first === 'painel' ? 'Continue daqui' : 'Comece por aqui'}</em>}
                <b>{g.title}</b>
                <span>{g.description}</span>
              </span>
              <ArrowRight size={18} className="pick-arrow" />
            </button>
          );
        })}
      </div>

      <button type="button" className={`picker-more ${more ? 'open' : ''}`} aria-expanded={more} onClick={() => setMore((v) => !v)}>
        {more ? 'Menos ferramentas' : 'Mais ferramentas'} <ChevronDown size={16} />
      </button>
      {more && (
        <div className="picker-rest">
          {rest.map((g) => {
            const Icon = g.icon;
            return (
              <button type="button" key={g.id} className="rest-item" onClick={() => pick(g)}>
                <span className={`tool-icon sm tone-${g.tone}`}><Icon size={16} strokeWidth={1.9} /></span>
                <b>{g.title}</b>
              </button>
            );
          })}
          {others.map((t) => (
            <button type="button" key={t.id} className="rest-item" onClick={() => onOpenTool(t.id)}>
              <ToolIcon tool={t} size="sm" />
              <b>{t.title}</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
