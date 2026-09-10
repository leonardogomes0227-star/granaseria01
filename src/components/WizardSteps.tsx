import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  Car,
  Check,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Gamepad2,
  Home,
  Plus,
  ShieldCheck,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import CurrencyInput from './CurrencyInput';
import { Debt, EXPENSE_CATEGORIES, WizardData } from '@/types';
import { Diagnosis, fmtBRL, fmtPct } from '@/calculations';

type StepProps = {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  updateExpenses: (key: keyof WizardData['expenses'], value: number) => void;
  onNext: () => void;
  onBack: () => void;
  canNext: boolean;
};

const stepMeta = [
  { eyebrow: 'Seu ponto de partida', title: 'Quanto entra todo mês?', subtitle: 'Considere sua renda líquida: o valor que realmente cai na sua conta.' },
  { eyebrow: 'Selo 1 · Pague-se primeiro', title: 'Quanto você guarda hoje?', subtitle: 'Antes de qualquer gasto, separar uma parte da renda é o primeiro passo para construir riqueza.' },
  { eyebrow: 'Selo 2 · Controle os gastos', title: 'Para onde vai o seu dinheiro?', subtitle: 'Use valores médios mensais. Não precisa ser perfeito — precisa ser honesto.' },
  { eyebrow: 'Selo 4 · Proteja-se de perdas', title: 'Você tem dívidas?', subtitle: 'Liste cada uma delas. Ter clareza é o começo para recuperar o controle.' },
  { eyebrow: 'Sua rede de segurança', title: 'Quanto você já tem de reserva?', subtitle: 'Inclua o dinheiro guardado para imprevistos, que pode ser acessado rapidamente.' },
];

function StepLayout({ children, step, onNext, onBack, canNext, nextLabel = 'Continuar' }: StepProps & { children: React.ReactNode; step: number; nextLabel?: string }) {
  const meta = stepMeta[step - 1];
  return (
    <div className="w-full max-w-wizard animate-fade-up">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-5">
          <span className="h-px w-6 bg-gold" />
          <span className="text-gold text-xs font-semibold uppercase tracking-[0.18em]">{meta.eyebrow}</span>
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl leading-[1.1] text-ink-100 mb-4">{meta.title}</h1>
        <p className="text-ink-200 leading-relaxed text-base">{meta.subtitle}</p>
      </div>
      {children}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-ink-600">
        <button type="button" onClick={onBack} className="btn-ghost flex items-center gap-2 -ml-4">
          <ArrowLeft size={16} /> Voltar
        </button>
        <button type="button" onClick={onNext} disabled={!canNext} className="btn-primary flex items-center gap-2">
          {nextLabel} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function IntroStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full max-w-wizard text-center animate-fade-up">
      <div className="mx-auto mb-9 w-16 h-16 border border-gold/60 rounded-full flex items-center justify-center relative">
        <div className="absolute inset-1.5 border border-gold/20 rounded-full" />
        <Coins size={25} className="text-gold" strokeWidth={1.5} />
      </div>
      <div className="flex items-center justify-center gap-2 mb-5">
        <span className="h-px w-8 bg-gold" />
        <span className="text-gold text-xs font-semibold uppercase tracking-[0.2em]">Um diagnóstico para a vida real</span>
        <span className="h-px w-8 bg-gold" />
      </div>
      <h1 className="font-serif text-5xl sm:text-7xl leading-[0.98] text-ink-100 mb-7">
        Grana<br /><span className="text-gold">Séria.</span>
      </h1>
      <p className="text-ink-200 text-lg leading-relaxed max-w-md mx-auto mb-10">
        Clareza sobre seu dinheiro. Um plano que cabe na sua realidade.
      </p>
      <button type="button" onClick={onStart} className="btn-primary inline-flex items-center gap-3 px-8 py-4 text-base">
        Começar <ChevronRight size={18} />
      </button>
      <p className="text-ink-300 text-xs mt-8">Inspirado nos princípios de <em>O Homem Mais Rico da Babilônia</em></p>
    </div>
  );
}

export function IncomeStep(props: StepProps) {
  return <StepLayout {...props} step={1}><CurrencyInput label="Renda líquida mensal" value={props.data.monthlyIncome} onChange={(v) => props.update({ monthlyIncome: v })} hint="O que sobra depois dos descontos." autoFocus /></StepLayout>;
}

export function SavingsStep(props: StepProps) {
  return <StepLayout {...props} step={2}><CurrencyInput label="Poupança mensal atual" value={props.data.monthlySavings} onChange={(v) => props.update({ monthlySavings: v })} hint="Se ainda não guarda nada, deixe em branco." autoFocus /></StepLayout>;
}

const categoryIcons = { Home, UtensilsCrossed, Car, Gamepad2 };

export function ExpensesStep(props: StepProps) {
  return (
    <StepLayout {...props} step={3}>
      <div className="space-y-5">
        {EXPENSE_CATEGORIES.map((category) => {
          const Icon = categoryIcons[category.icon as keyof typeof categoryIcons];
          return (
            <div key={category.key} className="flex items-end gap-3">
              <div className="w-9 h-10 flex items-center justify-center text-ink-300">
                <Icon size={19} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <CurrencyInput label={`${category.label} · ideal até ${category.idealPct * 100}%`} value={props.data.expenses[category.key]} onChange={(v) => props.updateExpenses(category.key, v)} />
              </div>
            </div>
          );
        })}
      </div>
    </StepLayout>
  );
}

function DebtRow({ debt, onChange, onRemove, isOnly }: { debt: Debt; onChange: (debt: Debt) => void; onRemove: () => void; isOnly: boolean }) {
  return (
    <div className="flex gap-2 items-start">
      <input type="text" value={debt.description} onChange={(e) => onChange({ ...debt, description: e.target.value })} placeholder="Ex: cartão de crédito" className="field-input flex-1 text-base" autoFocus={isOnly} />
      <div className="relative w-32 sm:w-36 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 text-sm pointer-events-none">R$</span>
        <input type="number" min={0} step="0.01" value={debt.amount || ''} onChange={(e) => onChange({ ...debt, amount: Number(e.target.value) || 0 })} placeholder="0,00" className="field-input pl-9 text-base" />
      </div>
      <button type="button" onClick={onRemove} className="h-12 w-10 flex items-center justify-center text-ink-300 hover:text-terracota transition-colors" aria-label="Remover dívida"><Trash2 size={17} /></button>
    </div>
  );
}

export function DebtsStep(props: StepProps) {
  const debts = props.data.debts;
  const total = debts.reduce((sum, debt) => sum + debt.amount, 0);
  const setDebts = (nextDebts: Debt[]) => props.update({ debts: nextDebts });
  const addDebt = () => setDebts([...debts, { id: crypto.randomUUID(), description: '', amount: 0 }]);
  return (
    <StepLayout {...props} step={4} nextLabel="Ver meu diagnóstico">
      <div className="space-y-3">
        {debts.map((debt) => <DebtRow key={debt.id} debt={debt} isOnly={debts.length === 1} onChange={(updated) => setDebts(debts.map((item) => item.id === updated.id ? updated : item))} onRemove={() => setDebts(debts.filter((item) => item.id !== debt.id))} />)}
        <button type="button" onClick={addDebt} className="flex items-center gap-2 text-gold hover:text-gold-light text-sm font-medium py-2 transition-colors"><Plus size={16} /> Adicionar dívida</button>
      </div>
      <div className="mt-8 bg-ink-700 border border-ink-600 rounded-lg px-5 py-4 flex items-center justify-between">
        <span className="text-ink-200 text-sm">Total das dívidas</span>
        <span className={`font-serif text-2xl ${total > 0 ? 'text-terracota-light' : 'text-sage-light'}`}>{fmtBRL(total)}</span>
      </div>
    </StepLayout>
  );
}

export function EmergencyStep(props: StepProps) {
  return <StepLayout {...props} step={5}><CurrencyInput label="Reserva já guardada" value={props.data.emergencyFund} onChange={(v) => props.update({ emergencyFund: v })} hint="Aquele dinheiro que não é para gastar no dia a dia." autoFocus /></StepLayout>;
}

function ProgressRing({ progress }: { progress: number }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#2B373D" strokeWidth="7" />
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#6E9A78" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-serif text-2xl text-sage-light">{Math.round(progress * 100)}%</div>
    </div>
  );
}

function CategoryBar({ item }: { item: Diagnosis['categoryAnalysis'][number] }) {
  const scale = Math.max(item.pctOfIncome, item.idealPct, 0.01);
  const actualWidth = Math.min((item.pctOfIncome / scale) * 100, 100);
  const idealPosition = Math.min((item.idealPct / scale) * 100, 100);
  return (
    <div className="py-4 border-b border-ink-600 last:border-0">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-ink-100 text-sm font-medium">{item.label}</span>
        <span className={item.overBudget ? 'text-terracota-light text-sm' : 'text-sage-light text-sm'}>{fmtBRL(item.amount)} <span className="text-ink-300">· {fmtPct(item.pctOfIncome)}</span></span>
      </div>
      <div className="relative h-2 bg-ink-600 rounded-full">
        <div className={`h-full rounded-full animate-grow ${item.overBudget ? 'bg-terracota' : 'bg-sage'}`} style={{ width: `${actualWidth}%` }} />
        <div className="absolute top-[-4px] h-4 border-l-2 border-gold" style={{ left: `${idealPosition}%` }} title={`Ideal: ${fmtPct(item.idealPct)}`} />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-ink-300"><span>0%</span><span className="text-gold">ideal {fmtPct(item.idealPct)}</span></div>
    </div>
  );
}

export function DiagnosisStep({ data, diagnosis, onRestart }: { data: WizardData; diagnosis: Diagnosis; onRestart: () => void }) {
  const { compoundProjection: projection } = diagnosis;
  return (
    <div className="w-full max-w-2xl animate-fade-up">
      <div className="mb-9">
        <div className="flex items-center gap-2 mb-5"><span className="h-px w-6 bg-gold" /><span className="text-gold text-xs font-semibold uppercase tracking-[0.18em]">Seu diagnóstico</span></div>
        <h1 className="font-serif text-4xl sm:text-5xl leading-[1.1] text-ink-100 mb-4">Dinheiro com<br /><span className="text-gold">direção.</span></h1>
        <p className="text-ink-200 leading-relaxed">Aqui está o retrato da sua vida financeira hoje — e por onde começar a transformar.</p>
      </div>

      <section className="bg-ink-700 border border-ink-600 rounded-xl p-5 sm:p-7 mb-4">
        <div className="flex items-center gap-3 mb-6"><BadgeDollarSign size={20} className="text-gold" /><h2 className="font-serif text-xl text-ink-100">Pague-se primeiro</h2></div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div><p className="text-sm text-ink-300 mb-1">Sua meta mensal</p><p className="font-serif text-3xl text-gold">{fmtBRL(diagnosis.savingsTarget)}</p><p className="text-xs text-ink-300 mt-1">10% da sua renda</p></div>
          <div className="sm:text-right"><p className="text-sm text-ink-300 mb-1">Você guarda hoje</p><p className={`font-serif text-2xl ${diagnosis.savingsStatus === 'below' ? 'text-terracota-light' : 'text-sage-light'}`}>{fmtBRL(data.monthlySavings)}</p><p className={`text-xs mt-1 ${diagnosis.savingsStatus === 'below' ? 'text-terracota-light' : 'text-sage-light'}`}>{diagnosis.savingsStatus === 'below' ? `Faltam ${fmtBRL(Math.abs(diagnosis.savingsDiff))}` : 'Meta alcançada'}</p></div>
        </div>
        <div className="mt-6 h-2 bg-ink-600 rounded-full overflow-hidden"><div className={`h-full rounded-full animate-grow ${diagnosis.savingsStatus === 'below' ? 'bg-terracota' : 'bg-sage'}`} style={{ width: `${Math.min(data.monthlySavings / (diagnosis.savingsTarget || 1), 1) * 100}%` }} /></div>
      </section>

      <section className="bg-ink-700 border border-ink-600 rounded-xl p-5 sm:p-7 mb-4">
        <div className="flex items-center gap-3 mb-2"><BadgeCheck size={20} className="text-gold" /><h2 className="font-serif text-xl text-ink-100">Controle seus gastos</h2></div>
        <p className="text-xs text-ink-300 mb-3">A marca dourada indica o limite ideal para cada categoria.</p>
        {diagnosis.categoryAnalysis.map((item) => <CategoryBar key={item.key} item={item} />)}
      </section>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <section className="bg-ink-700 border border-ink-600 rounded-xl p-5 sm:p-7">
          <div className="flex items-center gap-3 mb-5"><CircleDollarSign size={20} className="text-terracota-light" /><h2 className="font-serif text-xl text-ink-100">Suas dívidas</h2></div>
          <p className="font-serif text-3xl text-terracota-light mb-1">{fmtBRL(diagnosis.totalDebt)}</p>
          <p className="text-sm text-ink-300">{diagnosis.debtToIncomeRatio > 0 ? `${diagnosis.debtToIncomeRatio.toFixed(1).replace('.', ',')}x sua renda mensal` : 'Nenhuma dívida informada'}</p>
        </section>
        <section className="bg-ink-700 border border-ink-600 rounded-xl p-5 sm:p-7">
          <div className="flex items-center gap-3 mb-5"><ShieldCheck size={20} className="text-sage-light" /><h2 className="font-serif text-xl text-ink-100">Sua reserva</h2></div>
          <div className="flex items-center gap-4"><ProgressRing progress={diagnosis.emergencyProgress} /><div><p className="text-sm text-ink-300">Meta: {fmtBRL(diagnosis.emergencyTarget)}</p><p className="text-sm text-sage-light mt-1">{diagnosis.emergencyRemaining > 0 ? `Faltam ${fmtBRL(diagnosis.emergencyRemaining)}` : 'Meta alcançada'}</p></div></div>
        </section>
      </div>

      <section className="bg-ink-700 border border-ink-600 rounded-xl p-5 sm:p-7 mb-4">
        <div className="flex items-center gap-3 mb-2"><Coins size={20} className="text-gold" /><h2 className="font-serif text-xl text-ink-100">O efeito de ter constância</h2></div>
        <p className="text-sm text-ink-200 leading-relaxed mb-6">Guardando sua meta de {fmtBRL(projection.monthly)} todo mês, a 0,8% ao mês:</p>
        <p className="font-serif text-4xl text-gold mb-1">{fmtBRL(projection.finalAmount)}</p>
        <p className="text-sm text-ink-300 mb-5">em 10 anos · {fmtBRL(projection.totalContributed)} investidos por você</p>
        <div className="h-3 bg-ink-600 rounded-full overflow-hidden"><div className="h-full bg-sage rounded-full animate-grow" style={{ width: `${(projection.totalContributed / projection.finalAmount) * 100}%` }} /></div>
        <div className="flex justify-between mt-2 text-xs"><span className="text-ink-300">Aportes</span><span className="text-sage-light">Juros: +{fmtBRL(projection.totalInterest)}</span></div>
      </section>

      <section className="bg-ink-700 border border-gold/30 rounded-xl p-5 sm:p-7 mb-8">
        <div className="flex items-center gap-3 mb-6"><Check size={20} className="text-gold" /><h2 className="font-serif text-xl text-ink-100">Seu plano de ação</h2></div>
        {diagnosis.actionPlan.length > 0 ? <div className="space-y-5">{diagnosis.actionPlan.map((action, index) => <div key={action.title} className="flex gap-4"><span className="font-serif text-gold text-xl leading-none w-5 shrink-0">{index + 1}</span><div><h3 className="text-ink-100 font-medium mb-1">{action.title}</h3><p className="text-sm text-ink-300 leading-relaxed">{action.detail}</p></div></div>)}</div> : <p className="text-ink-200">Sua base está organizada. Continue mantendo os bons hábitos e revise este diagnóstico de tempos em tempos.</p>}
      </section>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pb-8"><button type="button" onClick={onRestart} className="btn-ghost border border-ink-500">Recomeçar</button><button type="button" disabled className="btn-primary opacity-50 cursor-not-allowed">Baixar plano em PDF <span className="text-xs font-normal ml-1">(em breve)</span></button></div>
    </div>
  );
}
