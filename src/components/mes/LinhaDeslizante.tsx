import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { poucoMovimento, vibrar } from '../../lib/celebrar';

/* ---------- Linha com "Editar" e "Apagar" (spec v2, seção 8) ---------- */
// Celular: deslizar pra esquerda apaga, pra direita edita. PC: o menu ⋯ aparece ao passar o mouse (ou com o foco).
// O gesto só vale na horizontal: rolar a página continua normal (touch-action: pan-y).

const LIMIAR = 88; // quanto arrastar (px) pra valer

interface Toque {
  id: number;
  x: number;
  y: number;
  dx: number;
  horizontal: boolean | null; // null: ainda não deu pra saber
}

export function LinhaDeslizante({
  nome,
  onEditar,
  onApagar,
  children,
  depois,
  className = '',
  style,
}: {
  nome: string; // pra o leitor de tela: "Mais ações: Aluguel"
  onEditar?: () => void;
  onApagar?: () => void;
  children: ReactNode;
  depois?: ReactNode; // embaixo da linha, fora do gesto (ex.: o formulário de editar)
  className?: string;
  style?: CSSProperties;
}) {
  const frente = useRef<HTMLDivElement>(null);
  const toque = useRef<Toque | null>(null);
  const arrastou = useRef(false);
  const botao = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState<'editar' | 'apagar' | null>(null);
  const [menu, setMenu] = useState(false);

  // menu aberto: fecha ao tocar fora; o foco vai pro primeiro item
  useEffect(() => {
    if (!menu) return;
    const fora = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', fora);
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => document.removeEventListener('pointerdown', fora);
  }, [menu]);

  const posicionar = (dx: number, animar: boolean) => {
    const el = frente.current;
    if (!el) return;
    el.style.transition = animar && !poucoMovimento() ? 'transform 0.22s var(--curva)' : 'none';
    el.style.transform = dx ? `translateX(${dx}px)` : '';
  };
  const voltar = () => {
    posicionar(0, true);
    window.setTimeout(() => setLado(null), poucoMovimento() ? 0 : 220);
  };

  const pode = Boolean(onEditar || onApagar);

  const aoDescer = (e: React.PointerEvent) => {
    if (!pode || (e.pointerType === 'mouse' && e.button !== 0)) return;
    toque.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, horizontal: null };
    arrastou.current = false;
  };
  const aoMover = (e: React.PointerEvent) => {
    const t = toque.current;
    if (!t || t.id !== e.pointerId) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (t.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      t.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!t.horizontal) {
        toque.current = null; // é rolagem
        return;
      }
      arrastou.current = true;
      try {
        frente.current?.setPointerCapture(e.pointerId);
      } catch {
        // sem captura: segue assim mesmo
      }
    }
    // lado sem ação: resiste
    const livre = (dx > 0 && onEditar) || (dx < 0 && onApagar);
    t.dx = livre ? dx : dx * 0.15;
    posicionar(t.dx, false);
    const novo = t.dx > 4 ? 'editar' : t.dx < -4 ? 'apagar' : null;
    setLado((l) => (l === novo ? l : novo));
  };
  const aoSubir = (e: React.PointerEvent) => {
    const t = toque.current;
    toque.current = null;
    if (!t || t.id !== e.pointerId || !t.horizontal) return;
    if (t.dx <= -LIMIAR && onApagar) {
      vibrar(15);
      // sai pela esquerda e some (o toast traz de volta)
      posicionar(-(frente.current?.offsetWidth ?? 400), true);
      window.setTimeout(() => {
        onApagar();
        posicionar(0, false);
        setLado(null);
      }, poucoMovimento() ? 0 : 200);
      return;
    }
    if (t.dx >= LIMIAR && onEditar) {
      vibrar(15);
      voltar();
      onEditar();
      return;
    }
    voltar();
  };
  const aoCancelar = () => {
    if (toque.current?.horizontal) voltar();
    toque.current = null;
  };

  const fecharMenu = (focar = true) => {
    setMenu(false);
    if (focar) botao.current?.focus();
  };
  const teclaMenu = (e: React.KeyboardEvent) => {
    const itens = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      fecharMenu();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      itens[(i + (e.key === 'ArrowDown' ? 1 : itens.length - 1)) % itens.length]?.focus();
    } else if (e.key === 'Tab') setMenu(false);
  };

  return (
    <li className={`linha-desl ${menu ? 'com-menu' : ''} ${className}`} style={style}>
      <div className="linha-trilho">
        {lado && (
          <div className={`linha-fundo ${lado}`} aria-hidden="true">
            {lado === 'editar' ? (
              <span><Pencil size={17} /> Editar</span>
            ) : (
              <span>Apagar <Trash2 size={17} /></span>
            )}
          </div>
        )}
        <div
          ref={frente}
          className="linha-frente"
          onPointerDown={aoDescer}
          onPointerMove={aoMover}
          onPointerUp={aoSubir}
          onPointerCancel={aoCancelar}
          onClickCapture={(e) => {
            // depois de arrastar, o toque não vira clique no botão de baixo
            if (arrastou.current) {
              e.preventDefault();
              e.stopPropagation();
              arrastou.current = false;
            }
          }}
        >
          {children}
          {pode && (
            <button ref={botao} type="button" className="linha-mais-btn" aria-label={`Mais ações: ${nome}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              <Ellipsis size={18} />
            </button>
          )}
        </div>
      </div>
      {menu && (
        <div ref={menuRef} className="linha-menu" role="menu" aria-label={`Ações: ${nome}`} onKeyDown={teclaMenu}>
          {onEditar && (
            <button type="button" role="menuitem" onClick={() => { fecharMenu(false); onEditar(); }}>
              <Pencil size={16} /> Editar
            </button>
          )}
          {onApagar && (
            <button type="button" role="menuitem" className="perigo" onClick={() => { fecharMenu(false); onApagar(); }}>
              <Trash2 size={16} /> Apagar
            </button>
          )}
        </div>
      )}
      {depois}
    </li>
  );
}
