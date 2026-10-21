import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ---------- Confirmação curta (spec v2, seção 8): só pra apagar missão/conversa, recomeçar e recomeçar do zero ---------- */
// "digitar": a pessoa precisa escrever a palavra (ex.: RECOMEÇAR) pro botão funcionar.

export function Confirmar({
  aberto,
  titulo,
  texto,
  confirmar,
  perigo = false,
  digitar,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo: string;
  texto: ReactNode;
  confirmar: string;
  perigo?: boolean;
  digitar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [escrito, setEscrito] = useState('');
  const primeiro = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  useEffect(() => {
    if (!aberto) return;
    setEscrito('');
    const t = window.setTimeout(() => primeiro.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [aberto, onCancelar]);
  if (!aberto) return null;
  const pode = !digitar || escrito.trim().toLocaleUpperCase('pt-BR') === digitar.toLocaleUpperCase('pt-BR');
  return (
    <div className="dialog-fundo" onClick={onCancelar}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-titulo" onClick={(e) => e.stopPropagation()}>
        <h2 id="dialog-titulo">{titulo}</h2>
        <div className="dialog-texto">{texto}</div>
        {digitar && (
          <label className="dialog-digitar">
            <span>
              Para confirmar, digite <b>{digitar}</b>
            </span>
            <input
              ref={(el) => {
                primeiro.current = el;
              }}
              className="field-input"
              value={escrito}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(e) => setEscrito(e.target.value)}
              aria-label={`Digite ${digitar}`}
            />
          </label>
        )}
        <div className="dialog-acoes">
          <button
            type="button"
            className="btn-ghost"
            ref={(el) => {
              if (!digitar) primeiro.current = el;
            }}
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button type="button" className={perigo ? 'btn-danger' : 'btn-primary'} disabled={!pode} onClick={onConfirmar}>
            {confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
