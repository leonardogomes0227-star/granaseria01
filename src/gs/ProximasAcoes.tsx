import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useEstado } from './store';
import { getInsights, type Insight } from './insights';
import { guardar, pagarDivida, removerAporte, desfazerPagamentoDivida } from './acoes';
import { BaixaSheet } from './BaixaSheet';
import { toast } from '../components/ui/Toast';
import { useHoje } from './useHoje';
import { lerCdiMensal } from './mercadoCache';
import { brl0, hoje as hojeSP } from './datas';
import { Vazio } from './ui';

/* ---------- Próximas ações: até 3, as mais urgentes, cada uma com o botão de fazer ---------- */

export function ProximasAcoes() {
  const e = useEstado();
  const hoje = useHoje();
  const [baixa, setBaixa] = useState<string | null>(null);
  const itens = useMemo(() => getInsights(e, hoje, { cdiMensalPct: lerCdiMensal() }), [e, hoje]);
  const gasto = e.gastosFixos.find((g) => g.id === baixa) ?? null;
  const fazer = (i: Insight) => {
    const a = i.acao;
    if (a.tipo === 'dar-baixa' && a.refId) return setBaixa(a.refId);
    if (a.tipo === 'pagar-divida' && a.refId && a.valor) {
      const data = hojeSP();
      const valor = Math.round(a.valor * 100) / 100;
      const id = a.refId;
      if (pagarDivida(id, valor, data)) toast(`Pagamento de ${brl0(valor)} registrado`, { acao: { rotulo: 'Desfazer', onClick: () => desfazerPagamentoDivida(id, data, valor) } });
      return;
    }
    if (a.tipo === 'guardar' && a.valor) {
      const id = guardar(a.valor, 'reserva', 'reserva');
      if (id) toast(`${brl0(a.valor)} guardados`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
    }
  };
  if (itens.length === 0)
    return <Vazio titulo="Tudo em dia por aqui" texto={e.gastosFixos.length === 0 ? 'Cadastre suas contas fixas e eu te aviso antes de cada vencimento.' : 'Nada urgente agora. Anote seus gastos pra manter o plano certo.'} acao={e.gastosFixos.length === 0 ? 'Cadastrar contas' : 'Anotar gasto'} rota={e.gastosFixos.length === 0 ? '/lancamentos?aba=contas' : '/lancamentos?aba=dia'} />;
  return (
    <>
      <div className="gs-lista-acoes">
        {itens.map((i) => (
          <div key={i.id} className={`gs-acao ${i.prioridade >= 85 ? 'urgente' : ''}`}>
            <p>{i.texto}</p>
            {i.acao.tipo === 'ir' || i.acao.tipo === 'revisar-assinaturas' ? (
              <Link to={i.acao.rota ?? '/'} className="gs-btn pequeno sec">{i.acao.rotulo}</Link>
            ) : (
              <button type="button" className="gs-btn pequeno" onClick={() => fazer(i)}>
                <Check size={16} /> {i.acao.rotulo}
              </button>
            )}
          </div>
        ))}
      </div>
      <BaixaSheet gasto={gasto} mes={hoje.slice(0, 7)} onFechar={() => setBaixa(null)} />
    </>
  );
}
