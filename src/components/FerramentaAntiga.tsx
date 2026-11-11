// As ferramentas antigas de /ferramentas/:slug, num pacote separado: só é baixado quando alguém abre uma delas.
import type { ToolId } from '../tools';
import type { WizardData } from '../types';
import { ImpulseTool, DebtSimulator, LongTermSimulator, GoalCalculator, LoanComparator } from './Tools';
import { SelosPanel } from './SelosAndShare';
import { CheckInTool } from './CheckIn';
import { QuoteTool } from './QuoteTool';
import { ExtraMoneyTool, LeaksTool, RightsTool } from './SolutionTools';
import { PlanTracker } from './PlanTracker';
import { FaturaTool } from './FaturaTool';
import { RichDadTool } from './RichDadTool';
import { BillsTool } from './BillsTool';

export function FerramentaAntiga({ id, data, onClose, onSwitch, onStart }: { id: ToolId; data: WizardData; onClose: () => void; onSwitch: (id: ToolId) => void; onStart: () => void }) {
  const toolProps = { onClose, onSwitch };
  const tool = { id };
  return (
      <div key={tool.id} style={{ display: 'contents' }}>
        {tool.id === 'quote' && <QuoteTool {...toolProps} />}
        {tool.id === 'impulse' && <ImpulseTool monthlyIncome={data.monthlyIncome} {...toolProps} />}
        {tool.id === 'debts' && <DebtSimulator debts={data.debts} data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'selos' && <SelosPanel onStart={onStart} {...toolProps} />}
        {tool.id === 'checkin' && <CheckInTool {...toolProps} />}
        {tool.id === 'longterm' && <LongTermSimulator monthlyIncome={data.monthlyIncome} {...toolProps} />}
        {tool.id === 'goal' && <GoalCalculator data={data} {...toolProps} />}
        {tool.id === 'loan' && <LoanComparator {...toolProps} />}
        {tool.id === 'extra' && <ExtraMoneyTool data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'leaks' && <LeaksTool data={data} {...toolProps} />}
        {tool.id === 'rights' && <RightsTool data={data} {...toolProps} />}
        {tool.id === 'fatura' && <FaturaTool data={data} {...toolProps} />}
        {tool.id === 'tracker' && <PlanTracker data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'richdad' && <RichDadTool data={data} onStart={onStart} {...toolProps} />}
        {tool.id === 'bills' && <BillsTool {...toolProps} />}
      </div>
  );
}
