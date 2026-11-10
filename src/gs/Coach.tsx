import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Send, Trash2 } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { nomeMes } from './datas';
import { recomendacoes, type Recomendacao } from './coachRegras';
import { anotarAtraso, colocarNoCaminho, concluirPasso, criarMeta, definirLimite, desligarAviso, editarPasso, escolherMetodoQuitacao, esperar72h, removerPasso } from './acoes';
import { abrirAdicionar } from './AdicionarMov';
import { FLUXOS, fluxoDaRota, rodarFluxo, type AcaoCoach, type Entrada, type Fluxo, type FluxoId } from './coachFluxos';
import type { Impacto } from './caminho';
import { painelToken } from '../painel';
import { supabase } from '../supabase';
import { Campo, CampoDinheiro, CampoNumero, Folha } from './ui';
import { Eyebrow, Moeda } from './base';
import { toast } from '../components/ui/Toast';

/* ---------- Coach: resolve um problema por vez, com os números da pessoa, e termina num passo no caminho ---------- */
// Os 9 assuntos prontos funcionam por regras (coachFluxos.ts), sem IA. A conversa livre usa a IA quando está ativada
// no servidor; ela calcula pelas mesmas funções (server/coachTools.ts). Sem a chave, a tela diz isso: nada é simulado.

const AVISOS: [string, string, string][] = [
  ['vencimento', 'Contas e faturas perto de vencer', 'Vencimentos e atrasos.'],
  ['orcamento', 'Orçamento e gastos acima do padrão', 'Gastos que sobem ou passam do limite.'],
  ['coach', 'Sugestões do coach', 'Ideias para guardar e metas.'],
];

async function token(): Promise<string | null> {
  const t = painelToken();
  if (t) return t;
  try {
    return (await supabase?.auth.getSession())?.data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

interface Msg {
  de: 'eu' | 'coach';
  texto: string;
  acoes?: AcaoCoach[];
  impacto?: Impacto | null;
  copiar?: { rotulo: string; texto: string };
  resolvidas?: number[]; // índices das ações já decididas (feitas ou dispensadas)
}
interface Conversa { id: string; quando: string; msgs: Msg[] }
// Histórico só neste aparelho (localStorage): nada vai para o servidor além da pergunta enviada.
const CHAVE = 'gs-coach-conversas';
const CHAVE_ANTIGA = 'gs-coach-conversa';
function lerConversas(): Conversa[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Conversa[] | null;
    if (Array.isArray(v)) return v.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.msgs)).slice(-8);
    const antiga = JSON.parse(localStorage.getItem(CHAVE_ANTIGA) ?? '[]') as Msg[];
    return Array.isArray(antiga) && antiga.length ? [{ id: 'antiga', quando: new Date().toISOString(), msgs: antiga.filter((m) => typeof m?.texto === 'string').slice(-40) }] : [];
  } catch { return []; }
}
const guardarConversas = (cs: Conversa[]) => { try { localStorage.setItem(CHAVE, JSON.stringify(cs.slice(-8))); } catch { /* sem armazenamento */ } };

export function Coach() {
  const e = useEstado();
  const hoje = useHoje();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const recs = useMemo(() => recomendacoes(e, hoje), [e, hoje]);
  const desligados = new Set(e.config.avisosDesligados ?? []);
  const [conversas, setConversasRaw] = useState<Conversa[]>(lerConversas);
  const [atualId, setAtualId] = useState<string>(() => `c-${Date.now()}`);
  const [form, setForm] = useState<Fluxo | null>(null);
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [anteriores, setAnteriores] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const msgs = conversas.find((c) => c.id === atualId)?.msgs ?? [];
  const setMsgs = (m: Msg[]) => setConversasRaw((cs) => {
    const sem = cs.filter((c) => c.id !== atualId);
    const prox = m.length ? [...sem, { id: atualId, quando: cs.find((c) => c.id === atualId)?.quando ?? new Date().toISOString(), msgs: m.slice(-40) }] : sem;
    guardarConversas(prox);
    return prox;
  });
  const de = params.get('de') ?? '';
  const sugerido = fluxoDaRota(de);
  const lembretes = e.caminho.passos.filter((p) => p.origem === 'coach' && p.lembrarEm && p.lembrarEm <= hoje && !p.feitoEm);
  const planos = e.caminho.passos.filter((p) => p.origem === 'coach');

  useEffect(() => {
    fetch('/api/conselheiro').then((r) => r.json()).then((j: { ativo?: boolean }) => setAtivo(Boolean(j.ativo))).catch(() => setAtivo(false));
  }, []);
  useEffect(() => { if (msgs.length) fim.current?.scrollIntoView?.({ block: 'nearest' }); }, [msgs.length, busy]);

  const responderFluxo = (id: FluxoId, ent: Entrada = {}, pergunta?: string) => {
    const f = FLUXOS.find((x) => x.id === id)!;
    const r = rodarFluxo(id, e, hoje, ent);
    const novas: Msg[] = [{ de: 'eu', texto: pergunta ?? f.titulo }, ...r.textos.map((t, i): Msg => (i === r.textos.length - 1 ? { de: 'coach', texto: t, acoes: r.acoes, impacto: r.impacto, copiar: r.copiar } : { de: 'coach', texto: t }))];
    setMsgs([...msgs, ...novas]);
  };
  const abrirFluxo = (id: FluxoId) => {
    const f = FLUXOS.find((x) => x.id === id)!;
    if (f.campos.length) setForm(f);
    else responderFluxo(id);
  };

  const enviar = async (texto: string) => {
    const t = texto.trim();
    if (!t || busy) return;
    const hist: Msg[] = [...msgs, { de: 'eu', texto: t }];
    setQ('');
    if (!ativo) {
      setMsgs([...hist, { de: 'coach', texto: 'A conversa livre ainda não está ativada neste app, então não vou fingir uma resposta. Os assuntos abaixo eu resolvo agora, com os seus números. Escolha o que mais parece com a sua dúvida.' }]);
      return;
    }
    const tk = await token();
    if (!tk) { setMsgs([...hist, { de: 'coach', texto: 'Para conversar comigo, entre na sua conta (pelo link do WhatsApp ou com o seu e-mail).', acoes: [] }]); return; }
    setMsgs(hist);
    setBusy(true);
    try {
      const res = await fetch('/api/conselheiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ question: t, history: hist.slice(-9).map((m) => ({ from: m.de === 'eu' ? 'me' : 'coach', text: m.texto })) }),
      });
      const j = (await res.json().catch(() => ({}))) as { reply?: string; error?: string; acoes?: AcaoCoach[]; impactos?: Impacto[] };
      setMsgs([...hist, { de: 'coach', texto: j.reply ?? j.error ?? 'Não consegui responder agora. Tenta de novo daqui a pouco.', acoes: Array.isArray(j.acoes) ? j.acoes.slice(0, 3) : [], impacto: Array.isArray(j.impactos) ? j.impactos[0] : null }]);
    } catch {
      setMsgs([...hist, { de: 'coach', texto: 'Sem conexão agora. Tenta de novo daqui a pouco.' }]);
    } finally {
      setBusy(false);
    }
  };

  // veio da busca com uma pergunta ("Pergunte ao Coach"): ela vira a primeira mensagem
  useEffect(() => {
    const p = params.get('pergunta');
    if (!p || ativo === null) return;
    setParams(de ? { de } : {}, { replace: true });
    void enviar(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez, quando já se sabe se a conversa está ativada
  }, [ativo]);

  const fazer = (a: AcaoCoach): boolean => {
    const d = a.dados;
    const s = (k: string) => String(d[k] ?? '');
    const n = (k: string) => Number(d[k] ?? 0);
    switch (a.tipo) {
      case 'colocar_no_caminho': return Boolean(colocarNoCaminho({ titulo: s('titulo'), detalhe: s('detalhe'), rota: s('rota') || undefined, origem: 'coach' }));
      case 'criar_meta': return Boolean(criarMeta({ nome: s('nome'), alvo: n('alvo'), prazo: s('prazo') || undefined }));
      case 'anotar_atraso': anotarAtraso({ nome: s('nome'), valor: n('valor'), diaVencimento: n('dia') || 10, meses: [s('mes')] }); return true;
      case 'definir_limite_categoria': definirLimite(s('categoria'), n('valor')); return true;
      case 'escolher_metodo_quitacao': escolherMetodoQuitacao(s('metodo') === 'maior-juro' ? 'maior-juro' : 'bola-de-neve'); return true;
      case 'criar_lembrete': return Boolean(colocarNoCaminho({ titulo: s('texto'), detalhe: 'Combinado com o Coach: eu volto a perguntar nesse dia.', rota: '/coach', origem: 'coach', lembrarEm: s('data') }));
      case 'colocar_compra_em_espera_72h': return Boolean(esperar72h(s('item'), n('valor')));
      case 'abrir_ferramenta': navigate(s('rota')); return true;
    }
  };
  const decidir = (iMsg: number, iAcao: number, a: AcaoCoach | null) => {
    if (a && !fazer(a)) { toast('Não consegui fazer isso. Tente pela tela da ferramenta.'); return; }
    if (a && a.tipo !== 'abrir_ferramenta') toast('Feito. Está no seu caminho.');
    setMsgs(msgs.map((m, i) => (i === iMsg ? { ...m, resolvidas: [...(m.resolvidas ?? []), iAcao] } : m)));
  };

  const passoEditado = planos.find((p) => p.id === editando);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <Moeda tamanho={52} />
        <div><h1 className="gs-titulo">Coach</h1><p className="gs-sub" style={{ margin: 0 }}>Um problema por vez, com os seus números.</p></div>
      </div>

      {lembretes.map((p) => (
        <section key={p.id} className="cm-volta">
          <Eyebrow>Combinamos de conversar</Eyebrow>
          <p><b>{p.titulo}</b></p>
          <p>Como foi? Me conta em uma frase, ou marque como resolvido.</p>
          <div className="gs-acoes"><button type="button" className="gs-btn" onClick={() => { concluirPasso(p.id); toast('Boa. Marquei como resolvido.'); }}>Resolvido</button></div>
        </section>
      ))}

      {msgs.length === 0 && recs.filter((r) => r.id !== 'tudo-certo').slice(0, 2).map((r) => <Rec key={r.id} r={r} />)}

      <h2 className="cm-h2">O que você quer resolver?{conversas.length > (msgs.length ? 1 : 0) && <button type="button" onClick={() => setAnteriores(true)}>Conversas anteriores</button>}</h2>
      <div className="cm-chips" role="group" aria-label="Assuntos que o Coach resolve">
        {[...FLUXOS].sort((a, b) => Number(b.id === sugerido) - Number(a.id === sugerido)).map((f) => <button key={f.id} type="button" className={`cm-chip${f.id === sugerido && msgs.length === 0 ? ' on' : ''}`} onClick={() => abrirFluxo(f.id)}>{f.titulo}</button>)}
      </div>

      <div className="cm-conversa" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <p className={`cm-msg ${m.de}`}>{m.texto}</p>
            {m.impacto && m.impacto.dataDepois && m.impacto.meses !== 0 && (
              <div className={`cm-impacto ${m.impacto.meses > 0 ? 'atrasa' : 'adianta'}`} style={{ margin: 0 }}>
                <Eyebrow>{m.impacto.titulo}</Eyebrow>
                <div className="cm-antes-depois"><div><span>Hoje</span><b>{nomeMes(m.impacto.dataAntes)}</b></div><span aria-hidden="true">→</span><div><span>Com isso</span><b style={{ color: m.impacto.meses > 0 ? 'var(--cm-atraso)' : 'var(--cm-ok)' }}>{nomeMes(m.impacto.dataDepois)}</b></div></div>
              </div>
            )}
            {m.copiar && <button type="button" className="gs-btn sec" style={{ alignSelf: 'flex-start' }} onClick={() => void navigator.clipboard?.writeText(m.copiar!.texto).then(() => toast('Mensagem copiada. É só colar na conversa com eles.'), () => toast('Não consegui copiar.'))}>{m.copiar.rotulo}</button>}
            {(m.acoes ?? []).map((a, k) => (m.resolvidas ?? []).includes(k) ? null : (
              <div key={k} className="cm-acao-card">
                <b>{a.titulo}</b>
                {a.detalhe && <small>{a.detalhe}</small>}
                <div className="gs-acoes" style={{ marginTop: 10 }}>
                  <button type="button" className="gs-btn pequeno" onClick={() => decidir(i, k, a)}>{a.tipo === 'abrir_ferramenta' ? 'Abrir' : 'Fazer'}</button>
                  {a.ajustar && <Link to={a.ajustar} className="gs-btn sec pequeno">Ajustar</Link>}
                  {a.tipo !== 'abrir_ferramenta' && <button type="button" className="gs-btn link" onClick={() => decidir(i, k, null)}>Agora não</button>}
                </div>
              </div>
            ))}
          </div>
        ))}
        {busy && <p className="cm-msg coach" aria-busy="true">Fazendo as contas…</p>}
        <div ref={fim} />
      </div>
      {msgs.length > 0 && <button type="button" className="cm-link" onClick={() => setAtualId(`c-${Date.now()}`)}>Nova conversa</button>}

      <form className="gs-envio" onSubmit={(ev) => { ev.preventDefault(); void enviar(q); }}>
        <input value={q} onChange={(ev) => setQ(ev.target.value)} maxLength={500} placeholder={ativo ? 'Escreva com as suas palavras' : 'Escreva sua dúvida'} aria-label="Pergunta ao coach" />
        <button type="submit" className="gs-btn" disabled={busy || !q.trim()} aria-label="Enviar"><Send size={18} aria-hidden="true" /></button>
      </form>
      {ativo === false && <p className="gs-nota">A conversa livre com inteligência artificial ainda não está ativada. Os assuntos acima funcionam normalmente, com os seus dados.</p>}

      {planos.length > 0 && (
        <>
          <h2 className="cm-h2">O que combinamos</h2>
          <div className="cm-lista">
            {planos.map((p) => (
              <div key={p.id} className="cm-item-lista">
                <span className="corpo"><b style={p.feitoEm ? { textDecoration: 'line-through' } : undefined}>{p.titulo}</b>{p.detalhe && <small className="cm-mudo">{p.detalhe}</small>}</span>
                {p.feitoEm ? <button type="button" className="gs-btn link" onClick={() => concluirPasso(p.id, false)}>Recomeçar</button> : <button type="button" className="gs-icone-btn" aria-label={`Editar: ${p.titulo}`} onClick={() => setEditando(p.id)}><Pencil size={18} aria-hidden="true" /></button>}
                <button type="button" className="gs-icone-btn" aria-label={`Apagar: ${p.titulo}`} onClick={() => { removerPasso(p.id); toast('Apagado.'); }}><Trash2 size={18} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <details style={{ marginTop: 28 }}>
        <summary className="cm-link" style={{ cursor: 'pointer' }}>Quais avisos eu quero receber</summary>
        <div className="gs-card" style={{ marginTop: 10 }}>
          {AVISOS.map(([id, titulo, texto]) => (
            <div className="gs-assist" key={id}>
              <div className="gs-assist-corpo" style={{ cursor: 'default' }}><span className="gs-corpo"><b>{titulo}</b><small>{texto}</small></span></div>
              <button type="button" role="switch" aria-checked={!desligados.has(id)} aria-label={titulo} className={`gs-switch ${!desligados.has(id) ? 'on' : ''}`} onClick={() => desligarAviso(id, !desligados.has(id))}><i /></button>
            </div>
          ))}
          <Link to="/assistentes" className="gs-btn link">Configurar lembretes por dia e horário</Link>
        </div>
      </details>
      <p className="gs-nota">Educação financeira. Não substitui um profissional. Não indico banco nem produto, e não prometo retorno.</p>

      <FormFluxo key={form?.id ?? 'nada'} fluxo={form} onFechar={() => setForm(null)} onEnviar={(ent, resumo) => { const f = form!; setForm(null); responderFluxo(f.id, ent, resumo); }} />
      <Folha aberta={anteriores} onFechar={() => setAnteriores(false)} titulo="Conversas anteriores">
        <p className="cm-mudo" style={{ marginTop: 0 }}>Ficam só neste aparelho.</p>
        <div className="cm-lista">
          {[...conversas].reverse().map((c) => (
            <button key={c.id} type="button" className="cm-item-lista" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--cm-linha)', textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => { setAtualId(c.id); setAnteriores(false); }}>
              <span className="corpo"><b>{c.msgs.find((m) => m.de === 'eu')?.texto ?? 'Conversa'}</b><small className="cm-mudo">{new Date(c.quando).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} · {c.msgs.length} mensagens</small></span>
            </button>
          ))}
        </div>
        <button type="button" className="gs-btn link" onClick={() => { guardarConversas([]); setConversasRaw([]); setAnteriores(false); }}>Apagar todas as conversas</button>
      </Folha>
      <Folha aberta={Boolean(passoEditado)} onFechar={() => setEditando(null)} titulo="Ajustar o combinado">
        {passoEditado && <EditarPasso key={passoEditado.id} titulo={passoEditado.titulo} detalhe={passoEditado.detalhe} onSalvar={(t, d) => { editarPasso(passoEditado.id, { titulo: t, detalhe: d }); setEditando(null); }} />}
      </Folha>
    </>
  );
}

function EditarPasso({ titulo, detalhe, onSalvar }: { titulo: string; detalhe: string; onSalvar: (t: string, d: string) => void }) {
  const [t, setT] = useState(titulo);
  const [d, setD] = useState(detalhe);
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); if (t.trim()) onSalvar(t, d); }}>
      <Campo rotulo="O passo" valor={t} onChange={setT} maxLength={120} autoFocus />
      <Campo rotulo="Detalhe" valor={d} onChange={setD} maxLength={300} />
      <button type="submit" className="gs-btn cheio" disabled={!t.trim()}>Salvar</button>
    </form>
  );
}

/** As perguntas de um assunto, uma folha curta: o Coach só pede o que precisa para calcular. */
function FormFluxo({ fluxo, onFechar, onEnviar }: { fluxo: Fluxo | null; onFechar: () => void; onEnviar: (e: Entrada, resumo: string) => void }) {
  const [v, setV] = useState<Entrada>({});
  if (!fluxo) return null;
  const falta = fluxo.campos.some((c) => c.id !== 'nome' && !(Number(v[c.id]) > 0));
  const resumo = `${fluxo.titulo.replace(/\?$/, "")}: ${fluxo.campos.map((c) => (v[c.id] ? (c.id === 'nome' ? String(v[c.id]) : c.id === 'parcelas' ? `${v[c.id]}x` : c.id === 'meses' ? `${v[c.id]} meses` : Number(v[c.id]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })) : '')).filter(Boolean).join(', ')}`;
  return (
    <Folha aberta onFechar={onFechar} titulo={fluxo.titulo}>
      <form onSubmit={(ev) => { ev.preventDefault(); if (!falta) onEnviar(v, resumo); }}>
        {fluxo.campos.map((c, i) => c.id === 'nome'
          ? <Campo key={c.id} rotulo={c.rotulo} valor={String(v.nome ?? '')} onChange={(s) => setV({ ...v, nome: s })} placeholder={`Ex.: ${c.exemplo}`} maxLength={40} />
          : c.id === 'parcelas' || c.id === 'meses'
            ? <CampoNumero key={c.id} rotulo={c.rotulo} valor={(v[c.id] as number) ?? ''} onChange={(x) => setV({ ...v, [c.id]: x === '' ? 0 : x })} min={1} max={480} placeholder={`Ex.: ${c.exemplo}`} />
            : <CampoDinheiro key={c.id} rotulo={c.rotulo} valor={Number(v[c.id] ?? 0)} onChange={(x) => setV({ ...v, [c.id]: x })} grande={i === 0 || fluxo.campos[0].id === 'nome'} />)}
        <button type="submit" className="gs-btn cheio" disabled={falta}>Calcular com os meus números</button>
      </form>
    </Folha>
  );
}

function Rec({ r }: { r: Recomendacao }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section className={`gs-card gs-coach ${r.tom}`}>
      <b>{r.titulo}</b>
      <p>{r.texto}</p>
      <div className="gs-acoes">
        {r.acao && (r.acao.rota ? <Link className="gs-btn sec pequeno" to={r.acao.rota}>Resolver agora</Link> : <button type="button" className="gs-btn sec pequeno" onClick={() => abrirAdicionar()}>{r.acao.rotulo}</button>)}
        <button type="button" className="gs-btn link" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>Por que estou vendo isso?</button>
      </div>
      {aberto && <p className="gs-nota">{r.porque}</p>}
    </section>
  );
}
