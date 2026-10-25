import { useEffect, useState } from 'react';

/* ---------- Convite discreto: "Adicionar à tela inicial" (só onde o navegador deixa) ---------- */

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const DISPENSADO = 'grana-seria:instalar-dispensado';

export function InstalarApp() {
  const [ev, setEv] = useState<EventoInstalar | null>(null);
  useEffect(() => {
    try {
      if (localStorage.getItem(DISPENSADO)) return;
    } catch {
      return;
    }
    const on = (e: Event) => {
      e.preventDefault();
      setEv(e as EventoInstalar);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (!ev) return null;
  const fechar = () => {
    try {
      localStorage.setItem(DISPENSADO, '1');
    } catch {
      // sem localStorage
    }
    setEv(null);
  };
  return (
    <div className="gs-banner" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1 }}>Quer o app na tela inicial?</span>
      <button type="button" className="gs-btn pequeno" onClick={() => void ev.prompt().then(() => ev.userChoice).finally(fechar)}>Adicionar</button>
      <button type="button" className="gs-btn link" onClick={fechar}>Agora não</button>
    </div>
  );
}
