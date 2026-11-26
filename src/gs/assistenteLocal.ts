// O assistente do app (a bolinha dourada). Por enquanto responde aqui mesmo, com os números da pessoa.
// PARA LIGAR A API DEPOIS: troque o corpo de `perguntarAoAssistente` por uma chamada ao servidor
// (ex.: fetch('/api/assistente', { method: 'POST', body: JSON.stringify({ pergunta, historico }) })) e devolva o mesmo formato
// de `RespostaAssistente`. A tela (Assistente.tsx) não precisa mudar. `responderLocal` pode ficar como reserva quando a API falhar.

import { brl, brl0, diaCurto, mesDe, nomeMes } from './datas.js';
import { sem } from './atrasosBase.js';
import { contasDoMes, detalheDisponivel, guardadoNoMes, patrimonioGuardado } from './selectores.js';
import { paraSim, saldoAtual, simular } from './dividas.js';
import { planoDeQuitacao } from './caminho.js';
import { gastosPorCategoria } from './evolucaoLogica.js';
import { buscar } from './registroFerramentas.js';
import type { Estado } from './tipos.js';
import { agirPorFrase } from './midasAcoes';
import { acharDestinos, pedidoDeIr } from './destinos.js';

export const NOME_ASSISTENTE = 'Midas';

export interface LinkAssistente { titulo: string; rota: string }
export interface RespostaAssistente { texto: string; links?: LinkAssistente[]; desfazer?: () => void; /** quando o Midas tem certeza do lugar, a tela abre sozinha */ ir?: string }
export interface MensagemAssistente { de: 'voce' | 'assistente'; texto: string; links?: LinkAssistente[]; desfazer?: () => void; desfeito?: boolean }

export const EXEMPLOS_ANOTAR = ['mercado 35', 'uber 18,50', 'almoço 30 ontem', 'recebi 200 de extra'];
export const SUGESTOES = ['O que eu pago primeiro?', 'Quanto posso gastar hoje?', 'Quando fico livre das dívidas?', 'Onde fica o orçamento?', 'Abrir minhas contas', 'Quanto já guardei?'];

const tem = (t: string, ...palavras: string[]) => palavras.some((p) => t.includes(p));

/** Resposta sem internet: lê os dados do app e responde em uma ou duas frases, com atalhos para a tela certa. Pura, com teste. */
export function responderLocal(pergunta: string, e: Estado, hoje: string): RespostaAssistente {
  const t = sem(pergunta);
  const mes = mesDe(hoje);

  // "abrir contas", "onde fica o orçamento": o Midas leva a pessoa até lá
  if (pedidoDeIr(t)) {
    const d = acharDestinos(pergunta);
    if (d.length === 1) return { texto: `Te levo para ${d[0].titulo}.`, links: d, ir: d[0].rota };
    if (d.length > 1) return { texto: 'Achei estes lugares. Toque no que você procura:', links: d };
  }

  if (tem(t, 'divida', 'devo', 'livre', 'quitar', 'juros')) {
    const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
    if (abertas.length === 0) return { texto: e.dividas.length ? 'Você não tem dívidas em aberto. Todas quitadas.' : 'Você ainda não cadastrou nenhuma dívida. Cadastre e eu mostro o dia em que você fica livre.', links: [{ titulo: 'Cadastrar dívida', rota: '/plano/dividas?nova=1' }] };
    const ds = paraSim(e.dividas);
    const { pagamento, estrategia } = planoDeQuitacao(e, mes);
    const sim = simular(ds, pagamento, estrategia, mes);
    const total = ds.reduce((s, d) => s + d.saldo, 0);
    return { texto: `Você deve ${brl0(total)} em ${abertas.length} ${abertas.length === 1 ? 'dívida' : 'dívidas'}. ${sim.quita && sim.dataFinal ? `Pagando ${brl0(pagamento)} por mês, você fica livre em ${nomeMes(sim.dataFinal)}.` : 'Com o pagamento de hoje a dívida não zera: vale aumentar a parcela ou negociar.'}`, links: [{ titulo: 'Abrir Dívidas', rota: '/plano/dividas' }] };
  }

  if (tem(t, 'pago primeiro', 'pagar', 'conta', 'vence', 'vencimento', 'boleto', 'atras')) {
    const abertas = contasDoMes(e, mes, hoje).filter((c) => c.estado !== 'paga').sort((a, b) => a.dias - b.dias);
    if (e.gastosFixos.length === 0) return { texto: 'Você ainda não cadastrou suas contas. Cadastre as fixas (aluguel, luz, internet) e eu digo o que pagar primeiro.', links: [{ titulo: 'Cadastrar conta', rota: '/pagar?nova=1' }] };
    if (abertas.length === 0) return { texto: 'Tudo pago neste mês. Pode respirar.', links: [{ titulo: 'Ver contas', rota: '/pagar' }] };
    const falta = abertas.reduce((s, c) => s + c.valor, 0);
    const p = abertas[0];
    const quando = p.dias < 0 ? `está atrasada há ${-p.dias} ${-p.dias === 1 ? 'dia' : 'dias'}` : p.dias === 0 ? 'vence hoje' : p.dias === 1 ? 'vence amanhã' : `vence em ${diaCurto(p.vencimento)}`;
    return { texto: `Faltam ${brl0(falta)} em ${abertas.length} ${abertas.length === 1 ? 'conta' : 'contas'}. Comece por ${p.gasto.nome} (${brl0(p.valor)}): ${quando}.`, links: [{ titulo: 'Ver contas', rota: '/pagar' }] };
  }

  if (tem(t, 'posso gastar', 'gastar hoje', 'sobra', 'sobrou', 'por dia', 'limite')) {
    const d = detalheDisponivel(e, mes, hoje);
    if (d.modo === 'incompleto') return { texto: 'Para calcular quanto você pode gastar, preciso saber quanto você ganha por mês.', links: [{ titulo: 'Informar minha renda', rota: '/dados' }] };
    return { texto: d.livre > 0 ? `Você pode gastar ${brl(d.porDia)} por dia até o fim do mês. Sobram ${brl0(d.livre)} depois das contas.` : `O mês está ${brl0(-d.livre)} acima do que entra. Vale ver onde cortar.`, links: d.livre > 0 ? [{ titulo: 'Anotar gasto', rota: '/lancamentos' }] : [{ titulo: 'Onde cortar', rota: '/plano/cortar' }] };
  }

  if (tem(t, 'guard', 'reserva', 'poup', 'economi')) {
    const noMes = guardadoNoMes(e, mes);
    const totalG = Math.max(0, patrimonioGuardado(e));
    return { texto: totalG > 0 ? `Você tem ${brl0(totalG)} guardados${noMes > 0 ? `, sendo ${brl0(noMes)} neste mês` : ''}.` : 'Você ainda não guardou nada por aqui. Comece pequeno: qualquer valor conta.', links: [{ titulo: 'Reserva de emergência', rota: '/plano/reserva' }, { titulo: 'Metas', rota: '/guardar#metas' }] };
  }

  if (tem(t, 'gastei', 'gasto', 'para onde', 'pra onde', 'foi meu dinheiro')) {
    const cats = gastosPorCategoria(e, mes);
    const total = cats.reduce((s, c) => s + c.valor, 0);
    if (total <= 0) return { texto: 'Nenhum gasto anotado neste mês. Toque no + e anote o primeiro: leva 5 segundos.', links: [{ titulo: 'Ver lançamentos', rota: '/lancamentos' }] };
    const top = cats.slice(0, 3).map((c) => `${c.categoria} (${brl0(c.valor)})`).join(', ');
    return { texto: `Você anotou ${brl0(total)} neste mês. Onde mais foi: ${top}.`, links: [{ titulo: 'Relatórios', rota: '/relatorios' }, { titulo: 'Lançamentos', rota: '/lancamentos' }] };
  }

  const achados = acharDestinos(pergunta, 3);
  if (achados.length) return { texto: achados.length === 1 ? `Acho que é aqui: ${achados[0].titulo}.` : 'Achei isto no app para você:', links: achados };
  return { texto: 'Não achei essa. Diga o que você quer resolver (por exemplo: pagar uma conta, ver dívidas, guardar dinheiro) e eu te levo até a tela certa.', links: [{ titulo: 'Ver todas as ferramentas', rota: '/ferramentas' }] };
}

/** O único ponto que a tela chama. Hoje responde localmente; é aqui que a API entra. */
export async function perguntarAoAssistente(pergunta: string, e: Estado, hoje: string, _historico: MensagemAssistente[] = []): Promise<RespostaAssistente> {
  void _historico;
  // primeiro vê se é um comando ("mercado 35", "recebi 3000"): aí o Midas anota de verdade, com Desfazer
  const feito = agirPorFrase(pergunta, hoje);
  if (feito) return feito;
  return responderLocal(pergunta, e, hoje);
}
