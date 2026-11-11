import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { Folha } from './ui';
import { PERGUNTAS, buscar, ferramenta } from './registroFerramentas';

/* ---------- "O que você quer resolver?": perguntas em linguagem de gente, cada uma leva à ferramenta certa ---------- */

const EVENTO = 'gs-resolver';
export const abrirResolver = () => window.dispatchEvent(new CustomEvent(EVENTO));

/** O botão que parece um campo: abre a folha de perguntas. */
export const CaixaResolver = () => (
  <button type="button" className="cm-busca" onClick={abrirResolver}><Search size={20} aria-hidden="true" />O que você quer resolver?</button>
);

export function Resolver() {
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    const abrir = () => { setQ(''); setAberta(true); };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);
  const achados = useMemo(() => buscar(q), [q]);
  const ir = (rota: string) => { setAberta(false); navigate(rota); };
  const texto = q.trim();
  return (
    <Folha aberta={aberta} onFechar={() => setAberta(false)} titulo="O que você quer resolver?">
      <label className="cm-campo-busca">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Escreva o que você precisa</span>
        <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Ex.: cartão, dívida, guardar…" autoComplete="off" enterKeyHint="search" />
      </label>
      {texto.length < 2 ? (
        <div className="cm-chips">
          {PERGUNTAS.map((p) => <button key={p.texto} type="button" className="cm-chip" onClick={() => ir(p.rota ?? ferramenta(p.ferramentaId)!.rota)}>{p.texto}</button>)}
        </div>
      ) : achados.length > 0 ? (
        <div className="cm-grade" style={{ marginTop: 16 }}>
          {achados.map((a) => (
            <button key={a.rota + a.titulo} type="button" className="cm-tile" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--cm-linha)', textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%' }} onClick={() => ir(a.rota)}>
              <b>{a.titulo}</b><em>{a.sub}</em>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          <p className="cm-mudo" style={{ margin: '0 0 12px' }}>Não achei uma ferramenta para "{texto}". O Coach pode ajudar com isso.</p>
          <button type="button" className="gs-btn cheio" onClick={() => ir(`/coach?pergunta=${encodeURIComponent(texto)}`)}><Sparkles size={18} aria-hidden="true" /> Pergunte ao Coach</button>
        </div>
      )}
      <Link to="/ferramentas" className="cm-link" onClick={() => setAberta(false)} style={{ marginTop: 10 }}>Ver todas as ferramentas</Link>
    </Folha>
  );
}
