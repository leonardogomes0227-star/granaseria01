import { useState } from 'react';
import {
  IntroStep,
  IncomeStep,
  SavingsStep,
  ExpensesStep,
  DebtsStep,
  EmergencyStep,
  DiagnosisStep,
} from './components/WizardSteps';
import { INITIAL_DATA, WizardData } from './types';
import { calculateDiagnosis } from './calculations';

function App() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);

  const update = (patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  const updateExpenses = (key: keyof WizardData['expenses'], value: number) => {
    setData((prev) => ({
      ...prev,
      expenses: { ...prev.expenses, [key]: value },
    }));
  };

  const onNext = () => setStep((s) => s + 1);
  const onBack = () => setStep((s) => Math.max(s - 1, 0));
  const onStart = () => setStep(1);
  const onRestart = () => {
    setData(INITIAL_DATA);
    setStep(0);
  };

  const stepProps = {
    data,
    update,
    updateExpenses,
    onNext,
    onBack,
    canNext: true,
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      {step === 0 && <IntroStep onStart={onStart} />}
      {step === 1 && <IncomeStep {...stepProps} canNext={data.monthlyIncome > 0} />}
      {step === 2 && <SavingsStep {...stepProps} />}
      {step === 3 && <ExpensesStep {...stepProps} />}
      {step === 4 && <DebtsStep {...stepProps} />}
      {step === 5 && <EmergencyStep {...stepProps} />}
      {step === 6 && (
        <DiagnosisStep data={data} diagnosis={calculateDiagnosis(data)} onRestart={onRestart} />
      )}
    </div>
  );
}

export default App;
