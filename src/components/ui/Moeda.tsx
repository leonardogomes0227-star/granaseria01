import { useId } from 'react';

/* ---------- A moeda da marca (Ouro Antigo, 6.9 e 9): ouro folheado com um "G" gravado ---------- */

export function Moeda({ tamanho = 28, className = '' }: { tamanho?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={`moeda-marca ${className}`} width={tamanho} height={tamanho} viewBox="0 0 64 64" role="img" aria-label="Grana Séria">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8A6420" />
          <stop offset="0.28" stopColor="#D9B76A" />
          <stop offset="0.45" stopColor="#F4E2AE" />
          <stop offset="0.62" stopColor="#C79A3E" />
          <stop offset="1" stopColor="#8A6420" />
        </linearGradient>
        <radialGradient id={`${id}-l`} cx="0.32" cy="0.28" r="0.75">
          <stop offset="0" stopColor="#FFF6D8" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#FFF6D8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}-f)`} />
      <circle cx="32" cy="32" r="30" fill={`url(#${id}-l)`} />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#7A5418" strokeOpacity="0.55" strokeWidth="1.4" />
      <circle cx="32" cy="32" r="27.5" fill="none" stroke="#7A5418" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="1.4 2.2" />
      <text x="32" y="42.5" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="29" fontWeight="600" fill="#6E4A12" fillOpacity="0.92">
        G
      </text>
      <text x="32.6" y="43" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize="29" fontWeight="600" fill="#FFF3CF" fillOpacity="0.25">
        G
      </text>
    </svg>
  );
}
