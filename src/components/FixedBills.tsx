import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { formatBRL } from '../calculations';
import { loadBills, monthOf, monthStatus, saveBills, type BillStatus } from '../bills';
import { todayBRT } from '../coach';
import { fmtDay } from '../dates';

/* ---------- Gastos fixos do mês: casa, carro, financiamento, cartão… com baixa de um toque ---------- */
// Usa as mesmas contas da tela Contas a pagar (src/bills.ts). "Paguei" marca o valor que falta como pago hoje e o saldo
// do mês já desconta. Errou? "Desfazer" logo depois. Outro valor ou outra data: toque em Gerenciar.

export function useBills() {
  const [bills, setBills] = useState(loadBills);
  useEffect(() => {
    const on = () => setBills(loadBills());
    window.addEventListener('gs-contas', on);
    return () => window.removeEventListener('gs-contas', on);
  }, []);
  return bills;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function dueText(s: BillStatus): string {
  if (s.left < 0.01) return 'paga';
  if (s.daysToDue < 0) return `venceu dia ${ddmm(s.due)}`;
  if (s.daysToDue === 0) return 'vence hoje';
  if (s.daysToDue === 1) return 'vence amanhã';
  return `vence dia ${ddmm(s.due)}`;
}

/** Resumo numa linha ("2 de 4 pagas · faltam R$ 480"), usado no Plano e nos cartões. */
export function fixedSummary(statuses: BillStatus[]): { total: number; paid: number; left: number } {
  return { total: statuses.length, paid: statuses.filter((s) => s.left < 0.01).length, left: statuses.reduce((t, s) => t + s.left, 0) };
}

export function FixedBills({ compact = false }: { compact?: boolean }) {
  const bills = useBills();
  const today = todayBRT();
  const month = monthOf(today);
  const statuses = monthStatus(bills, month, today);
  const { total, paid, left } = fixedSummary(statuses);
  const [open, setOpen] = useState(!compact);
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);

  const pay = (s: BillStatus) => {
    const amount = Math.round(s.left * 100) / 100;
    if (amount <= 0) return;
    saveBills(bills.map((b) => (b.id === s.bill.id ? { ...b, payments: [...b.payments, { month, paidOn: today, amount }] } : b)));
    setUndo({ id: s.bill.id, name: s.bill.name });
  };
  const undoPay = () => {
    if (!undo) return;
    saveBills(
      bills.map((b) => {
        if (b.id !== undo.id) return b;
        // tira só o último pagamento feito (o que acabou de ser marcado)
        const list = [...b.payments];
        const i = list.map((p) => p.paidOn).lastIndexOf(today);
        if (i >= 0) list.splice(i, 1);
        return { ...b, payments: list };
      })
    );
    setUndo(null);
  };

  if (total === 0) {
    return (
      <section className="fixed-bills empty">
        <div className="fixed-head">
          <b>Gastos fixos</b>
        </div>
        <p className="fixed-empty">Cadastre casa, carro, financiamento, cartão… e dê baixa com um toque quando pagar.</p>
        <Link className="btn-outline" to="/ferramentas/minhas-contas">Cadastrar gastos fixos</Link>
      </section>
    );
  }

  const head = (
    <>
      <b>Gastos fixos</b>
      <span className="fixed-count">
        {paid} de {total} pagos{left > 0 ? ` · faltam ${formatBRL(left)}` : ''}
      </span>
    </>
  );

  return (
    <section className={`fixed-bills ${compact ? 'compact' : ''}`}>
      {compact ? (
        <button type="button" className="fixed-head fixed-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span>{head}</span>
          <ChevronDown size={16} className="tl-chev" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
        </button>
      ) : (
        <div className="fixed-head">
          <span>{head}</span>
          <Link className="link-btn" to="/ferramentas/minhas-contas">Gerenciar</Link>
        </div>
      )}

      {open && (
        <>
          <ul className="fixed-list">
            {statuses.map((s) => {
              const ok = s.left < 0.01;
              const late = !ok && s.daysToDue < 0;
              return (
                <li key={s.bill.id} className={ok ? 'ok' : late ? 'late' : ''}>
                  <span className="fixed-copy">
                    <b>{s.bill.name}</b>
                    <small>{dueText(s)}</small>
                  </span>
                  <span className="fixed-amount">{formatBRL(ok ? s.paid : s.left)}</span>
                  {ok ? (
                    <span className="fixed-done" aria-label="Paga"><Check size={16} /></span>
                  ) : (
                    <button type="button" className="fixed-pay" aria-label={`Marcar ${s.bill.name} como paga`} onClick={() => pay(s)}>
                      Paguei
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {undo && (
            <div className="bill-undo" role="status">
              <span><b>{undo.name}</b> marcada como paga hoje ({fmtDay(new Date())}).</span>
              <button type="button" className="link-btn" onClick={undoPay}>Desfazer</button>
            </div>
          )}
          {compact && (
            <Link className="link-btn fixed-manage" to="/ferramentas/minhas-contas">Gerenciar gastos fixos</Link>
          )}
        </>
      )}
    </section>
  );
}
