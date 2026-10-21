import { useEffect, useMemo, useState } from 'react';
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
import { Medalhao } from '../ui/Medalhao';
import { poucoMovimento } from '../../lib/celebrar';
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

const corDo = (agente: string) => ({ ['--cor-agente' as string]: `var(--ag-${agente}, var(--cofre-800))` });

/** Verso do cartão: aparece girando quando a pessoa conclui a missão de hoje. */
function Verso({ frase }: { frase: string }) {
  return (
    <div className="hoje-face verso" aria-live="polite">
      <span className="hoje-check" aria-hidden="true">
        <Check size={26} strokeWidth={2.6} />
      </span>
      <b>Feito.</b>
      <p className="hoje-frase">
        <q>{frase}</q>
      </p>
    </div>
  );
}

export function MissaoDeHoje() {
  const missoes = useArmazem(lerMissoes);
  const eu = useArmazem(lerEu);
  const [outro, setOutro] = useState(false);
  // ao concluir, o cartão gira e mostra o "Feito" com o que estava na frente (o próximo passo só entra depois)
  const [virada, setVirada] = useState<{ alvo: { m: Missao; p: PassoMissao }; frase: string } | null>(null);
  const hoje = todaySP();
  const atual = missaoDeHoje(missoes, hoje);
  const alvo = virada?.alvo ?? atual;
  const principal = eu.agentePrincipal ?? 'arkad';
  const fraseKey = alvo ? `${alvo.m.agente}:${alvo.p.id}` : `dica:${principal}`;
  // uma frase por passo (sorteada uma vez, sem repetir a anterior)
  const frase = useMemo(() => (alvo ? fraseAgente(alvo.m.agente, andamento(alvo.m, hoje).emDia ? 'em_dia' : 'atrasado') : fraseAgente(principal, 'dica')), [fraseKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!virada) return;
    const t = window.setTimeout(() => setVirada(null), poucoMovimento() ? 1400 : 1900);
    return () => window.clearTimeout(t);
  }, [virada]);

  if (!alvo) {
    if (missoes.length === 0) return null; // sem plano ainda: o convite pra montar já aparece logo abaixo
    const info = infoAgente(principal);
    return (
      <section className="hoje-card" aria-label="Sua missão de hoje" style={corDo(principal)}>
        <Medalhao id={principal} nome={info.nome} tamanho={48} />
        <span className="hoje-copy">
          <small>Sua missão de hoje</small>
          <b>Tudo em dia por aqui.</b>
          <p className="hoje-frase">
            <q>{frase}</q> <span className="hoje-quem">{info.nome}</span>
          </p>
        </span>
      </section>
    );
  }

  const { m, p } = alvo;
  const info = infoAgente(m.agente);
  const acao = rotuloAcao(p, m);
  const ate = p.acao === 'guardar' || p.acao === 'pagar' ? prazo(hoje, eu.diaSalario) : null;
  const girar = () => setVirada({ alvo, frase: fraseAgente(m.agente, 'passo') });
  return (
    <section className={`hoje-card hoje-flip ${virada ? 'virado' : ''}`} aria-label="Sua missão de hoje" style={corDo(m.agente)}>
      <div className="hoje-inner">
        <div className="hoje-face frente" aria-hidden={virada ? true : undefined}>
          <Medalhao id={m.agente} nome={info.nome} tamanho={48} />
          <span className="hoje-copy">
            <small>Sua missão de hoje</small>
            <b>{p.titulo}</b>
            <span>
              {m.titulo}
              {ate ? ` · até ${ate === hoje ? 'hoje' : dayAbbr(ate)}` : ''}
            </span>
          </span>
          <p className="hoje-frase">
            <q>{frase}</q> <span className="hoje-quem">{info.nome}</span>
          </p>
          <div className="hoje-acao">
            {acao ? (
              outro ? (
                <Registrar
                  missao={m}
                  compacto
                  onFeito={() => {
                    setOutro(false);
                    girar();
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      girar();
                      registrarComAviso(m, m.valorMensal);
                    }}
                    disabled={!(m.valorMensal > 0) || Boolean(virada)}
                  >
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
              <button
                type="button"
                className="btn-primary"
                disabled={Boolean(virada)}
                onClick={() => {
                  girar();
                  marcarPasso(m.id, p.id, true);
                }}
              >
                <Check size={16} /> Feito
              </button>
            )}
          </div>
        </div>
        {virada && <Verso frase={virada.frase} />}
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
