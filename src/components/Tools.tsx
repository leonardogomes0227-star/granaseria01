import { useEffect, useMemo, useState, useId, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Target } from 'lucide-react';
import { getResults, saveGoal, saveResult, setToolTasks, type ResultCard } from '../results';
import type { NewTask, TaskSource } from '../coach';
import { fetchPainel, painelToken } from '../painel';
import { DebtItem, DebtKind, WizardData } from '../types';
import { buildPlan, compareStrategies, effectiveRate, getDebtKind, DEBT_KINDS } from '../plan';
import { formatBRL, computeProjection, computeRequiredContribution, computeLoanInstallment, inTodaysMoney, INFLATION_PCT } from '../calculations';
import { ToolId, getTool } from '../tools';
import { ToolIcon } from './Layout';
import { CountUp } from './motion';
import { DecimalInput } from './DecimalInput';

/* ---------- casca comum das ferramentas ---------- */

export interface ToolNavProps {
  onClose: () => void;
  onSwitch: (id: ToolId) => void;
}

export function ToolShell({
  id,
  onClose,
  children,
}: ToolNavProps & { id: ToolId; children: ReactNode }) {
  const tool = getTool(id);
  const [saved] = useState(() => getResults()[id]);
  return (
    <div className="wizard-wrap">
      <div className="tool-page">
        <div className="wizard-card anim-in" key={id} style={{ maxWidth: 'none' }}>
          <div className="tool-head">
            <ToolIcon tool={tool} size="lg" />
            <div>
              <div className="wizard-kicker" style={{ marginBottom: 4 }}>Ferramenta</div>
              <h2 className="wizard-h2">{tool.title}</h2>
            </div>
          </div>
          <dl className="tool-guide">
            <div><dt><Target size={15} /> Pra que serve</dt><dd>{tool.guide.serve}</dd></div>
            <div><dt><Clock size={15} /> Quando usar</dt><dd>{tool.guide.quando}</dd></div>
            <div><dt><CheckCircle2 size={15} /> O que você recebe</dt><dd>{tool.guide.recebe}</dd></div>
          </dl>
          {saved && id !== 'tracker' && (
            <p className="tool-saved">
              <CheckCircle2 size={14} /> Da última vez: {saved.summary}
            </p>
          )}
          {children}
          <p className="tool-saved-note">O resultado fica salvo no seu painel e conversa com o seu plano de ação.</p>
          <div className="wizard-nav">
            <button className="btn-outline" type="button" onClick={onClose}>
              <ArrowLeft size={16} /> Todas as ferramentas
            </button>
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Os próximos passos que a ferramenta deixa pro coach (com data e lembrete), um instante depois de parar de mexer. */
export function useToolTasks(source: TaskSource, tasks: NewTask[] | null) {
  const json = tasks ? JSON.stringify(tasks) : '';
  useEffect(() => {
    if (!json) return;
    const t = window.setTimeout(() => setToolTasks(source, JSON.parse(json) as NewTask[]), 1500);
    return () => window.clearTimeout(t);
  }, [source, json]);
}

/** Guarda o resultado da ferramenta no painel da pessoa, um instante depois de ela parar de mexer. */
export function useSaveResult(tool: ToolId, summary: string | null, card?: ResultCard) {
  const cardJson = card ? JSON.stringify(card) : '';
  useEffect(() => {
    if (!summary) return;
    const t = window.setTimeout(() => saveResult(tool, summary, cardJson ? (JSON.parse(cardJson) as ResultCard) : undefined), 1200);
    return () => window.clearTimeout(t);
  }, [tool, summary, cardJson]);
}

/* ---------- campos ---------- */

export function MoneyField({
  label,
  value,
  onChange,
  autoFocus,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  autoFocus?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="input-prefix">
        <span>R$</span>
        <DecimalInput id={id} placeholder="0,00" autoFocus={autoFocus} value={value} onChange={onChange} />
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  prefix?: string;
}) {
  const id = useId();
  const pct = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100;
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="range-row">
        <input
          type="range"
          className="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ ['--pct' as string]: `${pct}%` }}
          aria-label={label}
        />
        <div className={prefix ? 'input-prefix' : 'input-suffix'} style={{ width: 130, flexShrink: 0 }}>
          {prefix && <span>{prefix}</span>}
          <DecimalInput
            id={id}
            decimals={step % 1 === 0 ? 0 : 2}
            max={prefix ? 99_999_999 : max * 10}
            value={value}
            onChange={onChange}
            style={{ width: '100%' }}
          />
          {suffix && <span>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

/** Barra de composição: quanto do total veio do seu bolso e quanto veio dos juros. */
function CompositionBar({ own, interest }: { own: number; interest: number }) {
  const total = own + interest;
  if (total <= 0) return null;
  const ownPct = (own / total) * 100;
  const intPct = 100 - ownPct;
  return (
    <div>
      <div className="comp-bar" role="img" aria-label={`Você colocou ${ownPct.toFixed(0)}%, juros ${intPct.toFixed(0)}%`}>
        <div className="comp-seg" style={{ flexGrow: Math.max(ownPct, 0.5), background: 'var(--chart-a)' }}>
          <span className="tip">Você colocou: {formatBRL(own)}</span>
        </div>
        {interest > 0 && (
          <div className="comp-seg" style={{ flexGrow: Math.max(intPct, 0.5), background: 'var(--chart-b)' }}>
            <span className="tip">Juros: {formatBRL(interest)}</span>
          </div>
        )}
      </div>
      <div className="comp-legend">
        <span><i style={{ background: 'var(--chart-a)' }} /> Você colocou · {ownPct.toFixed(0)}%</span>
        {interest > 0 && <span><i style={{ background: 'var(--chart-b)' }} /> Juros · {intPct.toFixed(0)}%</span>}
      </div>
    </div>
  );
}

const brl = (n: number) => formatBRL(n);

/* ---------- Vale a pena comprar isso? ---------- */

export function ImpulseTool({ monthlyIncome, ...nav }: { monthlyIncome: number } & ToolNavProps) {
  const [income, setIncome] = useState(monthlyIncome);
  const [price, setPrice] = useState(0);
  // o mês de verdade: o que entrou menos o que saiu, anotado no WhatsApp
  const [month, setMonth] = useState<{ left: number; daysLeft: number } | null>(null);
  useEffect(() => {
    if (!painelToken()) return;
    void fetchPainel()
      .then((d) => {
        if (!d) return;
        const inc = d.month.incomes.reduce((x, r) => x + r.amount, 0);
        if (inc <= 0) return;
        const out = d.month.expenses.reduce((x, r) => x + r.amount, 0);
        const now = new Date(Date.now() - 3 * 3600 * 1000);
        const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
        setMonth({ left: inc - out, daysLeft: Math.max(1, last - now.getUTCDate() + 1) });
      })
      .catch(() => undefined);
  }, []);
  const afterBuy = month ? month.left - price : null;

  const pctOfIncome = income > 0 ? (price / income) * 100 : 0;
  const WORKDAYS = 22; // dias úteis num mês
  const daysOfWork = income > 0 ? price / (income / WORKDAYS) : 0;
  const savingsGoal = income * 0.1;
  const monthsDelay = savingsGoal > 0 ? price / savingsGoal : 0;

  const verdict =
    pctOfIncome >= 30
      ? { cls: 'status-bad', text: 'Compra pesada — pense pelo menos 7 dias antes' }
      : pctOfIncome >= 10
        ? { cls: 'status-warn', text: 'Vale esperar 48h e ver se a vontade continua' }
        : { cls: 'status-good', text: 'Cabe no orçamento, se não sair da poupança' };
  useToolTasks(
    'impulse',
    income > 0 && price > 0 && pctOfIncome >= 10
      ? [{ text: `Decidir se compra mesmo o item de ${brl(price)} (esperou ${pctOfIncome >= 30 ? '7 dias' : '48 horas'}?)`, inDays: pctOfIncome >= 30 ? 7 : 2 }]
      : null
  );
  useSaveResult('impulse', income > 0 && price > 0 ? `compra de ${brl(price)} = ${daysOfWork.toFixed(1).replace('.', ',')} dias de trabalho (${pctOfIncome.toFixed(0)}% da renda)` : null, {
    label: `Uma compra de ${brl(price)} custa`,
    big: `${daysOfWork.toFixed(1).replace('.', ',')} dias de trabalho`,
    rows: [
      ['Sua renda', brl(income)],
      ['Da sua renda', `${pctOfIncome.toFixed(0)}%`],
      ['Conselho', verdict.text],
      ...(afterBuy !== null ? ([['Sobra no mês depois', brl(afterBuy)]] as [string, string][]) : []),
    ],
  });

  return (
    <ToolShell id="impulse" {...nav}>
      <p className="wizard-sub">Antes de decidir, veja o que essa compra realmente custa em tempo e em meta.</p>

      <MoneyField label="Sua renda mensal" value={income} onChange={setIncome} hint={monthlyIncome > 0 ? 'Puxado do seu diagnóstico.' : undefined} />
      <MoneyField label="Valor da compra" value={price} onChange={setPrice} autoFocus />

      {income > 0 && price > 0 ? (
        <div className="result-card">
          {month && afterBuy !== null && (
            <div className={`insight insight-${afterBuy < 0 ? 'bad' : afterBuy / month.daysLeft < 30 ? 'warn' : 'good'}`} style={{ marginBottom: 14 }}>
              {afterBuy < 0
                ? `Não cabe neste mês: pelo que você anotou no WhatsApp, sobram ${formatBRL(month.left)} e faltariam ${formatBRL(-afterBuy)}.`
                : `Pelo seu mês no WhatsApp, depois da compra sobram ${formatBRL(afterBuy)}: uns ${formatBRL(Math.floor(afterBuy / month.daysLeft))} por dia até o fim do mês.`}
            </div>
          )}
          <span className={`status-pill ${verdict.cls}`}>{verdict.text}</span>
          <p className="diag-label">Essa compra custa</p>
          <p className="result-big">
            <CountUp value={daysOfWork} format={(n) => (daysOfWork < 1 ? 'menos de 1 dia' : `${n.toFixed(1).replace('.', ',')} dias`)} />
          </p>
          <p className="diag-label">de trabalho (dias úteis)</p>
          <div className="result-split">
            <div className="stat-card">
              <p className="diag-label">Da sua renda mensal</p>
              <p className="diag-number"><CountUp value={pctOfIncome} format={(n) => `${n.toFixed(1).replace('.', ',')}%`} /></p>
            </div>
            <div className="stat-card">
              <p className="diag-label">Quanto atrasa o que você ia guardar</p>
              <p className="diag-number">
                <CountUp value={monthsDelay} format={(n) => (monthsDelay < 1 ? '< 1 mês' : `${n.toFixed(1).replace('.', ',')} meses`)} />
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="result-empty">Preencha a renda e o valor da compra pra ver o custo real.</div>
      )}
    </ToolShell>
  );
}

/* ---------- Avalanche vs. bola de neve ---------- */

function sortAvalanche(debts: DebtItem[]): DebtItem[] {
  return [...debts].sort((a, b) => effectiveRate(b).rate - effectiveRate(a).rate);
}

function sortSnowball(debts: DebtItem[]): DebtItem[] {
  return [...debts].sort((a, b) => a.value - b.value);
}

function DebtOrderList({ title, note, debts }: { title: string; note: string; debts: DebtItem[] }) {
  return (
    <div className="stat-card">
      <p className="field-label" style={{ color: 'var(--ink)', fontWeight: 600, marginBottom: 2 }}>{title}</p>
      <p className="field-hint" style={{ marginTop: 0, marginBottom: 8 }}>{note}</p>
      <div className="action-list stagger">
        {debts.map((d, i) => (
          <div className="action-item" key={d.id}>
            <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
            <p>
              {d.description || 'Dívida sem nome'} — {formatBRL(d.value)}
              {` (${effectiveRate(d).rate.toLocaleString('pt-BR')}% ao mês${effectiveRate(d).assumed ? ', valor comum' : ''})`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DebtSimulator({ debts, data, onStart, ...nav }: { debts: DebtItem[]; data: WizardData; onStart: () => void } & ToolNavProps) {
  // com diagnóstico, usa as dívidas de lá; sem, a pessoa digita aqui mesmo (não precisa fazer o diagnóstico antes)
  const fromDiag = debts.filter((d) => d.value > 0);
  const [own, setOwn] = useState<DebtItem[]>([]);
  const [kind, setKind] = useState<DebtKind>('cartao');
  const [value, setValue] = useState(0);
  const [rate, setRate] = useState(0);
  const list = fromDiag.length > 0 ? fromDiag : own;
  // quanto dá pra pagar por mês: o do plano (com diagnóstico) ou o que a pessoa digita
  const planPower = useMemo(() => (data.monthlyIncome > 0 && fromDiag.length > 0 ? buildPlan(data).monthlyPower : 0), [data, fromDiag.length]);
  const [power, setPower] = useState(planPower);
  const results = useMemo(() => (list.length > 0 && power > 0 ? compareStrategies(list, power) : null), [list, power]);
  const best = results
    ? results[0].months === null
      ? null
      : results[1].months !== null && results[1].interest - results[0].interest < Math.max(50, results[0].interest * 0.05)
        ? results[1] // quase o mesmo juros: a bola de neve motiva mais (você vê dívidas acabando antes)
        : results[0]
    : null;
  const label = (o: 'avalanche' | 'snowball') => (o === 'avalanche' ? 'Começar pela de juros mais alto' : 'Começar pela menor');
  const when = (m: number | null) => (m === null ? 'não fecha com esse valor' : m < 12 ? `em ${m} ${m === 1 ? 'mês' : 'meses'}` : `em ${(m / 12).toFixed(1).replace('.', ',')} anos`);
  useToolTasks(
    'debts',
    best
      ? [
          { text: `Pagar o máximo que der em ${best.sequence[0]} (nas outras, só a parcela mínima)`, inDays: 5, repeat: 'monthly' },
          { text: `Ver no seu banco quanto ainda falta de ${best.sequence[0]}`, inDays: 30, repeat: 'monthly' },
        ]
      : results && results[0].months === null
        ? [{ text: 'Pedir pro banco renegociar as dívidas (veja "Seus direitos com o banco")', inDays: 1 }]
        : null
  );
  useSaveResult('debts', best ? `${label(best.order).toLowerCase()}: começa por ${best.sequence[0]}, livre ${when(best.months)}, ${formatBRL(best.interest)} de juros` : null, best ? {
    label: 'Comece por',
    big: best.sequence[0],
    rows: [
      ['Ordem', best.sequence.join(' → ')],
      ['Fica livre', when(best.months)],
      ['Juros no total', formatBRL(best.interest)],
      ['Pagando por mês', formatBRL(power)],
      ['Total das dívidas', formatBRL(list.reduce((x, d) => x + d.value, 0))],
    ],
  } : undefined);

  const add = () => {
    if (value <= 0) return;
    const label = getDebtKind(kind).label.split(' (')[0];
    const n = own.filter((d) => d.kind === kind).length;
    setOwn([...own, { id: `t-${Date.now()}`, description: n > 0 ? `${label} ${n + 1}` : label, value, kind, ...(rate > 0 ? { interestRate: rate } : {}) }]);
    setValue(0);
    setRate(0);
  };

  return (
    <ToolShell id="debts" {...nav}>
      <p className="wizard-sub">Veja por qual dívida começar. Nas outras, você paga só a parcela mínima.</p>

      {fromDiag.length === 0 && (
        <div className="stat-card" style={{ marginBottom: 16 }}>
          <p className="field-label" style={{ color: 'var(--ink)', fontWeight: 600 }}>Suas dívidas</p>
          <label className="field-label" htmlFor="debt-kind" style={{ marginTop: 6 }}>Tipo</label>
          <select id="debt-kind" className="field-input" value={kind} onChange={(e) => setKind(e.target.value as DebtKind)}>
            {DEBT_KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
          <MoneyField label="Quanto falta pagar" value={value} onChange={setValue} />
          <div className="field-group">
            <label className="field-label" htmlFor="debt-rate">Juros ao mês (se souber)</label>
            <div className="input-suffix">
              <DecimalInput id="debt-rate" placeholder={`${getDebtKind(kind).typicalRate.toLocaleString('pt-BR')} (típico)`} value={rate} onChange={setRate} />
              <span>% ao mês</span>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={add} disabled={value <= 0}>
            <Check size={16} /> Adicionar dívida
          </button>
          {own.length > 0 && (
            <ul className="debt-quick-list">
              {own.map((d) => (
                <li key={d.id}>
                  {d.description} — {formatBRL(d.value)}
                  <button type="button" className="plan-more" onClick={() => setOwn(own.filter((x) => x.id !== d.id))}>tirar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <div className="result-empty">Adicione suas dívidas acima pra ver qual pagar primeiro.</div>
      ) : (
        <>
          {list.some((d) => effectiveRate(d).assumed) && (
            <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
              Onde você não disse os juros, usamos o valor comum pra esse tipo de dívida. Confira no seu contrato.
            </p>
          )}
          <MoneyField
            label="Quanto dá pra pagar por mês, somando todas"
            value={power}
            onChange={setPower}
            hint={planPower > 0 ? 'Vem do seu plano de ação.' : 'Some as parcelas que você já paga com o que dá pra pôr a mais.'}
          />
          {results && (
            <div className="result-card" style={{ marginBottom: 16 }}>
              {best ? (
                <>
                  <span className="status-pill status-good">Recomendado: {label(best.order)}</span>
                  <p className="result-big" style={{ fontSize: 'clamp(22px, 5vw, 30px)' }}>Comece por {best.sequence[0]}</p>
                  <p className="field-hint">Você fica livre {when(best.months)} e paga {formatBRL(best.interest)} de juros no total.</p>
                </>
              ) : (
                <p className="wizard-sub" style={{ margin: 0 }}>Com {formatBRL(power)} por mês os juros crescem mais rápido que os pagamentos. Renegocie primeiro: veja "Seus direitos com o banco".</p>
              )}
              <div className="result-split">
                {results.map((r) => (
                  <div className="stat-card" key={r.order}>
                    <p className="diag-label">{label(r.order)}</p>
                    <p className="diag-number" style={{ fontSize: 20 }}>{r.months === null ? '—' : when(r.months).replace('em ', '')}</p>
                    <p className="field-hint">{r.months === null ? 'não fecha' : `${formatBRL(r.interest)} de juros`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="loan-grid">
            <DebtOrderList title="Começando pela de juros mais alto" note="Você paga menos juros no total." debts={sortAvalanche(list)} />
            <DebtOrderList title="Começando pela menor" note="Você vê dívidas acabando mais cedo, e isso anima." debts={sortSnowball(list)} />
          </div>
          {fromDiag.length === 0 && (
            <p className="field-hint" style={{ marginTop: 14 }}>
              Quer saber <b>quando</b> você fica livre e quanto pagar por mês?{' '}
              <button type="button" className="plan-more" onClick={onStart}>Faça o diagnóstico <ArrowRight size={13} /></button>
            </p>
          )}
        </>
      )}
    </ToolShell>
  );
}

/* ---------- Simulador de longo prazo / aposentadoria ---------- */

export function LongTermSimulator({ monthlyIncome, ...nav }: { monthlyIncome: number } & ToolNavProps) {
  const [contribution, setContribution] = useState(Math.round(monthlyIncome * 0.1) || 500);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(20);

  const total = computeProjection(contribution, rate, years);
  const totalContributed = contribution * years * 12;
  const totalInterest = Math.max(total - totalContributed, 0);
  useSaveResult('longterm', contribution > 0 ? `${brl(contribution)} por mês por ${years} anos viram ${brl(total)}` : null, {
    label: `Em ${years} anos você teria`,
    big: brl(total),
    rows: [['Guardando por mês', brl(contribution)], ['Rendendo por ano', `${rate}%`], ['Do seu bolso', brl(totalContributed)], ['De rendimento', brl(totalInterest)]],
  });

  return (
    <ToolShell id="longterm" {...nav}>
      <p className="wizard-sub">Mude os valores e veja quanto o que você guarda vira com o tempo.</p>

      <RangeField label="Quanto vai guardar por mês" prefix="R$" value={contribution} onChange={setContribution} min={0} max={10000} step={50} />
      <RangeField label="Quanto rende por ano" suffix="% ao ano" value={rate} onChange={setRate} min={0} max={20} step={0.5} />
      <RangeField label="Prazo" suffix="anos" value={years} onChange={(v) => setYears(Math.max(v, 1))} min={1} max={50} />

      {contribution > 0 ? (
        <div className="result-card">
          <p className="diag-label">Em {years} anos, você teria</p>
          <p className="result-big"><CountUp value={total} format={brl} /></p>
          <CompositionBar own={totalContributed} interest={totalInterest} />
          <div className="result-split">
            <div className="stat-card">
              <p className="diag-label">Do seu bolso</p>
              <p className="diag-number"><CountUp value={totalContributed} format={brl} /></p>
            </div>
            <div className="stat-card">
              <p className="diag-label">Rendido só de juros</p>
              <p className="diag-number"><CountUp value={totalInterest} format={brl} /></p>
            </div>
          </div>
          <p className="field-hint" style={{ marginTop: 12 }}>
            Em reais de hoje (descontando uma inflação de {INFLATION_PCT.toLocaleString('pt-BR')}% ao ano), esse valor compraria o que {formatBRL(inTodaysMoney(total, years))} compram agora.
          </p>
        </div>
      ) : (
        <div className="result-empty">Diga quanto vai guardar por mês pra ver o resultado.</div>
      )}
    </ToolShell>
  );
}

/* ---------- Calculadora de meta ---------- */

export function GoalCalculator({ data, ...nav }: { data: WizardData } & ToolNavProps) {
  const [target, setTarget] = useState(0);
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(10);

  const required = computeRequiredContribution(target, rate, years);
  const totalContributed = required * years * 12;
  const fromInterest = Math.max(target - totalContributed, 0);
  const [name, setName] = useState('');
  const [savedGoal, setSavedGoal] = useState(false);
  // cabe no bolso? Compara com o que o plano tem por mês (sem contar as metas já salvas)
  const capacity = useMemo(() => (data.monthlyIncome > 0 ? buildPlan(data).monthlyPower : 0), [data]);
  const monthsWithCapacity = (() => {
    if (capacity <= 0 || target <= 0) return null;
    const r = Math.pow(1 + rate / 100, 1 / 12) - 1;
    let b = 0;
    for (let m = 1; m <= 600; m++) {
      b = b * (1 + r) + capacity;
      if (b >= target) return m;
    }
    return null;
  })();
  const saveToPlan = () => {
    const label = name.trim() || 'minha meta';
    saveGoal({ name: label, target, monthly: Math.round(required), months: years * 12 });
    saveResult('goal', `${label}: ${brl(target)} em ${years} ${years === 1 ? 'ano' : 'anos'}, guardando ${brl(required)} por mês`, {
      label: `Pra ${label}, guarde por mês`,
      big: brl(required),
      rows: [
        ['Valor da meta', brl(target)],
        ['Prazo', `${years} ${years === 1 ? 'ano' : 'anos'}`],
        ['Cabe no plano?', capacity > 0 ? (required <= capacity ? 'Sim' : `Ainda não (o plano tem ${brl(capacity)}/mês)`) : 'Faça o diagnóstico pra saber'],
      ],
    });
    setToolTasks('goal', [{ text: `Separar ${brl(required)} pra ${label} numa conta só pra isso`, inDays: 1, repeat: 'monthly' }]);
    setSavedGoal(true);
  };

  return (
    <ToolShell id="goal" {...nav}>
      <p className="wizard-sub">Diga o que você quer e quanto custa. A gente calcula quanto guardar por mês.</p>

      <div className="field-group">
        <label className="field-label" htmlFor="goal-name">Qual é a meta?</label>
        <input id="goal-name" className="field-input" placeholder="Ex.: viagem, carro, entrada da casa" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setSavedGoal(false); }} />
      </div>
      <MoneyField label="Valor da meta" value={target} onChange={(v) => { setTarget(v); setSavedGoal(false); }} autoFocus />
      <RangeField label="Prazo" suffix="anos" value={years} onChange={(v) => setYears(Math.max(v, 1))} min={1} max={40} />
      <RangeField label="Quanto rende por ano" suffix="% ao ano" value={rate} onChange={setRate} min={0} max={20} step={0.5} />

      {target > 0 ? (
        <div className="result-card">
          <p className="diag-label">Você precisa guardar, por mês</p>
          <p className="result-big"><CountUp value={required} format={brl} /></p>
          <CompositionBar own={totalContributed} interest={fromInterest} />
          <div className="result-split">
            <div className="stat-card">
              <p className="diag-label">Do seu bolso</p>
              <p className="diag-number"><CountUp value={totalContributed} format={brl} /></p>
            </div>
            <div className="stat-card">
              <p className="diag-label">Vem dos juros</p>
              <p className="diag-number"><CountUp value={fromInterest} format={brl} /></p>
            </div>
          </div>
          {capacity > 0 && (
            <div className={`insight insight-${required <= capacity ? 'good' : 'warn'}`} style={{ marginTop: 14 }}>
              {required <= capacity ? (
                <>Cabe no seu plano: ele tem {formatBRL(capacity)} por mês. Lembre que a reserva de emergência vem primeiro.</>
              ) : (
                <>
                  Não cabe ainda: o seu plano tem {formatBRL(capacity)} por mês.{' '}
                  {monthsWithCapacity !== null
                    ? `Com esse valor, você chega lá em ${monthsWithCapacity < 12 ? `${monthsWithCapacity} meses` : `${(monthsWithCapacity / 12).toFixed(1).replace('.', ',')} anos`}. Aumente o prazo ou ache dinheiro no Caça-vazamentos.`
                    : 'Aumente o prazo ou diminua a meta.'}
                </>
              )}
            </div>
          )}
          <button type="button" className="btn-primary" style={{ marginTop: 16 }} onClick={saveToPlan} disabled={savedGoal}>
            {savedGoal ? <><Check size={16} /> Salvo no seu plano de ação</> : <>Salvar no meu plano <ArrowRight size={16} /></>}
          </button>
          {years >= 2 && (
            <p className="field-hint" style={{ marginTop: 12 }}>
              Atenção à inflação: daqui a {years} anos, {formatBRL(target)} terão o poder de compra de {formatBRL(inTodaysMoney(target, years))} de hoje. Se a meta é em reais de hoje, aumente o valor.
            </p>
          )}
        </div>
      ) : (
        <div className="result-empty">Digite o valor da meta pra calcular quanto guardar por mês.</div>
      )}
    </ToolShell>
  );
}

/* ---------- Comparador de empréstimo/financiamento ---------- */

function LoanColumn({
  label,
  principal,
  setPrincipal,
  rate,
  setRate,
  installmentsCount,
  setInstallmentsCount,
  installment,
  setInstallment,
  winner,
}: {
  label: string;
  principal: number;
  setPrincipal: (v: number) => void;
  rate: number;
  setRate: (v: number) => void;
  installmentsCount: number;
  setInstallmentsCount: (v: number) => void;
  installment: number;
  setInstallment: (v: number) => void;
  winner: boolean;
}) {
  return (
    <div className={`loan-col ${winner ? 'winner' : ''}`}>
      <div className="loan-col-head">
        {label}
        {winner && <span className="winner-badge"><Check size={12} /> Mais barata</span>}
      </div>
      <MoneyField label="Quanto você vai pegar" value={principal} onChange={setPrincipal} />
      <MoneyField label="Valor de cada parcela" value={installment} onChange={setInstallment} hint="Não sabe a taxa? Põe só a parcela." />
      {installment <= 0 && (
        <div className="field-group">
          <label className="field-label">Ou a taxa de juros</label>
          <div className="input-suffix">
            <DecimalInput aria-label={`Taxa da ${label}`} max={100} value={rate} onChange={setRate} placeholder="0" />
            <span>% ao mês</span>
          </div>
        </div>
      )}
      <div className="field-group" style={{ marginBottom: 0 }}>
        <label className="field-label">Parcelas</label>
        <div className="input-suffix">
          <DecimalInput aria-label={`Parcelas da ${label}`} decimals={0} max={600} value={installmentsCount} onChange={(v) => setInstallmentsCount(Math.max(v, 1))} />
          <span>meses</span>
        </div>
      </div>
    </div>
  );
}

export function LoanComparator(nav: ToolNavProps) {
  const [pA, setPA] = useState(0);
  const [rA, setRA] = useState(0);
  const [nA, setNA] = useState(12);

  const [pB, setPB] = useState(0);
  const [rB, setRB] = useState(0);
  const [nB, setNB] = useState(12);

  const [iA, setIA] = useState(0);
  const [iB, setIB] = useState(0);
  // com a parcela, o custo total é parcela × vezes; sem, sai da taxa
  const cost = (p: number, r: number, n: number, i: number) =>
    i > 0 ? { installment: i, total: i * n, totalInterest: Math.max(0, i * n - p) } : computeLoanInstallment(p, r, n);
  const resA = cost(pA, rA, nA, iA);
  const resB = cost(pB, rB, nB, iB);
  const bothFilled = pA > 0 && pB > 0;
  const tie = Math.abs(resA.total - resB.total) < 0.5;
  const cheaper = resA.total <= resB.total ? 'A' : 'B';
  useToolTasks(
    'loan',
    bothFilled && !tie ? [{ text: `Pedir por escrito o custo total da proposta ${cheaper} antes de assinar`, inDays: 2 }, { text: 'Decidir o empréstimo (sem pressa: proposta boa não some em 2 dias)', inDays: 4 }] : null
  );
  useSaveResult('loan', bothFilled ? (tie ? 'as duas propostas custam quase o mesmo' : `proposta ${cheaper} sai ${brl(Math.abs(resA.total - resB.total))} mais barata no total`) : null, {
    label: 'A melhor proposta',
    big: tie ? 'Empate' : `Proposta ${cheaper}`,
    rows: [
      ['Proposta A', `${nA}x de ${brl(resA.installment)} = ${brl(resA.total)}`],
      ['Proposta B', `${nB}x de ${brl(resB.installment)} = ${brl(resB.total)}`],
      ['Diferença', brl(Math.abs(resA.total - resB.total))],
    ],
  });

  return (
    <ToolShell id="loan" {...nav}>
      <p className="wizard-sub">Compare duas propostas antes de assinar.</p>

      <div className="loan-grid">
        <LoanColumn label="Proposta A" principal={pA} setPrincipal={setPA} rate={rA} setRate={setRA} installmentsCount={nA} setInstallmentsCount={setNA} installment={iA} setInstallment={setIA} winner={bothFilled && !tie && cheaper === 'A'} />
        <LoanColumn label="Proposta B" principal={pB} setPrincipal={setPB} rate={rB} setRate={setRB} installmentsCount={nB} setInstallmentsCount={setNB} installment={iB} setInstallment={setIB} winner={bothFilled && !tie && cheaper === 'B'} />
      </div>

      {bothFilled ? (
        <div className="result-card">
          <div className="result-split" style={{ marginTop: 0 }}>
            <div className="stat-card">
              <p className="diag-label">Parcela A</p>
              <p className="diag-number"><CountUp value={resA.installment} format={brl} /></p>
              <p className="field-hint">Total pago: {formatBRL(resA.total)} · juros {formatBRL(resA.totalInterest)}</p>
            </div>
            <div className="stat-card">
              <p className="diag-label">Parcela B</p>
              <p className="diag-number"><CountUp value={resB.installment} format={brl} /></p>
              <p className="field-hint">Total pago: {formatBRL(resB.total)} · juros {formatBRL(resB.totalInterest)}</p>
            </div>
          </div>
          <p className="wizard-sub" style={{ marginTop: 18, marginBottom: 0 }}>
            {tie ? (
              <strong style={{ color: 'var(--ink)' }}>As duas propostas custam praticamente o mesmo no total.</strong>
            ) : (
              <>
                <strong style={{ color: 'var(--ink)' }}>Proposta {cheaper} sai mais barata</strong> — diferença de{' '}
                {formatBRL(Math.abs(resA.total - resB.total))} no total pago.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="result-empty">Preencha o valor das duas propostas pra comparar.</div>
      )}
    </ToolShell>
  );
}
