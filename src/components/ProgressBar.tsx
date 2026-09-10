import { TOTAL_STEPS } from '@/types';

type ProgressBarProps = {
  currentStep: number;
};

export default function ProgressBar({ currentStep }: ProgressBarProps) {
  const pct = (currentStep / (TOTAL_STEPS - 1)) * 100;
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-ink-600">
        <div
          className="h-full bg-gold transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
