import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bell, House, Landmark, Menu, Plus, Receipt, Search, UserRound, type LucideIcon } from 'lucide-react';
import { AdicionarMov } from '../gs/AdicionarMov';
import { MenuAdicionar, abrirMenuAdicionar } from '../gs/MenuAdicionar';
import { Resolver } from '../gs/Resolver';
import { getName, painelToken } from '../painel';
import { useSession } from '../account';
import { useVisualDoApp } from '../gs/visual';
import { iniciarEfeitos } from '../gs/efeitosGlobais';
import { tocar } from '../gs/sons';
import { abrirResolver } from '../gs/Resolver';
import { Moeda } from './ui/Moeda';
import { useEstado } from '../gs/store';
import { useHoje } from '../gs/useHoje';
import { FERRAMENTAS, urgentesDaArea, type Area } from '../gs/registroFerramentas';

/* ---------- A casca do app: 4 áreas e o "+" no centro (celular), lateral com as mesmas áreas (PC) ---------- */
// Início · Contas · (+) · Dívidas · Mais. O (+) abre as ações mais comuns; "Mais" guarda todas as outras ferramentas, em grupos.

export const NAV: [string, string, LucideIcon, Area][] = [
  ['/', 'Início', House, 'caminho'],
  ['/pagar', 'Contas', Receipt, 'pagar'],
  ['/plano/dividas', 'Dívidas', Landmark, 'pagar'],
  ['/mais', 'Mais', Menu, 'gastos'],
];
/** Qual aba fica acesa: Início, Contas, Dívidas ou, para todo o resto, Mais. */
function abaDaRota(pathname: string, search: string): string {
  if (pathname === '/' || pathname === '/inicio') return '/';
  if (pathname.startsWith('/plano/dividas')) return '/plano/dividas';
  if (['/plano/calendario', '/plano/atrasos', '/plano/cartao'].some((r) => pathname.startsWith(r))) return '/pagar';
  if (pathname === '/pagar' || ((pathname === '/lancamentos' || pathname === '/mes' || pathname === '/meu-mes') && new URLSearchParams(search).get('aba') === 'contas')) return '/pagar';
  return '/mais';
}

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
  const aba = abaDaRota(pathname, search);
  const nome = e.config.nome || getName() || '';
  const urgentes = useMemo(() => urgentesDaArea('pagar', e, hoje).length, [e, hoje]);
  const atrasada = urgentes > 0;
  const pronto = e.config.onboardingFeito;
  // a pílula dourada do menu lateral desliza esticando: a borda da frente corre e a de trás vem depois
  const lateral = useRef<HTMLElement>(null);
  const antesTopo = useRef(0);
  const [pilula, setPilula] = useState<{ t: number; b: number; desce: boolean } | null>(null);
  const primeira = useRef(true);
  useEffect(() => iniciarEfeitos(), []);
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); abrirResolver(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);
  useEffect(() => {
    if (!primeira.current) tocar('navegar');
    primeira.current = false;
  }, [pathname]);
  const item = ([to, label, Icon]: (typeof NAV)[number]) => (
    <NavLink key={to} to={to} end={to === '/'} className={() => (aba === to ? 'on' : '')} aria-current={aba === to ? 'page' : undefined} aria-label={to === '/pagar' && atrasada ? `${label}, tem conta atrasada` : label}>
      <em><Icon size={23} strokeWidth={1.75} aria-hidden="true" />{to === '/pagar' && atrasada && <i aria-hidden="true" />}</em><span>{label}</span>
    </NavLink>
  );
  useLayoutEffect(() => {
    const box = lateral.current;
    const el = box?.querySelector<HTMLElement>('a.cm-item.on');
    if (!box || !el) { setPilula(null); return; }
    const t = el.offsetTop;
    setPilula({ t, b: box.offsetHeight - (t + el.offsetHeight), desce: t >= antesTopo.current });
    antesTopo.current = t;
  }, [pathname, pronto]);
  return (
    <div className={`gs-casca gs-app2 cm-casca${pronto ? '' : ' cm-sem-menu'}`}>
      <aside className="cm-lateral" aria-label="Menu principal" ref={lateral}>
        {pilula && <i className="cm-pill" aria-hidden="true" style={{ top: pilula.t, bottom: pilula.b, transition: pilula.desce ? `top .55s cubic-bezier(.65, 0, .35, 1), bottom .36s cubic-bezier(.215, .61, .355, 1)` : `top .36s cubic-bezier(.215, .61, .355, 1), bottom .55s cubic-bezier(.65, 0, .35, 1)` }} />}
        <Link to="/" className="cm-marca" aria-label="Grana Séria, início"><Moeda tamanho={34} girar={false} /><span className="nome-marca">Grana <em>Séria</em></span></Link>
        {NAV.map(([to, label, Icon]) => (
          <Link key={to} to={to} className={`cm-item${aba === to ? ' on' : ''}`} aria-current={aba === to ? 'page' : undefined}><Icon size={20} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span></Link>
        ))}
        {pronto && <button type="button" className="gs-btn" onClick={() => abrirMenuAdicionar()}><Plus size={18} aria-hidden="true" /><span>Adicionar</span></button>}
        <hr />
        <Link to="/perfil" className={`cm-item${pathname === '/perfil' ? ' on' : ''}`}><UserRound size={20} strokeWidth={1.75} aria-hidden="true" /><span>Perfil</span></Link>
      </aside>
      <div className="gs-coluna">
        <header className="cm-topo">
          <Link to="/" className="cm-marca" aria-label="Grana Séria, início"><Moeda tamanho={32} girar={false} /><span className="nome-marca">Grana <em>Séria</em></span></Link>
          <span className="cm-cam" aria-hidden="true"><i>Grana Séria</i><u>/</u><b>{TITULO_ROTA(pathname)}</b></span>
          <span className="cm-vivo" aria-label="Dados ao vivo"><i />Ao vivo</span>
          <Link to="/pagar" className="cm-sino" aria-label={urgentes ? `${urgentes} ${urgentes === 1 ? 'aviso' : 'avisos'} de contas` : 'Nenhum aviso de contas'} onClick={() => tocar('tique')}><Bell size={17} aria-hidden="true" />{urgentes > 0 && <b>{urgentes}</b>}</Link>
          <button type="button" className="gl-busca" onClick={() => abrirResolver()} aria-label="Buscar no app"><Search size={15} aria-hidden="true" /><span>Buscar…</span><kbd>Ctrl K</kbd></button>
          <button type="button" className="cm-novo" onClick={() => abrirMenuAdicionar()}><Plus size={14} aria-hidden="true" />Novo</button>
          <Link to="/perfil" className="cm-avatar" aria-label="Perfil">{inicialDo(nome)}</Link>
        </header>
        <main className="gs-principal">{children}</main>
      </div>
      <i className="esm-carrega" key={pathname} aria-hidden="true" />
      <nav className="cm-abas" aria-label="Seções">
        {NAV.slice(0, 2).map(item)}
        <button type="button" className="cm-mais" onClick={() => abrirMenuAdicionar()} aria-label="Adicionar: gasto, conta, dívida, fatura"><Plus size={30} strokeWidth={2.25} aria-hidden="true" /></button>
        {NAV.slice(2).map(item)}
      </nav>
      <AdicionarMov />
      <MenuAdicionar />
      <PuxarParaAtualizar />
      <Resolver />
    </div>
  );
}

const TITULO_ROTA = (p: string) => {
  if (p === '/' || p.startsWith('/inicio')) return 'Início';
  if (p.startsWith('/pagar')) return 'Contas';
  if (p.startsWith('/gastos')) return 'Gastos';
  if (p.startsWith('/plano/dividas')) return 'Dívidas';
  if (p.startsWith('/guardar')) return 'Guardar';
  if (p.startsWith('/mais')) return 'Mais';
  if (p.startsWith('/coach')) return 'Coach';
  if (p.startsWith('/caminho')) return 'Seu caminho';
  if (p.startsWith('/relatorios') || p.startsWith('/evolucao')) return 'Relatórios';
  if (p.startsWith('/perfil')) return 'Perfil';
  if (p.startsWith('/lancamentos') || p.startsWith('/mes') || p.startsWith('/meu-mes')) return 'Lançamentos';
  const f = FERRAMENTAS.find((x) => x.rota.split(/[?#]/)[0] === p);
  return f ? f.titulo : 'Início';
};

/** Puxar o topo da tela dá um refresco visual (os cartões entram de novo). Não recarrega a rede. */
function PuxarParaAtualizar() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const raiz = document.documentElement;
    let y0 = 0;
    let ativo = false;
    let dy = 0;
    let timer = 0;
    const comecar = (ev: TouchEvent) => {
      if (window.scrollY > 2) return;
      const alvo = ev.target instanceof Element ? ev.target : null;
      if (alvo?.closest('input, textarea, select, .as-painel, .gs-fundo, .as-fala')) return;
      y0 = ev.touches[0]?.clientY ?? 0;
      ativo = true;
      dy = 0;
    };
    const mover = (ev: TouchEvent) => {
      if (!ativo) return;
      if (window.scrollY > 2) {
        ativo = false;
        raiz.classList.remove('gs-puxando');
        raiz.style.setProperty('--gs-puxar', '0px');
        return;
      }
      const d = (ev.touches[0]?.clientY ?? y0) - y0;
      if (d <= 0) {
        dy = 0;
        raiz.style.setProperty('--gs-puxar', '0px');
        return;
      }
      dy = Math.min(84, d * 0.42);
      raiz.classList.add('gs-mola', 'gs-puxando');
      raiz.style.setProperty('--gs-puxar', `${dy}px`);
    };
    const fim = () => {
      if (!ativo && dy <= 0) return;
      const soltou = dy;
      ativo = false;
      dy = 0;
      raiz.classList.remove('gs-puxando');
      raiz.style.setProperty('--gs-puxar', '0px');
      if (soltou > 54) {
        raiz.classList.remove('gs-refresco');
        void raiz.offsetWidth;
        raiz.classList.add('gs-refresco');
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        raiz.classList.remove('gs-mola', 'gs-refresco');
        raiz.style.removeProperty('--gs-puxar');
      }, soltou > 54 ? 700 : 420);
    };
    window.addEventListener('touchstart', comecar, { passive: true });
    window.addEventListener('touchmove', mover, { passive: true });
    window.addEventListener('touchend', fim);
    window.addEventListener('touchcancel', fim);
    return () => {
      window.removeEventListener('touchstart', comecar);
      window.removeEventListener('touchmove', mover);
      window.removeEventListener('touchend', fim);
      window.removeEventListener('touchcancel', fim);
      window.clearTimeout(timer);
      raiz.classList.remove('gs-mola', 'gs-puxando', 'gs-refresco');
      raiz.style.removeProperty('--gs-puxar');
    };
  }, []);
  return <div className="gs-puxar-ind" aria-hidden="true"><i /></div>;
}

/** Quem ainda não entrou: cabeçalho enxuto (marca, guias, entrar), sem abas, e o rodapé com os avisos. */
function CascaPublica({ children }: { children: ReactNode }) {
  return (
    <div className="gs-casca">
      <header className="gs-topo">
        <div className="gs-topo-in">
          <Link to="/" className="gs-marca" aria-label="Grana Séria, início">
            <Moeda tamanho={30} />
            <span className="nome-marca">Grana <em>Séria</em></span>
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
  const session = useSession();
  // e-mail (Supabase) entra no app do mesmo jeito que o link do WhatsApp
  return app && Boolean(painelToken() || session) ? <Casca>{children}</Casca> : <CascaPublica>{children}</CascaPublica>;
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
