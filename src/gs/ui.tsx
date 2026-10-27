import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { arred } from './datas';
import { assistentePorId } from './assistentes';
import { Anel } from './graficos';

/* ---------- campo de dinheiro com máscara (digita centavos, mostra R$ 1.234,56) ---------- */
export function CampoDinheiro({ rotulo, valor, onChange, placeholder = 'R$ 0,00', grande = false, erro, autoFocus }: { rotulo: string; valor: number; onChange: (n: number) => void; placeholder?: string; grande?: boolean; erro?: string; autoFocus?: boolean }) {
  const texto = valor > 0 ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
  return (
    <label className="gs-campo">
      <span>{rotulo}</span>
      <input
        className={grande ? 'gs-dinheiro' : ''}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={texto}
        aria-invalid={Boolean(erro)}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').slice(0, 11);
          onChange(d ? arred(Number(d) / 100) : 0);
        }}
      />
      {erro && <em className="gs-erro">{erro}</em>}
    </label>
  );
}

/** Campo de número (dia, meses, percentual). Aceita vírgula. */
export function CampoNumero({ rotulo, valor, onChange, min, max, sufixo, placeholder, passo = 1, erro }: { rotulo: string; valor: number | ''; onChange: (n: number | '') => void; min?: number; max?: number; sufixo?: string; placeholder?: string; passo?: number; erro?: string }) {
  const [texto, setTexto] = useState(valor === '' ? '' : String(valor).replace('.', ','));
  useEffect(() => {
    setTexto((t) => (Number(t.replace(',', '.')) === valor ? t : valor === '' ? '' : String(valor).replace('.', ',')));
  }, [valor]);
  return (
    <label className="gs-campo">
      <span>{sufixo ? `${rotulo} (${sufixo})` : rotulo}</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={texto}
        aria-invalid={Boolean(erro)}
        data-passo={passo}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d,.]/g, '');
          setTexto(t);
          if (t === '') return onChange('');
          let n = Number(t.replace(',', '.'));
          if (!Number.isFinite(n)) return;
          if (max !== undefined) n = Math.min(max, n);
          if (min !== undefined && n < min) n = min;
          onChange(n);
        }}
      />
      {erro && <em className="gs-erro">{erro}</em>}
    </label>
  );
}

export function Campo({ rotulo, valor, onChange, placeholder, tipo = 'text', maxLength, erro, autoFocus }: { rotulo: string; valor: string; onChange: (s: string) => void; placeholder?: string; tipo?: string; maxLength?: number; erro?: string; autoFocus?: boolean }) {
  return (
    <label className="gs-campo">
      <span>{rotulo}</span>
      <input type={tipo} value={valor} placeholder={placeholder} maxLength={maxLength} autoFocus={autoFocus} aria-invalid={Boolean(erro)} onChange={(e) => onChange(e.target.value)} />
      {erro && <em className="gs-erro">{erro}</em>}
    </label>
  );
}

/* ---------- folha (bottom sheet no celular, janela no PC): Esc fecha, foco volta ---------- */
export function Folha({ aberta, onFechar, titulo, children }: { aberta: boolean; onFechar: () => void; titulo: string; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const ativo = useRef<Element | null>(null);
  useEffect(() => {
    if (!aberta) return;
    ativo.current = document.activeElement;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', tecla);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
      (ativo.current as HTMLElement | null)?.focus?.();
    };
  }, [aberta, onFechar]);
  if (!aberta) return null;
  return createPortal(
    <div className="gs-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="gs-folha" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <h2 id={id}>{titulo}</h2>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Confirmação curta (apagar, recomeçar). `digitar` exige escrever a palavra. */
export function Confirmar({ aberta, titulo, texto, rotulo = 'Confirmar', perigo = true, digitar, onConfirmar, onCancelar }: { aberta: boolean; titulo: string; texto?: string; rotulo?: string; perigo?: boolean; digitar?: string; onConfirmar: () => void; onCancelar: () => void }) {
  const [t, setT] = useState('');
  useEffect(() => setT(''), [aberta]);
  const ok = !digitar || t.trim().toUpperCase() === digitar.toUpperCase();
  return (
    <Folha aberta={aberta} onFechar={onCancelar} titulo={titulo}>
      {texto && <p className="gs-sub">{texto}</p>}
      {digitar && <Campo rotulo={`Digite ${digitar} pra confirmar`} valor={t} onChange={setT} />}
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onCancelar}>Cancelar</button>
        <button type="button" className={`gs-btn ${perigo ? 'perigo' : ''}`} disabled={!ok} onClick={onConfirmar}>{rotulo}</button>
      </div>
    </Folha>
  );
}

/* ---------- avatar do assistente: fundo areia, aro dourado, inicial em serifa ---------- */
export function AvatarAssistente({ id, inicial, cor, tamanho = 44 }: { id?: string; inicial?: string; cor?: string; tamanho?: number }) {
  const a = id ? assistentePorId(id) : undefined;
  return (
    <span className="gs-avatar" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42, color: cor ?? a?.cor ?? 'var(--ink)', background: 'var(--bg-2)' }} aria-hidden="true">
      {inicial ?? a?.inicial ?? '•'}
    </span>
  );
}

export function Vazio({ titulo, texto, acao, rota, onAcao, avatar }: { titulo: string; texto?: string; acao?: string; rota?: string; onAcao?: () => void; avatar?: string }) {
  return (
    <div className="gs-card gs-vazio">
      <AvatarAssistente id={avatar} inicial={avatar ? undefined : '•'} tamanho={56} />
      <b>{titulo}</b>
      {texto && <p>{texto}</p>}
      {acao && rota && <Link className="gs-btn" to={rota}>{acao}</Link>}
      {acao && !rota && <button type="button" className="gs-btn" onClick={onAcao}>{acao}</button>}
    </div>
  );
}

export const Esqueleto = ({ linhas = 3 }: { linhas?: number }) => (
  <div aria-busy="true" aria-label="Carregando">
    {Array.from({ length: linhas }, (_, i) => <div key={i} className="gs-esqueleto" style={{ width: `${90 - i * 12}%` }} />)}
  </div>
);

export const Barra = ({ pct, tom = '', rotulo }: { pct: number; tom?: '' | 'ok' | 'perigo'; rotulo?: string }) => (
  <div className={`gs-barra ${tom}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, Math.max(0, pct)))} aria-label={rotulo ?? 'Progresso'}>
    <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
  </div>
);

export function Titulo({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <>
      <h1 className="gs-titulo">{titulo}</h1>
      {sub && <p className="gs-sub">{sub}</p>}
    </>
  );
}

/** "Pra entender": um parágrafo que explica o porquê, em linguagem simples. */
export const Aprende = ({ titulo, texto }: { titulo: string; texto: string }) => (
  <section className="gs-card" style={{ background: 'var(--gold-soft)', borderColor: 'transparent' }}>
    <div className="gs-rotulo">Pra entender</div>
    <h3 style={{ margin: '4px 0 6px', fontFamily: 'var(--serif)', fontSize: 18 }}>{titulo}</h3>
    <p style={{ margin: 0 }}>{texto}</p>
  </section>
);

/** Controle deslizante com valor grande em cima e limites embaixo. */
export function Deslizante({ rotulo, valor, min, max, passo, onChange, formato, extra }: { rotulo: string; valor: number; min: number; max: number; passo: number; onChange: (n: number) => void; formato: (n: number) => string; extra?: string }) {
  return (
    <div>
      <div className="gs-rotulo">{rotulo}</div>
      <div className="gs-medio" style={{ margin: '2px 0' }}>{formato(valor)}</div>
      <input type="range" min={min} max={max} step={passo} value={valor} aria-label={rotulo} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%', height: 44, accentColor: 'var(--gold-strong)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-muted)' }}>
        <span>{formato(min)}</span>
        {extra && <span>{extra}</span>}
        <span>{formato(max)}</span>
      </div>
    </div>
  );
}

export const Dica = ({ children, icone = '💡' }: { children: ReactNode; icone?: string }) => (
  <div className="gs-dica">
    <span aria-hidden="true">{icone}</span>
    <span>{children}</span>
  </div>
);

/* ---------- molde das ferramentas: cabeçalho com anel, o que fazer agora, conquistas e "mais ajuda" ---------- */
export function Heroi({ pct, anel, anelSub, rotulo, grande, sub, cor = 'var(--gold-strong)' }: { pct: number; anel: string; anelSub: string; rotulo: string; grande: string; sub?: string; cor?: string }) {
  return (
    <section className="gs-card destaque" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ flex: 'none', width: 104 }}><Anel pct={Math.max(0, Math.min(100, pct))} grande={anel} sub={anelSub} tamanho={104} cor={cor} /></div>
      <div style={{ minWidth: 0 }}>
        <span className="gs-rotulo">{rotulo}</span>
        <p className="gs-grande" style={{ margin: '2px 0' }}>{grande}</p>
        {sub && <p className="gs-sub" style={{ margin: 0 }}>{sub}</p>}
      </div>
    </section>
  );
}

export function Agora({ tom = 'ok', texto, children }: { tom?: 'ok' | 'aviso' | 'perigo' | 'dica'; texto: string; children?: ReactNode }) {
  return (
    <section className="gs-card">
      <span className="gs-rotulo">O que fazer agora</span>
      <p style={{ margin: '6px 0 0' }}><span className={`gs-etiqueta ${tom === 'dica' ? '' : tom}`} style={{ marginRight: 8 }}>{tom === 'ok' ? 'Tudo certo' : tom === 'perigo' ? 'Atenção' : tom === 'dica' ? 'Dica' : 'Cuidado'}</span>{texto}</p>
      {children}
    </section>
  );
}

export const Conquistas = ({ lista }: { lista: string[] }) =>
  lista.length === 0 ? null : (
    <div className="gs-chips" aria-label="Conquistas">
      {lista.map((c) => <span key={c} className="gs-etiqueta ok">★ {c}</span>)}
    </div>
  );

export const MaisAjuda = ({ children, titulo = 'Mais ajuda' }: { children: ReactNode; titulo?: string }) => (
  <details className="gs-card" style={{ padding: '4px 20px', marginTop: 12 }}>
    <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>{titulo}</summary>
    <div style={{ paddingBottom: 12 }}>{children}</div>
  </details>
);
