import { ArrowRight } from 'lucide-react';
import { hasDiagnosisCompleted } from '../config';
import { ToolShell, ToolNavProps } from './Tools';

/* ---------- Painel de selos ---------- */

const ALL_SELOS = [
  { numeral: 'I', label: 'Pague-se primeiro' },
  { numeral: 'II', label: 'Controle os gastos' },
  { numeral: 'III', label: 'Construa sua reserva' },
  { numeral: 'IV', label: 'Proteja-se de perdas' },
];

export function SelosPanel({ onStart, ...nav }: { onStart: () => void } & ToolNavProps) {
  const earned = hasDiagnosisCompleted();

  return (
    <ToolShell id="selos" {...nav}>
      <p className="wizard-sub">
        {earned
          ? 'Você completou o diagnóstico e conquistou os quatro selos das leis do livro.'
          : 'Complete o diagnóstico pra desbloquear os quatro selos das leis do livro.'}
      </p>

      <div className="selos-grid">
        {ALL_SELOS.map((s, i) => (
          <div className={`selo-tile ${earned ? 'earned' : 'locked'}`} key={s.numeral} style={{ animation: `rise 0.5s var(--ease-out) both ${i * 0.1}s` }}>
            <svg width="52" height="52" viewBox="0 0 48 48" style={{ animationDelay: `${0.2 + i * 0.12}s` }}>
              <circle cx="24" cy="24" r="21" fill={earned ? '#C6842A' : '#E9DBB4'} />
              <circle cx="24" cy="24" r="21" fill="none" stroke={earned ? '#7A5311' : '#DCC996'} strokeWidth="1.5" />
              <text x="24" y="31" textAnchor="middle" fontFamily="Cinzel, serif" fontSize="17" fill={earned ? '#3A2506' : '#B7A576'}>
                {s.numeral}
              </text>
            </svg>
            <p className="selo-tile-label">{s.label}</p>
          </div>
        ))}
      </div>

      {!earned && (
        <button className="btn-primary" type="button" onClick={onStart} style={{ marginTop: 16 }}>
          Fazer diagnóstico <ArrowRight size={16} className="arrow" />
        </button>
      )}
    </ToolShell>
  );
}
