import { PiggyBank, Target, Wallet } from 'lucide-react';
import { brl } from '../coachChat/engine';
import { whenText, type Plan } from '../coachChat/plan';

/* Os 3 itens do plano: guardar, gastar até, reserva pronta. O mesmo no chat e na Início. */

export function PlanItems({ plan, tone = 'light' }: { plan: Plan; tone?: 'light' | 'dark' }) {
  return (
    <ul className={`plan-items ${tone}`}>
      <li>
        <span className="plan-item-icon"><PiggyBank size={18} /></span>
        <span>
          <b>Guardar {brl(plan.aporte)} por mês</b>
          {plan.temDivida && <small>A dívida vem primeiro, depois a reserva</small>}
        </span>
      </li>
      <li>
        <span className="plan-item-icon"><Wallet size={18} /></span>
        <span><b>Gastar até {brl(plan.limite)} por mês</b><small>Além dos gastos fixos</small></span>
      </li>
      <li>
        <span className="plan-item-icon"><Target size={18} /></span>
        <span><b>Reserva pronta em {whenText(plan.previsao)}</b><small>Meta de {brl(plan.meta)} (6 meses de gastos fixos)</small></span>
      </li>
    </ul>
  );
}
