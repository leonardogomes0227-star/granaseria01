import { useMemo, useState } from 'react';
import ProgressBar from '@/components/ProgressBar';
import {
  DebtsStep,
  DiagnosisStep,
  EmergencyStep,
  ExpensesStep,
  IncomeStep,
  IntroStep,
  SavingsStep,
} from '@/components/WizardSteps';
import { calculateDiagnosis } from '@/calculations';
import { INITIAL_DATA, TOTAL_STEPS, WizardData } from '@/types';

function App() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);

  const diagnosis = useMemo(() => calculateDiagnosis(data), [data]);

  const update = (patch: Partial<WizardData>) => {
    setData((current) => ({ ...current, ...patch }));
  };

  const updateExpenses = (key: keyof WizardData['expenses'], value: number) => {
    setData((current) => ({
      ...current,
      expenses: { ...current.expenses, [key]: value },
    }));
  };

  const goNext = () => setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep((current) => Math.max(current - 1, 1));
  const restart = () => {
    setData(INITIAL_DATA);
    setStep(0);
  };

  const sharedProps = {
    data,
    update,
    updateExpenses,
    onNext: goNext,
    onBack: goBack,
    canNext: true,
  };

  return (
    <main className="min-h-screen bg-ink-800 flex flex-col">
      {step > 0 && <ProgressBar currentStep={step} />}
      <header className="w-full max-w-6xl mx-auto px-6 sm:px-10 pt-7 sm:pt-9">
        <button type="button" onClick={restart} className="flex items-center gap-2 group" aria-label="Voltar ao início">
          <span className="w-7 h-7 rounded-full border border-gold/70 flex items-center justify-center group-hover:border-gold transition-colors">
            <span className="w-2 h-2 rounded-full bg-gold" />
          </span>
          <span className="font-serif text-lg text-ink-100 group-hover:text-gold transition-colors">Grana Séria</span>
        </button>
      </header>

      <div className="flex-1 flex items-start justify-center px-6 sm:px-10 py-12 sm:py-16">
        {step === 0 && <IntroStep onStart={goNext} />}
        {step === 1 && <IncomeStep {...sharedProps} />}
        {step === 2 && <SavingsStep {...sharedProps} />}
        {step === 3 && <ExpensesStep {...sharedProps} />}
        {step === 4 && <DebtsStep {...sharedProps} />}
        {step === 5 && <EmergencyStep {...sharedProps} />}
        {step === 6 && <DiagnosisStep data={data} diagnosis={diagnosis} onRestart={restart} />}
      </div>

      {step > 0 && step < 6 && (
        <div className="text-center pb-7 sm:pb-9 text-ink-400 text-[11px] tracking-wide">Etapa {step} de 5</div>
      )}
      {step === 0 && <div className="text-center pb-7 sm:pb-9 text-ink-400 text-[11px] tracking-wide">Leva menos de 2 minutos</div>}
    </main>
  );
}

export default App;
