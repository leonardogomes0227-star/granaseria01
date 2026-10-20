import type { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { richDad } from '../richdad';

/* ---------- Placar do Pai Rico, Pai Pobre ---------- */
// Quatro números do livro, com uma frase do que cada um quer dizer. Usado no resultado, no painel e na ferramenta.

export function RichDadCard({ data, compact = false }: { data: WizardData; compact?: boolean }) {
  const r = richDad(data);
  const months = r.monthsFree < 1 ? 'menos de 1 mês' : `${r.monthsFree.toFixed(r.monthsFree < 10 ? 1 : 0).replace('.', ',')} ${r.monthsFree < 2 ? 'mês' : 'meses'}`;
  return (
    <div className={`richdad stat-card ${compact ? 'compact' : ''}`}>
      <p className="diag-label">Viver de renda · Pai Rico, Pai Pobre</p>
      <p className={`richdad-level lvl-${r.level.id}`}>
        <b>{r.level.label}</b> {r.level.text}
      </p>
      <div className="richdad-grid">
        <div>
          <small>Sobra no mês</small>
          <b className={r.cashflow < 0 ? 'tone-text-bad' : ''}>{formatBRL(r.cashflow)}</b>
          <span>O que fica depois de pagar tudo.</span>
        </div>
        <div>
          <small>O que você tem − o que deve</small>
          <b className={r.netWorth < 0 ? 'tone-text-bad' : ''}>{formatBRL(r.netWorth)}</b>
          <span>{formatBRL(r.assets)} que você tem − {formatBRL(r.liabilities)} que deve.</span>
        </div>
        <div>
          <small>Se parar de trabalhar, dá pra viver</small>
          <b>{months}</b>
          <span>Pro livro, ser rico é ter esse tempo.</span>
        </div>
        <div>
          <small>Dinheiro que entra sem trabalhar paga</small>
          <b>{r.freedomPct.toFixed(0)}% dos gastos</b>
          <span>
            <i className="richdad-bar"><em style={{ width: `${Math.min(100, r.freedomPct)}%` }} /></i>
            {formatBRL(r.passiveIncome)} de {formatBRL(r.costOfLiving)} por mês.
          </span>
        </div>
      </div>
      {!compact && (
        <p className="field-hint" style={{ marginTop: 10 }}>
          Pra viver só do que seu dinheiro rende, sem trabalhar, você precisaria de uns {formatBRL(r.freedomTarget)} guardados e rendendo.
        </p>
      )}
    </div>
  );
}
