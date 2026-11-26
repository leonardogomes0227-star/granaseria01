import { FerramentaLayout } from './gs/FerramentaLayout';
import { useState, useEffect, lazy, Suspense, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { importarComRetry } from './gs/importar';
import { Routes, Route, useLocation, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
const PrivacyPage = lazy(() => importarComRetry(() => import('./components/Pages')).then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => importarComRetry(() => import('./components/Pages')).then((m) => ({ default: m.TermsPage })));
const NotFoundPage = lazy(() => importarComRetry(() => import('./components/Pages')).then((m) => ({ default: m.NotFoundPage })));
import { HomePage } from './components/HomePage';
import { AppShell } from './components/AppShell';
import { Toaster } from './components/ui/Toast';
import { Assistente } from './gs/Assistente';
import { EsqueletoTela } from './gs/Esqueleto';
import { OuvirSons } from './gs/OuvirSons';
import { AppBar } from './components/Layout';
import { ToolId, getTool, getToolBySlug } from './tools';
import { INITIAL_DATA, WizardData } from './types';
import { track, trackPageview } from './analytics';
import { useSession } from './account';
import { startSync } from './sync';
const AccountPage = lazy(() => importarComRetry(() => import('./components/Account')).then((m) => ({ default: m.AccountPage })));
const AdminPage = lazy(() => importarComRetry(() => import('./components/AdminPage')).then((m) => ({ default: m.AdminPage })));
const MeuMes = lazy(() => importarComRetry(() => import('./gs/MeuMes')).then((m) => ({ default: m.MeuMes })));
const Dividas = lazy(() => importarComRetry(() => import('./gs/Dividas')).then((m) => ({ default: m.Dividas })));
const Atrasos = lazy(() => importarComRetry(() => import('./gs/Atrasos')).then((m) => ({ default: m.Atrasos })));
const PossoComprar = lazy(() => importarComRetry(() => import('./gs/PossoComprar')).then((m) => ({ default: m.PossoComprar })));
const Assinaturas = lazy(() => importarComRetry(() => import('./gs/Assinaturas')).then((m) => ({ default: m.Assinaturas })));
const Reserva = lazy(() => importarComRetry(() => import('./gs/Reserva')).then((m) => ({ default: m.Reserva })));
const Desafio = lazy(() => importarComRetry(() => import('./gs/Desafio')).then((m) => ({ default: m.Desafio })));
const Renda = lazy(() => importarComRetry(() => import('./gs/Renda')).then((m) => ({ default: m.Renda })));
const Emprestimos = lazy(() => importarComRetry(() => import('./gs/Emprestimos')).then((m) => ({ default: m.Emprestimos })));
const Extras = lazy(() => importarComRetry(() => import('./gs/Extras')).then((m) => ({ default: m.Extras })));
const Orcamento = lazy(() => importarComRetry(() => import('./gs/Orcamento')).then((m) => ({ default: m.Orcamento })));
const Calendario = lazy(() => importarComRetry(() => import('./gs/Calendario')).then((m) => ({ default: m.Calendario })));
const Evolucao = lazy(() => importarComRetry(() => import('./gs/Evolucao')).then((m) => ({ default: m.Evolucao })));
const Coach = lazy(() => importarComRetry(() => import('./gs/Coach')).then((m) => ({ default: m.Coach })));
const Assistentes = lazy(() => importarComRetry(() => import('./gs/Assistentes')).then((m) => ({ default: m.Assistentes })));
const ParceladoTela = lazy(() => importarComRetry(() => import('./gs/Parcelado')).then((m) => ({ default: m.ParceladoTela })));
const CartaoTela = lazy(() => importarComRetry(() => import('./gs/Cartao')).then((m) => ({ default: m.CartaoTela })));
const Recuperacao = lazy(() => importarComRetry(() => import('./gs/Recuperacao')).then((m) => ({ default: m.Recuperacao })));
const Cortar = lazy(() => importarComRetry(() => import('./gs/Cortar')).then((m) => ({ default: m.Cortar })));
const Investir = lazy(() => importarComRetry(() => import('./gs/investir/Investir')).then((m) => ({ default: m.Investir })));
import { MeusDados } from './gs/MeusDados';
const Mais = lazy(() => importarComRetry(() => import('./gs/Mais')).then((m) => ({ default: m.Mais })));
const PassoDoDiagnostico = lazy(() => importarComRetry(() => import('./components/PassoDoDiagnostico')).then((m) => ({ default: m.PassoDoDiagnostico })));
const TelaCaminho = lazy(() => importarComRetry(() => import('./gs/TelaCaminho')).then((m) => ({ default: m.TelaCaminho })));
const FerramentaAntiga = lazy(() => importarComRetry(() => import('./components/FerramentaAntiga')).then((m) => ({ default: m.FerramentaAntiga })));
const AreaPagar = lazy(() => importarComRetry(() => import('./gs/Areas')).then((m) => ({ default: m.AreaPagar })));
const AreaGastos = lazy(() => importarComRetry(() => import('./gs/Areas')).then((m) => ({ default: m.AreaGastos })));
const AreaGuardar = lazy(() => importarComRetry(() => import('./gs/Areas')).then((m) => ({ default: m.AreaGuardar })));
const Perfil = lazy(() => importarComRetry(() => import('./gs/Areas')).then((m) => ({ default: m.Perfil })));
const TodasFerramentas = lazy(() => importarComRetry(() => import('./gs/Areas')).then((m) => ({ default: m.TodasFerramentas })));
import { RespostaFerramenta } from './gs/RespostaFerramenta';
import { RESPOSTA_DO_SLUG } from './gs/respostas';
const DevUI = lazy(() => importarComRetry(() => import('./gs/DevUI')).then((m) => ({ default: m.DevUI })));
const Sobre = lazy(() => importarComRetry(() => import('./gs/Sobre')).then((m) => ({ default: m.Sobre })));
const Planos = lazy(() => importarComRetry(() => import('./gs/Planos')).then((m) => ({ default: m.Planos })));
import { Porteiro } from './gs/Porteiro';
import { ErroGlobal } from './gs/ErroGlobal';
import { startPainelSync, captureLoginFromUrl, siteEvent } from './painel';
import { LoginGate } from './components/LoginGate';
const GuidesIndex = lazy(() => importarComRetry(() => import('./components/Guides')).then((m) => ({ default: m.GuidesIndex })));
const GuidePage = lazy(() => importarComRetry(() => import('./components/Guides')).then((m) => ({ default: m.GuidePage })));
import { getGuide } from './guides';
import { PLAN_KEYS, RESET_ID, RESET_KEY } from './reset';

// recomeço do plano (src/reset.ts): o plano antigo deste navegador sai uma vez, antes de qualquer coisa ler ele
try {
  if (localStorage.getItem(RESET_KEY) !== RESET_ID) {
    for (const k of PLAN_KEYS) localStorage.removeItem(k);
    localStorage.setItem(RESET_KEY, RESET_ID);
  }
} catch {
  // navegador sem localStorage: não há plano guardado
}

// o link do WhatsApp (?t=…) vira login antes de o roteador ler o endereço
captureLoginFromUrl();

const STORAGE_KEY = 'selos-wizard-progress';
const TOTAL_STEPS = 7;
const SITE_NAME = 'Grana Séria';

interface SavedProgress {
  data: WizardData;
  step: number;
}

function loadSavedProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    // só considera "progresso salvo" se a pessoa realmente preencheu algo
    if (!parsed.data || parsed.data.monthlyIncome <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveProgress(p: SavedProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // navegador sem localStorage (aba anônima restrita) — segue sem salvar
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // idem
  }
}

/** Título da aba do navegador por tela. */
function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Diagnóstico financeiro`;
  }, [title]);
}

/** Cada tela nova começa do topo; links com #âncora rolam até a seção. */
function ScrollManager() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // espera a página montar antes de procurar a seção
      const id = window.setTimeout(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return () => window.clearTimeout(id);
    }
    window.scrollTo({ top: 0 });
  }, [pathname, search, hash]);
  useEffect(() => {
    trackPageview();
  }, [pathname]);
  return null;
}

function Titled({ title, children }: { title: string | null; children: ReactNode }) {
  useTitle(title);
  return <>{children}</>;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(() => loadSavedProgress());
  // começa com o que ficou salvo: assim as ferramentas já chegam com a renda/dívidas preenchidas
  const [data, setData] = useState<WizardData>(() => loadSavedProgress()?.data ?? INITIAL_DATA);

  const update = (patch: Partial<WizardData>) => setData((prev) => ({ ...prev, ...patch }));
  const updateExpenses = (key: keyof WizardData['expenses'], value: number) =>
    setData((prev) => ({ ...prev, expenses: { ...prev.expenses, [key]: value } }));

  const goToStep = (s: number) => navigate(`/diagnostico?etapa=${s}`);
  const startWizard = () => {
    track('diagnostico_iniciado');
    setData(INITIAL_DATA);
    goToStep(1);
  };
  const resumeWizard = () => {
    if (!savedProgress) return;
    setData(savedProgress.data);
    goToStep(savedProgress.step);
  };
  const onRestart = () => {
    clearProgress();
    setSavedProgress(null);
    setData(INITIAL_DATA);
    goToStep(1);
  };
  const openTool = (id: ToolId) => {
    track('ferramenta_aberta', { ferramenta: id });
    navigate(`/ferramentas/${getTool(id).slug}`);
  };
  const goHome = () => {
    setSavedProgress(loadSavedProgress());
    navigate('/');
  };
  const backToTools = () => {
    setSavedProgress(loadSavedProgress());
    // volta pra quem abriu (o agente); se a pessoa chegou direto no link, vai pros agentes
    if (window.history.length > 1) navigate(-1);
    else navigate('/ferramentas');
  };

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/inicio') setSavedProgress(loadSavedProgress());
  }, [location.pathname]);

  useEffect(() => {
    const noClique = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const alvo = ev.target instanceof Element ? ev.target.closest('a[href]') : null;
      if (!(alvo instanceof HTMLAnchorElement) || alvo.target === '_blank' || alvo.origin !== window.location.origin) return;
      if (typeof document.startViewTransition !== 'function') return;
      const url = new URL(alvo.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      ev.preventDefault();
      const ir = () => navigate(`${url.pathname}${url.search}${url.hash}`);
      try { document.startViewTransition(() => { flushSync(ir); }); } catch { ir(); }
    };
    document.addEventListener('click', noClique);
    return () => document.removeEventListener('click', noClique);
  }, [navigate]);

  const session = useSession();
  useEffect(() => {
    void startSync(session);
  }, [session]);

  // navegador ligado ao WhatsApp pelo link do painel: mantém tudo salvo nos dois lados, em qualquer página
  useEffect(() => {
    void startPainelSync().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez ao abrir o site (o /painel liga sozinho)
  }, []);


  return (
    <>
      <ScrollManager />
      <Routes>
        <Route
          path="/"
          element={
            <Titled title={null}>
              <AppShell>
                <HomePage savedProgress={savedProgress} onStart={startWizard} onResume={resumeWizard} onOpenTool={openTool} />
              </AppShell>
            </Titled>
          }
        />
        <Route
          path="/inicio"
          element={
            <Titled title={null}>
              <AppShell>
                <HomePage savedProgress={savedProgress} onStart={startWizard} onResume={resumeWizard} onOpenTool={openTool} />
              </AppShell>
            </Titled>
          }
        />
        <Route
          path="/diagnostico"
          element={
            <LoginGate what="o diagnóstico" header={<AppBar onHome={goHome} />}>
            <WizardRoute
              data={data}
              setData={setData}
              update={update}
              updateExpenses={updateExpenses}
              goToStep={goToStep}
              onHome={goHome}
              onRestart={onRestart}
              onOpenTool={openTool}
            />
            </LoginGate>
          }
        />
        <Route
          path="/entrar"
          element={
            <Titled title="Entrar">
              <AppShell>
                <LoginGate what="o seu painel">
                  <Navigate to="/" replace />
                </LoginGate>
              </AppShell>
            </Titled>
          }
        />
        <Route path="/caminho" element={<Pagina titulo="Meu caminho" o="o seu caminho"><TelaCaminho /></Pagina>} />
        <Route path="/pagar" element={<Pagina titulo="Pagar" o="as suas contas"><AreaPagar /></Pagina>} />
        <Route path="/gastos" element={<Pagina titulo="Gastos" o="os seus gastos"><AreaGastos /></Pagina>} />
        <Route path="/guardar" element={<Pagina titulo="Guardar" o="o que você guarda"><AreaGuardar /></Pagina>} />
        <Route path="/perfil" element={<Pagina titulo="Perfil" o="o seu perfil"><Perfil /></Pagina>} />
        <Route path="/mais" element={<Pagina titulo="Mais" o="o menu"><Mais /></Pagina>} />
        <Route path="/ferramentas" element={<Pagina titulo="Todas as ferramentas" o="as ferramentas"><TodasFerramentas /></Pagina>} />
        <Route path="/dev/ui" element={<Pagina titulo="Componentes" o="" aberto><DevUI /></Pagina>} />
        <Route path="/lancamentos" element={<Pagina titulo="Lançamentos" o="os seus lançamentos"><MeuMes padrao="historico" /></Pagina>} />
        <Route path="/plano/cortar" element={<Pagina titulo="Onde cortar" o="a ferramenta"><Cortar /></Pagina>} />
        <Route path="/recuperacao" element={<Pagina titulo="Modo recuperação" o="o modo recuperação"><Recuperacao /></Pagina>} />
        <Route path="/relatorios" element={<Pagina titulo="Relatórios" o="os seus relatórios"><Evolucao /></Pagina>} />
        <Route path="/planejamento" element={<PlanoRedirect />} />
        <Route path="/mes" element={<Pagina titulo="Meu mês" o="o seu mês"><MeuMes /></Pagina>} />
        <Route path="/meu-mes" element={<Pagina titulo="Meu mês" o="o seu mês"><MeuMes /></Pagina>} />
        <Route path="/plano" element={<PlanoRedirect />} />
        <Route path="/plano/dividas" element={<Pagina titulo="Quitar dívidas" o="as suas dívidas"><Dividas /></Pagina>} />
        <Route path="/plano/atrasos" element={<Pagina titulo="Sair do atraso" o="as contas atrasadas"><Atrasos /></Pagina>} />
        <Route path="/plano/comprar" element={<Pagina titulo="Posso comprar isso?" o="a ferramenta"><PossoComprar /></Pagina>} />
        <Route path="/plano/assinaturas" element={<Pagina titulo="Gastos escondidos" o="as suas assinaturas"><Assinaturas /></Pagina>} />
        <Route path="/plano/reserva" element={<Pagina titulo="Reserva" o="a sua reserva"><Reserva /></Pagina>} />
        <Route path="/plano/desafio" element={<Pagina titulo="Desafio de juntar" o="o seu desafio"><Desafio /></Pagina>} />
        <Route path="/plano/renda" element={<Pagina titulo="Liberdade de renda" o="a ferramenta"><Renda /></Pagina>} />
        <Route path="/plano/emprestimos" element={<Pagina titulo="Empréstimos" o="a ferramenta"><Emprestimos /></Pagina>} />
        <Route path="/plano/orcamento" element={<Pagina titulo="Orçamento" o="o seu orçamento"><Orcamento /></Pagina>} />
        <Route path="/plano/calendario" element={<Pagina titulo="Calendário de contas" o="o calendário"><Calendario /></Pagina>} />
        <Route path="/plano/parcelado" element={<Pagina titulo="À vista ou parcelado?" o="a ferramenta"><ParceladoTela /></Pagina>} />
        <Route path="/plano/cartao" element={<Pagina titulo="Cartão de crédito" o="o seu cartão"><CartaoTela /></Pagina>} />
        <Route path="/plano/extras" element={<Pagina titulo="Dinheiro extra" o="a ferramenta"><Extras /></Pagina>} />
        <Route path="/investir" element={<Pagina titulo="Investir" o="a aba Investir"><Suspense fallback={null}><Investir /></Suspense></Pagina>} />
        <Route path="/evolucao" element={<Pagina titulo="Evolução" o="a sua evolução"><Evolucao /></Pagina>} />
        <Route path="/coach" element={<Pagina titulo="Coach" o="o seu coach"><Coach /></Pagina>} />
        <Route path="/assistentes" element={<Pagina titulo="Assistentes" o="os seus assistentes"><Assistentes /></Pagina>} />
        <Route path="/dados" element={<Pagina titulo="Meus dados" o="os seus dados"><MeusDados /></Pagina>} />
        <Route path="/sobre" element={<Pagina titulo="Sobre e avisos" o="" aberto><Sobre /></Pagina>} />
        <Route path="/planos" element={<Pagina titulo="Planos" o="" aberto><Planos /></Pagina>} />
        <Route path="/painel" element={<PainelRedirect />} />
        {['/missoes', '/conselheiros', '/agentes', '/selos', '/coach/chat', '/coach/plano', '/conselheiros/:id', '/agentes/:id/chat'].map((de) => (
          <Route key={de} path={de} element={<Navigate to={de === '/missoes' ? '/ferramentas' : de === '/selos' ? '/' : '/coach'} replace />} />
        ))}
        <Route
          path="/ferramentas/:slug"
          element={<ToolRoute data={data} onClose={backToTools} onSwitch={openTool} onStart={startWizard} />}
        />
        <Route path="/politica-de-privacidade" element={<Titled title="Política de privacidade"><AppShell><Suspense fallback={null}><PrivacyPage /></Suspense></AppShell></Titled>} />
        <Route path="/termos-de-uso" element={<Titled title="Termos de uso"><AppShell><Suspense fallback={null}><TermsPage /></Suspense></AppShell></Titled>} />
        <Route path="/guias" element={<Titled title="Guias"><AppShell><Suspense fallback={null}><GuidesIndex /></Suspense></AppShell></Titled>} />
        <Route path="/guias/:slug" element={<GuideRoute onStart={startWizard} />} />
        <Route path="/conta" element={<Titled title="Minha conta"><AppShell><Suspense fallback={null}><AccountPage session={session} /></Suspense></AppShell></Titled>} />
        <Route
          path="/admin"
          element={
            <Titled title="Painel">
              <AppBar onHome={goHome} />
              <Suspense fallback={null}><AdminPage /></Suspense>
            </Titled>
          }
        />
        <Route path="*" element={<Titled title="Página não encontrada"><AppShell><Suspense fallback={null}><NotFoundPage /></Suspense></AppShell></Titled>} />
      </Routes>
      {/* O Midas fica fora das rotas: cada página tem a sua casca, e remontar o guia no meio do passo fazia ele piscar. */}
      <Assistente />
      <OuvirSons />
      <Toaster />
    </>
  );
}

function WizardRoute({
  data,
  setData,
  update,
  updateExpenses,
  goToStep,
  onHome,
  onRestart,
  onOpenTool,
}: {
  data: WizardData;
  setData: (d: WizardData) => void;
  update: (patch: Partial<WizardData>) => void;
  updateExpenses: (key: keyof WizardData['expenses'], value: number) => void;
  goToStep: (s: number) => void;
  onHome: () => void;
  onRestart: () => void;
  onOpenTool: (id: ToolId) => void;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const parsed = parseInt(params.get('etapa') || '1', 10);
  const step = Math.min(Math.max(isNaN(parsed) ? 1 : parsed, 1), TOTAL_STEPS);
  // sem renda não dá pra estar além da etapa 1 (ex.: link direto pra ?etapa=5 sem nada preenchido)
  const blocked = step > 1 && data.monthlyIncome <= 0;

  useTitle(step === TOTAL_STEPS ? 'Seu diagnóstico' : `Diagnóstico, etapa ${step} de ${TOTAL_STEPS}`);

  useEffect(() => {
    if (!blocked) return;
    const saved = loadSavedProgress();
    if (saved) setData(saved.data);
    else navigate('/diagnostico?etapa=1', { replace: true });
  }, [blocked, setData, navigate]);

  useEffect(() => {
    track('diagnostico_etapa', { etapa: step });
  }, [step]);

  // salva a cada mudança, mas só depois que a pessoa começou a preencher de verdade
  useEffect(() => {
    if (data.monthlyIncome > 0) saveProgress({ data, step });
  }, [data, step]);

  const stepProps = {
    data,
    update,
    updateExpenses,
    onNext: () => goToStep(step + 1),
    onBack: () => goToStep(Math.max(step - 1, 1)),
    canNext: true,
  };

  return (
    <>
      <AppBar onHome={onHome} />
      <div className="wizard-wrap">
        {!blocked && (
          <div key={step} className="anim-step" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Suspense fallback={<p className="gs-mudo" role="status" style={{ padding: 16 }}>Carregando…</p>}>
              <PassoDoDiagnostico step={step} stepProps={stepProps} data={data} goToStep={goToStep} onRestart={onRestart} onOpenTool={onOpenTool} />
            </Suspense>
          </div>
        )}
      </div>
    </>
  );
}

/** Página do app: casca com as 5 abas, login e (na primeira vez) a pergunta da renda. */
function Pagina({ titulo, o, children, aberto = false }: { titulo: string; o: string; children: ReactNode; aberto?: boolean }) {
  return (
    <Titled title={titulo}>
      <AppShell>
        {aberto ? (
          children
        ) : (
          <LoginGate what={o}>
            <ErroGlobal>
              <Porteiro><div className="rv-moldura"><FerramentaLayout><Suspense fallback={<EsqueletoTela />}>{children}</Suspense></FerramentaLayout></div></Porteiro>
            </ErroGlobal>
          </LoginGate>
        )}
      </AppShell>
    </Titled>
  );
}

function GuideRoute({ onStart }: { onStart: () => void }) {
  const { slug } = useParams();
  const guide = getGuide(slug);
  useTitle(guide ? guide.title : 'Página não encontrada');
  return <AppShell><Suspense fallback={null}>{guide ? <GuidePage guide={guide} onStart={onStart} /> : <NotFoundPage />}</Suspense></AppShell>;
}

/** "Planejamento" virou as áreas: /plano#metas abre as metas em Guardar; o resto abre a lista de todas as ferramentas. */
function PlanoRedirect() {
  const { hash, search } = useLocation();
  return <Navigate to={hash === '#metas' ? '/guardar#metas' : `/ferramentas${search}`} replace />;
}

/** As ferramentas antigas que a ferramenta nova cobre por inteiro: o endereço antigo continua abrindo, na tela nova.
 *  Para desfazer uma fusão, apague a linha dela aqui (o componente antigo continua no repositório). */
export const ALIAS_FERRAMENTAS: Record<string, string> = {
  'minhas-contas': '/lancamentos?aba=contas',
  'quitar-dividas': '/plano/dividas',
  'comparador-de-emprestimo': '/plano/emprestimos',
  'vale-a-pena-comprar': '/plano/comprar',
  'decimo-terceiro': '/plano/extras',
  'caca-vazamentos': '/plano/assinaturas',
  'calculadora-de-meta': '/guardar#metas',
};

/** Os links antigos do painel (/painel#mes, #plano…) levam pra página nova de cada coisa. */
function PainelRedirect() {
  const { hash, search } = useLocation();
  const to: Record<string, string> = { '#mes': '/mes', '#plano': '/ferramentas', '#pairico': '/ferramentas', '#ferramentas': '/ferramentas' };
  return <Navigate to={`${to[hash] ?? '/'}${search}`} replace />;
}

function ToolRoute({
  data,
  onClose,
  onSwitch,
  onStart,
}: {
  data: WizardData;
  onClose: () => void;
  onSwitch: (id: ToolId) => void;
  onStart: () => void;
}) {
  const { slug } = useParams();
  const tool = getToolBySlug(slug);
  useTitle(tool ? tool.title : 'Página não encontrada');
  if (slug && ALIAS_FERRAMENTAS[slug]) return <Navigate to={ALIAS_FERRAMENTAS[slug]} replace />;
  if (!tool) {
    return (
      <AppShell>
        <Suspense fallback={null}><NotFoundPage /></Suspense>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <LoginGate what={tool.title.charAt(0).toLowerCase() + tool.title.slice(1)}>
      <ToolOpened id={tool.id} />
      {/* ferramenta antiga: no topo, a resposta com os números que a pessoa já cadastrou no app */}
      {slug && RESPOSTA_DO_SLUG[slug] && <div className="gs-principal" style={{ paddingBottom: 0 }}><RespostaFerramenta id={RESPOSTA_DO_SLUG[slug]} /></div>}
      {/* key: trocar de ferramenta zera os campos da anterior */}
      <Suspense fallback={<p className="gs-mudo" role="status" style={{ padding: 16 }}>Carregando…</p>}>
        <FerramentaAntiga id={tool.id} data={data} onClose={onClose} onSwitch={onSwitch} onStart={onStart} />
      </Suspense>
      </LoginGate>
    </AppShell>
  );
}

/** Conta no painel do dono que a pessoa abriu esta ferramenta no site. */
function ToolOpened({ id }: { id: ToolId }) {
  useEffect(() => {
    void siteEvent(`tool:site-${id}`);
  }, [id]);
  return null;
}

export default App;
