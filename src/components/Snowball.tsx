import { useMemo, useState } from 'react';
import { Check, MessageSquareText } from 'lucide-react';
import { compareStrategies, getDebtKind, monthShort, renegotiationText, snowball } from '../plan';
import type { DebtItem } from '../types';
import { formatBRL } from '../calculations';
import { CopyMessage } from './CopyMessage';

/* ---------- Bola de neve: da menor dívida pra maior ---------- */
// Paga o mínimo de todas e joga o que sobra na menor. Cada dívida que acaba libera o dinheiro dela pra próxima
// (a "bola" cresce). Mostra a primeira vitória, quanto pagar a mais pra ficar livre antes e a mensagem pro banco.

const EXTRAS = [50, 100, 200, 500];

const when = (m: number | null) => (m === null ? 'sem data ainda' : m <= 1 ? 'no mês que vem' : `em ${m} meses`);

export function Snowball({ debts, power, compact = false }: { debts: DebtItem[]; power: number; compact?: boolean }) {
  const [extra, setExtra] = useState(100);
  const [msg, setMsg] = useState(false);
  const base = useMemo(() => snowball(debts, power), [debts, power]);
  const faster = useMemo(() => snowball(debts, power + extra), [debts, power, extra]);
  const avalanche = useMemo(() => (debts.length > 1 && power > 0 ? compareStrategies(debts, power)[0] : null), [debts, power]);
  const start = new Date();
  const first = base.order[0];
  if (!first) return null;

  const monthsSaved = base.months !== null && faster.months !== null ? base.months - faster.months : null;
  const interestSaved = Math.max(0, base.interest - faster.interest);
  // a que mais pesa no juros e dá pra negociar (consignado e financiamento têm juros baixos e contrato fixo)
  const target = [...base.order].sort((a, b) => b.rate - a.rate).find((o) => o.debt.kind !== 'consignado' && o.debt.kind !== 'financiamento') ?? base.order[0];
  const targetPay = target.debt.installment || Math.max(50, Math.round(power / base.order.length));
  const text = renegotiationText(getDebtKind(target.debt.kind ?? 'outro').label.split(' (')[0].toLowerCase(), target.debt.value, target.rate, targetPay);
  const extraInterest = avalanche && base.months !== null && avalanche.months !== null ? base.interest - avalanche.interest : 0;

  return (
    <section className={`snow ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="snow-win">
          <span className="snow-label">Sua primeira vitória</span>
          <b>{first.debt.description}</b>
          <span>
            {formatBRL(first.debt.value)} · quita {first.payoffMonth ? `em ${monthShort(start, first.payoffMonth)}` : when(null)}
          </span>
        </div>
      )}

      <ol className="snow-list" aria-label="Da menor pra maior">
        {base.order.slice(0, compact ? 3 : undefined).map((o, i) => (
          <li key={o.debt.id} className={i === 0 ? 'first' : ''}>
            <span className="snow-n">{i === 0 ? <Check size={14} /> : i + 1}</span>
            <span className="snow-copy">
              <b>{o.debt.description}</b>
              <small>{i === 0 ? 'Comece por aqui' : o.payoffMonth ? `quita em ${monthShort(start, o.payoffMonth)}` : 'depois das anteriores'}</small>
            </span>
            <span className="snow-amount">{formatBRL(o.debt.value)}</span>
          </li>
        ))}
      </ol>

      <p className="snow-total">
        {base.months === null ? 'Com esse valor por mês ainda não fecha. Renegocie ou pague um pouco mais.' : `Livre ${when(base.months)}${compact ? '' : ` · ${formatBRL(base.interest)} de juros`}`}
      </p>

      {!compact && (
        <>
          <div className="snow-extra">
            <p className="snow-q">E se você pagar a mais por mês?</p>
            <div className="snow-chips" role="group" aria-label="Valor a mais por mês">
              {EXTRAS.map((v) => (
                <button key={v} type="button" className={extra === v ? 'on' : ''} aria-pressed={extra === v} onClick={() => setExtra(v)}>
                  + {formatBRL(v)}
                </button>
              ))}
            </div>
            <p className="snow-gain">
              {faster.months === null
                ? 'Ainda não fecha com esse valor.'
                : monthsSaved && monthsSaved > 0
                  ? `Livre ${monthsSaved} ${monthsSaved === 1 ? 'mês' : 'meses'} antes${interestSaved > 1 ? ` e ${formatBRL(interestSaved)} a menos de juros` : ''}.`
                  : 'Mesmo prazo, mas com menos juros.'}
            </p>
          </div>

          {extraInterest > 100 && (
            <p className="snow-note">Pagando primeiro a de juros mais alto você pouparia {formatBRL(extraInterest)} a mais, mas a menor te dá vitórias mais cedo.</p>
          )}

          <button type="button" className="btn-outline snow-msg-btn" aria-expanded={msg} onClick={() => setMsg((v) => !v)}>
            <MessageSquareText size={16} /> {msg ? 'Esconder a mensagem' : 'Gerar mensagem de renegociação'}
          </button>
          {msg && (
            <div className="snow-msg">
              <p>Para {target.debt.description}. Mande pelo app, chat ou SAC do banco.</p>
              <CopyMessage text={text} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
