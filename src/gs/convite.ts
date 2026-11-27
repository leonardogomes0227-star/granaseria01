// O convite da pessoa (link ?convite=CÓDIGO, guardado no aparelho) ainda vale? Só então os planos abrem.
import { useEffect, useState } from 'react';

export interface Convite { valido: boolean; ate: string | null }
const CHAVE = 'gs-convite';
const guardar = (v: string) => { try { localStorage.setItem(CHAVE, v); } catch { /* sem storage */ } };
const ler = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };

export const AVISO_CONVITE = 'gs-convite-liberado';

/** Guarda o código e avisa a página, para os planos abrirem sem recarregar. */
export function marcarConvite(codigo: string) {
  guardar(codigo.toUpperCase());
  window.dispatchEvent(new Event(AVISO_CONVITE));
}

export function useConvite(): Convite {
  const [c, setC] = useState<Convite>({ valido: false, ate: null });
  useEffect(() => {
    let vivo = true;
    const checar = () => {
      const codigo = (new URLSearchParams(window.location.search).get('convite') ?? ler() ?? '').toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(codigo)) return;
      fetch(`/api/fila?convite=${codigo}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: Convite | null) => { if (vivo && j?.valido) { guardar(codigo); setC(j); } })
        .catch(() => undefined);
    };
    checar();
    window.addEventListener(AVISO_CONVITE, checar);
    return () => { vivo = false; window.removeEventListener(AVISO_CONVITE, checar); };
  }, []);
  return c;
}
