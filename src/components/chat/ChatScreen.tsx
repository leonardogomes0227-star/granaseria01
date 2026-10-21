import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { addChosen } from '../../agents';
import { getName } from '../../painel';
import { gravarEu, primeiroNome } from '../../eu';
import { comecarMissoes } from '../../missoesAcoes';
import { conferir, falasDoRoteiro, percorrer, rotuloDe, type Percurso, type Roteiro, type Valor } from '../../chat/engine';
import { lerDados } from '../../chat/dados';
import { ehAgente, infoAgente } from '../../chat/agentes';
import { roteiroPara } from '../../chat/roteiros';
import { apagarConversa, concluirConversa, conversaId, lerConversa, recomecarConversa, restaurarConversa, salvarRespostas } from '../../chat/store';
import { confete, poucoMovimento, vibrar } from '../../lib/celebrar';
import { Confirmar } from '../ui/Confirmar';
import { Medalhao } from '../ui/Medalhao';
import { apagarComDesfazer, toast } from '../ui/Toast';
import { Composer } from './Composer';
import { CabecalhoChat, calculadoraDo } from './CabecalhoChat';
import { ResultadoCard } from './ResultadoCard';
import { chaveDoVoo } from './resultado';
import { useVisualDoApp } from '../../lib/visual';

/* ---------- O chat com um agente (spec v2, seções 5 e 7.5; design 6.5): /agentes/:id/chat ---------- */
// O endereço manda o roteiro e os dados dele: /agentes/arkad/chat?roteiro=checkin&missao=<id>&mes=2026-09.
// ?editar=<passo> abre a resposta daquele passo; ?refazer=1 já pergunta se quer recomeçar.

interface Msg {
  id: string;
  de: 'agente' | 'eu';
  texto: string;
  indice?: number; // posição da resposta (balão da pessoa)
  valor?: Valor; // a resposta (pro chip "voar" até o balão)
  erro?: boolean;
}

const chave = (m: Msg) => `${m.id}|${m.texto}`;
/** "digitando…" de 500 a 900 ms, proporcional ao tamanho do texto. */
const digitacao = (texto: string) => (poucoMovimento() ? 150 : 500 + Math.min(400, texto.length * 5));
/** O que não entra na chave da conversa (só abre a edição ou a pergunta de recomeçar). */
const SO_DA_TELA = ['editar', 'refazer'];
/** Mola dos balões (design 6.5): sobem 8px e aparecem. */
const MOLA = { type: 'spring', stiffness: 520, damping: 36, mass: 0.7 } as const;

/** Todos os balões da conversa, na ordem. */
function montarMensagens(percurso: Percurso, retomou: boolean, erro: { n: number; texto: string } | null): Msg[] {
  const out: Msg[] = [];
  percurso.visitas.forEach((v, vi) => {
    falasDoRoteiro.falas(v.passo, v.ctx).forEach((t, j) => out.push({ id: `${vi}:${v.passo.id}:f${j}`, de: 'agente', texto: t }));
    if (v.valor !== undefined) out.push({ id: `${vi}:${v.passo.id}:r`, de: 'eu', texto: rotuloDe(v.passo, v.valor, v.ctx), indice: v.indice, valor: v.valor });
  });
  if (percurso.atual) {
    if (retomou) out.push({ id: 'retomar', de: 'agente', texto: 'Continuando de onde paramos…' });
    const vi = percurso.visitas.length;
    falasDoRoteiro.falas(percurso.atual, percurso.ctx).forEach((t, j) => out.push({ id: `${vi}:${percurso.atual!.id}:f${j}`, de: 'agente', texto: t }));
  }
  if (erro) out.push({ id: `erro-${erro.n}`, de: 'agente', texto: erro.texto, erro: true });
  return out;
}

export function ChatScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const busca = params.toString();
  // os parâmetros do endereço vão pro roteiro (ex.: missao e mes do check-in)
  const roteiro = useMemo(() => (ehAgente(id) ? roteiroPara(id, params.get('roteiro'), Object.fromEntries(params.entries())) : null), [id, busca]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ehAgente(id)) return <Navigate to="/conselheiros" replace />;
  // agente ainda sem roteiro próprio: a página antiga dele continua
  if (!roteiro) return <Navigate to={`/conselheiros/${id}`} replace />;
  const extras = [...params.entries()].filter(([k]) => !SO_DA_TELA.includes(k) && k !== 'roteiro').map(([k, v]) => `${k}=${v}`).join('&');
  return <Conversa key={`${id}:${roteiro.id}:${extras}`} roteiro={roteiro} editarPasso={params.get('editar')} refazer={params.get('refazer') === '1'} />;
}

function Conversa({ roteiro, editarPasso, refazer }: { roteiro: Roteiro; editarPasso?: string | null; refazer?: boolean }) {
  useVisualDoApp(true);
  const navigate = useNavigate();
  const calmo = poucoMovimento();
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
  // "Refazer com o agente" (menu da missão) já abre a pergunta de recomeçar
  const [perguntaRecomecar, setPerguntaRecomecar] = useState(Boolean(refazer && (salva?.respostas.length ?? 0) > 0));
  const [perguntaApagar, setPerguntaApagar] = useState(false);
  const [saindo, setSaindo] = useState(false);
  // o chip tocado por último (ele "voa" até o balão da resposta)
  const [ultimoVoo, setUltimoVoo] = useState<string | null>(null);

  const mensagens = useMemo(() => montarMensagens(percurso, retomou, erro), [percurso, retomou, erro]);

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

  // balões que entram juntos (ao abrir, ao pular a animação) vêm em sequência, 40 ms um do outro
  const jaEntraram = useRef<Set<string>>(new Set());
  const novos = visiveis.filter((m) => !jaEntraram.current.has(chave(m))).map(chave);
  const atrasoDe = (k: string) => {
    const i = novos.indexOf(k);
    return i < 0 ? 0 : Math.max(0, i - (novos.length - 8)) * 0.04;
  };
  useEffect(() => {
    visiveis.forEach((m) => jaEntraram.current.add(chave(m)));
  });
  const entrada = (k: string) =>
    calmo
      ? { initial: false as const }
      : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { y: { ...MOLA, delay: atrasoDe(k) }, opacity: { duration: 0.2, delay: atrasoDe(k) } } };

  // rolagem suave até o fim, sem puxar quem rolou pra cima pra reler (ao abrir, vai direto)
  const rolagem = useRef<HTMLDivElement>(null);
  const perto = useRef(true);
  const fim = useRef<HTMLDivElement>(null);
  const primeiraRolagem = useRef(true);
  useEffect(() => {
    if (!perto.current) return;
    fim.current?.scrollIntoView({ behavior: calmo || primeiraRolagem.current ? 'auto' : 'smooth', block: 'end' });
    primeiraRolagem.current = false;
  }, [nVisiveis, digitando, editando, calmo]);

  /** Grava as respostas; o que já estava na tela fica, a resposta nova aparece na hora, o que vem depois entra animado. */
  const gravar = useCallback(
    (nova: typeof respostas, ateIndice?: number) => {
      // ao editar, o que vinha depois da resposta editada sai da tela e volta a entrar animado
      const corte = ateIndice === undefined ? visiveis.length : visiveis.findIndex((m) => m.de === 'eu' && m.indice === ateIndice);
      const fica = visiveis.slice(0, corte === -1 ? visiveis.length : corte).filter((m) => !m.erro && m.id !== 'retomar').map(chave);
      // o balão da resposta entra junto com a saída do campo (assim o chip tocado "voa" até ele)
      const depois = montarMensagens(percorrer(roteiro, nova, base), false, null);
      const balao = depois.find((m) => m.de === 'eu' && m.indice === nova.length - 1);
      setRevelados(new Set(balao ? [...fica, chave(balao)] : fica));
      setRetomou(false);
      setRespostas(nova);
      salvarRespostas(agente, roteiro.id, nova);
      setConcluida(false);
      perto.current = true;
    },
    [agente, roteiro, base, visiveis]
  );

  const responder = (valor: Valor, voo?: string) => {
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
    setUltimoVoo(voo ?? null);
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
      // o que mexe no que já existe (registrar numa missão, salvar as contas) vem depois das missões novas
      try {
        c.efeitos?.();
      } catch (e) {
        console.error(e);
        toast('Uma parte não foi salva. Confira em Missões.');
      }
      concluirConversa(convId, c.missoes.map((m) => m.id));
    }
    setConcluida(true);
    setSaindo(true);
    confete('pequeno');
    vibrar();
    window.setTimeout(() => navigate(c?.destino ?? '/'), calmo ? 200 : 1100);
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
  const calculadora = calculadoraDo(agente);
  // a chave do campo: muda a cada passo (ou edição), e o campo velho sai enquanto a resposta entra
  const campo = !tudoNaTela ? null : editVisita ? `e${editando}` : percurso.atual ? `${percurso.visitas.length}:${percurso.atual.id}` : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="cc-page chat">
        <CabecalhoChat
          agente={agente}
          info={info}
          podeRecomecar={respostas.length > 0}
          temMissao={temMissao}
          onVoltar={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          onRecomecar={() => setPerguntaRecomecar(true)}
          onVerMissao={() => navigate('/missoes')}
          onCalculadora={calculadora ? () => navigate(calculadora) : null}
          onApagar={() => setPerguntaApagar(true)}
        />

        <LayoutGroup id="chat">
          <motion.div
            className="cc-scroll"
            layoutScroll
            ref={rolagem}
            onScroll={(e) => {
              const el = e.currentTarget;
              perto.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
            }}
            onClick={pularAnimacao}
          >
            <div className="cc-msgs" aria-live="polite" aria-relevant="additions">
              {visiveis.map((m, i) => {
                const k = chave(m);
                const primeiroDoBloco = m.de === 'agente' && visiveis[i - 1]?.de !== 'agente';
                if (m.de === 'agente')
                  return (
                    <motion.div key={k} layout="position" className={`cc-linha agente ${primeiroDoBloco ? 'inicio' : ''}`} {...entrada(k)}>
                      {primeiroDoBloco ? <Medalhao id={agente} nome={info.nome} tamanho={30} /> : <span className="cc-avatar-vazio" />}
                      <p className={`cc-bubble coach ${m.erro ? 'erro' : ''}`}>{m.texto}</p>
                    </motion.div>
                  );
                const sel = tocada === m.indice;
                const voo = calmo || m.indice === undefined ? undefined : chaveDoVoo(m.indice, m.valor);
                // veio de um chip: o próprio chip vira o balão; digitado: o balão sobe com a mola
                const voou = Boolean(voo && voo === ultimoVoo);
                return (
                  <motion.div key={k} layout="position" className={`cc-linha eu ${editando === m.indice ? 'editando' : ''}`} {...(voou ? { initial: false as const } : entrada(k))}>
                    <motion.button
                      type="button"
                      layoutId={voo}
                      transition={MOLA}
                      className="cc-bubble me"
                      aria-label={`Sua resposta: ${m.texto}. Toque para editar.`}
                      aria-expanded={sel}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (saindo) return;
                        setTocada(sel ? null : m.indice ?? null);
                      }}
                    >
                      {m.texto}
                    </motion.button>
                    {sel && editando === null && (
                      <motion.button
                        type="button"
                        className="cc-editar"
                        initial={calmo ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditando(m.indice ?? null);
                          setErro(null);
                        }}
                      >
                        <Pencil size={14} strokeWidth={1.9} aria-hidden="true" /> Editar
                      </motion.button>
                    )}
                  </motion.div>
                );
              })}
              {digitando && (
                <motion.div key="digitando" layout="position" className="cc-linha agente" {...entrada('digitando')}>
                  {visiveis[visiveis.length - 1]?.de === 'agente' ? <span className="cc-avatar-vazio" /> : <Medalhao id={agente} nome={info.nome} tamanho={30} />}
                  <p className="cc-bubble coach typing" role="status" aria-label={`${info.nome} está digitando`}>
                    <i />
                    <i />
                    <i />
                  </p>
                </motion.div>
              )}

              {tudoNaTela && resultado && editando === null && (
                <ResultadoCard
                  resultado={resultado}
                  concluida={concluida}
                  saindo={saindo}
                  calmo={calmo}
                  onComecar={comecar}
                  onVerMissoes={() => navigate('/missoes')}
                  onRefazer={() => setPerguntaRecomecar(true)}
                  onAjustar={() => {
                    perto.current = false;
                    rolagem.current?.scrollTo({ top: 0, behavior: calmo ? 'auto' : 'smooth' });
                    toast('Toque numa resposta sua para corrigir.');
                  }}
                />
              )}
              <div ref={fim} className="cc-fim" />
            </div>
          </motion.div>

          <AnimatePresence initial={false} mode="popLayout">
            {campo && (
              <motion.div
                key={campo}
                className="cc-base"
                initial={calmo ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: calmo ? 0 : 0.18 } }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                {editVisita ? (
                  <>
                    <div className="cc-editbar">
                      <span>
                        <Pencil size={14} strokeWidth={1.9} aria-hidden="true" /> Editando sua resposta
                      </span>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          setEditando(null);
                          setTocada(null);
                          setErro(null);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                    <Composer passo={editVisita.passo} ctx={editVisita.ctx} inicial={editVisita.valor} onEnviar={responder} />
                  </>
                ) : (
                  percurso.atual && <Composer passo={percurso.atual} ctx={percurso.ctx} voo={calmo ? undefined : `resposta-${percurso.validas.length}`} onEnviar={responder} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>

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
    </MotionConfig>
  );
}
