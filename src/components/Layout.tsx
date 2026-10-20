import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUp, ChevronDown, LayoutGrid, Menu, UserRound, X } from 'lucide-react';
import { LISTED_TOOLS as TOOLS, ToolId, ToolInfo } from '../tools';
import { accountsEnabled } from '../supabase';
import { painelToken } from '../painel';

/** Conectado pelo WhatsApp: "Meu painel". Ainda não: "Entrar" (o login é pelo WhatsApp, sem senha). */
const painelLabel = () => (painelToken() ? 'Meu painel' : 'Entrar');

export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#BD7E1E" />
      <circle cx="20" cy="20" r="18" fill="none" stroke="#7A5311" strokeWidth="1.5" />
      <path d="M11 26h18M13.5 21h13M16 16h8" stroke="#5A3A0A" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

export function ToolIcon({ tool, size = 'md' }: { tool: ToolInfo; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = tool.icon;
  const px = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;
  return (
    <span className={`tool-icon tone-${tool.tone} ${size === 'md' ? '' : size}`}>
      <Icon size={px} strokeWidth={1.9} />
    </span>
  );
}

function ToolMenuItem({ tool, onClick }: { tool: ToolInfo; onClick: () => void }) {
  return (
    <button type="button" className="mega-item" onClick={onClick}>
      <ToolIcon tool={tool} size="sm" />
      <span>
        <b>{tool.title}</b>
        <span className="desc">{tool.description}</span>
      </span>
    </button>
  );
}

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

export function SiteHeader({
  onStart,
  onOpenTool,
}: {
  onStart: () => void;
  onOpenTool: (id: ToolId) => void;
}) {
  const scrolled = useScrolled();
  const [megaOpen, setMegaOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeTimer = useRef<number>();
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMegaOpen(false);
        setDrawerOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const openMega = () => {
    window.clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = window.setTimeout(() => setMegaOpen(false), 140);
  };

  const pickTool = (id: ToolId) => {
    setMegaOpen(false);
    setDrawerOpen(false);
    onOpenTool(id);
  };

  return (
    <>
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <nav className="site-nav">
          <a href="#topo" className="brand" aria-label="Grana Séria — início">
            <BrandMark />
            <span className="logo">Grana Séria</span>
          </a>

          <div className="navlinks">
            <div className="dropdown-wrap" ref={dropRef} onMouseEnter={openMega} onMouseLeave={scheduleClose}>
              <button
                type="button"
                className={`navlink ${megaOpen ? 'open' : ''}`}
                aria-expanded={megaOpen}
                onClick={() => setMegaOpen((v) => !v)}
              >
                Ferramentas <ChevronDown size={15} className="chev" />
              </button>
              <div className={`mega ${megaOpen ? 'open' : ''}`} role="menu">
                <div className="mega-grid">
                  {TOOLS.map((t) => (
                    <ToolMenuItem key={t.id} tool={t} onClick={() => pickTool(t.id)} />
                  ))}
                </div>
                <div className="mega-foot">
                  <span>Comece pelo diagnóstico — ele alimenta as ferramentas.</span>
                  <button type="button" onClick={() => { setMegaOpen(false); onStart(); }}>
                    Fazer diagnóstico <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
            <a className="navlink" href="/#como-funciona">Como funciona</a>
            <a className="navlink" href="/#duvidas">Dúvidas</a>
          </div>

          <div className="nav-right">
            <Link className="nav-cta" to="/painel">
              {painelToken() ? <LayoutGrid size={15} /> : <UserRound size={15} />} {painelLabel()}
            </Link>
            <button type="button" className="menu-btn" aria-label="Abrir menu" onClick={() => setDrawerOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
        </nav>
      </header>

      {drawerOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="drawer" aria-label="Menu">
            <div className="drawer-head">
              <span className="brand">
                <BrandMark />
                <span className="logo">Grana Séria</span>
              </span>
              <button type="button" className="menu-btn" style={{ display: 'inline-flex' }} aria-label="Fechar menu" onClick={() => setDrawerOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <Link className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} to="/painel" onClick={() => setDrawerOpen(false)}>
              {painelToken() ? 'Abrir meu painel' : 'Entrar com WhatsApp'} <ArrowRight size={16} className="arrow" />
            </Link>
            <button type="button" className="btn-outline" style={{ width: '100%', marginTop: 10, justifyContent: 'center' }} onClick={() => { setDrawerOpen(false); onStart(); }}>
              Fazer meu diagnóstico
            </button>
            <p className="drawer-label">Ferramentas</p>
            <div className="stagger">
              {TOOLS.map((t) => (
                <ToolMenuItem key={t.id} tool={t} onClick={() => pickTool(t.id)} />
              ))}
            </div>
            <p className="drawer-label">Mais</p>
            <a className="drawer-link" href="/#como-funciona" onClick={() => setDrawerOpen(false)}>Como funciona</a>
            <a className="drawer-link" href="/#duvidas" onClick={() => setDrawerOpen(false)}>Dúvidas frequentes</a>
            <Link className="drawer-link" to="/guias">Guias</Link>
            {accountsEnabled && <Link className="drawer-link" to="/conta">Minha conta</Link>}
          </aside>
        </>
      )}
    </>
  );
}

/** Barra fina usada dentro do diagnóstico e das ferramentas — sempre dá pra voltar ao início. */
export function AppBar({ onHome }: { onHome: () => void }) {
  return (
    <header className="app-bar">
      <nav className="site-nav">
        <button type="button" className="brand" onClick={onHome} aria-label="Voltar ao início">
          <BrandMark />
          <span className="logo">Grana Séria</span>
        </button>
        <div className="nav-right">
          <Link className="btn-ghost" to="/painel">
            {painelToken() ? <LayoutGrid size={16} /> : <UserRound size={16} />} {painelToken() ? 'Painel' : 'Entrar'}
          </Link>
          <button type="button" className="btn-ghost" onClick={onHome}>
            <ArrowLeft size={16} /> Início
          </button>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter({ onStart, onOpenTool }: { onStart: () => void; onOpenTool: (id: ToolId) => void }) {
  return (
    <footer className="site-footer">
      <div className="foot-grid">
        <div className="foot-brand">
          <div className="brand">
            <BrandMark />
            <div className="logo">Grana Séria</div>
          </div>
          <p>Um diagnóstico financeiro baseado nos princípios de O Homem Mais Rico da Babilônia.</p>
        </div>
        <div className="foot-col">
          <h4>Ferramentas</h4>
          {TOOLS.slice(0, 4).map((t) => (
            <button type="button" key={t.id} onClick={() => onOpenTool(t.id)}>{t.title}</button>
          ))}
        </div>
        <div className="foot-col">
          <h4>Comece</h4>
          <button type="button" onClick={onStart}>Fazer diagnóstico</button>
          <Link to="/#como-funciona">Como funciona</Link>
          <Link to="/#duvidas">Dúvidas frequentes</Link>
          <Link to="/guias">Guias</Link>
          {accountsEnabled && <Link to="/conta">Minha conta</Link>}
        </div>
        <div className="foot-col">
          <h4>Legal</h4>
          <Link to="/politica-de-privacidade">Política de privacidade</Link>
          <Link to="/termos-de-uso">Termos de uso</Link>
        </div>
      </div>
      <p className="foot-bottom">
        © {new Date().getFullYear()} Grana Séria. Não somos uma consultoria financeira registrada; o conteúdo é
        educacional, baseado nos princípios do livro O Homem Mais Rico da Babilônia.
      </p>
      <p className="foot-bottom">
        69.557.683 LEONARDO GOMES BALOQUE · CNPJ 69.557.683/0001-89 · <Link className="foot-admin" to="/admin">Painel</Link>
      </p>
    </footer>
  );
}

export function BackToTop() {
  const show = useScrolled(900);
  return (
    <button
      type="button"
      className={`to-top ${show ? 'show' : ''}`}
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUp size={18} />
    </button>
  );
}
