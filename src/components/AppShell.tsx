import { useMemo, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { HandCoins, PiggyBank, Plus, Route, Sparkles, UserRound, Wallet, type LucideIcon } from 'lucide-react';
import { AdicionarMov, abrirAdicionar } from '../gs/AdicionarMov';
import { Resolver } from '../gs/Resolver';
import { getName, painelToken } from '../painel';
import { useVisualDoApp } from '../gs/visual';
import { Moeda } from './ui/Moeda';
import { useEstado } from '../gs/store';
import { useHoje } from '../gs/useHoje';
import { recomendacoes } from '../gs/coachRegras';
import { FERRAMENTAS, urgentesDaArea, type Area } from '../gs/registroFerramentas';

/* ---------- A casca do app: 4 áreas e o "+" no centro (celular), lateral com as mesmas áreas (PC) ---------- */
// Caminho · Pagar · (+) · Gastos · Guardar. No topo: a marca, o Coach e o avatar (Perfil).
// O menu "Mais" acabou: cada ferramenta mora na sua área e todas aparecem em /ferramentas.

export const NAV: [string, string, LucideIcon, Area][] = [
  ['/', 'Caminho', Route, 'caminho'],
  ['/pagar', 'Pagar', HandCoins, 'pagar'],
  ['/gastos', 'Gastos', Wallet, 'gastos'],
  ['/guardar', 'Guardar', PiggyBank, 'guardar'],
];

/** A área (aba acesa) de qualquer endereço do app: vem do registro de ferramentas, para as rotas antigas continuarem no lugar certo. */
export function areaDaRota(pathname: string, search = ''): Area {
  const aba = new URLSearchParams(search).get('aba');
  if (pathname === '/' || pathname === '/inicio') return 'caminho';
  if (pathname === '/lancamentos' || pathname === '/mes' || pathname === '/meu-mes') return aba === 'contas' || (pathname !== '/lancamentos' && !aba) ? 'pagar' : 'gastos';
  for (const a of ['pagar', 'gastos', 'guardar', 'perfil'] as Area[]) if (pathname === `/${a}` || pathname.startsWith(`/${a}/`)) return a;
  if (pathname === '/evolucao') return 'gastos';
  if (['/dados', '/assistentes', '/planos', '/sobre', '/conta'].includes(pathname)) return 'perfil';
  const f = FERRAMENTAS.find((x) => x.rota.split(/[?#]/)[0] === pathname);
  return f ? f.area : 'caminho';
}

function inicialDo(nome?: string | null) {
  return ((nome ?? '').trim().charAt(0) || 'V').toUpperCase();
}

/** Dentro do app: lateral (PC) ou barra de baixo (celular), Coach no topo e o botão de adicionar no centro. */
function Casca({ children }: { children: ReactNode }) {
  const e = useEstado();
  const hoje = useHoje();
  const { pathname, search } = useLocation();
  const area = areaDaRota(pathname, search);
  const noCoach = pathname === '/coach';
  const nome = e.config.nome || getName() || '';
  const avisos = useMemo(() => recomendacoes(e, hoje).filter((r) => r.tom === 'perigo' || r.tom === 'aviso').length, [e, hoje]);
  const vermelho = useMemo(() => ({ pagar: urgentesDaArea('pagar', e, hoje).length > 0, gastos: urgentesDaArea('gastos', e, hoje).length > 0 }) as Partial<Record<Area, boolean>>, [e, hoje]);
  const coach = `/coach?de=${encodeURIComponent(pathname)}`;
  const pronto = e.config.onboardingFeito;
  const aba = ([to, label, Icon, a]: (typeof NAV)[number]) => (
    <NavLink key={to} to={to} end={to === '/'} className={() => (area === a && !noCoach ? 'on' : '')} aria-current={area === a && !noCoach ? 'page' : undefined} aria-label={vermelho[a] ? `${label}, tem algo atrasado` : label}>
      <em><Icon size={23} strokeWidth={1.75} aria-hidden="true" />{vermelho[a] && <i aria-hidden="true" />}</em><span>{label}</span>
    </NavLink>
  );
  return (
    <div className={`gs-casca gs-app2 cm-casca${pronto ? '' : ' cm-sem-menu'}`}>
      <aside className="cm-lateral" aria-label="Menu principal">
        <Link to="/" className="cm-marca" aria-label="Grana Séria, início"><Moeda tamanho={34} girar={false} /><span>Grana Séria</span></Link>
        {NAV.map(([to, label, Icon, a]) => (
          <Link key={to} to={to} className={`cm-item${area === a && !noCoach ? ' on' : ''}`} aria-current={area === a && !noCoach ? 'page' : undefined}><Icon size={20} strokeWidth={1.75} aria-hidden="true" />{label}</Link>
        ))}
        {pronto && <button type="button" className="gs-btn" onClick={() => abrirAdicionar()}><Plus size={18} aria-hidden="true" /> Adicionar</button>}
        <hr />
        <Link to={coach} className={`cm-item${noCoach ? ' on' : ''}`}><Sparkles size={20} strokeWidth={1.75} aria-hidden="true" />Coach</Link>
        <Link to="/perfil" className={`cm-item${area === 'perfil' ? ' on' : ''}`}><UserRound size={20} strokeWidth={1.75} aria-hidden="true" />Perfil</Link>
      </aside>
      <div className="gs-coluna">
        <header className="cm-topo">
          <Link to="/" className="cm-marca" aria-label="Grana Séria, início"><Moeda tamanho={32} girar={false} /><span>Grana Séria</span></Link>
          {pronto && (
            <Link to={coach} className="cm-coach-btn" aria-label={avisos ? `Coach: ${avisos} ${avisos === 1 ? 'orientação nova' : 'orientações novas'}` : 'Coach'}>
              <Sparkles size={18} aria-hidden="true" />Coach{avisos > 0 && <i aria-hidden="true" />}
            </Link>
          )}
          <Link to="/perfil" className="cm-avatar" aria-label="Perfil">{inicialDo(nome)}</Link>
        </header>
        <main className="gs-principal">{children}</main>
      </div>
      <nav className="cm-abas" aria-label="Seções">
        {NAV.slice(0, 2).map(aba)}
        <button type="button" className="cm-mais" onClick={() => abrirAdicionar()} aria-label="Adicionar movimentação"><Plus size={30} strokeWidth={2.25} aria-hidden="true" /></button>
        {NAV.slice(2).map(aba)}
      </nav>
      <AdicionarMov />
      <Resolver />
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
