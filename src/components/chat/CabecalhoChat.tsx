import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Calculator, ListChecks, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { AGENTS } from '../../agents';
import { getTool } from '../../tools';
import type { AgenteId } from '../../chat/engine';
import type { InfoAgente } from '../../chat/agentes';
import { Medalhao } from '../ui/Medalhao';

/* ---------- Cabeçalho do chat (design 6.5): translúcido, medalhão com o ponto "online", ↺ e o menu ⋯ ---------- */

/** A calculadora do agente (/ferramentas/<slug>), ou null se ele não tem. */
export function calculadoraDo(agente: AgenteId): string | null {
  const tool = AGENTS.find((a) => a.id === agente)?.tool;
  if (!tool) return null;
  const t = getTool(tool);
  return t ? `/ferramentas/${t.slug}` : null;
}

export function CabecalhoChat({
  agente,
  info,
  podeRecomecar,
  temMissao,
  onVoltar,
  onRecomecar,
  onVerMissao,
  onCalculadora,
  onApagar,
}: {
  agente: AgenteId;
  info: InfoAgente;
  podeRecomecar: boolean;
  temMissao: boolean;
  onVoltar: () => void;
  onRecomecar: () => void;
  onVerMissao: () => void;
  onCalculadora: (() => void) | null;
  onApagar: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // menu aberto: foco no primeiro item, Esc fecha (e devolve o foco ao ⋯), tocar fora fecha
  useEffect(() => {
    if (!menu) return;
    caixa.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMenu(false);
        botao.current?.focus();
      }
    };
    const onFora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!caixa.current?.contains(alvo) && !botao.current?.contains(alvo)) setMenu(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onFora);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onFora);
    };
  }, [menu]);

  const escolher = (acao: () => void) => () => {
    setMenu(false);
    acao();
  };

  return (
    <header className="cc-head">
      <div className="cc-head-linha">
        <button type="button" className="cc-close" aria-label="Voltar" onClick={onVoltar}>
          <ArrowLeft size={20} strokeWidth={1.9} />
        </button>
        <span className="cc-quem-foto">
          <Medalhao id={agente} nome={info.nome} tamanho={40} />
          <span className="cc-online" title="Online" />
        </span>
        <span className="cc-who">
          <b>{info.nome}</b>
          <small>
            <span className="sr-only">Online. </span>
            {info.titulo}
          </small>
        </span>
        <button type="button" className="cc-icon" aria-label="Recomeçar a conversa" disabled={!podeRecomecar} onClick={onRecomecar}>
          <RotateCcw size={18} strokeWidth={1.9} />
        </button>
        <div className="cc-menu-wrap">
          <button ref={botao} type="button" className="cc-icon" aria-label="Mais opções" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <MoreHorizontal size={20} strokeWidth={1.9} />
          </button>
          {menu && (
            <div ref={caixa} className="cc-menu" role="menu" aria-label="Opções da conversa">
              <button type="button" role="menuitem" disabled={!temMissao} onClick={escolher(onVerMissao)}>
                <ListChecks size={17} strokeWidth={1.9} aria-hidden="true" /> Ver missão
              </button>
              {onCalculadora && (
                <button type="button" role="menuitem" onClick={escolher(onCalculadora)}>
                  <Calculator size={17} strokeWidth={1.9} aria-hidden="true" /> Abrir a calculadora
                </button>
              )}
              <button type="button" role="menuitem" className="danger" disabled={!podeRecomecar} onClick={escolher(onApagar)}>
                <Trash2 size={17} strokeWidth={1.9} aria-hidden="true" /> Apagar conversa
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
