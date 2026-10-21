import { Link } from 'react-router-dom';
import { lerMissoes, type Missao } from '../../missoes';
import { useArmazem } from '../../lib/armazem';
import { lerEu } from '../../eu';
import { infoAgente } from '../../chat/agentes';
import { AgentArt } from '../AgentArt';
import { PageHead } from '../AppShell';
import { MissaoCard } from './MissaoCard';

/* ---------- Suas missões (spec v2, 7.3): o topo da página Plano / Missões ---------- */

export function MissoesSection() {
  const todas = useArmazem(lerMissoes);
  const eu = useArmazem(lerEu);
  const andando = todas.filter((m) => m.status === 'ativa' || m.status === 'pausada').sort((a, b) => a.prioridade - b.prioridade || a.createdAt.localeCompare(b.createdAt));
  const feitas = todas.filter((m) => m.status === 'concluida').sort((a, b) => (b.concluidaEm ?? '').localeCompare(a.concluidaEm ?? ''));
  const nAtivas = todas.filter((m) => m.status === 'ativa').length;
  // o cabeçalho conta exatamente o que está na tela
  const resumo = `${nAtivas} ${nAtivas === 1 ? 'ativa' : 'ativas'} · ${feitas.length} ${feitas.length === 1 ? 'concluída' : 'concluídas'}`;
  const principal = eu.agentePrincipal ?? 'arkad';
  const arkad = infoAgente(principal);

  return (
    <section className="ms-section" aria-label="Suas missões">
      <PageHead title="Suas missões" sub={andando.length + feitas.length > 0 ? resumo : undefined} />
      {andando.length + feitas.length === 0 ? (
        <div className="ms-vazio">
          <span className="ms-vazio-art">
            <AgentArt id={principal} hue={arkad.hue} />
          </span>
          <p>
            <b>{arkad.nome}:</b> Nenhuma missão ainda. Vamos montar a primeira?
          </p>
          <Link className="btn-primary" to="/coach">
            Conversar com {arkad.nome}
          </Link>
        </div>
      ) : (
        <ol className="ms-timeline">
          {andando.map((m: Missao, i) => (
            <li key={m.id} className={`ms-item ${m.status === 'pausada' ? 'futura' : i === 0 ? 'agora' : 'andando'}`}>
              <span className="ms-dot" aria-hidden="true" />
              <MissaoCard m={m} />
            </li>
          ))}
        </ol>
      )}
      {feitas.length > 0 && (
        <details className="ms-feitas">
          <summary>Concluídas ({feitas.length})</summary>
          <ol className="ms-timeline">
            {feitas.map((m) => (
              <li key={m.id} className="ms-item feita">
                <span className="ms-dot" aria-hidden="true" />
                <MissaoCard m={m} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
