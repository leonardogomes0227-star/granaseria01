import { useEffect, useState, InputHTMLAttributes } from 'react';
import { digitarDinheiro } from './dinheiroCampo';

// Campo numérico no padrão brasileiro: formata enquanto digita ("4500" → "4.500", vírgula pros centavos).
// Substitui <input type="number">, que no celular não aceita vírgula direito e não mostra separador de milhar.

function formatNumber(value: number, decimals: number): string {
  if (!value) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals > 0 && value % 1 !== 0 ? decimals : 0,
    maximumFractionDigits: decimals,
  });
}

function parseText(text: string): number {
  const n = parseFloat(text.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function DecimalInput({
  value,
  onChange,
  decimals = 2,
  max = 99_999_999,
  className = 'field-input',
  ...rest
}: {
  value: number;
  onChange: (v: number) => void;
  decimals?: number;
  max?: number;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [text, setText] = useState(() => formatNumber(value, decimals));

  // valor mudou por fora (slider, botão "refazer"): reflete no campo sem atrapalhar quem está digitando
  useEffect(() => {
    setText((current) => (parseText(current) === value ? current : formatNumber(value, decimals)));
  }, [value, decimals]);

  const handleChange = (raw: string) => {
    const r = digitarDinheiro(raw, decimals, max);
    setText(r.texto);
    onChange(r.valor);
  };

  return (
    <input
      {...rest}
      className={className}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => {
        // arruma "12," → "12" ao sair do campo
        setText(formatNumber(parseText(text), decimals));
        rest.onBlur?.(e);
      }}
    />
  );
}
