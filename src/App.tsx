import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
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
import { PrivacyPage, TermsPage, NotFoundPage } from './components/Pages';
import { Landing } from './components/Landing';
import { AppBar } from './components/Layout';
import { ToolId } from './tools';
import { INITIAL_DATA, WizardData } from './types';
import { calculateDiagnosis } from './calculations';

const STORAGE_KEY = 'selos-wizard-progress';

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

function App() {
  const [showWizard, setShowWizard] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(() => loadSavedProgress());

  // salva a cada mudança, mas só depois que a pessoa começou a preencher de verdade
  useEffect(() => {
    if (data.monthlyIncome > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step }));
    }
  }, [data, step]);

  const update = (patch: Partial<WizardData>) => setData((prev) => ({ ...prev, ...patch }));
  const updateExpenses = (key: keyof WizardData['expenses'], value: number) =>
    setData((prev) => ({ ...prev, expenses: { ...prev.expenses, [key]: value } }));

  const onNext = () => setStep((s) => s + 1);
  const onBack = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (s: number) => setStep(s);
  const startWizard = () => {
    setData(INITIAL_DATA);
    setStep(1);
    setActiveTool(null);
    setShowWizard(true);
  };
  const resumeWizard = () => {
    if (!savedProgress) return;
    setData(savedProgress.data);
    setStep(savedProgress.step);
    setActiveTool(null);
    setShowWizard(true);
  };
  const onRestart = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedProgress(null);
    setData(INITIAL_DATA);
    setStep(1);
    setShowWizard(false);
  };

  // As ferramentas usam a renda/dívidas do diagnóstico. Se a pessoa abriu direto da home,
  // reaproveita o que ficou salvo no navegador pra não pedir os números de novo.
  const openTool = (id: ToolId) => {
    if (data.monthlyIncome <= 0 && savedProgress) setData(savedProgress.data);
    setShowWizard(false);
    setActiveTool(id);
  };
  const goHome = () => {
    setShowWizard(false);
    setActiveTool(null);
    setSavedProgress(loadSavedProgress());
  };

  // toda troca de tela começa do topo
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [showWizard, activeTool, step]);

  const stepProps = { data, update, updateExpenses, onNext, onBack, canNext: true };

  const toolProps = { onClose: goHome, onSwitch: openTool };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            {!showWizard && !activeTool && (
              <Landing savedProgress={savedProgress} onStart={startWizard} onResume={resumeWizard} onOpenTool={openTool} />
            )}

            {(showWizard || activeTool) && <AppBar onHome={goHome} />}

            {showWizard && (
              <div className="wizard-wrap">
                <div key={step} className="anim-step" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  {step === 1 && <IncomeStep {...stepProps} canNext={data.monthlyIncome > 0} />}
                  {step === 2 && <SavingsStep {...stepProps} />}
                  {step === 3 && <ExpensesStep {...stepProps} />}
                  {step === 4 && <DebtsStep {...stepProps} />}
                  {step === 5 && <EmergencyStep {...stepProps} />}
                  {step === 6 && <ReviewStep {...stepProps} goToStep={goToStep} />}
                  {step === 7 && (
                    <DiagnosisStep data={data} diagnosis={calculateDiagnosis(data)} onRestart={onRestart} onOpenTool={openTool} />
                  )}
                </div>
              </div>
            )}

            {activeTool === 'impulse' && <ImpulseTool monthlyIncome={data.monthlyIncome} {...toolProps} />}
            {activeTool === 'debts' && <DebtSimulator debts={data.debts} onStart={startWizard} {...toolProps} />}
            {activeTool === 'selos' && <SelosPanel onStart={startWizard} {...toolProps} />}
            {activeTool === 'checkin' && <CheckInTool {...toolProps} />}
            {activeTool === 'longterm' && <LongTermSimulator monthlyIncome={data.monthlyIncome} {...toolProps} />}
            {activeTool === 'goal' && <GoalCalculator {...toolProps} />}
            {activeTool === 'loan' && <LoanComparator {...toolProps} />}
          </>
        }
      />
      <Route path="/politica-de-privacidade" element={<PrivacyPage />} />
      <Route path="/termos-de-uso" element={<TermsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
