import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react';
import { addChosen } from '../../agents';
import { getName } from '../../painel';
import { gravarEu, primeiroNome } from '../../eu';
import { comecarMissoes } from '../../missoesAcoes';
import { conferir, falasDoRoteiro, percorrer, rotuloDe, type Roteiro, type Valor } from '../../chat/engine';
import { lerDados } from '../../chat/dados';
import { ehAgente, infoAgente } from '../../chat/agentes';
import { roteiroPara } from '../../chat/roteiros';
import { apagarConversa, concluirConversa, conversaId, lerConversa, recomecarConversa, restaurarConversa, salvarRespostas } from '../../chat/store';
import { confete, poucoMovimento, vibrar } from '../../lib/celebrar';
import { AgentAvatar } from '../AgentPage';
import { Confirmar } from '../ui/Confirmar';
import { apagarComDesfazer, toast } from '../ui/Toast';
import { Composer } from './Composer';

/* ---------- O chat com um agente (spec v2, seções 5 e 7.5): /agentes/:id/chat ---------- */

interface Msg {
  id: string;
  de: 'agente' | 'eu';
  texto: string;
  indice?: number; // posição da resposta (balão da pessoa)
  erro?: boolean;
}

const chave = (m: Msg) => `${m.id}|${m.texto}`;
/** "digitando…" de 500 a 900 ms, proporcional ao tamanho do texto. */
const digitacao = (texto: string) => (poucoMovimento() ? 150 : 500 + Math.min(400, texto.length * 5));

export function ChatScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (!ehAgente(id)) return <Navigate to="/conselheiros" replace />;
  const roteiro = roteiroPara(id, params.get('roteiro'), Object.fromEntries(params.entries()));
  // agente ainda sem roteiro próprio: a página antiga dele continua
  if (!roteiro) return <Navigate to={`/conselheiros/${id}`} replace />;
  return <Conversa key={`${id}:${roteiro.id}`} roteiro={roteiro} editarPasso={params.get('editar')} refazer={params.get('refazer') === '1'} />;
}

function Conversa({ roteiro, editarPasso, refazer }: { roteiro: Roteiro; editarPasso?: string | null; refazer?: boolean }) {
  const navigate = useNavigate();
  const agente = roteiro.agente;
  const info = infoAgente(agente);
  const convId = conversaId(agente, roteiro.id);
  const salva = useMemo(() => lerConversa(convId), [convId]);
  const [respostas, setRespostas] = useState(() => salva?.respostas ?? []);
  const [concluida, setConcluida] = useState(() => salva?.status === 'concluida');
  const [retomou, setRetomou] = useState(() => (salva?.respostas.length ?? 0) > 0 && salva?.status !== 'concluida');
  const base = useMemo(() => ({ agente, nome: primeiroNome(getName()), dados: lerDados() }), [agente]);
  const percurso = useMemo(() => percorrer(roteiro, respostas, base), [roteiro, respostas, base]);
  const [erro, setErro] = useState<{ n: number; texto: string } | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [tocada, setTocada] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  // "Refazer com o agente" (menu da missão) já abre a pergunta de recomeçar
  const [perguntaRecomecar, setPerguntaRecomecar] = useState(Boolean(refazer && (salva?.respostas.length ?? 0) > 0));
  const [perguntaApagar, setPerguntaApagar] = useState(false);
  const [saindo, setSaindo] = useState(false);

  // todos os balões, na ordem
  const mensagens = useMemo<Msg[]>(() => {
    const out: Msg[] = [];
    percurso.visitas.forEach((v, vi) => {
      falasDoRoteiro.falas(v.passo, v.ctx).forEach((t, j) => out.push({ id: `${vi}:${v.passo.id}:f${j}`, de: 'agente', texto: t }));
      if (v.valor !== undefined) out.push({ id: `${vi}:${v.passo.id}:r`, de: 'eu', texto: rotuloDe(v.passo, v.valor, v.ctx), indice: v.indice });
    });
    if (percurso.atual) {
      if (retomou) out.push({ id: 'retomar', de: 'agente', texto: 'Continuando de onde paramos…' });
      const vi = percurso.visitas.length;
      falasDoRoteiro.falas(percurso.atual, percurso.ctx).forEach((t, j) => out.push({ id: `${vi}:${percurso.atual!.id}:f${j}`, de: 'agente', texto: t }));
    }
    if (erro) out.push({ id: `erro-${erro.n}`, de: 'agente', texto: erro.texto, erro: true });
    return out;
  }, [percurso, retomou, erro]);

  // o que já apareceu na tela: o resto entra um por um, com "digitando…"
  const [revelados, setRevelados] = useState<Set<string>>(() => {
    if (salva?.status === 'concluida') return new Set(mensagens.map(chave));
    if (!retomou) return new Set();
    const ate = mensagens.findIndex((m) => m.id === 'retomar');
    return new Set(mensagens.slice(0, ate === -1 ? mensagens.length : ate).map(chave));
  });
  let nVisiveis = 0;
  while (nVisiveis < mensagens.length && revelados.has(chave(mensagens[nVisiveis]))) nVisiveis++;
  const visiveis = mensagens.slice(0, nVisiveis);
  const proxima = mensagens[nVisiveis] ?? null;
  const [digitando, setDigitando] = useState(false);

  useEffect(() => {
    if (!proxima) {
      setDigitando(false);
      return;
    }
    if (proxima.de === 'eu') {
      setRevelados((s) => new Set(s).add(chave(proxima)));
      return;
    }
    setDigitando(true);
    const t = window.setTimeout(() => {
      setDigitando(false);
      setRevelados((s) => new Set(s).add(chave(proxima)));
    }, proxima.erro ? 350 : digitacao(proxima.texto));
    return () => window.clearTimeout(t);
  }, [proxima]);

  const pularAnimacao = () => {
    if (proxima) setRevelados(new Set(mensagens.map(chave)));
  };

  // rolagem suave até o fim, sem puxar quem rolou pra cima pra reler
  const rolagem = useRef<HTMLDivElement>(null);
  const perto = useRef(true);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (perto.current) fim.current?.scrollIntoView({ behavior: poucoMovimento() ? 'auto' : 'smooth', block: 'end' });
  }, [nVisiveis, digitando, editando]);

  /** Grava as respostas; o que já estava na tela fica, o que vem depois entra animado. */
  const gravar = useCallback(
    (nova: typeof respostas, ateIndice?: number) => {
      // ao editar, o que vinha depois da resposta editada sai da tela e volta a entrar animado
      const corte = ateIndice === undefined ? visiveis.length : visiveis.findIndex((m) => m.de === 'eu' && m.indice === ateIndice);
      setRevelados(new Set(visiveis.slice(0, corte === -1 ? visiveis.length : corte).filter((m) => !m.erro && m.id !== 'retomar').map(chave)));
      setRetomou(false);
      setRespostas(nova);
      salvarRespostas(agente, roteiro.id, nova);
      setConcluida(false);
      perto.current = true;
    },
    [agente, roteiro.id, visiveis]
  );

  const responder = (valor: Valor) => {
    if (editando !== null) {
      const v = percurso.visitas.find((x) => x.indice === editando);
      if (!v) return setEditando(null);
      const msg = conferir(v.passo, valor, v.ctx);
      if (msg) return setErro({ n: (erro?.n ?? 0) + 1, texto: msg });
      setErro(null);
      setEditando(null);
      setTocada(null);
      // editar: as respostas depois desta saem (tela e estado) e a conversa continua dali
      gravar([...respostas.slice(0, editando), { passo: v.passo.id, valor }], editando);
      return;
    }
    if (!percurso.atual) return;
    const msg = conferir(percurso.atual, valor, percurso.ctx);
    if (msg) return setErro({ n: (erro?.n ?? 0) + 1, texto: msg });
    setErro(null);
    gravar([...percurso.validas, { passo: percurso.atual.id, valor }]);
  };

  const recomecar = () => {
    setPerguntaRecomecar(false);
    recomecarConversa(convId);
    setRevelados(new Set());
    setRetomou(false);
    setErro(null);
    setEditando(null);
    setTocada(null);
    setConcluida(false);
    setRespostas([]);
  };

  const apagar = () => {
    setPerguntaApagar(false);
    setMenu(false);
    const antes = apagarConversa(convId);
    setRevelados(new Set());
    setRetomou(false);
    setErro(null);
    setEditando(null);
    setRespostas([]);
    setConcluida(false);
    if (antes)
      apagarComDesfazer('Conversa apagada', () => {
        restaurarConversa(antes);
        setRespostas(antes.respostas);
        setConcluida(antes.status === 'concluida');
        setRevelados(new Set());
      });
  };

  const comecar = () => {
    const c = roteiro.concluir?.(percurso.ctx, convId);
    if (c) {
      comecarMissoes(c.missoes);
      for (const a of c.ativar) addChosen(a);
      if (c.eu) gravarEu(c.eu);
      concluirConversa(convId, c.missoes.map((m) => m.id));
    }
    setConcluida(true);
    setSaindo(true);
    confete('pequeno');
    vibrar();
    window.setTimeout(() => navigate(c?.destino ?? '/'), poucoMovimento() ? 200 : 1100);
  };

  // "Editar respostas" (menu da missão): abre direto a resposta daquele passo pra corrigir
  const abriuEdicao = useRef(false);
  useEffect(() => {
    if (abriuEdicao.current || !editarPasso) return;
    abriuEdicao.current = true;
    const v = percurso.visitas.find((x) => x.passo.id === editarPasso && x.indice !== undefined);
    if (v?.indice !== undefined) {
      setTocada(v.indice);
      setEditando(v.indice);
    }
  }, [editarPasso, percurso.visitas]);

  const editVisita = editando !== null ? percurso.visitas.find((v) => v.indice === editando) ?? null : null;
  const tudoNaTela = !proxima && !digitando;
  const resultado = percurso.fim && roteiro.resultado ? roteiro.resultado(percurso.ctx) : null;
  const temMissao = Boolean(lerConversa(convId)?.missoes?.length);

  return (
    <div className="cc-page chat" onClick={() => menu && setMenu(false)}>
      <header className="cc-head">
        <button type="button" className="cc-close" aria-label="Voltar" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          <ArrowLeft size={20} />
        </button>
        <AgentAvatar id={agente} name={info.nome} hue={info.hue} size={38} />
        <span className="cc-who">
          <b>{info.nome}</b>
          <small>{info.titulo}</small>
        </span>
        <button type="button" className="cc-icon" aria-label="Recomeçar a conversa" disabled={respostas.length === 0} onClick={() => setPerguntaRecomecar(true)}>
          <RotateCcw size={18} />
        </button>
        <div className="cc-menu-wrap">
          <button
            type="button"
            className="cc-icon"
            aria-label="Mais opções"
            aria-expanded={menu}
            onClick={(e) => {
              e.stopPropagation();
              setMenu((v) => !v);
            }}
          >
            <MoreHorizontal size={20} />
          </button>
          {menu && (
            <div className="cc-menu" role="menu">
              <button type="button" role="menuitem" disabled={!temMissao} onClick={() => navigate('/missoes')}>
                Ver missão
              </button>
              <button type="button" role="menuitem" className="danger" disabled={respostas.length === 0} onClick={() => setPerguntaApagar(true)}>
                Apagar conversa
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        className="cc-scroll"
        ref={rolagem}
        onScroll={(e) => {
          const el = e.currentTarget;
          perto.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
        }}
        onClick={pularAnimacao}
      >
        <div className="cc-msgs" aria-live="polite" aria-relevant="additions">
          {visiveis.map((m, i) => {
            const primeiroDoBloco = m.de === 'agente' && visiveis[i - 1]?.de !== 'agente';
            if (m.de === 'agente')
              return (
                <div key={m.id} className={`cc-linha agente ${primeiroDoBloco ? 'inicio' : ''}`}>
                  {primeiroDoBloco ? <AgentAvatar id={agente} name={info.nome} hue={info.hue} size={30} /> : <span className="cc-avatar-vazio" />}
                  <p className={`cc-bubble coach ${m.erro ? 'erro' : ''}`}>{m.texto}</p>
                </div>
              );
            const sel = tocada === m.indice;
            return (
              <div key={m.id} className={`cc-linha eu ${editando === m.indice ? 'editando' : ''}`}>
                <button
                  type="button"
                  className="cc-bubble me"
                  aria-label={`Sua resposta: ${m.texto}. Toque para editar.`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (saindo) return;
                    setTocada(sel ? null : m.indice ?? null);
                  }}
                >
                  {m.texto}
                </button>
                {sel && editando === null && (
                  <button
                    type="button"
                    className="cc-editar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditando(m.indice ?? null);
                      setErro(null);
                    }}
                  >
                    <Pencil size={13} /> Editar
                  </button>
                )}
              </div>
            );
          })}
          {digitando && (
            <div className="cc-linha agente">
              {visiveis[visiveis.length - 1]?.de === 'agente' ? <span className="cc-avatar-vazio" /> : <AgentAvatar id={agente} name={info.nome} hue={info.hue} size={30} />}
              <p className="cc-bubble coach typing" aria-label={`${info.nome} está digitando`}>
                <i />
                <i />
                <i />
              </p>
            </div>
          )}

          {tudoNaTela && resultado && editando === null && (
            <div className="cc-resultado">
              <b>{resultado.titulo}</b>
              <ol>
                {resultado.linhas.map((l) => (
                  <li key={l}>{l.replace(/^\d+\.\s*/, '')}</li>
                ))}
              </ol>
              {resultado.agentes.length > 0 && (
                <div className="cc-ativados">
                  <span className="cc-faces">
                    {resultado.agentes.map((a) => (
                      <AgentAvatar key={a} id={a} name={infoAgente(a).nome} hue={infoAgente(a).hue} size={28} />
                    ))}
                  </span>
                  <small>{resultado.agentes.map((a) => infoAgente(a).nome).join(', ')} de olho</small>
                </div>
              )}
              {resultado.rodape && <p className="cc-rodape">{resultado.rodape}</p>}
              <div className="cc-resultado-acoes">
                {concluida ? (
                  <>
                    <button type="button" className="btn-primary" onClick={() => navigate('/missoes')}>
                      Ver minhas missões
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setPerguntaRecomecar(true)}>
                      Refazer
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-primary" disabled={saindo} onClick={comecar}>
                      {resultado.botao ?? 'Começar missão'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        perto.current = false;
                        rolagem.current?.scrollTo({ top: 0, behavior: 'smooth' });
                        toast('Toque numa resposta sua para corrigir.');
                      }}
                    >
                      Ajustar respostas
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <div ref={fim} />
        </div>
      </div>

      {tudoNaTela && editVisita && (
        <div className="cc-editbar">
          <span>Editando sua resposta</span>
          <button type="button" className="link-btn" onClick={() => { setEditando(null); setTocada(null); setErro(null); }}>
            Cancelar
          </button>
        </div>
      )}
      {tudoNaTela && editVisita && <Composer key={`e${editando}`} passo={editVisita.passo} ctx={editVisita.ctx} inicial={editVisita.valor} onEnviar={responder} />}
      {tudoNaTela && !editVisita && percurso.atual && <Composer key={`${percurso.visitas.length}:${percurso.atual.id}`} passo={percurso.atual} ctx={percurso.ctx} onEnviar={responder} />}

      <Confirmar
        aberto={perguntaRecomecar}
        titulo="Recomeçar a conversa?"
        texto={`Suas respostas serão apagadas e o ${info.nome} vai perguntar tudo de novo. Sua missão atual continua valendo até você terminar a nova.`}
        confirmar="Recomeçar"
        onConfirmar={recomecar}
        onCancelar={() => setPerguntaRecomecar(false)}
      />
      <Confirmar
        aberto={perguntaApagar}
        titulo="Apagar esta conversa?"
        texto="As respostas somem. Suas missões continuam como estão."
        confirmar="Apagar"
        perigo
        onConfirmar={apagar}
        onCancelar={() => setPerguntaApagar(false)}
      />
    </div>
  );
}
