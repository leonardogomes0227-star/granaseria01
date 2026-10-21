import { useEffect, useId, useRef, useState } from 'react';
import type { Bill } from '../../bills';
import { MoneyField } from '../Tools';
import { DecimalInput } from '../DecimalInput';

/* ---------- Editar um gasto fixo: o mesmo formulário da criação (Minhas contas), já preenchido ---------- */
// Muda nome, valor, vencimento e parcelas sem perder o que já foi pago.

export function ContaForm({ conta, onSalvar, onCancelar }: { conta: Bill; onSalvar: (b: Bill) => void; onCancelar: () => void }) {
  const id = useId();
  const [nome, setNome] = useState(conta.name);
  const [valor, setValor] = useState(conta.amount);
  const [dia, setDia] = useState(conta.dueDay);
  const [parcelado, setParcelado] = useState(Boolean(conta.installments));
  const [total, setTotal] = useState(conta.installments ?? 1);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    caixa.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);
  const pode = nome.trim().length > 0 && valor > 0;
  const salvar = () => {
    if (!pode) return;
    const { installments: _antes, ...resto } = conta;
    void _antes;
    onSalvar({ ...resto, name: nome.trim(), amount: valor, dueDay: Math.min(31, Math.max(1, Math.round(dia))), ...(parcelado ? { installments: Math.max(1, Math.round(total)) } : {}) });
  };
  return (
    <div
      ref={caixa}
      className="bill-pay conta-form"
      role="group"
      aria-label={`Editar ${conta.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancelar();
        }
      }}
    >
      <div className="field-group">
        <label className="field-label" htmlFor={`${id}-nome`}>Nome</label>
        <input id={`${id}-nome`} className="field-input" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} />
      </div>
      <MoneyField label="Valor" value={valor} onChange={setValor} />
      <div className="field-group">
        <label className="field-label" htmlFor={`${id}-dia`}>Dia do vencimento</label>
        <DecimalInput id={`${id}-dia`} decimals={0} max={31} value={dia} onChange={setDia} />
      </div>
      <div className="seg" role="group" aria-label="Tipo" style={{ marginBottom: 12 }}>
        <button type="button" className={!parcelado ? 'active' : ''} aria-pressed={!parcelado} onClick={() => setParcelado(false)}>Todo mês</button>
        <button type="button" className={parcelado ? 'active' : ''} aria-pressed={parcelado} onClick={() => setParcelado(true)}>Parcelado</button>
      </div>
      {parcelado && (
        <div className="field-group">
          <label className="field-label" htmlFor={`${id}-total`}>Quantas parcelas no total?</label>
          <DecimalInput id={`${id}-total`} decimals={0} max={480} value={total} onChange={setTotal} />
        </div>
      )}
      <div className="bill-actions">
        <button type="button" className="btn-primary" disabled={!pode} onClick={salvar}>Salvar</button>
        <button type="button" className="btn-ghost" onClick={onCancelar}>Cancelar</button>
      </div>
      <p className="field-hint">Os pagamentos já marcados continuam salvos.</p>
    </div>
  );
}
