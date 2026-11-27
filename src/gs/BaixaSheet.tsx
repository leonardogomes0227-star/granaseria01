import { useEffect, useState } from 'react';
import { Folha, CampoDinheiro } from './ui';
import { useUmaVez } from './umaVez';
import { darBaixa, desfazerBaixa } from './acoes';
import { toast } from '../components/ui/Toast';
import { brl, mesCurto } from './datas';
import type { GastoFixo } from './tipos';

/* ---------- "Dar baixa": o valor pago já vem preenchido e pode ser editado ---------- */

export function BaixaSheet({ gasto, mes, onFechar }: { gasto: GastoFixo | null; mes: string; onFechar: () => void }) {
  const [valor, setValor] = useState(0);
  const envio = useUmaVez();
  useEffect(() => { envio.soltar(); setValor(gasto ? gasto.pagamentos[mes]?.valorPago ?? gasto.valor : 0); }, [gasto, mes, envio]);
  return (
    <Folha aberta={Boolean(gasto)} onFechar={onFechar} titulo={gasto ? `Pagar ${gasto.nome}` : ''}>
      <p className="gs-sub">Conta de {mesCurto(mes)}. Se pagou outro valor, é só ajustar.</p>
      <CampoDinheiro rotulo="Valor pago" valor={valor} onChange={setValor} grande />
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button
          type="button"
          className="gs-btn"
          disabled={envio.ocupado || !(valor > 0)}
          onClick={() => {
            envio.tentar(() => {
              if (!gasto || !darBaixa(gasto.id, mes, valor)) return false;
              const id = gasto.id;
              toast(`${gasto.nome} paga: ${brl(valor)}`, { acao: { rotulo: 'Desfazer', onClick: () => desfazerBaixa(id, mes) } });
              onFechar();
              return true;
            });
          }}
        >
          Confirmar pagamento
        </button>
      </div>
    </Folha>
  );
}
