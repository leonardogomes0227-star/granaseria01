import { useEffect, useState } from 'react';
import { tipoDoAviso, tocar } from '../../gs/sons';

/* ---------- Toast (spec v2, seções 8 e 10): canto de baixo, 5 s, com ação ("Desfazer") ---------- */
// Um só na tela: o novo substitui o anterior (e o anterior se confirma, ex.: o apagar vira definitivo).

export interface ToastAcao {
  rotulo: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  texto: string;
  acao?: ToastAcao;
  duracao: number;
  aoSumir?: () => void; // quando some sem a ação ser tocada (ex.: confirmar o apagar no servidor)
}

let atual: ToastItem | null = null;
const ouvintes = new Set<(t: ToastItem | null) => void>();
let seq = 0;
let timer: number | undefined;

function emitir(t: ToastItem | null) {
  atual = t;
  ouvintes.forEach((f) => f(t));
}

function encerrar(chamarAoSumir: boolean) {
  window.clearTimeout(timer);
  const t = atual;
  emitir(null);
  if (chamarAoSumir) t?.aoSumir?.();
}

/** Mostra um toast. Devolve uma função que fecha. */
export function toast(texto: string, opts: { acao?: ToastAcao; duracao?: number; aoSumir?: () => void } = {}): () => void {
  if (atual) encerrar(true); // o anterior se confirma
  const t: ToastItem = { id: ++seq, texto, acao: opts.acao, duracao: opts.duracao ?? 5000, aoSumir: opts.aoSumir };
  emitir(t);
  const som = tipoDoAviso(texto);
  if (som) tocar(som);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gs-aviso', { detail: texto }));
  timer = window.setTimeout(() => {
    if (atual?.id === t.id) encerrar(true);
  }, t.duracao);
  return () => {
    if (atual?.id === t.id) encerrar(true);
  };
}

/**
 * "Apagado · Desfazer": some da tela na hora, e só vira definitivo quando o toast some (5 s).
 * Se a página for fechada antes, o definitivo roda na saída.
 */
export function apagarComDesfazer(texto: string, desfazer: () => void, definitivo?: () => void) {
  let feito = false;
  const confirmar = () => {
    if (feito) return;
    feito = true;
    window.removeEventListener('pagehide', confirmar);
    definitivo?.();
  };
  window.addEventListener('pagehide', confirmar);
  toast(texto, {
    acao: {
      rotulo: 'Desfazer',
      onClick: () => {
        feito = true;
        window.removeEventListener('pagehide', confirmar);
        desfazer();
      },
    },
    aoSumir: confirmar,
  });
}

export function Toaster() {
  const [t, setT] = useState<ToastItem | null>(atual);
  useEffect(() => {
    ouvintes.add(setT);
    return () => {
      ouvintes.delete(setT);
    };
  }, []);
  if (!t) return null;
  return (
    <div className="toast" role="status" aria-live="polite" key={t.id}>
      <span>{t.texto}</span>
      <span className="toast-tempo" aria-hidden="true">
        <i style={{ animationDuration: `${t.duracao}ms` }} />
      </span>
      {t.acao && (
        <button
          type="button"
          onClick={() => {
            const a = t.acao;
            encerrar(false);
            a?.onClick();
          }}
        >
          {t.acao.rotulo}
        </button>
      )}
    </div>
  );
}
