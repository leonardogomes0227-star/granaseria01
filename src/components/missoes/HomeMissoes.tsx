import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { andamento, ativas, lerMissoes, passoFeito, type Missao, type PassoMissao } from '../../missoes';
import { marcarPasso } from '../../missoesAcoes';
import { useArmazem } from '../../lib/armazem';
import { lerEu } from '../../eu';
import { infoAgente } from '../../chat/agentes';
import { brl } from '../../chat/engine';
import { dayAbbr, daysInMonth, monthAbbr, todaySP } from '../../coachChat/months';
import { fraseAgente } from '../../lib/mensagensAgente';
import { AgentAvatar } from '../AgentPage';
import { Anel } from '../ui/Anel';
import { Registrar, registrarComAviso, rotuloAcao } from './Registrar';

/* ---------- Início: "Sua missão de hoje" e "Missões ativas" (spec v2, 7.1) ---------- */

/** Até quando: dia do salário deste mês (se ainda vem) ou o último dia do mês. */
function prazo(hoje: string, diaSalario?: number): string {
  const mes = hoje.slice(0, 7);
  const ultimo = daysInMonth(mes);
  if (diaSalario && Math.min(diaSalario, ultimo) >= Number(hoje.slice(8, 10))) return `${mes}-${String(Math.min(diaSalario, ultimo)).padStart(2, '0')}`;
  return `${mes}-${String(ultimo).padStart(2, '0')}`;
}

/** O passo pendente mais importante: prioridade da missão e, empatando, o que vence antes. */
export function missaoDeHoje(missoes: Missao[], hoje = todaySP()): { m: Missao; p: PassoMissao } | null {
  // marcos (metade, meta) se completam sozinhos: a missão de hoje é sempre uma ação
  const acionavel = (m: Missao) => [...m.passos].sort((a, b) => a.ordem - b.ordem).find((p) => !passoFeito(m, p, hoje) && (p.acao || !p.valor)) ?? null;
  const c = ativas(missoes)
    .map((m) => ({ m, p: acionavel(m) }))
    .filter((x): x is { m: Missao; p: PassoMissao } => Boolean(x.p));
  c.sort((a, b) => a.m.prioridade - b.m.prioridade || String(a.p.dataAlvo ?? '9').localeCompare(String(b.p.dataAlvo ?? '9')));
  return c[0] ?? null;
}

export function MissaoDeHoje() {
  const missoes = useArmazem(lerMissoes);
  const eu = useArmazem(lerEu);
  const [outro, setOutro] = useState(false);
  const hoje = todaySP();
  const alvo = missaoDeHoje(missoes, hoje);

  if (!alvo) {
    if (missoes.length === 0) return null; // sem plano ainda: o convite pra montar já aparece logo abaixo
    const principal = eu.agentePrincipal ?? 'arkad';
    const info = infoAgente(principal);
    return (
      <section className="hoje-card" aria-label="Sua missão de hoje">
        <AgentAvatar id={principal} name={info.nome} hue={info.hue} size={44} />
        <span className="hoje-copy">
          <small>Sua missão de hoje</small>
          <b>Tudo em dia por aqui.</b>
          <span>
            {info.nome}: {fraseAgente(principal, 'dica')}
          </span>
        </span>
      </section>
    );
  }

  const { m, p } = alvo;
  const info = infoAgente(m.agente);
  const acao = rotuloAcao(p, m);
  const ate = p.acao === 'guardar' || p.acao === 'pagar' ? prazo(hoje, eu.diaSalario) : null;
  return (
    <section className="hoje-card" aria-label="Sua missão de hoje">
      <AgentAvatar id={m.agente} name={info.nome} hue={info.hue} size={44} />
      <span className="hoje-copy">
        <small>Sua missão de hoje</small>
        <b>{p.titulo}</b>
        <span>
          {m.titulo}
          {ate ? ` · até ${ate === hoje ? 'hoje' : dayAbbr(ate)}` : ''}
        </span>
      </span>
      <div className="hoje-acao">
        {acao ? (
          outro ? (
            <Registrar missao={m} compacto onFeito={() => setOutro(false)} />
          ) : (
            <>
              <button type="button" className="btn-primary" onClick={() => registrarComAviso(m, m.valorMensal)} disabled={!(m.valorMensal > 0)}>
                <Check size={16} /> {p.acao === 'guardar' ? 'Guardei' : 'Paguei'} {m.valorMensal > 0 ? brl(m.valorMensal) : ''}
              </button>
              <button type="button" className="link-btn" onClick={() => setOutro(true)}>
                Outro valor
              </button>
            </>
          )
        ) : p.acao === 'conversar' ? (
          <Link className="btn-primary" to={`/agentes/${m.agente}/chat`}>
            Conversar com {info.nome}
          </Link>
        ) : (
          <button type="button" className="btn-primary" onClick={() => marcarPasso(m.id, p.id, true)}>
            <Check size={16} /> Feito
          </button>
        )}
      </div>
    </section>
  );
}

export function MissoesAtivas() {
  const missoes = useArmazem(lerMissoes);
  const lista = ativas(missoes);
  if (lista.length === 0) return null;
  return (
    <section className="home-block" aria-label="Missões ativas">
      <div className="block-head">
        <h2>Missões ativas</h2>
        <Link to="/missoes">
          Ver todas <ChevronRight size={14} />
        </Link>
      </div>
      <div className="ms-strip">
        {lista.map((m) => {
          const a = andamento(m);
          return (
            <Link key={m.id} to={`/missoes#missao-${m.id}`} className="ms-mini">
              <Anel pct={a.pct} tamanho={52} espessura={6} tom={a.emDia ? 'verde' : 'ambar'} />
              <span>
                <b>{m.titulo}</b>
                <small>
                  {a.falta > 0 ? `faltam ${brl(a.falta)}` : 'quase lá'}
                  {a.previsao ? ` · ${monthAbbr(a.previsao)}` : ''}
                </small>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
