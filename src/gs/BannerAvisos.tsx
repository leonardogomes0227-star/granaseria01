import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { avisosPendentes } from './avisosPendentes';
import { avisarUmaVez } from './avisos';

/* ---------- Avisos dentro do app (e na Notification API, quando a pessoa deixou) ---------- */

const DISPENSADOS = 'grana-seria:avisos-dispensados';

export function BannerAvisos() {
  const e = useEstado();
  const hoje = useHoje();
  const [fora, setFora] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(DISPENSADOS) || '{}') as { dia?: string; ids?: string[] };
      return v.dia === hoje ? v.ids ?? [] : [];
    } catch {
      return [];
    }
  });
  const itens = useMemo(() => avisosPendentes(e, hoje).filter((a) => !fora.includes(a.id)), [e, hoje, fora]);
  useEffect(() => {
    const agora = new Date().toTimeString().slice(0, 5);
    if (agora >= e.config.avisos.horario) for (const a of itens) avisarUmaVez(a.id, 'Grana Séria', a.texto, hoje);
  }, [itens, e.config.avisos.horario, hoje]);
  if (itens.length === 0) return null;
  const a = itens[0];
  return (
    <div className="gs-banner" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Bell size={18} aria-hidden="true" />
      <span style={{ flex: 1 }}>{a.texto}{itens.length > 1 ? ` (+${itens.length - 1})` : ''}</span>
      {a.rota && <Link to={a.rota} className="gs-btn link">Ver</Link>}
      <button
        type="button"
        className="gs-menu-pontos"
        aria-label="Dispensar aviso"
        onClick={() => {
          const ids = [...fora, a.id];
          setFora(ids);
          try {
            localStorage.setItem(DISPENSADOS, JSON.stringify({ dia: hoje, ids }));
          } catch {
            // sem localStorage
          }
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** Só dispara as notificações do navegador (quando a pessoa deixou), sem desenhar nada na tela. */
export function NotificadorAvisos() {
  const e = useEstado();
  const hoje = useHoje();
  const itens = useMemo(() => avisosPendentes(e, hoje), [e, hoje]);
  useEffect(() => {
    const agora = new Date().toTimeString().slice(0, 5);
    if (agora >= e.config.avisos.horario) for (const a of itens) avisarUmaVez(a.id, 'Grana Séria', a.texto, hoje);
  }, [itens, e.config.avisos.horario, hoje]);
  return null;
}
