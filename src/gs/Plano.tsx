import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { brl0, mesCurto, mesDe } from './datas';
import { paraSim, saldoAtual, simular } from './dividas';
import { assinaturasTotal } from './resumos';
import { reservaMeta, patrimonioGuardado } from './selectores';
import { Titulo, AvatarAssistente } from './ui';

/* ---------- Plano: as ferramentas que viram plano, com o estado atual de cada uma ---------- */

export function Plano() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const total = e.dividas.reduce((t, d) => t + saldoAtual(d), 0);
  const sim = e.planoDividas && total > 0 ? simular(paraSim(e.dividas), e.planoDividas.pagamentoMensal, e.planoDividas.estrategia) : null;
  const itens: { id: string; rota: string; titulo: string; texto: string; assistente: string }[] = [
    { id: 'dividas', rota: '/plano/dividas', titulo: 'Quitar dívidas', texto: total > 0 ? `${brl0(total)} em aberto${sim?.dataFinal ? ` · quita em ${mesCurto(sim.dataFinal)}` : ''}` : e.dividas.length ? 'Tudo quitado' : 'Monte o caminho até zerar', assistente: 'dividas' },
    { id: 'comprar', rota: '/plano/comprar', titulo: 'Posso comprar isso?', texto: e.desejos.some((d) => d.status === 'esperando') ? `${e.desejos.filter((d) => d.status === 'esperando').length} em espera de 72h` : 'Horas de trabalho e veredito', assistente: 'gastos' },
    { id: 'assinaturas', rota: '/plano/assinaturas', titulo: 'Gastos escondidos', texto: assinaturasTotal(e) > 0 ? `${brl0(assinaturasTotal(e))} por mês em assinaturas` : 'Ache o que você paga sem ver', assistente: 'assinaturas' },
    { id: 'reserva', rota: '/plano/reserva', titulo: 'Reserva', texto: reservaMeta(e, mes) > 0 ? `${brl0(patrimonioGuardado(e))} de ${brl0(reservaMeta(e, mes))}` : 'Guarde antes de gastar', assistente: 'reserva' },
    { id: 'renda', rota: '/plano/renda', titulo: 'Liberdade de renda', texto: 'Quanto falta pra viver de rendimentos', assistente: 'renda' },
    { id: 'emprestimos', rota: '/plano/emprestimos', titulo: 'Empréstimos', texto: 'Compare ofertas pelo custo real', assistente: 'emprestimos' },
    { id: 'extras', rota: '/plano/extras', titulo: 'Dinheiro extra', texto: '13º, bônus: dê destino a ele', assistente: 'extras' },
  ];
  return (
    <>
      <Titulo titulo="Plano" sub="O que fazer com o seu dinheiro, passo a passo." />
      <div className="gs-card" style={{ padding: '4px 20px' }}>
        {itens.map((i) => (
          <Link key={i.id} to={i.rota} className="gs-linha" style={{ textDecoration: 'none', color: 'inherit' }}>
            <AvatarAssistente id={i.assistente} />
            <div className="gs-corpo"><b>{i.titulo}</b><small>{i.texto}</small></div>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </>
  );
}
