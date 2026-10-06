import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
import { PrivacyPage, TermsPage, NotFoundPage } from './components/Pages';
import { Landing } from './components/Landing';
import { AppBar, SiteFooter } from './components/Layout';
import { ToolId, getTool, getToolBySlug } from './tools';
import { INITIAL_DATA, WizardData } from './types';
import { calculateDiagnosis } from './calculations';
import { RotateCcw } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { AuthPage, RequireAuth, LoadingScreen } from './components/Auth';
import { authLink } from './lib/redirect';
import { GastosPage } from './components/Gastos';
import { DiagnosticoRow, fetchLatestDiagnostico, saveDiagnostico } from './lib/diagnosticos';
import { translateDbError } from './lib/authErrors';

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

/** JSON com chaves ordenadas — o jsonb do Postgres não preserva a ordem, então comparamos assim. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Respostas vindas do banco completadas com os campos padrão (caso algum falte). */
function normalizeRespostas(r: Partial<WizardData> | null | undefined): WizardData {
  return {
    ...INITIAL_DATA,
    ...(r ?? {}),
    expenses: { ...INITIAL_DATA.expenses, ...(r?.expenses ?? {}) },
    debts: Array.isArray(r?.debts) ? r!.debts : [],
  };
}

function Titled({ title, children }: { title: string | null; children: ReactNode }) {
  useTitle(title);
  return <>{children}</>;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(() => loadSavedProgress());
  // começa com o que ficou salvo: assim as ferramentas já chegam com a renda/dívidas preenchidas
  const [data, setData] = useState<WizardData>(() => loadSavedProgress()?.data ?? INITIAL_DATA);

  const update = (patch: Partial<WizardData>) => setData((prev) => ({ ...prev, ...patch }));
  const updateExpenses = (key: keyof WizardData['expenses'], value: number) =>
    setData((prev) => ({ ...prev, expenses: { ...prev.expenses, [key]: value } }));

  const goToStep = (s: number) => navigate(`/diagnostico?etapa=${s}`);
  // o diagnóstico exige conta: sem sessão, passa pelo cadastro e volta pro destino
  const goProtected = (target: string) => navigate(user ? target : authLink('cadastro', target));
  const startWizard = () => {
    setData(INITIAL_DATA);
    // /diagnostico sem etapa: mostra o último resultado salvo, ou começa do zero se não houver
    goProtected('/diagnostico');
  };
  const restartFresh = () => {
    clearProgress();
    setSavedProgress(null);
    setData(INITIAL_DATA);
    goProtected('/diagnostico?etapa=1');
  };
  const resumeWizard = () => {
    if (!savedProgress) return;
    setData(savedProgress.data);
    goProtected(`/diagnostico?etapa=${savedProgress.step}`);
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

  // saiu da conta (ou trocou de conta): o progresso local era da pessoa anterior
  const prevUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading) return;
    const id = user?.id ?? null;
    if (prevUserId.current && prevUserId.current !== id) {
      clearProgress();
      setSavedProgress(null);
      setData(INITIAL_DATA);
    }
    prevUserId.current = id;
  }, [user, authLoading]);

  const footer = <SiteFooter onStart={startWizard} onOpenTool={openTool} />;

  return (
    <>
      <ScrollManager />
      <Routes>
        <Route
          path="/"
          element={
            <Titled title={null}>
              <Landing
                savedProgress={savedProgress}
                onStart={startWizard}
                onResume={resumeWizard}
                onRestart={restartFresh}
                onOpenTool={openTool}
              />
            </Titled>
          }
        />
        <Route
          path="/diagnostico"
          element={
            <RequireAuth>
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
            </RequireAuth>
          }
        />
        <Route
          path="/entrar"
          element={
            <Titled title="Entrar">
              <AppBar onHome={goHome} />
              <AuthPage mode="entrar" />
            </Titled>
          }
        />
        <Route
          path="/cadastro"
          element={
            <Titled title="Criar conta">
              <AppBar onHome={goHome} />
              <AuthPage mode="cadastro" />
            </Titled>
          }
        />
        <Route
          path="/meus-gastos"
          element={
            <Titled title="Meus gastos">
              <AppBar onHome={goHome} />
              <RequireAuth>
                <GastosPage />
              </RequireAuth>
            </Titled>
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
  const { user } = useAuth();
  const userId = user?.id ?? '';
  // sem ?etapa= é a "entrada": mostra o último diagnóstico salvo, se houver
  const isEntry = !params.has('etapa');
  const parsed = parseInt(params.get('etapa') || '1', 10);
  const step = Math.min(Math.max(isNaN(parsed) ? 1 : parsed, 1), TOTAL_STEPS);
  // sem renda não dá pra estar além da etapa 1 (ex.: link direto pra ?etapa=5 sem nada preenchido)
  const blocked = !isEntry && step > 1 && data.monthlyIncome <= 0;

  useTitle(isEntry || step === TOTAL_STEPS ? 'Seu diagnóstico' : `Diagnóstico — etapa ${step} de ${TOTAL_STEPS}`);

  // último diagnóstico salvo na conta
  const [latest, setLatest] = useState<{ status: 'loading' | 'ready' | 'error'; row: DiagnosticoRow | null; error?: string }>({
    status: 'loading',
    row: null,
  });
  const loadLatest = useCallback(async () => {
    if (!userId) return;
    setLatest({ status: 'loading', row: null });
    try {
      setLatest({ status: 'ready', row: await fetchLatestDiagnostico(userId) });
    } catch (e) {
      setLatest({ status: 'error', row: null, error: translateDbError(e) });
    }
  }, [userId]);
  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  // ao mostrar o diagnóstico salvo, as ferramentas também passam a usar esses números
  const savedRow = latest.row;
  useEffect(() => {
    if (isEntry && savedRow && data.monthlyIncome <= 0) setData(normalizeRespostas(savedRow.respostas));
  }, [isEntry, savedRow, data.monthlyIncome, setData]);

  // salva o diagnóstico na conta assim que a pessoa chega ao resultado
  const [save, setSave] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; error?: string }>({ status: 'idle' });
  const savedKeyRef = useRef<string | null>(null);
  const persist = useCallback(async () => {
    savedKeyRef.current = stableStringify(data);
    setSave({ status: 'saving' });
    try {
      const row = await saveDiagnostico(userId, data, calculateDiagnosis(data));
      setLatest({ status: 'ready', row });
      setSave({ status: 'saved' });
    } catch (e) {
      savedKeyRef.current = null;
      setSave({ status: 'error', error: translateDbError(e) });
    }
  }, [data, userId]);

  const atResult = !isEntry && step === TOTAL_STEPS && !blocked && data.monthlyIncome > 0;
  useEffect(() => {
    if (!atResult || !userId || latest.status === 'loading') return;
    const key = stableStringify(data);
    if (savedKeyRef.current === key) return;
    // mesmo resultado que já está salvo (ex.: recarregou a página no resultado): não duplica
    if (latest.row && stableStringify(normalizeRespostas(latest.row.respostas)) === key) {
      savedKeyRef.current = key;
      setSave({ status: 'saved' });
      return;
    }
    persist();
  }, [atResult, userId, data, latest.status, latest.row, persist]);

  useEffect(() => {
    if (!blocked) return;
    const saved = loadSavedProgress();
    if (saved) setData(saved.data);
    else navigate('/diagnostico?etapa=1', { replace: true });
  }, [blocked, setData, navigate]);

  // salva a cada mudança, mas só depois que a pessoa começou a preencher de verdade
  useEffect(() => {
    if (!isEntry && data.monthlyIncome > 0) saveProgress({ data, step });
  }, [data, step, isEntry]);

  const stepProps = {
    data,
    update,
    updateExpenses,
    onNext: () => goToStep(step + 1),
    onBack: () => goToStep(Math.max(step - 1, 1)),
    canNext: true,
  };

  if (isEntry) {
    if (latest.status === 'loading') {
      return (
        <>
          <AppBar onHome={onHome} />
          <LoadingScreen label="Buscando seu último diagnóstico…" />
        </>
      );
    }
    if (latest.status === 'error') {
      return (
        <>
          <AppBar onHome={onHome} />
          <div className="wizard-wrap">
            <div className="wizard-card anim-in">
              <div className="wizard-kicker"><span className="wedge" />Seu diagnóstico</div>
              <h2 className="wizard-h2">Não conseguimos carregar seu diagnóstico</h2>
              <div className="insight insight-bad" role="alert" style={{ margin: '8px 0 20px' }}>{latest.error}</div>
              <div className="wizard-nav">
                <button className="btn-outline" type="button" onClick={() => goToStep(1)}>Começar um novo</button>
                <button className="btn-primary" type="button" onClick={loadLatest}>
                  <RotateCcw size={15} /> Tentar de novo
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }
    if (!latest.row) return <Navigate to="/diagnostico?etapa=1" replace />;

    const respostas = normalizeRespostas(latest.row.respostas);
    const savedDiagnosis = latest.row.resultado?.diagnostico ?? calculateDiagnosis(respostas);
    return (
      <>
        <AppBar onHome={onHome} />
        <div className="wizard-wrap">
          <div className="wizard-stack anim-step">
            <div className="saved-meta">
              <p className="msg">
                <b>Seu último diagnóstico</b> · feito em{' '}
                {new Date(latest.row.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <button className="btn-outline" type="button" onClick={onRestart}>
                <RotateCcw size={14} /> Refazer diagnóstico
              </button>
            </div>
            <DiagnosisStep data={respostas} diagnosis={savedDiagnosis} onRestart={onRestart} onOpenTool={onOpenTool} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppBar onHome={onHome} />
      <div className={`wizard-wrap ${atResult && save.status !== 'idle' ? 'stacked' : ''}`}>
        {atResult && save.status !== 'idle' && (
          <div className="wizard-stack" style={{ marginBottom: 14 }}>
            {save.status === 'saving' && (
              <div className="insight insight-info save-status" role="status">
                <span className="btn-spinner gold" aria-hidden="true" /> Salvando seu diagnóstico na sua conta…
              </div>
            )}
            {save.status === 'saved' && (
              <div className="insight insight-good save-status" role="status">
                Diagnóstico salvo na sua conta — da próxima vez que entrar, ele estará aqui.
              </div>
            )}
            {save.status === 'error' && (
              <div className="insight insight-bad save-status" role="alert">
                Não foi possível salvar seu diagnóstico. {save.error}{' '}
                <button type="button" className="link-btn" onClick={persist}>
                  <RotateCcw size={13} /> Tentar de novo
                </button>
              </div>
            )}
          </div>
        )}
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
      </div>
    </>
  );
}

export default App;
