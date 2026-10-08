import { useState, useEffect, ReactNode } from 'react';
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
import { PrivacyPage, TermsPage, NotFoundPage } from './components/Pages';
import { Landing } from './components/Landing';
import { AppBar, SiteFooter } from './components/Layout';
import { ToolId, getTool, getToolBySlug } from './tools';
import { INITIAL_DATA, WizardData } from './types';
import { calculateDiagnosis } from './calculations';

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
    document.title = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Diagnóstico financeiro`;
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
  const openTool = (id: ToolId) => navigate(`/ferramentas/${getTool(id).slug}`);
  const goHome = () => {
    setSavedProgress(loadSavedProgress());
    navigate('/');
  };
  const backToTools = () => {
    setSavedProgress(loadSavedProgress());
    navigate('/#ferramentas');
  };

  useEffect(() => {
    if (location.pathname === '/') setSavedProgress(loadSavedProgress());
  }, [location.pathname]);

  const footer = <SiteFooter onStart={startWizard} onOpenTool={openTool} />;

  return (
    <>
      <ScrollManager />
      <Routes>
        <Route
          path="/"
          element={
            <Titled title={null}>
              <Landing savedProgress={savedProgress} onStart={startWizard} onResume={resumeWizard} onOpenTool={openTool} />
            </Titled>
          }
        />
        <Route
          path="/diagnostico"
          element={
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
          }
        />
        <Route
          path="/ferramentas/:slug"
          element={<ToolRoute data={data} onClose={backToTools} onHome={goHome} onSwitch={openTool} onStart={startWizard} />}
        />
        <Route path="/ferramentas" element={<Navigate to="/#ferramentas" replace />} />
        <Route
          path="/politica-de-privacidade"
          element={
            <Titled title="Política de privacidade">
              <AppBar onHome={goHome} />
              <PrivacyPage />
              {footer}
            </Titled>
          }
        />
        <Route
          path="/termos-de-uso"
          element={
            <Titled title="Termos de uso">
              <AppBar onHome={goHome} />
              <TermsPage />
              {footer}
            </Titled>
          }
        />
        <Route
          path="*"
          element={
            <Titled title="Página não encontrada">
              <AppBar onHome={goHome} />
              <NotFoundPage />
            </Titled>
          }
        />
      </Routes>
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

  useTitle(step === TOTAL_STEPS ? 'Seu diagnóstico' : `Diagnóstico — etapa ${step} de ${TOTAL_STEPS}`);

  useEffect(() => {
    if (!blocked) return;
    const saved = loadSavedProgress();
    if (saved) setData(saved.data);
    else navigate('/diagnostico?etapa=1', { replace: true });
  }, [blocked, setData, navigate]);

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

function ToolRoute({
  data,
  onClose,
  onHome,
  onSwitch,
  onStart,
}: {
  data: WizardData;
  onClose: () => void;
  onHome: () => void;
  onSwitch: (id: ToolId) => void;
  onStart: () => void;
}) {
  const { slug } = useParams();
  const tool = getToolBySlug(slug);
  useTitle(tool ? tool.title : 'Página não encontrada');
  if (!tool) {
    return (
      <>
        <AppBar onHome={onHome} />
        <NotFoundPage />
      </>
    );
  }
  const toolProps = { onClose, onSwitch };
  return (
    <>
      <AppBar onHome={onHome} />
      {/* key: trocar de ferramenta zera os campos da anterior */}
      <div key={tool.id} style={{ display: 'contents' }}>
        {tool.id === 'quote' && <QuoteTool {...toolProps} />}
        {tool.id === 'impulse' && <ImpulseTool monthlyIncome={data.monthlyIncome} {...toolProps} />}
        {tool.id === 'debts' && <DebtSimulator debts={data.debts} onStart={onStart} {...toolProps} />}
        {tool.id === 'selos' && <SelosPanel onStart={onStart} {...toolProps} />}
        {tool.id === 'checkin' && <CheckInTool {...toolProps} />}
        {tool.id === 'longterm' && <LongTermSimulator monthlyIncome={data.monthlyIncome} {...toolProps} />}
        {tool.id === 'goal' && <GoalCalculator {...toolProps} />}
        {tool.id === 'loan' && <LoanComparator {...toolProps} />}
        {tool.id === 'extra' && <ExtraMoneyTool data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'leaks' && <LeaksTool data={data} {...toolProps} />}
        {tool.id === 'rights' && <RightsTool data={data} {...toolProps} />}
        {tool.id === 'tracker' && <PlanTracker data={data} onStart={onStart} {...toolProps} />}
      </div>
    </>
  );
}

export default App;
