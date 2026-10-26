import { Link } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl0, mesCurto, mesDe } from './datas';
import { paraSim, saldoAtual, simular } from './dividas';
import { assinaturasTotal } from './resumos';
import { contasDoMes, patrimonioGuardado, reservaMeta, gastoMensalMedio } from './selectores';
import { saudeFinanceira } from './saude';
import { patrimonioParaRenda } from './ferramentas';
import { Anel } from './graficos';
import { Titulo } from './ui';
import { linhasDeCategoria } from './orcamento';

/* ---------- Plano: as ferramentas, cada uma com o seu estado e um porquê ---------- */

export function Plano() {
  const e = useEstado();
  const hoje = useHoje();
  const mes = mesDe(hoje);
  const total = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
  const sim = e.planoDividas && total > 0 ? simular(paraSim(e.dividas), e.planoDividas.pagamentoMensal, e.planoDividas.estrategia) : null;
  const s = saudeFinanceira(e, mes, hoje);
  const aPagar = contasDoMes(e, mes, hoje).filter((c) => c.estado !== 'paga').length;
  const noLimite = linhasDeCategoria(e, mes).filter((l) => l.tom === 'aviso' || l.tom === 'perigo').length;
  const alvoRenda = patrimonioParaRenda(gastoMensalMedio(e, mes), 0.7);
  const meta = reservaMeta(e, mes);
  const itens: [string, string, string, string][] = [
    ['/plano/dividas', 'D', 'Quitar dívidas', total > 0 ? `${brl0(total)} em aberto${sim?.dataFinal ? ` · quita em ${mesCurto(sim.dataFinal)}` : ''}` : e.dividas.length ? 'Tudo quitado' : 'Monte o caminho até zerar'],
    ['/plano/orcamento', 'O', 'Orçamento', e.config.renda > 0 ? (noLimite ? `${noLimite} categoria${noLimite > 1 ? 's' : ''} no limite` : 'Limite por categoria e 50/30/20') : 'Limite por categoria e 50/30/20'],
    ['/plano/calendario', 'C', 'Calendário de contas', e.gastosFixos.length ? `${aPagar} a pagar neste mês` : 'O que vence e quando'],
    ['/plano/assinaturas', 'A', 'Gastos escondidos', assinaturasTotal(e) > 0 ? `${brl0(assinaturasTotal(e))} por mês` : 'Ache o que você paga sem ver'],
    ['/plano/reserva', 'R', 'Reserva de emergência', meta > 0 ? `${brl0(patrimonioGuardado(e))} de ${brl0(meta)}` : 'Guarde antes de gastar'],
    ['/plano/comprar', 'P', 'Posso comprar isso?', e.desejos.some((d) => d.status === 'esperando') ? `${e.desejos.filter((d) => d.status === 'esperando').length} em espera de 72h` : 'Horas de trabalho e veredito'],
    ['/plano/parcelado', 'V', 'À vista ou parcelado?', 'Descubra o juro escondido'],
    ['/plano/cartao', 'F', 'Cartão de crédito', e.cartao ? `${Math.round((e.cartao.usado / e.cartao.limite) * 100)}% do limite` : 'Fatura, limite e melhor dia'],
    ['/plano/emprestimos', 'E', 'Comparar empréstimos', 'Custo real de cada oferta'],
    ['/plano/renda', 'L', 'Viver de renda', alvoRenda > 0 ? `${((patrimonioGuardado(e) / alvoRenda) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do caminho` : 'Quanto falta pra chegar lá'],
    ['/plano/extras', 'X', 'Dinheiro extra', '13º, bônus: dê destino a ele'],
  ];
  return (
    <>
      <Titulo titulo="Plano" sub="Ferramentas que usam os seus números e terminam numa ação." />
      <section className="gs-card destaque" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 'none', width: 92 }}><Anel pct={s.nota} grande={String(s.nota)} sub="nota" cor={s.nota >= 70 ? 'var(--success)' : s.nota >= 45 ? 'var(--gold-strong)' : 'var(--danger)'} tamanho={92} /></div>
        <div>
          <b>Comece por aqui</b>
          <p className="gs-mudo" style={{ margin: '2px 0 8px' }}>{s.pior.nome}: {s.pior.detalhe}. {s.pior.dica}</p>
          <Link to={s.pior.rota} className="gs-btn pequeno">Abrir</Link>
        </div>
      </section>
      <div className="gs-grid2">
        {itens.map(([rota, ic, titulo, texto]) => (
          <Link key={rota} to={rota} className="gs-tile">
            <span className="ic">{ic}</span>
            <b>{titulo}</b>
            <small>{texto}</small>
          </Link>
        ))}
      </div>
    </>
  );
}
