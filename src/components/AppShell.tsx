import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { House, MessageCircle, UserRound, type LucideIcon } from 'lucide-react';
import { getName, painelToken } from '../painel';
import { BrandMark } from './Layout';

/* ---------- A casca do app: as mesmas 4 abas no topo (PC) e embaixo (celular) ---------- */
// O coach é o coração do app: Início (o plano e como estou) e Coach (a conversa). O resto vive dentro do chat.

export const NAV: [string, string, LucideIcon][] = [
  ['/inicio', 'Início', House],
  ['/coach', 'Coach', MessageCircle],
];

function TopBar() {
  const logged = Boolean(painelToken());
  const name = getName();
  return (
    <header className="shell-top">
      <div className="shell-top-in">
        <Link to="/inicio" className="shell-brand" aria-label="Grana Séria, início">
          <BrandMark />
          <span>Grana Séria</span>
        </Link>
        <nav className="shell-links" aria-label="Seções">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'on' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <Link className={logged ? 'shell-me' : 'shell-login'} to={logged ? '/conta' : '/entrar'}>
          {logged ? <span className="shell-avatar">{(name || 'V').charAt(0).toUpperCase()}</span> : <UserRound size={16} />}
          <span>{logged ? name || 'Minha conta' : 'Entrar'}</span>
        </Link>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="shell-bottom" aria-label="Seções">
      {NAV.map(([to, label, Icon]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'on' : '')}>
          <Icon size={21} strokeWidth={1.9} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function MiniFooter() {
  return (
    <footer className="shell-foot">
      <p>
        <Link to="/guias">Guias</Link> · <Link to="/politica-de-privacidade">Privacidade</Link> · <Link to="/termos-de-uso">Termos</Link> ·{' '}
        <Link to="/admin" className="foot-admin">Painel</Link>
      </p>
      <p>Grana Séria · conteúdo educacional, não é consultoria financeira · CNPJ 69.557.683/0001-89</p>
    </footer>
  );
}

/** Página do app: barra no topo, conteúdo, rodapé curto e as abas embaixo no celular. */
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="shell">
      <TopBar />
      <main className={`shell-main ${wide ? 'wide' : ''}`}>{children}</main>
      <MiniFooter />
      <BottomNav />
    </div>
  );
}

/** Título de cada página: curto, com uma linha embaixo se precisar. */
export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </div>
  );
}
