import { AgentArt } from '../AgentArt';
import { hasAgentArt } from '../AgentArt';

/* ---------- Medalhão do agente (Ouro Antigo, 5): retrato em círculo, anel duplo de ouro, fundo na cor dele ---------- */

export function Medalhao({ id, nome, tamanho = 44, sepia = false, className = '' }: { id: string; nome: string; tamanho?: number; sepia?: boolean; className?: string }) {
  const arte = hasAgentArt(id);
  return (
    <span className={`medalhao ${sepia ? 'sepia' : ''} ${className}`} style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.42), ['--cor-agente' as string]: `var(--ag-${id}, var(--cofre-800))` }} aria-hidden="true">
      <span className="medalhao-retrato">{arte ? <AgentArt id={id} hue={40} variant="avatar" /> : <b>{nome.charAt(0)}</b>}</span>
    </span>
  );
}
