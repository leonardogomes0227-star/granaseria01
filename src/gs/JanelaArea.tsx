// A moldura das áreas do app no jeito do painel do Início: janela de vidro, título que embaralha, abas com a pílula que estica.
// Só organiza o que já existe em abas; nenhuma função muda.
import { useEffect, useState, type PointerEvent as PE, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Abas, useEmbaralhar } from './PainelVideo';
import { tocar } from './sons';
import './painelVideo.css';
import './painelRv.css';

export interface AbaDef<T extends string> { id: T; rotulo: string; Icone?: LucideIcon; n?: number }

export function JanelaArea<T extends string>({ titulo, sub, abas, acoes, children }: { titulo: string; sub?: ReactNode; abas: AbaDef<T>[]; acoes?: ReactNode; children: (aba: T) => ReactNode }) {
  const [aba, setAba] = useState<T>(abas[0].id);
  const t = useEmbaralhar(titulo);
  useEffect(() => { const id = setTimeout(() => tocar('subir'), 120); return () => clearTimeout(id); }, []);
  const seguir = (ev: PE<HTMLDivElement>) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('.pv-p, .pv-kpi, .rv-card, .pu-kpi, .pu-vidro, .cm-card, .gs-card');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
    el.style.setProperty('--my', `${ev.clientY - r.top}px`);
  };
  return (
    <div className="pv rv rv-area" onPointerMove={seguir}>
      <i className="pv-halo" aria-hidden="true" />
      <div className="pv-ph">
        <div>
          <h1 className="rv-titulo">{t}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {acoes && <div className="pv-acoes">{acoes}</div>}
      </div>
      {abas.length > 1 && <Abas<T> itens={abas} valor={aba} onMudar={setAba} />}
      <div className="rv-pagina" key={aba}>{children(aba)}</div>
    </div>
  );
}
