// A resposta de cada ferramenta, em uma frase com número e data, o porquê, UM botão e o passo que vai para o caminho.
// É a seção 3.4 do prompt: toda ferramenta termina em solução, não em número. Pura e testada; a tela só mostra.

import { brl, brl0, diaCurto, mesCurto, mesDe, nomeMes } from './datas.js';
import { situacaoAtrasos } from './atrasosLogica.js';
import { proximaData } from './cartaoLogica.js';
import { eventosDoMes, faltaDoMes } from './calendarioLogica.js';
import { serieMensal, compararMeses, gastosPorCategoria } from './evolucaoLogica.js';
import { linhasDeCategoria } from './orcamento.js';
import { planoDeSaida, passoDoDia } from './recuperacaoLogica.js';
import { calcularCaminho, fraseDoMarco, type Marco, type Mudanca } from './caminho.js';
import { contasDoMes, detalheDisponivel, faltaPagar, faturaAberta, totalVariaveis } from './selectores.js';
import { assinaturasTotal } from './resumos.js';
import type { Estado } from './tipos.js';

export type HandlerResposta = 'adicionar' | 'renda' | 'baixa';
export interface RespostaFerramenta {
  frase: string; // a resposta, com número (e data quando existe)
  porque: string[]; // "Como cheguei nisso"
  acao: { rotulo: string; rota?: string; handler?: HandlerResposta; refId?: string };
  passo?: { titulo: string; detalhe: string; rota?: string }; // "Colocar no meu caminho"
  mudanca?: Mudanca; // quando a decisão mexe na data do destino
  tom?: 'perigo' | 'aviso' | 'ok' | '';
}

const marco = (e: Estado, hoje: string, id: Marco['id']) => calcularCaminho(e, hoje).find((m) => m.id === id);
const qtd = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const premissas = (m?: Marco) => (m?.premissas ?? []).map((p) => p.charAt(0).toUpperCase() + p.slice(1) + '.');

/** Nulo quando a ferramenta não tem o que responder com os dados de agora (a tela mostra o que pedir). */
export function respostaDe(id: string, e: Estado, hoje: string): RespostaFerramenta | null {
  const mes = mesDe(hoje);
  const disp = detalheDisponivel(e, mes, hoje);
  const semRenda = disp.modo === 'incompleto';
  const pedirRenda: RespostaFerramenta = { frase: 'Me conte quanto entra por mês e eu respondo com os seus números.', porque: ['Sem a renda (ou o saldo de hoje), qualquer número seria chute.'], acao: { rotulo: 'Informar minha renda', handler: 'renda' }, tom: 'aviso' };

  switch (id) {
    case 'contas': {
      const cs = contasDoMes(e, mes, hoje);
      if (cs.length === 0) return { frase: 'Cadastre suas contas do mês e eu digo o que pagar primeiro e quando vence cada uma.', porque: ['Aluguel, luz, água, internet: com elas eu aviso antes de vencer e tiro do "pode gastar" o que já tem dono.'], acao: { rotulo: 'Cadastrar a primeira conta', rota: '/lancamentos?aba=contas' } };
      const abertas = cs.filter((c) => c.estado !== 'paga');
      if (abertas.length === 0) return { frase: `Todas as ${cs.length} contas de ${nomeMes(mes).split(' ')[0]} estão pagas. Mês em ordem.`, porque: cs.map((c) => `${c.gasto.nome}: ${brl(c.valor)}, paga.`), acao: { rotulo: 'Ver meu caminho', rota: '/' }, tom: 'ok' };
      const p = abertas[0];
      const quando = p.estado === 'atrasada' ? `venceu ${diaCurto(p.vencimento)}` : p.dias === 0 ? 'vence hoje' : p.dias === 1 ? 'vence amanhã' : `vence ${diaCurto(p.vencimento)}`;
      return { frase: `Falta pagar ${brl0(faltaPagar(e, mes))} em ${qtd(abertas.length, 'conta', 'contas')}. A primeira é ${p.gasto.nome}: ${brl(p.valor)}, ${quando}.`, porque: abertas.map((c) => `${c.gasto.nome}: ${brl(c.valor)}, dia ${c.vencimento.slice(8)}${c.estado === 'atrasada' ? ' (atrasada)' : ''}.`), acao: { rotulo: `Pagar ${p.gasto.nome}`, handler: 'baixa', refId: p.gasto.id }, passo: { titulo: `Pagar ${p.gasto.nome} até ${diaCurto(p.vencimento)}`, detalhe: `${brl(p.valor)}. Pagando no dia, não tem multa.`, rota: '/pagar' }, tom: p.estado === 'atrasada' ? 'perigo' : p.estado === 'vence-logo' ? 'aviso' : '' };
    }

    case 'calendario': {
      const ev = eventosDoMes(e, mes, hoje).filter((x) => !x.paga);
      if (ev.length === 0) return { frase: 'Nada mais vence neste mês. O que entrar daqui para frente é para o seu plano.', porque: ['Contas fixas, parcelas e fatura do mês já estão pagas, ou não há nenhuma cadastrada.'], acao: { rotulo: 'Ver meu caminho', rota: '/' }, tom: 'ok' };
      const prox = ev.sort((a, b) => a.data.localeCompare(b.data))[0];
      const sobra = semRenda ? null : disp.livre;
      return { frase: `Ainda vencem ${brl0(faltaDoMes(ev))} neste mês. O próximo é ${prox.nome}, ${diaCurto(prox.data)}${sobra !== null ? `, e depois de tudo sobram ${brl0(sobra)}` : ''}.`, porque: ev.slice(0, 6).map((x) => `${diaCurto(x.data)}: ${x.nome}, ${brl(x.valor)}.`), acao: { rotulo: 'Ver as contas a pagar', rota: '/pagar' }, passo: { titulo: `Separar ${brl0(prox.valor)} para ${prox.nome}`, detalhe: `Vence ${diaCurto(prox.data)}.`, rota: '/pagar' }, tom: prox.dias < 0 ? 'perigo' : prox.dias <= 3 ? 'aviso' : '' };
    }

    case 'atrasos': {
      const s = situacaoAtrasos(e, hoje);
      if (s.atrasos.length === 0) return { frase: 'Nenhuma conta atrasada. Esse marco do seu caminho está feito.', porque: ['Nenhuma conta fixa de meses anteriores sem pagamento e nenhuma parcela vencida.'], acao: { rotulo: 'Anotar uma conta antiga', rota: '/plano/atrasos?anotar=1' }, tom: 'ok' };
      const m = marco(e, hoje, 'em-dia');
      const p = s.atrasos[0];
      return { frase: s.plano.emDiaEm ? `Você fica em dia em ${nomeMes(s.plano.emDiaEm)}. Comece por ${p.nome}: ${brl0(p.total)}.` : `São ${brl0(s.total)} atrasados. Comece por ${p.nome}: ${brl0(p.total)}.`, porque: [...premissas(m), `${qtd(s.atrasos.length, 'conta', 'contas')} na ordem de pagar: moradia, luz e água, financiamento, outras, cartão.`], acao: { rotulo: `Pagar ${p.nome}`, rota: '/plano/atrasos' }, passo: { titulo: `Pagar ${p.nome}${p.mes < mes ? ` de ${mesCurto(p.mes)}` : ''}`, detalhe: `${brl0(p.total)} com multa e juros estimados. Vem primeiro na fila.`, rota: '/plano/atrasos' }, tom: 'perigo' };
    }

    case 'dividas': {
      const m = marco(e, hoje, 'dividas');
      if (!m || m.status === 'nao-se-aplica') return { frase: 'Nenhuma dívida cadastrada. Se tiver uma, cadastre em 3 toques e eu digo a data em que você fica livre.', porque: ['Tipo, quanto deve e quanto paga por mês. O juro eu estimo pelo tipo, se você não souber.'], acao: { rotulo: 'Cadastrar uma dívida', rota: '/plano/dividas?nova=1' } };
      if (m.status === 'feito') return { frase: 'Você está livre das dívidas cadastradas. Agora esse dinheiro vai para a sua reserva.', porque: ['Todas as dívidas cadastradas estão com saldo zero.'], acao: { rotulo: 'Ver a reserva', rota: '/plano/reserva' }, tom: 'ok' };
      const f = fraseDoMarco(m);
      return { frase: f.data ? `Você fica livre das dívidas em ${f.data}. Faltam ${brl0(m.faltaValor)}, pagando ${brl0(m.porMes)} por mês.` : `${m.pendencia ?? 'Ainda não dá para calcular a data.'}`, porque: premissas(m), acao: { rotulo: e.planoDividas ? 'Registrar o pagamento do mês' : 'Escolher como quitar', rota: '/plano/dividas' }, passo: { titulo: `Pagar ${brl0(m.porMes)} nas dívidas este mês`, detalhe: f.data ? `Mantendo esse valor, você fica livre em ${f.data}.` : 'Para os juros pararem de ganhar.', rota: '/plano/dividas' }, mudanca: { tipo: 'corte', porMes: 100 }, tom: f.data ? 'aviso' : 'perigo' };
    }

    case 'cartao': {
      if (!e.cartao) return { frase: 'Cadastre seu cartão e eu digo quanto vem na fatura e o que já está comprometido nos próximos meses.', porque: ['Com o limite, a fatura atual e o dia de vencimento eu acompanho tudo.'], acao: { rotulo: 'Cadastrar meu cartão', rota: '/plano/cartao' } };
      const v = proximaData(e.cartao.venceDia, hoje);
      const total = faturaAberta(e);
      const uso = e.cartao.limite > 0 ? Math.round((e.cartao.usado / e.cartao.limite) * 100) : 0;
      if (total <= 0) return { frase: `Nenhuma fatura em aberto. O cartão tem ${brl0(e.cartao.limite)} de limite livre.`, porque: ['Fatura atual zerada.'], acao: { rotulo: 'Simular uma compra', rota: '/plano/cartao' }, tom: 'ok' };
      return { frase: `Pague ${brl(total)} inteiros até ${diaCurto(v.data)}. Assim você foge do rotativo (os juros de quem paga só uma parte).`, porque: [`Fatura aberta: ${brl(total)}.`, `Vence em ${qtd(v.dias, 'dia', 'dias')}.`, `Você usa ${uso}% do limite.`, ...(semRenda ? [] : [`Ela já está descontada do seu "pode gastar".`])], acao: { rotulo: 'Abrir o cartão', rota: '/plano/cartao' }, passo: { titulo: `Pagar a fatura inteira até ${diaCurto(v.data)}`, detalhe: `${brl(total)}, sem rotativo.`, rota: '/plano/cartao' }, tom: v.dias <= 2 || uso > 90 ? 'perigo' : v.dias <= 7 || uso > 70 ? 'aviso' : '' };
    }

    case 'recuperacao': {
      const p = planoDeSaida(e, hoje);
      const d = passoDoDia(e, hoje);
      if (p.nItens === 0) return { frase: 'Nada atrasado e nenhuma dívida: você não precisa do modo recuperação agora.', porque: ['Sem contas atrasadas nem dívidas cadastradas.'], acao: { rotulo: 'Ver meu caminho', rota: '/' }, tom: 'ok' };
      return { frase: p.emDiaEm ? `Você deve ${brl0(p.totalDevido)} e fica em dia em ${nomeMes(p.emDiaEm)}. Hoje: ${d.titulo.toLowerCase()}.` : `Você deve ${brl0(p.totalDevido)}. Com o que sobra hoje ainda não fecha: o passo é ${d.titulo.toLowerCase()}.`, porque: [`Sobra cerca de ${brl0(p.capacidade)} por mês para pagar.`, ...(p.semHistorico ? ['Sem gastos anotados, essa sobra pode estar otimista.'] : []), ...(p.temEstimativa ? ['Alguns valores são estimados.'] : []), d.texto], acao: { rotulo: d.tipo === 'pagar' ? 'Resolver agora' : 'Abrir o plano', rota: d.rota ?? '/recuperacao' }, passo: { titulo: d.titulo, detalhe: d.texto, rota: d.rota ?? '/recuperacao' }, tom: 'aviso' };
    }

    case 'lancamentos': {
      if (semRenda) return pedirRenda;
      const gasto = totalVariaveis(e, mes);
      const top = gastosPorCategoria(e, mes)[0];
      if (gasto <= 0) return { frase: `Nada anotado neste mês ainda. Você pode gastar ${brl(disp.porDia)} por dia.`, porque: ['Sem gastos anotados o "pode gastar" fica otimista: anote, ou mande pelo WhatsApp.'], acao: { rotulo: 'Anotar um gasto', handler: 'adicionar' }, tom: 'aviso' };
      return { frase: `Você gastou ${brl0(gasto)} no dia a dia este mês${top ? `, mais em ${top.categoria} (${brl0(top.valor)})` : ''}. Ainda dá para gastar ${brl(disp.porDia)} por dia.`, porque: gastosPorCategoria(e, mes).slice(0, 4).map((c) => `${c.categoria}: ${brl0(c.valor)}.`), acao: { rotulo: 'Anotar um gasto', handler: 'adicionar' }, passo: top ? { titulo: `Segurar ${top.categoria} até o fim do mês`, detalhe: `Já foram ${brl0(top.valor)}.`, rota: '/gastos' } : undefined };
    }

    case 'orcamento': {
      if (semRenda) return pedirRenda;
      const ls = linhasDeCategoria(e, mes).filter((l) => l.limite);
      const estouro = ls.find((l) => l.tom === 'perigo') ?? ls.find((l) => l.tom === 'aviso');
      if (ls.length === 0) return { frase: `Defina um limite por categoria e eu aviso antes de passar. Hoje sobram ${brl0(Math.max(0, disp.livre))} para o dia a dia.`, porque: ['O orçamento divide o que sobra entre mercado, transporte, lazer e o resto.'], acao: { rotulo: 'Montar meu orçamento', rota: '/plano/orcamento' } };
      if (!estouro) return { frase: `Todas as ${ls.length} categorias estão dentro do limite. Sobram ${brl0(Math.max(0, disp.livre))} no mês.`, porque: ls.map((l) => `${l.categoria}: ${brl0(l.gasto)} de ${brl0(l.limite ?? 0)}.`), acao: { rotulo: 'Ajustar limites', rota: '/plano/orcamento' }, tom: 'ok' };
      const falta = Math.max(0, (estouro.limite ?? 0) - estouro.gasto);
      return { frase: estouro.tom === 'perigo' ? `${estouro.categoria} passou ${brl0(estouro.gasto - (estouro.limite ?? 0))} do limite. Segure essa categoria até o fim do mês.` : `${estouro.categoria} está perto do limite: restam ${brl0(falta)} até o fim do mês.`, porque: ls.map((l) => `${l.categoria}: ${brl0(l.gasto)} de ${brl0(l.limite ?? 0)}.`), acao: { rotulo: 'Ver o orçamento', rota: '/plano/orcamento' }, passo: { titulo: `Não gastar mais em ${estouro.categoria} este mês`, detalhe: `Limite de ${brl0(estouro.limite ?? 0)}; já foram ${brl0(estouro.gasto)}.`, rota: '/plano/orcamento' }, tom: estouro.tom === 'perigo' ? 'perigo' : 'aviso' };
    }

    case 'relatorios': {
      const serie = serieMensal(e, hoje, 6);
      const c = compararMeses(serie, mes);
      const prev = serie.filter((s) => s.mes < mes && s.temDados);
      if (!c || prev.length === 0) return { frase: 'Com um mês completo anotado eu mostro se você está melhorando, com os números lado a lado.', porque: ['Comparar exige pelo menos o mês passado com dados.'], acao: { rotulo: 'Anotar um gasto', handler: 'adicionar' } };
      const sobrou = (s: (typeof serie)[number]) => s.receitas - s.despesas - s.dividasPagas;
      const ult = prev[prev.length - 1];
      const media = prev.reduce((t, s) => t + sobrou(s), 0) / prev.length;
      const melhorou = sobrou(ult) >= media;
      return { frase: `Em ${nomeMes(ult.mes).split(' ')[0]} sobraram ${brl0(sobrou(ult))}, ${melhorou ? 'mais' : 'menos'} que a sua média (${brl0(media)}). ${melhorou ? 'Você está no caminho certo.' : 'Sem drama: dá para ajustar este mês.'}`, porque: prev.slice(-4).map((s) => `${mesCurto(s.mes)}: entrou ${brl0(s.receitas)}, saiu ${brl0(s.despesas + s.dividasPagas)}.`), acao: { rotulo: melhorou ? 'Ver meu caminho' : 'Ver onde cortar', rota: melhorou ? '/' : '/plano/cortar' }, tom: melhorou ? 'ok' : 'aviso' };
    }

    case 'reserva': {
      const m = marco(e, hoje, 'reserva');
      if (!m) return null;
      if (m.status === 'feito') return { frase: 'Sua reserva de emergência está completa. O próximo passo é fazer o dinheiro trabalhar.', porque: ['O que você guardou cobre a meta de meses do seu gasto.'], acao: { rotulo: 'Ver como investir', rota: '/investir' }, tom: 'ok' };
      const f = fraseDoMarco(m);
      return { frase: f.data ? `Sua reserva fica completa em ${f.data}. Faltam ${brl0(m.faltaValor)}, guardando ${brl0(m.porMes)} por mês.` : m.pendencia ?? 'Ainda não dá para calcular.', porque: premissas(m), acao: { rotulo: 'Guardar agora', rota: '/plano/reserva' }, passo: { titulo: `Guardar ${brl0(m.porMes)} na reserva este mês`, detalhe: f.data ? `No ritmo, completa em ${f.data}.` : 'Um pouco todo mês já protege.', rota: '/plano/reserva' }, mudanca: m.porMes > 0 ? { tipo: 'extra', valor: m.porMes } : undefined, tom: f.data ? '' : 'aviso' };
    }

    case 'metas': {
      const m = marco(e, hoje, 'objetivo');
      if (!m || m.pendencia?.startsWith('Crie')) return { frase: 'Dê um nome e um valor ao seu objetivo, e eu digo quanto guardar por mês e quando você chega lá.', porque: ['Viagem, carro, casa: com o valor e o prazo eu faço a conta.'], acao: { rotulo: 'Criar uma meta', rota: '/guardar#metas' } };
      if (m.status === 'feito') return { frase: 'Suas metas estão batidas. Que tal escolher a próxima?', porque: ['Todas as metas chegaram no valor.'], acao: { rotulo: 'Criar outra meta', rota: '/guardar#metas' }, tom: 'ok' };
      const f = fraseDoMarco(m);
      return { frase: f.data ? `Você chega em "${m.titulo}" em ${f.data}, guardando ${brl0(m.porMes)} por mês. Faltam ${brl0(m.faltaValor)}.` : m.pendencia ?? '', porque: premissas(m), acao: { rotulo: 'Guardar na meta', rota: '/guardar#metas' }, passo: { titulo: `Guardar ${brl0(m.porMes)} para ${m.titulo}`, detalhe: f.data ? `Mantém a data: ${f.data}.` : 'Para a meta andar.', rota: '/guardar#metas' } };
    }

    case 'extras': {
      const m = calcularCaminho(e, hoje).find((x) => x.status === 'atual');
      return { frase: 'Digite quanto entrou e eu mostro o melhor rumo e quanto isso adianta o seu caminho.', porque: ['A ordem: contas atrasadas, dívidas caras, reserva, investir. Uma parte fica para você aproveitar sem culpa.', ...(m ? [`Seu destino agora: ${m.titulo.toLowerCase()}.`] : [])], acao: { rotulo: 'Registrar a entrada', handler: 'adicionar' } };
    }

    case 'investir': {
      const m = marco(e, hoje, 'investir');
      const r = marco(e, hoje, 'reserva');
      if (m?.status === 'feito') return { frase: 'Seu dinheiro já trabalha para você. Agora é manter o valor todo mês.', porque: ['Há valores guardados como investimento.'], acao: { rotulo: 'Ver a simulação', rota: '/investir' }, tom: 'ok' };
      if (r && r.status !== 'feito') { const f = fraseDoMarco(r); return { frase: `Antes de investir, a reserva${f.data ? `: ela fica pronta em ${f.data}` : ''}. Investir com dívida cara ou sem reserva costuma sair caro.`, porque: premissas(r), acao: { rotulo: 'Ver o caminho em passos', rota: '/investir' }, passo: { titulo: 'Completar a reserva antes de investir', detalhe: f.data ? `Prevista para ${f.data}.` : 'Um pouco todo mês.', rota: '/plano/reserva' } }; }
      return { frase: 'Sua base está pronta: é hora do primeiro investimento. Comece descobrindo o seu perfil.', porque: ['Contas em dia, sem dívida cara e com reserva.', 'Não indico banco nem produto, e nenhum investimento tem retorno garantido.'], acao: { rotulo: 'Descobrir meu perfil', rota: '/investir' }, passo: { titulo: 'Fazer o primeiro investimento', detalhe: 'Depois de descobrir o seu perfil.', rota: '/investir' }, tom: 'ok' };
    }

    case 'renda': {
      const m = marco(e, hoje, 'renda');
      if (!m) return null;
      if (m.status === 'feito') return { frase: 'O que você juntou já pode pagar o seu mês. Você chegou ao topo do caminho.', porque: premissas(m), acao: { rotulo: 'Ver os degraus', rota: '/plano/renda' }, tom: 'ok' };
      return { frase: m.dataPrevista ? `No ritmo de hoje, você vive de renda em ${m.dataPrevista.slice(0, 4)}. Faltam ${brl0(m.faltaValor)}.` : m.pendencia ?? '', porque: premissas(m), acao: { rotulo: 'Ver os degraus', rota: '/plano/renda' }, passo: { titulo: `Guardar ${brl0(m.porMes)} todo mês para o futuro`, detalhe: 'O primeiro degrau é a sua menor conta paga pelo rendimento.', rota: '/plano/renda' }, mudanca: { tipo: 'corte', porMes: 100 } };
    }

    case 'assinaturas': {
      const t = assinaturasTotal(e);
      if (t <= 0) return { frase: 'Cadastre o que você paga todo mês e eu mostro quanto isso vira em 1, 5 e 10 anos.', porque: ['Streaming, academia, aplicativos: valores pequenos que somam muito.'], acao: { rotulo: 'Adicionar assinatura', rota: '/plano/assinaturas' } };
      return { frase: `Você paga ${brl0(t)} por mês em assinaturas: ${brl0(t * 12)} por ano. Corte a que você menos usa.`, porque: e.assinaturas.filter((a) => a.ativa).map((a) => `${a.nome}: ${brl0(a.valor)} por mês.`), acao: { rotulo: 'Revisar as assinaturas', rota: '/plano/assinaturas' }, tom: '' };
    }

    default:
      return null;
  }
}

/** Ferramentas antigas (/ferramentas/:slug) que mostram a resposta do registro no topo. */
export const RESPOSTA_DO_SLUG: Record<string, string> = { 'placar-pai-rico': 'investir', 'simulador-longo-prazo': 'renda', 'check-in-mensal': 'relatorios', 'meu-plano': 'atrasos', 'leitor-de-fatura': 'cartao', 'seus-direitos': 'atrasos', 'meus-selos': 'reserva', 'frase-do-dia': 'reserva' };
