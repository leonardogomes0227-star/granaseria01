// Os passos do diagnóstico (/diagnostico), num pacote separado: só é baixado por quem faz o diagnóstico.
import { IncomeStep, SavingsStep, ExpensesStep, DebtsStep, EmergencyStep, ReviewStep, DiagnosisStep } from './WizardSteps';
import { calculateDiagnosis } from '../calculations';
import type { ToolId } from '../tools';
import type { WizardData } from '../types';

type StepProps = Parameters<typeof IncomeStep>[0];

export function PassoDoDiagnostico({ step, stepProps, data, goToStep, onRestart, onOpenTool }: { step: number; stepProps: StepProps; data: WizardData; goToStep: (s: number) => void; onRestart: () => void; onOpenTool: (id: ToolId) => void }) {
  return (
    <>
            {step === 1 && <IncomeStep {...stepProps} canNext={data.monthlyIncome > 0} />}
            {step === 2 && <SavingsStep {...stepProps} />}
            {step === 3 && <ExpensesStep {...stepProps} />}
            {step === 4 && <DebtsStep {...stepProps} />}
            {step === 5 && <EmergencyStep {...stepProps} />}
            {step === 6 && <ReviewStep {...stepProps} goToStep={goToStep} />}
            {step === 7 && (
              <DiagnosisStep data={data} diagnosis={calculateDiagnosis(data)} onRestart={onRestart} onOpenTool={onOpenTool} />
            )}
    </>
  );
}
