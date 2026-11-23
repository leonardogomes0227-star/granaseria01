// A reserva de emergência como pilha de moedas e barras de ouro em 3D: cresce conforme a pessoa guarda.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { brl0, mesDe } from './datas';
import { mascarar, useOculto } from './privacidade';
import { patrimonioGuardado, reservaMeta } from './selectores';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import type { CenaOuro } from './ouro3d';

export function ReservaOuro() {
  const e = useEstado();
  const hoje = useHoje();
  const oculto = useOculto();
  const mes = mesDe(hoje);
  const guardado = Math.max(0, patrimonioGuardado(e));
  const meta = reservaMeta(e, mes);
  const pct = meta > 0 ? Math.min(1, guardado / meta) : 0;
  const pilha = useMemo(() => ({ moedas: 6 + Math.round(pct * 22), barras: Math.min(4, Math.floor(pct * 4)) }), [pct]);
  const palco = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaOuro | null>(null);
  const pilhaRef = useRef(pilha); pilhaRef.current = pilha;
  const [semWebgl, setSemWebgl] = useState(false);
  useEffect(() => {
    let cancelado = false;
    void import('./ouro3d').then((m) => {
      if (cancelado || !palco.current) return;
      if (!m.webglDisponivel()) { setSemWebgl(true); return; }
      try { cena.current = m.criarCena(palco.current); cena.current.definir(pilhaRef.current); } catch { setSemWebgl(true); }
    }).catch(() => setSemWebgl(true));
    return () => { cancelado = true; cena.current?.destruir(); cena.current = null; };
  }, []);
  useEffect(() => { cena.current?.definir(pilha); }, [pilha]);
  const v = (n: number) => (oculto ? mascarar(brl0(n), true) : brl0(n));
  return (
    <section className="ro" aria-label="Sua reserva" onPointerMove={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); cena.current?.inclinar((ev.clientX - r.left) / Math.max(1, r.width), (ev.clientY - r.top) / Math.max(1, r.height)); }}>
      <div className="ro-texto">
        <small>Sua reserva</small>
        <b>{v(guardado)}</b>
        <span>{meta > 0 ? `${Math.round(pct * 100)}% de ${v(meta)}` : 'Defina quanto você gasta por mês para ver a meta'}</span>
        <div className="ro-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Reserva de emergência"><i style={{ width: `${Math.max(3, pct * 100)}%` }} /></div>
        <Link to="/plano/reserva">Guardar agora<ChevronRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className="ro-ouro" ref={palco} aria-hidden="true">{semWebgl && <i>S</i>}</div>
    </section>
  );
}
