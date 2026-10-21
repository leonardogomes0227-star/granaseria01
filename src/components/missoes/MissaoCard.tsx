import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, MoreHorizontal } from 'lucide-react';
import { andamento, ativas, eSe, lerMissoes, passoFeito, proximoPasso, previsao, valorAtual, type Missao } from '../../missoes';
import { apagarMissao, marcarPasso, pausarMissao } from '../../missoesAcoes';
import { infoAgente } from '../../chat/agentes';
import { brl } from '../../chat/engine';
import { dayAbbr, monthAbbr } from '../../coachChat/months';
import { AgentAvatar } from '../AgentPage';
import { Anel } from '../ui/Anel';
import { Confirmar } from '../ui/Confirmar';
import { apagarComDesfazer } from '../ui/Toast';
import { Registrar, rotuloAcao } from './Registrar';

/* ---------- Cartão de missão (spec v2, 7.3) ---------- */

const quando = (mes: string | null) => (mes ? monthAbbr(mes) : 'sem data ainda');

/** O roteiro que criou a missão ('dabasir:onboarding' → 'onboarding'). */
export const roteiroDa = (m: Missao) => (m.conversa?.includes(':') ? m.conversa.split(':')[1] : null);

export function MissaoCard({ m }: { m: Missao }) {
  const navigate = useNavigate();
  const info = infoAgente(m.agente);
  const a = andamento(m);
  const prox = proximoPasso(m);
  const acao = rotuloAcao(prox, m);
  const [registrando, setRegistrando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [apagar, setApagar] = useState(false);
  const dica = eSe(m);
  const roteiro = roteiroDa(m);
  const atual = valorAtual(m);
  const reserva = ativas(lerMissoes()).find((x) => x.tipo === 'reserva');
  // investir só começa com a reserva completa
  const esperaReserva = m.tipo === 'investir' && reserva && reserva.id !== m.id;
  const concluida = m.status === 'concluida';
  const pausada = m.status === 'pausada';

  return (
    <article className={`ms-card ${concluida ? 'feita' : ''} ${pausada ? 'pausada' : ''}`} id={`missao-${m.id}`}>
      <header className="ms-head">
        <AgentAvatar id={m.agente} name={info.nome} hue={info.hue} size={36} />
        <span className="ms-titulo">
          <small>{info.nome}</small>
          <b>{m.titulo}</b>
        </span>
        <div className="ms-menu-wrap">
          <button type="button" className="cc-icon" aria-label={`Opções da missão ${m.titulo}`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <MoreHorizontal size={20} />
          </button>
          {menu && (
            <div className="cc-menu" role="menu" onMouseLeave={() => setMenu(false)}>
              {roteiro && m.editarPasso && (
                <button type="button" role="menuitem" onClick={() => navigate(`/agentes/${m.agente}/chat?roteiro=${roteiro}&editar=${m.editarPasso}`)}>
                  Editar respostas
                </button>
              )}
              {roteiro && (
                <button type="button" role="menuitem" onClick={() => navigate(`/agentes/${m.agente}/chat?roteiro=${roteiro}&refazer=1`)}>
                  Refazer com {info.nome}
                </button>
              )}
              {!concluida && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    pausarMissao(m.id, !pausada);
                  }}
                >
                  {pausada ? 'Retomar' : 'Pausar'}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenu(false);
                  setApagar(true);
                }}
              >
                Apagar missão
              </button>
            </div>
          )}
        </div>
      </header>

      {esperaReserva ? (
        <p className="ms-espera">Começa quando a reserva completar · {quando(previsao(reserva!))}</p>
      ) : m.metaValor > 0 ? (
        <div className="ms-progresso">
          <Anel pct={a.pct} tamanho={76} espessura={8} tom={concluida ? 'dourado' : a.emDia ? 'verde' : 'ambar'} />
          <div className="ms-numeros">
            <b>
              {brl(atual)} {m.tipo === 'divida' ? 'pagos' : ''} de {brl(m.metaValor)}
            </b>
            {!concluida && <span>Previsão: {quando(a.previsao)}</span>}
            {concluida ? (
              <span className="ms-status ok">Missão cumprida{m.concluidaEm ? ` · ${dayAbbr(m.concluidaEm.slice(0, 10))}` : ''}</span>
            ) : pausada ? (
              <span className="ms-status pausa">Pausada</span>
            ) : a.emDia ? (
              <span className="ms-status ok">Em dia</span>
            ) : (
              <span className="ms-status atras">
                {brl(a.atras)} atrás · nova data {quando(a.previsao)}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {!concluida && !pausada && prox && (
        <div className="ms-proximo">
          <small>Próximo passo</small>
          <b>{prox.titulo}</b>
          {acao && !registrando && (
            <button type="button" className="btn-primary" onClick={() => setRegistrando(true)}>
              {acao}
            </button>
          )}
          {!acao && prox.acao === 'conversar' && (
            <Link className="btn-primary" to={`/agentes/${m.agente}/chat`}>
              Conversar com {info.nome}
            </Link>
          )}
          {!acao && prox.acao !== 'conversar' && !prox.valor && (
            <button type="button" className="btn-outline" onClick={() => marcarPasso(m.id, prox.id, true)}>
              <Check size={15} /> Feito
            </button>
          )}
          {registrando && <Registrar missao={m} onFeito={() => setRegistrando(false)} />}
        </div>
      )}

      <ol className="ms-passos">
        {[...m.passos]
          .sort((x, y) => x.ordem - y.ordem)
          .map((p) => {
            const feito = passoFeito(m, p);
            return (
              <li key={p.id} className={feito ? 'feito' : ''}>
                <span className="ms-check" aria-hidden="true">
                  {feito && <Check size={13} />}
                </span>
                <span>{p.titulo}</span>
              </li>
            );
          })}
      </ol>

      {dica && !esperaReserva && (
        <p className="ms-dica">
          {info.nome}: {m.tipo === 'divida' ? 'Pagando' : 'Guardando'} {brl(dica.extra)} a mais, termina em {monthAbbr(dica.previsao)}.
        </p>
      )}
      {m.notas && <p className="ms-nota">{m.notas}</p>}

      <Confirmar
        aberto={apagar}
        titulo={`Apagar a missão "${m.titulo}"?`}
        texto="Ela sai da sua lista. Você pode desfazer logo em seguida."
        confirmar="Apagar"
        perigo
        onConfirmar={() => {
          setApagar(false);
          const desfazer = apagarMissao(m.id);
          apagarComDesfazer('Missão apagada', desfazer);
        }}
        onCancelar={() => setApagar(false)}
      />
    </article>
  );
}
