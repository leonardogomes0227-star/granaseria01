import { useState } from 'react';
import { Check } from 'lucide-react';
import { MoneyField } from '../Tools';
import { registrarNaMissao } from '../../missoesAcoes';
import type { Missao, PassoMissao } from '../../missoes';
import { brl } from '../../chat/engine';
import { confete, vibrar } from '../../lib/celebrar';
import { toast } from '../ui/Toast';
import { fraseAgente } from '../../lib/mensagensAgente';

/* ---------- "Marquei que guardei" / "Paguei a parcela": registra no mês atual, com Desfazer ---------- */

export const rotuloAcao = (p: PassoMissao | null, m: Missao) => {
  if (!p) return null;
  if (p.acao === 'guardar') return 'Marquei que guardei';
  if (p.acao === 'pagar') return m.tipo === 'divida' ? 'Paguei a parcela' : 'Paguei';
  return null;
};

/** Registra e avisa (toast com Desfazer; missão cumprida = confete grande). */
export function registrarComAviso(m: Missao, valor: number) {
  const r = registrarNaMissao(m.id, valor);
  if (!r) return;
  vibrar();
  if (r.missao.status === 'concluida') {
    confete('grande');
    toast(`Missão cumprida: ${m.titulo}! ${fraseAgente(m.agente, 'meta_batida')}`, { acao: { rotulo: 'Desfazer', onClick: r.desfazer }, duracao: 7000 });
    return;
  }
  toast(`${m.tipo === 'divida' ? 'Pago' : 'Guardado'}: ${brl(valor)}. ${fraseAgente(m.agente, 'passo')}`, { acao: { rotulo: 'Desfazer', onClick: r.desfazer } });
}

export function Registrar({ missao, onFeito, compacto = false }: { missao: Missao; onFeito?: () => void; compacto?: boolean }) {
  const [valor, setValor] = useState(missao.valorMensal > 0 ? missao.valorMensal : 0);
  return (
    <div className={`ms-registrar ${compacto ? 'compacto' : ''}`}>
      <MoneyField label={missao.tipo === 'divida' ? 'Quanto pagou' : 'Quanto guardou'} value={valor} onChange={setValor} />
      <button
        type="button"
        className="btn-primary"
        disabled={!(valor > 0)}
        onClick={() => {
          registrarComAviso(missao, valor);
          onFeito?.();
        }}
      >
        <Check size={16} /> Confirmar
      </button>
    </div>
  );
}
