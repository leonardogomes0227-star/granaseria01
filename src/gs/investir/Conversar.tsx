import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { atualizar, useEstado } from '../store';
import { useHoje } from '../useHoje';
import { hoje as hojeSP, mesDe } from '../datas';
import { livreParaGastar, patrimonioGuardado, reservaMeta } from '../selectores';
import { maiorJuroMensal, totalDividas } from '../dividas';
import { PERGUNTAS_RAPIDAS, respostaGuiada } from './guiado';
import { toast } from '../../components/ui/Toast';

/* ---------- Conversar: o Assistente de Investimentos. Com chave no servidor, é o chat inteligente; sem, o modo guiado. ---------- */

const LIMITE_DIA = 20;

export function Conversar() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const [texto, setTexto] = useState('');
  const [digitando, setDigitando] = useState(false);
  const [guiado, setGuiado] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const chat = e.investir.chat;
  const usadas = e.investir.mensagensHoje.data === hojeSP() ? e.investir.mensagensHoje.qtd : 0;
  useEffect(() => fim.current?.scrollIntoView({ block: 'end' }), [chat.length, digitando]);

  const add = (role: 'user' | 'assistant', content: string, contar = false) =>
    atualizar((s) => ({ ...s, investir: { ...s.investir, chat: [...s.investir.chat, { role, content, ts: Date.now() }].slice(-50), mensagensHoje: contar ? { data: hojeSP(), qtd: (s.investir.mensagensHoje.data === hojeSP() ? s.investir.mensagensHoje.qtd : 0) + 1 } : s.investir.mensagensHoje } }));

  const enviar = async (pergunta: string) => {
    const t = pergunta.trim().slice(0, 1000);
    if (!t || digitando) return;
    if (usadas >= LIMITE_DIA) return void toast('Você chegou ao limite de 20 mensagens por hoje. Volte amanhã.');
    setTexto('');
    const historico = [...chat, { role: 'user' as const, content: t, ts: Date.now() }];
    add('user', t, true);
    setDigitando(true);
    try {
      const r = await fetch('/api/investimentos/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historico.slice(-10).map(({ role, content }) => ({ role, content })),
          contexto: { renda: e.config.renda, livreParaGastar: livreParaGastar(e, mes), patrimonioGuardado: patrimonioGuardado(e), reservaMeta: reservaMeta(e, mes), totalDividas: totalDividas(e.dividas), maiorJuroMensal: maiorJuroMensal(e.dividas), perfilRisco: e.investir.perfilRisco, aporteMensalPlanejado: e.investir.aporteMensalPlanejado },
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { texto?: string; error?: string; guiado?: boolean };
      if (r.ok && j.texto) {
        setGuiado(false);
        add('assistant', j.texto);
      } else if (j.guiado || r.status === 404 || r.status >= 500) {
        setGuiado(true);
        add('assistant', respostaGuiada(t, e, mes));
      } else add('assistant', j.error ?? 'Não consegui responder agora. Tente de novo em instantes.');
    } catch {
      setGuiado(true);
      add('assistant', respostaGuiada(t, e, mes));
    } finally {
      setDigitando(false);
    }
  };

  return (
    <>
      {guiado && <p className="gs-banner" role="status">A conversa livre ainda não está ligada. Estou respondendo com as contas do app, usando os seus números.</p>}
      <div className="gs-card" style={{ minHeight: 280 }} aria-live="polite">
        {chat.length === 0 && <p className="gs-sub" style={{ margin: 0 }}>Pergunte sobre quanto investir, onde guardar a reserva ou como funciona o mercado. Eu uso os seus números e os dados de mercado do app.</p>}
        {chat.map((m) => (
          <div key={m.ts + m.role} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
            <div style={{ maxWidth: '86%', padding: '10px 14px', borderRadius: 18, background: m.role === 'user' ? 'var(--gold)' : 'var(--ivory)', border: m.role === 'user' ? 'none' : '1px solid var(--line)', whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: '22px' }}>{m.content}</div>
          </div>
        ))}
        {digitando && <p className="gs-mudo" aria-label="Digitando">Digitando…</p>}
        <div ref={fim} />
      </div>
      <div className="gs-chips">{PERGUNTAS_RAPIDAS.map((q) => <button key={q} type="button" className="gs-chip" disabled={digitando} onClick={() => void enviar(q)}>{q}</button>)}</div>
      <form className="gs-card" style={{ display: 'flex', gap: 8, padding: 12 }} onSubmit={(ev) => { ev.preventDefault(); void enviar(texto); }}>
        <label className="gs-campo" style={{ flex: 1, margin: 0 }}><span style={{ position: 'absolute', left: -9999 }}>Sua pergunta</span><input value={texto} maxLength={1000} placeholder="Escreva sua pergunta" onChange={(ev) => setTexto(ev.target.value)} /></label>
        <button type="submit" className="gs-btn" disabled={digitando || !texto.trim()} aria-label="Enviar"><Send size={18} /></button>
      </form>
      <div className="gs-acoes" style={{ marginTop: 0 }}>
        <Link to="/investir" className="gs-btn pequeno sec">Meu caminho</Link>
        <Link to="/investir?aba=mercado" className="gs-btn pequeno sec">Ver mercado</Link>
        <Link to="/investir?aba=simulacao" className="gs-btn pequeno sec">Treinar sem risco</Link>
        {chat.length > 0 && <button type="button" className="gs-btn link" onClick={() => atualizar((s) => ({ ...s, investir: { ...s.investir, chat: [] } }))}>Limpar conversa</button>}
      </div>
      <p className="gs-nota">{usadas}/{LIMITE_DIA} mensagens hoje. Conteúdo educativo. Não é recomendação de investimento. Rentabilidade passada não garante resultado futuro.</p>
    </>
  );
}
