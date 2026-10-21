import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, House, Plus, UserRound, Users, Wallet, type LucideIcon } from 'lucide-react';
import { getName, painelToken } from '../painel';
import { primeiroNome } from '../eu';
import { abrirAnotar } from '../lib/anotar';
import { Moeda } from './ui/Moeda';
import { BrandMark } from './Layout';
import { useVisualDoApp } from '../lib/visual';

/* ---------- A casca do app: as mesmas 4 abas no topo (PC) e embaixo (celular) ---------- */
// Os agentes são o coração do app: Início (como estou hoje?), Agentes (quem cuida do quê?), Meu mês (pra onde foi?)
// e Plano (o que faço?). Não há lista de ferramentas: cada tela de cálculo abre de dentro do agente dela.

export const NAV: [string, string, LucideIcon][] = [
  ['/', 'Início', House],
  ['/conselheiros', 'Agentes', Users],
  ['/mes', 'Meu mês', Wallet],
  ['/missoes', 'Missões', ClipboardList],
];

// os nomes novos da spec v2 apontam pras mesmas telas: o item do menu fica aceso nos dois
const IGUAIS: Record<string, string[]> = { '/': ['/', '/inicio'], '/conselheiros': ['/conselheiros', '/agentes'], '/mes': ['/mes', '/meu-mes'], '/missoes': ['/missoes', '/plano'] };
function useAceso(): (to: string) => boolean {
  const { pathname } = useLocation();
  return (to) => (IGUAIS[to] ?? [to]).some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
}

function TopBar() {
  const aceso = useAceso();
  const logged = Boolean(painelToken());
  const name = primeiroNome(getName());
  return (
    <header className="shell-top">
      <div className="shell-top-in">
        <Link to="/" className="shell-brand" aria-label="Grana Séria, início">
          <span className="brand-antiga"><BrandMark /></span>
          <Moeda tamanho={28} className="brand-ouro" />
          <span>Grana Séria</span>
        </Link>
        <nav className="shell-links" aria-label="Seções">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={() => (aceso(to) ? 'on' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <Link className={logged ? 'shell-me' : 'shell-login'} to={logged ? '/perfil' : '/entrar'} aria-label={logged ? 'Meu perfil' : 'Entrar'}>
          {logged ? <span className="shell-avatar">{(name || 'V').charAt(0).toUpperCase()}</span> : <UserRound size={16} />}
          <span>{logged ? name || 'Minha conta' : 'Entrar'}</span>
        </Link>
      </div>
    </header>
  );
}

/** Celular: no app, barra flutuante com o "+ Anotar" no meio; fora dele (landing), a barra de sempre. */
function BottomNav({ ouro }: { ouro: boolean }) {
  const aceso = useAceso();
  const item = ([to, label, Icon]: (typeof NAV)[number]) => {
    const on = aceso(to);
    return (
      <NavLink key={to} to={to} end={to === '/'} className={() => (on ? 'on' : '')} aria-label={label}>
        <Icon size={22} strokeWidth={1.75} fill={on && ouro ? 'currentColor' : 'none'} fillOpacity={on && ouro ? 0.16 : 0} />
        <span>{label}</span>
      </NavLink>
    );
  };
  if (!ouro)
    return (
      <nav className="shell-bottom" aria-label="Seções">
        {NAV.map(item)}
      </nav>
    );
  return (
    <nav className="shell-bottom flutuante" aria-label="Seções">
      {NAV.slice(0, 2).map(item)}
      <button type="button" className="nav-anotar" aria-label="Anotar um gasto ou entrada" onClick={() => abrirAnotar({ origem: 'barra' })}>
        <Plus size={26} strokeWidth={2} />
      </button>
      {NAV.slice(2).map(item)}
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
  const ouro = useVisualDoApp();
  return (
    <div className={`shell ${ouro ? 'no-app' : ''}`}>
      <TopBar />
      <main className={`shell-main ${wide ? 'wide' : ''}`}>{children}</main>
      <MiniFooter />
      <BottomNav ouro={ouro} />
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
