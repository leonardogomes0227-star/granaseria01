import { forwardRef } from 'react';

type CurrencyInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
};

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ label, value, onChange, placeholder, hint, autoFocus }, ref) => {
    return (
      <div>
        <label className="field-label">{label}</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 text-lg font-sans pointer-events-none">
            R$
          </span>
          <input
            ref={ref}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={value === 0 ? '' : value}
            placeholder={placeholder ?? '0,00'}
            autoFocus={autoFocus}
            onChange={(e) => {
              const v = parseFloat(e.target.value.replace(',', '.'));
              onChange(isNaN(v) ? 0 : v);
            }}
            className="field-input pl-11"
          />
        </div>
        {hint && <p className="text-xs text-ink-300 mt-1.5">{hint}</p>}
      </div>
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';

export default CurrencyInput;
