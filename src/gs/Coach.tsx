import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Sparkles } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { recomendacoes, type Recomendacao } from './coachRegras';
import { desligarAviso } from './acoes';
import { abrirAdicionar } from './AdicionarMov';
import { painelToken } from '../painel';
import { supabase } from '../supabase';
import { Titulo } from './ui';

/* ---------- Coach: orientações calculadas dos seus dados + conversa com IA (quando ativada no servidor) ---------- */

const SUGESTOES = ['Quanto posso gastar neste final de semana?', 'Quais são meus maiores gastos?', 'Qual conta devo priorizar?', 'Estou melhorando financeiramente?', 'Por que estou terminando o mês sem dinheiro?'];
const AVISOS: [string, string, string][] = [
  ['vencimento', 'Contas e faturas perto de vencer', 'Avisos de vencimento e atraso (atraso grave continua aparecendo).'],
  ['orcamento', 'Orçamento e gastos acima do padrão', 'Quando uma categoria sobe ou passa do limite que você definiu.'],
  ['coach', 'Sugestões do coach', 'Ideias para guardar, metas e próximos passos.'],
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

interface Msg { de: 'eu' | 'coach'; texto: string }

export function Coach() {
  const e = useEstado();
  const hoje = useHoje();
  const recs = useMemo(() => recomendacoes(e, hoje), [e, hoje]);
  const desligados = new Set(e.config.avisosDesligados ?? []);
  return (
    <>
      <Titulo titulo="Coach financeiro" sub="Orientações baseadas nos seus dados reais, sem julgamentos." />
      <h2 className="gs-h2">Para você agora</h2>
      {recs.slice(0, 5).map((r) => <Rec key={r.id} r={r} />)}
      <h2 className="gs-h2">Converse com o coach</h2>
      <Conversa />
      <h2 className="gs-h2">Avisos que você quer receber</h2>
      <div className="gs-card">
        {AVISOS.map(([id, titulo, texto]) => (
          <div className="gs-assist" key={id}>
            <div className="gs-assist-corpo" style={{ cursor: 'default' }}>
              <span className="gs-corpo"><b>{titulo}</b><small>{texto}</small></span>
            </div>
            <button type="button" role="switch" aria-checked={!desligados.has(id)} aria-label={titulo} className={`gs-switch ${!desligados.has(id) ? 'on' : ''}`} onClick={() => desligarAviso(id, !desligados.has(id))}><i /></button>
          </div>
        ))}
        <Link to="/assistentes" className="gs-btn link">Configurar lembretes por dia e horário</Link>
      </div>
      <p className="gs-nota">O coach é educação financeira: não promete resultados nem substitui um profissional, principalmente em dívidas complexas ou investimentos.</p>
    </>
  );
}

function Rec({ r }: { r: Recomendacao }) {
  const [aberto, setAberto] = useState(false);
  return (
    <section className={`gs-card gs-coach ${r.tom}`}>
      <b>{r.titulo}</b>
      <p>{r.texto}</p>
      <div className="gs-acoes">
        {r.acao && (r.acao.rota ? <Link className="gs-btn sec pequeno" to={r.acao.rota}>{r.acao.rotulo}</Link> : <button type="button" className="gs-btn sec pequeno" onClick={() => abrirAdicionar()}>{r.acao.rotulo}</button>)}
        <button type="button" className="gs-btn link" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>Por que estou vendo isso?</button>
      </div>
      {aberto && <p className="gs-nota">{r.porque}</p>}
    </section>
  );
}

function Conversa() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [logado, setLogado] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetch('/api/conselheiro').then((r) => r.json()).then((j: { ativo?: boolean }) => setAtivo(Boolean(j.ativo))).catch(() => setAtivo(false));
    void token().then((t) => setLogado(Boolean(t)));
  }, []);
  useEffect(() => fim.current?.scrollIntoView?.({ block: 'nearest' }), [msgs]);

  if (ativo === null || logado === null) return <div className="gs-card"><p className="gs-mudo">Carregando…</p></div>;
  if (!ativo)
    return (
      <div className="gs-card">
        <b>A conversa com o coach ainda não está ativada</b>
        <p className="gs-mudo">Ela depende de uma chave de IA configurada no servidor do app. Enquanto isso, as orientações acima continuam sendo calculadas dos seus dados.</p>
      </div>
    );
  if (!logado)
    return (
      <div className="gs-card">
        <b>Entre para conversar</b>
        <p className="gs-mudo">O coach precisa saber quem é você para ler os seus números com segurança. Entre com seu e-mail ou pelo link do WhatsApp.</p>
        <Link to="/entrar" className="gs-btn">Entrar</Link>
      </div>
    );

  const enviar = async (texto: string) => {
    const t = texto.trim();
    if (!t || busy) return;
    const hist = [...msgs, { de: 'eu' as const, texto: t }];
    setMsgs(hist);
    setQ('');
    setBusy(true);
    try {
      const res = await fetch('/api/conselheiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await token()) ?? ''}` },
        body: JSON.stringify({ question: t, history: hist.slice(-9).map((m) => ({ from: m.de === 'eu' ? 'me' : 'coach', text: m.texto })) }),
      });
      const j = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      setMsgs([...hist, { de: 'coach', texto: j.reply ?? j.error ?? 'Não consegui responder agora. Tenta de novo daqui a pouco.' }]);
    } catch {
      setMsgs([...hist, { de: 'coach', texto: 'Sem conexão agora. Tenta de novo daqui a pouco.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gs-card">
      {msgs.length === 0 && (
        <>
          <p className="gs-mudo" style={{ marginTop: 0 }}><Sparkles size={14} style={{ verticalAlign: -2 }} aria-hidden="true" /> Pergunte sobre o seu dinheiro. Eu uso só os seus dados; se faltar alguma informação, eu pergunto.</p>
          <div className="gs-chips">{SUGESTOES.map((s) => <button key={s} type="button" className="gs-chip" onClick={() => void enviar(s)}>{s}</button>)}</div>
        </>
      )}
      <div className="gs-conversa" aria-live="polite">
        {msgs.map((m, i) => <p key={i} className={`gs-msg ${m.de}`}>{m.texto}</p>)}
        {busy && <p className="gs-msg coach" aria-busy="true">Pensando…</p>}
        <div ref={fim} />
      </div>
      <form className="gs-envio" onSubmit={(ev) => { ev.preventDefault(); void enviar(q); }}>
        <input value={q} onChange={(ev) => setQ(ev.target.value)} maxLength={500} placeholder="Escreva sua pergunta" aria-label="Pergunta ao coach" />
        <button type="submit" className="gs-btn" disabled={busy || !q.trim()} aria-label="Enviar"><Send size={18} /></button>
      </form>
    </div>
  );
}
