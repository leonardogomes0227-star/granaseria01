import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Check } from 'lucide-react';
import { WizardData } from '../types';
import { formatBRL } from '../calculations';
import { buildPlan, simulateLumpSum, monthLong } from '../plan';
import { LEAKS, RIGHTS, LeakSelection, getLeakSelection, saveLeakSelection, leaksMonthlyTotal, relevantRights } from '../leaks';
import { ToolShell, ToolNavProps, MoneyField, useSaveResult } from './Tools';
import { CopyMessage } from './CopyMessage';
import { DecimalInput } from './DecimalInput';
import { CountUp } from './motion';
import { track } from '../analytics';

const hasDiagnosis = (data: WizardData) => data.monthlyIncome > 0;

/* ---------- O que fazer com o 13º (e outros extras) ---------- */

const EXTRA_KINDS = [
  { id: '13', label: '13º salário' },
  { id: 'ir', label: 'Restituição do IR' },
  { id: 'fgts', label: 'FGTS' },
  { id: 'bonus', label: 'PLR ou bônus' },
] as const;

export function ExtraMoneyTool({ data, onStart, ...nav }: { data: WizardData; onStart: () => void } & ToolNavProps) {
  const [kind, setKind] = useState<(typeof EXTRA_KINDS)[number]['id']>('13');
  const [amount, setAmountState] = useState(data.monthlyIncome > 0 ? Math.round(data.monthlyIncome) : 0);
  const [touched, setTouched] = useState(false);
  const setAmount = (v: number) => {
    setAmountState(v);
    setTouched(true);
  };
  const diag = hasDiagnosis(data);

  const result = useMemo(
    () => (diag && amount > 0 ? simulateLumpSum(data, amount, { extraMonthly: leaksMonthlyTotal() }) : null),
    [data, amount, diag]
  );

  const reserveSooner =
    result && result.before.reserve.doneMonth !== null && result.after.reserve.doneMonth !== null
      ? result.before.reserve.doneMonth - result.after.reserve.doneMonth
      : 0;

  useSaveResult(
    'extra',
    touched && result ? `${EXTRA_KINDS.find((k) => k.id === kind)?.label ?? 'extra'} de ${formatBRL(amount)}: ${result.allocation.map((a) => `${a.label} ${formatBRL(a.amount)}`).join(', ')}` : null
  );

  return (
    <ToolShell id="extra" {...nav}>
      <p className="wizard-sub">Dinheiro extra é a chance de pular meses do seu plano. Diga quanto entrou e veja onde colocar cada real.</p>

      <div className="seg" role="tablist" aria-label="Tipo de dinheiro extra" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
        {EXTRA_KINDS.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'active' : ''} onClick={() => setKind(k.id)}>
            {k.label}
          </button>
        ))}
      </div>

      <MoneyField
        label={`Quanto você vai receber (${EXTRA_KINDS.find((k) => k.id === kind)!.label})`}
        value={amount}
        onChange={setAmount}
        hint={
          kind === '13'
            ? 'O 13º vem em duas parcelas: a 1ª até 30 de novembro e a 2ª (com desconto de INSS e IR) até 20 de dezembro. Preenchemos com uma renda mensal — ajuste se precisar.'
            : kind === 'fgts'
              ? 'Saque-aniversário ou rescisão: use o valor que vai cair na conta.'
              : undefined
        }
      />

      {!diag && (
        <div className="result-card">
          <p className="diag-label">A ordem que mais rende pra qualquer dinheiro extra</p>
          <div className="action-list" style={{ marginTop: 8 }}>
            {[
              ['Dívidas caras', 'Cartão, cheque especial, empréstimo pessoal: cobram de 5% a 15% ao mês. Quitar é o melhor "investimento" que existe.'],
              ['Reserva de emergência', 'Até ter 6 meses dos seus gastos num lugar que rende e deixa sacar na hora (no app do banco: "CDB com resgate diário" ou "Tesouro Selic").'],
              ['Dívidas baratas', 'Financiamento e consignado: amortizar antes reduz os juros (é seu direito pedir o desconto).'],
              ['Investir', 'Só depois disso: Tesouro IPCA+, fundos de índice.'],
            ].map(([t, d], i) => (
              <div className="action-item" key={t}>
                <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="plan-step-title">{t}</p>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="wizard-sub" style={{ marginTop: 12, fontSize: 14.5 }}>
            Faça o diagnóstico pra ver exatamente quanto vai em cada dívida e quantos meses antes você termina.
          </p>
          <button className="btn-primary" type="button" onClick={onStart}>
            Fazer diagnóstico grátis <ArrowRight size={16} className="arrow" />
          </button>
        </div>
      )}

      {result && (
        <div className="result-card">
          <ExtraHeadline result={result} reserveSooner={reserveSooner} amount={amount} />

          <p className="diag-label" style={{ marginTop: 18 }}>Onde colocar cada real</p>
          <div className="action-list">
            {result.allocation.map((a, i) => (
              <div className="action-item" key={i}>
                <span className="action-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className={`plan-step-title tone-text-${a.kind === 'debt' ? 'bad' : a.kind === 'reserve' ? 'info' : 'good'}`}>
                    {a.label}: {formatBRL(a.amount)}
                  </p>
                  <p>{a.why}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="insight insight-warn" style={{ marginTop: 14 }}>
            Não comprometa o extra com compras parceladas novas: o 13º acaba em dezembro, as parcelas continuam até o meio do ano.
          </div>
        </div>
      )}
    </ToolShell>
  );
}

function ExtraHeadline({ result, reserveSooner, amount }: { result: ReturnType<typeof simulateLumpSum>; reserveSooner: number; amount: number }) {
  const { before, after } = result;
  const start = before.start;
  if (result.unstuck) {
    return (
      <>
        <p className="diag-label">Com esse dinheiro, sua dívida passa a ter fim</p>
        <p className="result-big">{after.debtFreeMonth !== null ? monthLong(start, after.debtFreeMonth) : '—'}</p>
        <p className="field-hint">Hoje, o que você paga não cobre nem os juros. Usando o extra como abaixo, ela começa a diminuir de verdade.</p>
      </>
    );
  }
  if (after.stuck) {
    const debtBefore = before.debts.reduce((s, d) => s + d.balance, 0);
    const debtAfter = after.debts.reduce((s, d) => s + d.balance, 0);
    return (
      <>
        <p className="diag-label">Ajuda, mas ainda não resolve sozinho</p>
        <p className="result-big">{formatBRL(debtBefore)} → {formatBRL(debtAfter)}</p>
        <p className="field-hint">
          Mesmo com o extra, o que vai pro plano por mês não cobre os juros. Use o extra como abaixo e, junto, renegocie: com um desconto à vista, esse dinheiro pode quitar a dívida inteira. A mensagem pronta está no seu plano de ação.
        </p>
      </>
    );
  }
  if (result.monthsSooner !== null && result.monthsSooner > 0) {
    return (
      <>
        <p className="diag-label">Você sai das dívidas</p>
        <p className="result-big">
          <CountUp value={result.monthsSooner} format={(n) => `${Math.round(n)} ${Math.round(n) === 1 ? 'mês' : 'meses'} antes`} />
        </p>
        <p className="field-hint">
          Em {monthLong(start, after.debtFreeMonth ?? 0)} em vez de {monthLong(start, before.debtFreeMonth ?? 0)}
          {result.interestSaved > 1 ? `, e deixa de pagar ${formatBRL(result.interestSaved)} de juros.` : '.'}
        </p>
      </>
    );
  }
  if (reserveSooner > 0) {
    return (
      <>
        <p className="diag-label">Sua reserva fica pronta</p>
        <p className="result-big">
          <CountUp value={reserveSooner} format={(n) => `${Math.round(n)} ${Math.round(n) === 1 ? 'mês' : 'meses'} antes`} />
        </p>
        <p className="field-hint">Em {monthLong(start, after.reserve.doneMonth ?? 0)} em vez de {monthLong(start, before.reserve.doneMonth ?? 0)}.</p>
      </>
    );
  }
  return (
    <>
      <p className="diag-label">Seu plano já está adiantado</p>
      <p className="result-big">{formatBRL(amount)}</p>
      <p className="field-hint">Sem dívidas e com a reserva completa: esse dinheiro pode ir direto pros investimentos.</p>
    </>
  );
}

/* ---------- Caça-vazamentos ---------- */

export function LeaksTool({ data, ...nav }: { data: WizardData } & ToolNavProps) {
  const [sel, setSel] = useState<LeakSelection>(() => getLeakSelection());
  const [open, setOpen] = useState<string | null>(null);
  const total = leaksMonthlyTotal(sel);
  const diag = hasDiagnosis(data);

  const update = (next: LeakSelection) => {
    setSel(next);
    saveLeakSelection(next);
  };
  const toggle = (id: string, typical: number) => {
    const next = { ...sel };
    if (id in next) delete next[id];
    else {
      next[id] = typical;
      track('vazamento_marcado', { item: id });
    }
    update(next);
  };

  const impact = useMemo(() => {
    if (!diag || total <= 0) return null;
    const before = buildPlan(data);
    const after = buildPlan(data, { extraMonthly: total, start: before.start });
    if (before.debts.length > 0 && before.debtFreeMonth !== null && after.debtFreeMonth !== null) {
      const n = before.debtFreeMonth - after.debtFreeMonth;
      return n > 0 ? `Isso tira ${n} ${n === 1 ? 'mês' : 'meses'} do seu caminho pra sair das dívidas.` : null;
    }
    if (before.stuck && !after.stuck) return 'Com esse dinheiro, sua dívida passa a ter fim.';
    if (before.reserve.doneMonth !== null && after.reserve.doneMonth !== null) {
      const n = before.reserve.doneMonth - after.reserve.doneMonth;
      return n > 0 ? `Sua reserva fica pronta ${n} ${n === 1 ? 'mês' : 'meses'} antes.` : null;
    }
    return null;
  }, [data, total, diag]);

  useSaveResult('leaks', total > 0 ? `achou ${formatBRL(total)} por mês (${formatBRL(total * 12)} por ano), já somados no plano` : null);

  return (
    <ToolShell id="leaks" {...nav}>
      <p className="wizard-sub">Marque o que acontece com você. Cada item tem o caminho pra resolver — e, quando dá, a mensagem pronta.</p>

      <div className="leaks-total result-card">
        <p className="diag-label">Você achou</p>
        <p className="result-big">
          <CountUp value={total} format={(n) => `${formatBRL(n)}/mês`} />
        </p>
        <p className="field-hint" style={{ marginTop: 0 }}>
          {total > 0 ? `${formatBRL(total * 12)} por ano. ` : ''}
          {diag ? 'Esse valor entra automaticamente no seu plano de ação.' : 'Faça o diagnóstico e esse valor entra no seu plano de ação.'}
          {impact ? ` ${impact}` : ''}
        </p>
      </div>

      <div className="leaks-list">
        {LEAKS.map((l) => {
          const on = l.id in sel;
          const expanded = open === l.id;
          return (
            <div className={`leak-card ${on ? 'on' : ''}`} key={l.id}>
              <div className="leak-head">
                <button type="button" className="leak-check" aria-pressed={on} onClick={() => toggle(l.id, l.typical)}>
                  <span className="leak-box">{on && <Check size={14} />}</span>
                  <span>
                    <b>{l.title}</b>
                    <small>{l.what}</small>
                  </span>
                </button>
              </div>
              {on && (
                <div className="leak-amount">
                  <span>Quanto isso te custa por mês</span>
                  <div className="input-prefix">
                    <span>R$</span>
                    <DecimalInput aria-label={`Economia por mês com ${l.title}`} value={sel[l.id]} onChange={(v) => update({ ...sel, [l.id]: v })} />
                  </div>
                </div>
              )}
              <button type="button" className="plan-more" onClick={() => setOpen(expanded ? null : l.id)} aria-expanded={expanded}>
                <ChevronDown size={15} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} /> Como resolver
              </button>
              {expanded && (
                <div className="leak-fix">
                  <p>{l.fix}</p>
                  {l.message && <CopyMessage text={l.message} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ToolShell>
  );
}

/* ---------- Seus direitos com o banco ---------- */

// primeiro a pessoa diz o problema; aparecem só os direitos que resolvem ele
const PROBLEMS: { id: string; label: string; rights: string[] }[] = [
  { id: 'juros', label: '💳 Os juros do cartão ou do cheque especial estão altos', rights: ['rotativo', 'cheque', 'portabilidade'] },
  { id: 'nao-paga', label: '😰 Não consigo pagar as minhas dívidas', rights: ['superendividamento', 'portabilidade', 'quitacao'] },
  { id: 'quitar', label: '✅ Quero quitar uma dívida antes', rights: ['quitacao', 'portabilidade'] },
  { id: 'cobranca', label: '🧾 Me cobraram algo que eu não devia', rights: ['cobranca'] },
  { id: 'nome', label: '🚫 Meu nome está sujo (negativado)', rights: ['negativacao', 'superendividamento'] },
];

export function RightsTool({ data, ...nav }: { data: WizardData } & ToolNavProps) {
  const mine = useMemo(() => (hasDiagnosis(data) && data.debts.length > 0 ? relevantRights(buildPlan(data)) : []), [data]);
  const [problem, setProblem] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const picked = PROBLEMS.find((p) => p.id === problem);
  const shown = all ? RIGHTS : picked ? RIGHTS.filter((r) => picked.rights.includes(r.id)).sort((a, b) => picked.rights.indexOf(a.id) - picked.rights.indexOf(b.id)) : [];
  useSaveResult('rights', picked ? `${picked.label.replace(/^\S+\s/, '')}: ${shown.map((r) => r.title.toLowerCase()).join('; ')}` : null);

  return (
    <ToolShell id="rights" {...nav}>
      <p className="wizard-sub">Qual é o seu problema com o banco agora?</p>
      <div className="rights-problems">
        {PROBLEMS.map((p) => (
          <button key={p.id} type="button" className={problem === p.id ? 'on' : ''} onClick={() => { setProblem(p.id); setAll(false); }}>
            {p.label}
          </button>
        ))}
      </div>
      {shown.length > 0 && (
        <div className="rights-list" style={{ marginTop: 16 }}>
          {shown.map((r) => (
            <div className="stat-card right-card" key={r.id}>
              {mine.includes(r.id) && <span className="status-pill status-good">Vale pro seu caso</span>}
              <p className="plan-step-title" style={{ fontSize: 16 }}>{r.title}</p>
              <p className="right-law">{r.law}</p>
              <p className="right-summary">{r.summary}</p>
              {r.message && <CopyMessage text={r.message} />}
            </div>
          ))}
        </div>
      )}
      {!all && (
        <button type="button" className="plan-more" onClick={() => setAll(true)} style={{ marginTop: 10 }}>
          Ver todos os direitos
        </button>
      )}
      <p className="field-hint" style={{ marginTop: 14 }}>
        Conteúdo informativo, não substitui orientação jurídica. Se o banco não resolver: reclame no consumidor.gov.br, no Procon ou no Banco Central (bcb.gov.br/meubc).
      </p>
    </ToolShell>
  );
}
