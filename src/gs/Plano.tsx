import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
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

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ---------- Ferramentas (rota /plano): as ferramentas, cada uma com o seu estado e um porquê ---------- */

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
  const esperando = e.desejos.filter((d) => d.status === 'esperando').length;
  type Item = { rota: string; ic: string; titulo: string; texto: string; busca: string };
  const I = (rota: string, ic: string, titulo: string, texto: string, busca: string): Item => ({ rota, ic, titulo, texto, busca });
  const grupos: { nome: string; itens: Item[] }[] = [
    {
      nome: 'Sair do aperto',
      itens: [
        I('/plano/dividas', 'D', 'Quitar dívidas', total > 0 ? `${brl0(total)} em aberto${sim?.dataFinal ? ` · quita em ${mesCurto(sim.dataFinal)}` : ''}` : e.dividas.length ? 'Tudo quitado' : 'Monte o caminho até zerar', 'divida devo juros banco negociar'),
        I('/plano/emprestimos', 'E', 'Comparar empréstimos', 'Custo real de cada oferta', 'emprestimo financiamento juros oferta'),
        I('/plano/cartao', 'F', 'Cartão de crédito', e.cartao && e.cartao.limite > 0 ? `${Math.round((e.cartao.usado / e.cartao.limite) * 100)}% do limite` : 'Fatura, limite e melhor dia', 'cartao fatura limite credito'),
      ],
    },
    {
      nome: 'Controlar o mês',
      itens: [
        I('/plano/orcamento', 'O', 'Orçamento', e.config.renda > 0 && noLimite ? `${noLimite} categoria${noLimite > 1 ? 's' : ''} no limite` : 'Limite por categoria e 50/30/20', 'orcamento limite categoria gastos 50 30 20'),
        I('/plano/calendario', 'C', 'Calendário de contas', e.gastosFixos.length ? `${aPagar} a pagar neste mês` : 'O que vence e quando', 'calendario contas vencimento boleto'),
        I('/plano/assinaturas', 'A', 'Gastos escondidos', assinaturasTotal(e) > 0 ? `${brl0(assinaturasTotal(e))} por mês` : 'Ache o que você paga sem ver', 'assinaturas streaming gastos escondidos'),
      ],
    },
    {
      nome: 'Guardar dinheiro',
      itens: [
        I('/plano/reserva', 'R', 'Reserva de emergência', meta > 0 ? `${brl0(patrimonioGuardado(e))} de ${brl0(meta)}` : 'Guarde antes de gastar', 'reserva emergencia guardar poupar'),
        I('/plano/extras', 'X', 'Dinheiro extra', '13º, bônus: dê destino a ele', 'extra 13 bonus freela'),
        I('/plano/renda', 'L', 'Viver de renda', alvoRenda > 0 ? `${((patrimonioGuardado(e) / alvoRenda) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do caminho` : 'Quanto falta pra chegar lá', 'renda liberdade aposentadoria patrimonio'),
      ],
    },
    {
      nome: 'Comprar bem',
      itens: [
        I('/plano/comprar', 'P', 'Posso comprar isso?', esperando ? `${esperando} em espera de 72h` : 'Horas de trabalho e veredito', 'comprar compra desejo 72 horas'),
        I('/plano/parcelado', 'V', 'À vista ou parcelado?', 'Descubra o juro escondido', 'parcelado a vista parcela desconto juros'),
      ],
    },
  ];
  const [busca, setBusca] = useState('');
  const q = norm(busca.trim());
  const visiveis = grupos.map((g) => ({ ...g, itens: q ? g.itens.filter((i) => norm(`${i.titulo} ${i.busca}`).includes(q)) : g.itens })).filter((g) => g.itens.length > 0);
  return (
    <>
      <Titulo titulo="Ferramentas" sub="Escolha o que você quer resolver. Cada uma termina numa ação." />
      <section className="gs-card destaque" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 'none', width: 92 }}><Anel pct={s.nota} grande={String(s.nota)} sub="nota" cor={s.nota >= 70 ? 'var(--success)' : s.nota >= 45 ? 'var(--gold-strong)' : 'var(--danger)'} tamanho={92} /></div>
        <div>
          <b>Comece por aqui</b>
          <p className="gs-mudo" style={{ margin: '2px 0 8px' }}>{s.pior.nome}: {s.pior.detalhe}. {s.pior.dica}</p>
          <Link to={s.pior.rota} className="gs-btn pequeno">Abrir</Link>
        </div>
      </section>
      <label className="gs-campo" style={{ marginTop: 16 }}>
        <span style={{ position: "absolute", left: -9999 }}>Buscar ferramenta</span>
        <input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar: dívida, cartão, reserva…" maxLength={40} />
      </label>
      {visiveis.map((g) => (
        <section key={g.nome} aria-label={g.nome}>
          <h2 className="gs-h2">{g.nome}</h2>
          <div className="gs-card" style={{ padding: '4px 16px' }}>
            {g.itens.map((i) => (
              <Link key={i.rota} to={i.rota} className="gs-ferr">
                <span className="ic" aria-hidden="true">{i.ic}</span>
                <span className="gs-corpo"><b>{i.titulo}</b><small>{i.texto}</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ))}
      {visiveis.length === 0 && <p className="gs-mudo" role="status">Nenhuma ferramenta com “{busca}”. Tente outra palavra.</p>}
    </>
  );
}
