import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Plus, Send, X } from 'lucide-react';
import { brl2, respostaDe, type Campo, type Ctx, type ItemLista, type Passo, type Valor } from '../../chat/engine';

/* ---------- O campo fixo embaixo do chat: muda conforme o tipo de resposta (spec v2, seção 5) ---------- */

const centavos = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '' : String(Math.round(n * 100)));
const mostrar = (digits: string) => (digits === '' ? '' : `R$ ${(parseInt(digits, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const limpa = (s: string) => s.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 11);

/** Campo de dinheiro com máscara: o teclado numérico digita os centavos (1 → R$ 0,01; 1234 → R$ 12,34). */
function Dinheiro({ valor, onChange, rotulo, autoFocus, onEnter }: { valor: string; onChange: (d: string) => void; rotulo: string; autoFocus?: boolean; onEnter?: () => void }) {
  return (
    <input
      className="field-input cc-input"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      aria-label={rotulo}
      placeholder="R$ 0,00"
      value={mostrar(valor)}
      onChange={(e) => onChange(limpa(e.target.value))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter?.();
        }
      }}
    />
  );
}

export function Composer({ passo, ctx, inicial, onEnviar }: { passo: Passo; ctx: Ctx; inicial?: Valor; onEnviar: (v: Valor) => void }) {
  const r = respostaDe(passo, ctx);
  if (r.tipo === 'nenhuma') return null;
  if (r.tipo === 'dinheiro') return <ComposerDinheiro sugestao={r.sugestao?.(ctx) ?? null} inicial={typeof inicial === 'number' ? inicial : undefined} onEnviar={onEnviar} />;
  if (r.tipo === 'botoes')
    return (
      <div className="cc-composer">
        <div className="cc-options" role="group" aria-label="Escolha uma resposta">
          {r.opcoes.map((o) => (
            <button key={o.valor} type="button" className={inicial === o.valor ? 'on' : ''} onClick={() => onEnviar(o.valor)}>
              {o.rotulo}
            </button>
          ))}
        </div>
      </div>
    );
  if (r.tipo === 'multiplo') return <ComposerMultiplo opcoes={r.opcoes} inicial={Array.isArray(inicial) ? (inicial as string[]) : []} onEnviar={onEnviar} />;
  if (r.tipo === 'texto') return <ComposerTexto placeholder={r.placeholder} max={r.max} inicial={typeof inicial === 'string' ? inicial : ''} onEnviar={onEnviar} />;
  if (r.tipo === 'data') return <ComposerData min={r.min} max={r.max ?? ctx.dados.hoje} inicial={typeof inicial === 'string' ? inicial : ctx.dados.hoje} onEnviar={onEnviar} />;
  if (r.tipo === 'dia') return <ComposerDia inicial={typeof inicial === 'number' ? inicial : ctx.dados.diaSalario ?? null} onEnviar={onEnviar} />;
  if (r.tipo === 'numero') return <ComposerNumero min={r.min} max={r.max} decimais={r.decimais ?? 0} sufixo={r.sufixo} sugestoes={r.sugestoes} inicial={typeof inicial === 'number' ? inicial : undefined} onEnviar={onEnviar} />;
  if (r.tipo === 'divisao')
    return <ComposerDivisao total={r.total} partes={r.partes} inicial={inicial && typeof inicial === 'object' && !Array.isArray(inicial) ? (inicial as Record<string, number>) : r.inicial} onEnviar={onEnviar} />;
  if (r.tipo !== 'lista') return null;
  return <ComposerLista campos={r.campos} rotuloItem={r.rotuloItem} inicial={Array.isArray(inicial) ? (inicial as ItemLista[]) : r.inicial ?? []} onEnviar={onEnviar} />;
}

function ComposerDinheiro({ sugestao, inicial, onEnviar }: { sugestao: { valor: number; rotulo: string } | null; inicial?: number; onEnviar: (v: Valor) => void }) {
  const [digits, setDigits] = useState(centavos(inicial));
  const enviar = () => {
    if (digits !== '') onEnviar(parseInt(digits, 10) / 100);
  };
  return (
    <form
      className="cc-composer"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      {sugestao && (
        <div className="cc-chips">
          <button type="button" className="cc-chip" onClick={() => onEnviar(sugestao.valor)}>
            {sugestao.rotulo}
          </button>
        </div>
      )}
      <div className="cc-row">
        <Dinheiro valor={digits} onChange={setDigits} rotulo="Valor em reais" autoFocus onEnter={enviar} />
        <button type="submit" className="btn-primary cc-send" disabled={digits === ''} aria-label="Enviar">
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}

function ComposerMultiplo({ opcoes, inicial, onEnviar }: { opcoes: { valor: string; rotulo: string }[]; inicial: string[]; onEnviar: (v: Valor) => void }) {
  const [sel, setSel] = useState<string[]>(inicial);
  const toggle = (v: string) => setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  return (
    <div className="cc-composer">
      <div className="cc-multi" role="group" aria-label="Escolha uma ou mais">
        {opcoes.map((o) => (
          <button key={o.valor} type="button" aria-pressed={sel.includes(o.valor)} className={sel.includes(o.valor) ? 'on' : ''} onClick={() => toggle(o.valor)}>
            {sel.includes(o.valor) && <Check size={15} />} {o.rotulo}
          </button>
        ))}
      </div>
      <div className="cc-row">
        <button type="button" className="btn-primary cc-wide" disabled={sel.length === 0} onClick={() => onEnviar(sel)}>
          Continuar
        </button>
      </div>
    </div>
  );
}

function ComposerTexto({ placeholder, max, inicial, onEnviar }: { placeholder: string; max: number; inicial: string; onEnviar: (v: Valor) => void }) {
  const [t, setT] = useState(inicial);
  return (
    <form
      className="cc-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (t.trim()) onEnviar(t.trim());
      }}
    >
      <div className="cc-row">
        <input className="field-input cc-input" autoFocus aria-label="Sua resposta" placeholder={placeholder} maxLength={max} value={t} onChange={(e) => setT(e.target.value)} />
        <button type="submit" className="btn-primary cc-send" disabled={!t.trim()} aria-label="Enviar">
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}

function ComposerData({ min, max, inicial, onEnviar }: { min?: string; max?: string; inicial: string; onEnviar: (v: Valor) => void }) {
  const [d, setD] = useState(inicial);
  return (
    <form
      className="cc-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (d) onEnviar(d);
      }}
    >
      <div className="cc-row">
        <input className="field-input cc-input" type="date" autoFocus aria-label="Data" min={min} max={max} value={d} onChange={(e) => setD(e.target.value)} />
        <button type="submit" className="btn-primary cc-send" disabled={!d} aria-label="Enviar">
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}

function ComposerNumero({ min, max, decimais, sufixo, sugestoes, inicial, onEnviar }: { min: number; max: number; decimais: number; sufixo?: string; sugestoes?: number[]; inicial?: number; onEnviar: (v: Valor) => void }) {
  const [t, setT] = useState(inicial === undefined ? '' : String(inicial).replace('.', ','));
  const n = Number(t.replace(',', '.'));
  const ok = t.trim() !== '' && Number.isFinite(n);
  return (
    <form
      className="cc-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onEnviar(decimais ? Math.round(n * 10 ** decimais) / 10 ** decimais : Math.round(n));
      }}
    >
      {sugestoes && sugestoes.length > 0 && (
        <div className="cc-chips">
          {sugestoes.map((s) => (
            <button key={s} type="button" className="cc-chip" onClick={() => onEnviar(s)}>
              {String(s).replace('.', ',')}
              {sufixo ?? ''}
            </button>
          ))}
        </div>
      )}
      <div className="cc-row">
        <input
          className="field-input cc-input"
          inputMode={decimais ? 'decimal' : 'numeric'}
          autoFocus
          aria-label={`Número de ${min} a ${max}`}
          placeholder={sufixo ? `0${sufixo}` : '0'}
          value={t}
          onChange={(e) => setT(e.target.value.replace(decimais ? /[^\d,.]/g : /\D/g, '').slice(0, 8))}
        />
        <button type="submit" className="btn-primary cc-send" disabled={!ok} aria-label="Enviar">
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}

/** Divide um valor em partes (%), sempre somando 100: mexer numa parte tira ou devolve das outras. */
function ComposerDivisao({ total, partes, inicial, onEnviar }: { total: number; partes: { id: string; rotulo: string }[]; inicial: Record<string, number>; onEnviar: (v: Valor) => void }) {
  const [pct, setPct] = useState<Record<string, number>>(() => ({ ...Object.fromEntries(partes.map((p) => [p.id, 0])), ...inicial }));
  const mudar = (id: string, novo: number) => {
    setPct((atual) => {
      const v = Math.max(0, Math.min(100, Math.round(novo)));
      const outras = partes.filter((p) => p.id !== id);
      const somaOutras = outras.reduce((t, p) => t + (atual[p.id] ?? 0), 0);
      const resto = 100 - v;
      const next: Record<string, number> = { ...atual, [id]: v };
      if (somaOutras <= 0) {
        outras.forEach((p, i) => (next[p.id] = i === outras.length - 1 ? resto - Math.floor(resto / outras.length) * (outras.length - 1) : Math.floor(resto / outras.length)));
      } else {
        let usado = 0;
        outras.forEach((p, i) => {
          const parte = i === outras.length - 1 ? resto - usado : Math.round(((atual[p.id] ?? 0) / somaOutras) * resto);
          next[p.id] = Math.max(0, parte);
          usado += next[p.id];
        });
      }
      return next;
    });
  };
  return (
    <div className="cc-composer cc-divisao">
      {partes.map((p) => (
        <label key={p.id} className="cc-slider">
          <span>
            <b>{p.rotulo}</b>
            <small>
              {pct[p.id] ?? 0}% · {brl2(Math.round((total * (pct[p.id] ?? 0)) / 100))}
            </small>
          </span>
          <input type="range" min={0} max={100} step={5} value={pct[p.id] ?? 0} onChange={(e) => mudar(p.id, Number(e.target.value))} aria-label={`${p.rotulo} em porcentagem`} />
        </label>
      ))}
      <div className="cc-row">
        <button type="button" className="btn-primary cc-wide" onClick={() => onEnviar(pct)}>
          Confirmar divisão
        </button>
      </div>
    </div>
  );
}

function ComposerDia({ inicial, onEnviar }: { inicial: number | null; onEnviar: (v: Valor) => void }) {
  return (
    <div className="cc-composer">
      <div className="cc-dias" role="group" aria-label="Escolha o dia do mês">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <button key={d} type="button" className={inicial === d ? 'on' : ''} onClick={() => onEnviar(d)} aria-label={`Dia ${d}`}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lista (ex.: as dívidas): adicionar várias, editar e tirar, e "Pronto". */
function ComposerLista({ campos, rotuloItem, inicial, onEnviar }: { campos: Campo[]; rotuloItem: string; inicial: ItemLista[]; onEnviar: (v: Valor) => void }) {
  const vazio = (): Record<string, string> => Object.fromEntries(campos.map((c) => [c.id, '']));
  const [itens, setItens] = useState<ItemLista[]>(inicial);
  const [form, setForm] = useState<Record<string, string>>(() => (inicial.length ? vazio() : vazio()));
  const [aberto, setAberto] = useState(inicial.length === 0);
  const [erro, setErro] = useState<string | null>(null);
  const primeiro = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (aberto) primeiro.current?.focus();
  }, [aberto]);

  const doForm = (): ItemLista | null => {
    const it: ItemLista = { id: `i${Date.now().toString(36)}` };
    for (const c of campos) {
      const raw = form[c.id] ?? '';
      if (c.tipo === 'dinheiro') it[c.id] = raw === '' ? null : parseInt(raw, 10) / 100;
      else if (c.tipo === 'dia') it[c.id] = raw === '' ? null : Number(raw);
      else if (c.tipo === 'percentual') it[c.id] = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
      else it[c.id] = raw.trim();
      if (!c.opcional && (it[c.id] === null || it[c.id] === '' || (c.tipo === 'dinheiro' && !(Number(it[c.id]) > 0)))) {
        setErro(`Falta ${c.rotulo.toLowerCase()}.`);
        return null;
      }
      if (c.tipo === 'dia' && it[c.id] !== null && !(Number(it[c.id]) >= 1 && Number(it[c.id]) <= 31)) {
        setErro('O dia vai de 1 a 31.');
        return null;
      }
      if (c.tipo === 'percentual' && it[c.id] !== null && !(Number(it[c.id]) >= 0 && Number(it[c.id]) <= 100)) {
        setErro('Os juros vão de 0 a 100% ao mês.');
        return null;
      }
    }
    setErro(null);
    return it;
  };

  const adicionar = () => {
    const it = doForm();
    if (!it) return false;
    setItens((l) => [...l, it]);
    setForm(vazio());
    setAberto(false);
    return true;
  };

  const editar = (i: number) => {
    const it = itens[i];
    setForm(Object.fromEntries(campos.map((c) => [c.id, it[c.id] === null || it[c.id] === undefined ? '' : c.tipo === 'dinheiro' ? centavos(Number(it[c.id])) : String(it[c.id])])));
    setItens((l) => l.filter((_, j) => j !== i));
    setAberto(true);
  };

  const pronto = () => {
    // o que está no formulário entra também
    const preenchido = campos.some((c) => (form[c.id] ?? '') !== '');
    if (aberto && preenchido) {
      const it = doForm();
      if (!it) return;
      onEnviar([...itens, it]);
      return;
    }
    onEnviar(itens);
  };

  const resumo = (it: ItemLista) =>
    campos
      .slice(1)
      .map((c) => (it[c.id] === null || it[c.id] === undefined || it[c.id] === '' ? null : c.tipo === 'dinheiro' ? brl2(Number(it[c.id])) : c.tipo === 'percentual' ? `${String(it[c.id]).replace('.', ',')}% a.m.` : c.tipo === 'dia' ? `dia ${it[c.id]}` : String(it[c.id])))
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="cc-composer cc-lista">
      {itens.length > 0 && (
        <ul className="cc-itens">
          {itens.map((it, i) => (
            <li key={String(it.id ?? i)}>
              <span>
                <b>{String(it[campos[0].id] || `${rotuloItem} ${i + 1}`)}</b>
                <small>{resumo(it)}</small>
              </span>
              <button type="button" aria-label={`Editar ${String(it[campos[0].id])}`} onClick={() => editar(i)}>
                <Pencil size={15} />
              </button>
              <button type="button" aria-label={`Tirar ${String(it[campos[0].id])}`} onClick={() => setItens((l) => l.filter((_, j) => j !== i))}>
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberto && (
        <div className="cc-form">
          {campos.map((c, i) => (
            <label key={c.id} className="cc-campo">
              <span>
                {c.rotulo}
                {c.opcional && <small> (opcional)</small>}
              </span>
              {c.tipo === 'dinheiro' ? (
                <Dinheiro valor={form[c.id] ?? ''} rotulo={c.rotulo} onChange={(d) => setForm((f) => ({ ...f, [c.id]: d }))} onEnter={adicionar} />
              ) : (
                <input
                  ref={i === 0 ? primeiro : undefined}
                  className="field-input cc-input"
                  inputMode={c.tipo === 'percentual' ? 'decimal' : c.tipo === 'dia' ? 'numeric' : undefined}
                  placeholder={c.placeholder}
                  maxLength={c.max ?? 40}
                  value={form[c.id] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [c.id]: c.tipo === 'percentual' ? e.target.value.replace(/[^\d.,]/g, '').slice(0, 6) : c.tipo === 'dia' ? e.target.value.replace(/\D/g, '').slice(0, 2) : e.target.value }))}
                />
              )}
            </label>
          ))}
          {erro && (
            <p className="cc-error" role="alert">
              {erro}
            </p>
          )}
          <button type="button" className="btn-outline cc-wide" onClick={adicionar}>
            <Check size={16} /> Adicionar esta
          </button>
        </div>
      )}
      <div className="cc-row">
        {!aberto && (
          <button type="button" className="btn-outline cc-wide" onClick={() => setAberto(true)}>
            <Plus size={16} /> Adicionar {itens.length ? 'outra' : rotuloItem}
          </button>
        )}
        <button type="button" className="btn-primary cc-wide" disabled={itens.length === 0 && !campos.some((c) => (form[c.id] ?? '') !== '')} onClick={pronto}>
          Pronto
        </button>
      </div>
    </div>
  );
}
