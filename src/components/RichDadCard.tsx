import { Check } from 'lucide-react';
import type { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { richDad } from '../richdad';

/* ---------- Viver de renda (Pai Rico, Pai Pobre) ---------- */
// Uma pergunta, um número e a escada até a liberdade: 1) parar de ficar no vermelho, 2) ter uma reserva,
// 3) o dinheiro rendendo pagar as contas. Usado no resultado, no painel e na ferramenta.

export function RichDadCard({ data, compact = false }: { data: WizardData; compact?: boolean }) {
  const r = richDad(data);
  const months = r.monthsFree < 1 ? 'menos de 1 mês' : `${r.monthsFree.toFixed(r.monthsFree < 10 ? 1 : 0).replace('.', ',')} ${r.monthsFree < 2 ? 'mês' : 'meses'}`;
  const steps = [
    {
      title: 'Sobrar dinheiro todo mês',
      done: r.cashflow > 0,
      now: r.cashflow > 0 ? `Sobra ${formatBRL(r.cashflow)} por mês` : r.cashflow < 0 ? `Falta ${formatBRL(-r.cashflow)} por mês` : 'Não sobra nada',
    },
    {
      title: 'Ter 6 meses guardados',
      done: r.monthsFree >= 6,
      now: `Hoje: ${months}`,
    },
    {
      title: 'O dinheiro rendendo pagar suas contas',
      done: r.freedomPct >= 100,
      now: `Hoje paga ${r.freedomPct.toFixed(0)}% · precisa de uns ${formatBRL(r.freedomTarget)} rendendo`,
    },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <div className={`richdad stat-card ${compact ? 'compact' : ''}`}>
      <p className="richdad-q">Se o salário parasse hoje, você viveria</p>
      <p className="richdad-big">{months}</p>
      <p className="richdad-sub">{r.level.label}. Rico, pro livro, é quem vive sem depender do salário.</p>
      {!compact && (
        <ol className="ladder">
          {steps.map((s, i) => (
            <li key={i} className={s.done ? 'done' : i === current ? 'now' : ''}>
              <span className="ladder-n">{s.done ? <Check size={14} /> : i + 1}</span>
              <span>
                <b>{s.title}</b>
                <small>{s.now}</small>
              </span>
              {i === current && <em>Você está aqui</em>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
