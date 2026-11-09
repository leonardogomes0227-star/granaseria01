import { useState, useEffect, lazy, Suspense, ReactNode } from 'react';
import { importarComRetry } from './gs/importar';
import { Routes, Route, useLocation, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import {
  IncomeStep,
  SavingsStep,
  ExpensesStep,
  DebtsStep,
  EmergencyStep,
  ReviewStep,
  DiagnosisStep,
} from './components/WizardSteps';
import { ImpulseTool, DebtSimulator, LongTermSimulator, GoalCalculator, LoanComparator } from './components/Tools';
import { SelosPanel } from './components/SelosAndShare';
import { CheckInTool } from './components/CheckIn';
import { QuoteTool } from './components/QuoteTool';
import { ExtraMoneyTool, LeaksTool, RightsTool } from './components/SolutionTools';
import { PlanTracker } from './components/PlanTracker';
import { FaturaTool } from './components/FaturaTool';
import { PrivacyPage, TermsPage, NotFoundPage } from './components/Pages';
import { HomePage } from './components/HomePage';
import { AppShell } from './components/AppShell';
import { Toaster } from './components/ui/Toast';
import { AppBar } from './components/Layout';
import { ToolId, getTool, getToolBySlug } from './tools';
import { INITIAL_DATA, WizardData } from './types';
import { calculateDiagnosis } from './calculations';
import { track, trackPageview } from './analytics';
import { useSession } from './account';
import { startSync } from './sync';
import { AccountPage } from './components/Account';
import { AdminPage } from './components/AdminPage';
import { MeuMes } from './gs/MeuMes';
import { Plano } from './gs/Plano';
const Dividas = lazy(() => importarComRetry(() => import('./gs/Dividas')).then((m) => ({ default: m.Dividas })));
const Atrasos = lazy(() => importarComRetry(() => import('./gs/Atrasos')).then((m) => ({ default: m.Atrasos })));
const PossoComprar = lazy(() => importarComRetry(() => import('./gs/PossoComprar')).then((m) => ({ default: m.PossoComprar })));
const Assinaturas = lazy(() => importarComRetry(() => import('./gs/Assinaturas')).then((m) => ({ default: m.Assinaturas })));
const Reserva = lazy(() => importarComRetry(() => import('./gs/Reserva')).then((m) => ({ default: m.Reserva })));
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
const Investir = lazy(() => importarComRetry(() => import('./gs/investir/Investir')).then((m) => ({ default: m.Investir })));
import { MeusDados } from './gs/MeusDados';
import { Sobre } from './gs/Sobre';
import { Planos } from './gs/Planos';
import { Porteiro } from './gs/Porteiro';
import { ErroGlobal } from './gs/ErroGlobal';
import { startPainelSync, captureLoginFromUrl, siteEvent } from './painel';
import { LoginGate } from './components/LoginGate';
import { RichDadTool } from './components/RichDadTool';
import { BillsTool } from './components/BillsTool';
import { GuidesIndex, GuidePage } from './components/Guides';
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
    else navigate('/conselheiros');
  };

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/inicio') setSavedProgress(loadSavedProgress());
  }, [location.pathname]);

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
        <Route path="/lancamentos" element={<Pagina titulo="Lançamentos" o="os seus lançamentos"><MeuMes padrao="historico" /></Pagina>} />
        <Route path="/relatorios" element={<Pagina titulo="Relatórios" o="os seus relatórios"><Evolucao /></Pagina>} />
        <Route path="/planejamento" element={<Navigate to="/plano" replace />} />
        <Route path="/mes" element={<Pagina titulo="Meu mês" o="o seu mês"><MeuMes /></Pagina>} />
        <Route path="/meu-mes" element={<Pagina titulo="Meu mês" o="o seu mês"><MeuMes /></Pagina>} />
        <Route path="/plano" element={<Pagina titulo="Plano" o="o seu plano"><Plano /></Pagina>} />
        <Route path="/plano/dividas" element={<Pagina titulo="Quitar dívidas" o="as suas dívidas"><Dividas /></Pagina>} />
        <Route path="/plano/atrasos" element={<Pagina titulo="Sair do atraso" o="as contas atrasadas"><Atrasos /></Pagina>} />
        <Route path="/plano/comprar" element={<Pagina titulo="Posso comprar isso?" o="a ferramenta"><PossoComprar /></Pagina>} />
        <Route path="/plano/assinaturas" element={<Pagina titulo="Gastos escondidos" o="as suas assinaturas"><Assinaturas /></Pagina>} />
        <Route path="/plano/reserva" element={<Pagina titulo="Reserva" o="a sua reserva"><Reserva /></Pagina>} />
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
        {['/missoes', '/conselheiros', '/agentes', '/perfil', '/selos', '/coach/chat', '/coach/plano', '/conselheiros/:id', '/agentes/:id/chat'].map((de) => (
          <Route key={de} path={de} element={<Navigate to={de === '/missoes' ? '/plano' : de === '/perfil' ? '/dados' : de === '/selos' ? '/' : '/coach'} replace />} />
        ))}
        <Route path="/ferramentas" element={<Navigate to="/conselheiros" replace />} />
        <Route
          path="/ferramentas/:slug"
          element={<ToolRoute data={data} onClose={backToTools} onSwitch={openTool} onStart={startWizard} />}
        />
        <Route path="/politica-de-privacidade" element={<Titled title="Política de privacidade"><AppShell><PrivacyPage /></AppShell></Titled>} />
        <Route path="/termos-de-uso" element={<Titled title="Termos de uso"><AppShell><TermsPage /></AppShell></Titled>} />
        <Route path="/guias" element={<Titled title="Guias"><AppShell><GuidesIndex /></AppShell></Titled>} />
        <Route path="/guias/:slug" element={<GuideRoute onStart={startWizard} />} />
        <Route path="/conta" element={<Titled title="Minha conta"><AppShell><AccountPage session={session} /></AppShell></Titled>} />
        <Route
          path="/admin"
          element={
            <Titled title="Painel">
              <AppBar onHome={goHome} />
              <AdminPage />
            </Titled>
          }
        />
        <Route path="*" element={<Titled title="Página não encontrada"><AppShell><NotFoundPage /></AppShell></Titled>} />
      </Routes>
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
            {step === 1 && <IncomeStep {...stepProps} canNext={data.monthlyIncome > 0} />}
            {step === 2 && <SavingsStep {...stepProps} />}
            {step === 3 && <ExpensesStep {...stepProps} />}
            {step === 4 && <DebtsStep {...stepProps} />}
            {step === 5 && <EmergencyStep {...stepProps} />}
            {step === 6 && <ReviewStep {...stepProps} goToStep={goToStep} />}
            {step === 7 && (
              <DiagnosisStep data={data} diagnosis={calculateDiagnosis(data)} onRestart={onRestart} onOpenTool={onOpenTool} />
            )}
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
              <Porteiro><Suspense fallback={<p className="gs-mudo" role="status" style={{ padding: 16 }}>Carregando…</p>}>{children}</Suspense></Porteiro>
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
  return <AppShell>{guide ? <GuidePage guide={guide} onStart={onStart} /> : <NotFoundPage />}</AppShell>;
}

/** Os links antigos do painel (/painel#mes, #plano…) levam pra página nova de cada coisa. */
function PainelRedirect() {
  const { hash, search } = useLocation();
  const to: Record<string, string> = { '#mes': '/mes', '#plano': '/plano', '#pairico': '/plano', '#ferramentas': '/ferramentas' };
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
  if (!tool) {
    return (
      <AppShell>
        <NotFoundPage />
      </AppShell>
    );
  }
  const toolProps = { onClose, onSwitch };
  return (
    <AppShell>
      <LoginGate what={tool.title.charAt(0).toLowerCase() + tool.title.slice(1)}>
      <ToolOpened id={tool.id} />
      {/* key: trocar de ferramenta zera os campos da anterior */}
      <div key={tool.id} style={{ display: 'contents' }}>
        {tool.id === 'quote' && <QuoteTool {...toolProps} />}
        {tool.id === 'impulse' && <ImpulseTool monthlyIncome={data.monthlyIncome} {...toolProps} />}
        {tool.id === 'debts' && <DebtSimulator debts={data.debts} data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'selos' && <SelosPanel onStart={onStart} {...toolProps} />}
        {tool.id === 'checkin' && <CheckInTool {...toolProps} />}
        {tool.id === 'longterm' && <LongTermSimulator monthlyIncome={data.monthlyIncome} {...toolProps} />}
        {tool.id === 'goal' && <GoalCalculator data={data} {...toolProps} />}
        {tool.id === 'loan' && <LoanComparator {...toolProps} />}
        {tool.id === 'extra' && <ExtraMoneyTool data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'leaks' && <LeaksTool data={data} {...toolProps} />}
        {tool.id === 'rights' && <RightsTool data={data} {...toolProps} />}
        {tool.id === 'fatura' && <FaturaTool data={data} {...toolProps} />}
        {tool.id === 'tracker' && <PlanTracker data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'richdad' && <RichDadTool data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'bills' && <BillsTool {...toolProps} />}
      </div>
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
