import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { House, Plus, Sparkles, Target, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { AdicionarMov, abrirAdicionar } from '../gs/AdicionarMov';
import { getName, painelToken } from '../painel';
import { useVisualDoApp } from '../gs/visual';
import { Moeda } from './ui/Moeda';
import { useEstado } from '../gs/store';

/* ---------- A casca do app: 5 abas (embaixo no celular, no topo no PC) ---------- */
// Início (como estou hoje?) · Meu mês (pra onde foi?) · Ferramentas (o que faço?) · Investir · Assistentes.
// O avatar abre "Meus dados". As páginas públicas (guias, termos, landing) mantêm a barra de sempre.

export const NAV: [string, string, LucideIcon][] = [
  ['/', 'Início', House],
  ['/mes', 'Meu dinheiro', Wallet],
  ['/plano', 'Planejar', Target],
  ['/evolucao', 'Evolução', TrendingUp],
  ['/coach', 'Coach', Sparkles],
];

// rotas-irmãs acendem a mesma aba
const IGUAIS: Record<string, string[]> = { '/': ['/', '/inicio'], '/mes': ['/mes', '/meu-mes'], '/plano': ['/plano', '/missoes', '/investir'], '/coach': ['/coach', '/assistentes', '/agentes', '/conselheiros'] };
function useAceso(): (to: string) => boolean {
  const { pathname } = useLocation();
  return (to) => (IGUAIS[to] ?? [to]).some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
}

function inicialDo(nome?: string | null) {
  return ((nome ?? '').trim().charAt(0) || 'V').toUpperCase();
}

/** Dentro do app: visual areia e dourado. */
function Casca({ children }: { children: ReactNode }) {
  const aceso = useAceso();
  const { config } = useEstado();
  const nome = config.nome || getName() || '';
  return (
    <div className="gs-casca">
      <header className="gs-topo">
        <div className="gs-topo-in">
          <Link to="/" className="gs-marca" aria-label="Grana Séria, início">
            <Moeda tamanho={30} />
            <span>Grana Séria</span>
          </Link>
          <nav className="gs-abas-topo" aria-label="Seções">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={() => (aceso(to) ? 'on' : '')}>
                {label}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="gs-btn pequeno gs-add-topo" hidden={!config.onboardingFeito} onClick={() => abrirAdicionar()}>
            <Plus size={16} aria-hidden="true" /> Adicionar movimentação
          </button>
          <Link to="/dados" className="gs-avatar" aria-label="Meus dados">
            {inicialDo(nome)}
          </Link>
        </div>
      </header>
      <main className="gs-principal">{children}</main>
      {config.onboardingFeito && (
        <button type="button" className="gs-fab" onClick={() => abrirAdicionar()} aria-label="Adicionar movimentação">
          <Plus size={26} aria-hidden="true" />
        </button>
      )}
      <AdicionarMov />
      <nav className="gs-abas" aria-label="Seções">
        {NAV.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} className={() => (aceso(to) ? 'on' : '')} aria-label={label}>
            <Icon size={22} strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Quem ainda não entrou: cabeçalho enxuto (marca, guias, entrar), sem abas, e o rodapé com os avisos. */
function CascaPublica({ children }: { children: ReactNode }) {
  return (
    <div className="gs-casca">
      <header className="gs-topo">
        <div className="gs-topo-in">
          <Link to="/" className="gs-marca" aria-label="Grana Séria, início">
            <Moeda tamanho={30} />
            <span>Grana Séria</span>
          </Link>
          <nav className="gs-abas-topo" aria-label="Seções" style={{ display: 'flex' }}>
            <NavLink to="/guias">Guias</NavLink>
            <NavLink to="/planos">Planos</NavLink>
          </nav>
          <Link className="gs-btn pequeno" to="/entrar">Entrar</Link>
        </div>
      </header>
      <main className="gs-principal">{children}</main>
      <footer className="gs-rodape">
        <p>
          <Link to="/guias">Guias</Link> · <Link to="/planos">Planos</Link> · <Link to="/politica-de-privacidade">Privacidade</Link> · <Link to="/termos-de-uso">Termos</Link> · <Link to="/sobre">Sobre e avisos</Link>
        </p>
        <p>Grana Séria · conteúdo educacional, não é consultoria financeira · CNPJ 69.557.683/0001-89</p>
      </footer>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode; wide?: boolean }) {
  const app = useVisualDoApp();
  return app && Boolean(painelToken()) ? <Casca>{children}</Casca> : <CascaPublica>{children}</CascaPublica>;
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
