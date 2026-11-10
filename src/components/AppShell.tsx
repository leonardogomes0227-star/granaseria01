import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bell, BookOpen, CalendarClock, CalendarDays, ChartColumn, Gift, ChartPie, House, Info, Landmark, Menu, Plus, Receipt, Sparkles, Target, Trash2, TrendingUp, UserRound, Wallet, type LucideIcon } from 'lucide-react';
import { AdicionarMov, abrirAdicionar } from '../gs/AdicionarMov';
import { getName, painelToken } from '../painel';
import { useVisualDoApp } from '../gs/visual';
import { Moeda } from './ui/Moeda';
import { useEstado } from '../gs/store';
import { useHoje } from '../gs/useHoje';
import { recomendacoes } from '../gs/coachRegras';
import { Folha } from '../gs/ui';

/* ---------- A casca do app: lateral no PC, barra de baixo no celular ---------- */
// Início · Lançamentos · Planejamento · Relatórios · Coach. O resto (contas fixas, calendário, investir, guias, dados…)
// fica em "Mais", sem sumir. As páginas públicas (guias, termos, landing) mantêm a barra de sempre.

export const NAV: [string, string, LucideIcon][] = [
  ['/', 'Início', House],
  ['/lancamentos', 'Lançamentos', Wallet],
  ['/plano', 'Planejamento', Target],
  ['/relatorios', 'Relatórios', ChartColumn],
  ['/coach', 'Coach', Sparkles],
];

/** Menu "Mais": tudo o que não é uma das 5 áreas, agrupado por finalidade. */
export const MAIS: { grupo: string; itens: [string, string, LucideIcon][] }[] = [
  { grupo: 'Dia a dia', itens: [['/lancamentos?aba=contas', 'Contas fixas', Receipt], ['/plano/atrasos?anotar=1', 'Anotar conta atrasada', CalendarClock], ['/plano/extras', 'Renda extra (13º, bônus, freela)', Gift], ['/plano/calendario', 'Calendário de contas', CalendarDays], ['/assistentes', 'Lembretes e assistentes', Bell]] },
  { grupo: 'Planejar e crescer', itens: [['/plano/orcamento', 'Orçamento', ChartPie], ['/plano/dividas', 'Dívidas', Landmark], ['/investir', 'Investir', TrendingUp]] },
  { grupo: 'Aprender e ajustar', itens: [['/guias', 'Guias', BookOpen], ['/dados', 'Meus dados', UserRound], ['/dados#limpar', 'Limpar meus dados', Trash2], ['/sobre', 'Sobre e avisos', Info]] },
];

// rotas-irmãs acendem a mesma aba
const IGUAIS: Record<string, string[]> = {
  '/': ['/', '/inicio'],
  '/lancamentos': ['/lancamentos', '/mes', '/meu-mes'],
  '/plano': ['/plano', '/planejamento', '/missoes', '/investir'],
  '/relatorios': ['/relatorios', '/evolucao'],
  '/coach': ['/coach', '/assistentes', '/agentes', '/conselheiros'],
};
function useAceso(): (to: string) => boolean {
  const { pathname } = useLocation();
  return (to) => (IGUAIS[to] ?? [to]).some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
}

function inicialDo(nome?: string | null) {
  return ((nome ?? '').trim().charAt(0) || 'V').toUpperCase();
}

/** Dentro do app: lateral (PC) ou barra de baixo (celular), sino de avisos e botão de adicionar. */
function Casca({ children }: { children: ReactNode }) {
  const aceso = useAceso();
  const e = useEstado();
  const hoje = useHoje();
  const [mais, setMais] = useState(false);
  const { pathname } = useLocation();
  const nome = e.config.nome || getName() || '';
  const avisos = useMemo(() => recomendacoes(e, hoje).filter((r) => r.tom === 'perigo' || r.tom === 'aviso').length, [e, hoje]);
  useEffect(() => setMais(false), [pathname]);
  const linksMais = MAIS.map((g) => (
    <div key={g.grupo} className="gs-mais-grupo">
      <span className="gs-rotulo">{g.grupo}</span>
      {g.itens.map(([to, label, Icon]) => (
        <Link key={to} to={to} className="gs-mais-link"><Icon size={18} strokeWidth={1.75} aria-hidden="true" />{label}</Link>
      ))}
    </div>
  ));
  return (
    <div className={`gs-casca gs-app2${e.config.onboardingFeito ? '' : ' gs-sem-menu'}`}>
      <aside className="gs-lateral" aria-label="Menu principal">
        <Link to="/" className="gs-marca" aria-label="Grana Séria, início"><Moeda tamanho={30} /><span>Grana Séria</span></Link>
        <nav aria-label="Seções">
          {NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={() => (aceso(to) ? 'on' : '')} aria-current={aceso(to) ? 'page' : undefined}>
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
        {e.config.onboardingFeito && <button type="button" className="gs-btn" onClick={() => abrirAdicionar()}><Plus size={16} aria-hidden="true" /> Adicionar</button>}
        <div className="gs-lateral-mais">{linksMais}</div>
      </aside>
      <div className="gs-coluna">
        <header className="gs-topo2">
          <Link to="/" className="gs-marca gs-marca-topo" aria-label="Grana Séria, início"><Moeda tamanho={28} /><span>Grana Séria</span></Link>
          <span className="gs-topo2-data">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <Link to="/coach" className="gs-icone-btn" aria-label={avisos ? `${avisos} avisos importantes` : 'Sem avisos importantes'}>
            <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
            {avisos > 0 && <i className="gs-sino-badge" aria-hidden="true">{avisos > 9 ? '9+' : avisos}</i>}
          </Link>
          <button type="button" className="gs-icone-btn gs-so-mobile" aria-label="Mais opções" aria-expanded={mais} onClick={() => setMais(true)}><Menu size={20} strokeWidth={1.75} aria-hidden="true" /></button>
          <Link to="/dados" className="gs-avatar" aria-label="Meus dados">{inicialDo(nome)}</Link>
        </header>
        <main className="gs-principal">{children}</main>
      </div>
      {e.config.onboardingFeito && (
        <button type="button" className="gs-fab" onClick={() => abrirAdicionar()} aria-label="Adicionar movimentação"><Plus size={26} aria-hidden="true" /></button>
      )}
      <nav className="gs-abas" aria-label="Seções">
        {NAV.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} className={() => (aceso(to) ? 'on' : '')} aria-label={label} aria-current={aceso(to) ? 'page' : undefined}>
            <Icon size={22} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <Folha aberta={mais} onFechar={() => setMais(false)} titulo="Mais">{linksMais}</Folha>
      <AdicionarMov />
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
