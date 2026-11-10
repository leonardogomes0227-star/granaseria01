// O Coach que resolve: 9 problemas prontos, em fluxo guiado. Funcionam por regras, sem IA, com as mesmas funções
// testadas que as telas usam. A IA (api/conselheiro.ts) chama essas mesmas funções pelo servidor: ninguém faz conta "de cabeça".
// Nada aqui muda dados: o que mudaria vira uma AcaoCoach, que a pessoa confirma em um cartão.

import { brl, brl0, mesDe, nomeMes } from './datas.js';
import { mensagemAtraso, situacaoAtrasos } from './atrasosLogica.js';
import { NIVEIS } from './atrasosBase.js';
import { compararEstrategias, paraSim } from './dividas.js';
import { analisarCompra, custoDaOferta } from './ferramentas.js';
import { rumoDoExtra } from './extrasLogica.js';
import { mediaPorCategoria, gastoPorCategoria } from './orcamento.js';
import { contasDoMes, detalheDisponivel, folgaMensal } from './selectores.js';
import { calcularCaminho, destino, fraseDoMarco, planoDeQuitacao, simularImpacto, type Impacto } from './caminho.js';
import type { Estado } from './tipos.js';

/* ---------- ações: sempre um cartão que a pessoa confirma ([Fazer] [Ajustar] [Agora não]) ---------- */
export type TipoAcao = 'colocar_no_caminho' | 'criar_meta' | 'anotar_atraso' | 'definir_limite_categoria' | 'escolher_metodo_quitacao' | 'criar_lembrete' | 'colocar_compra_em_espera_72h' | 'abrir_ferramenta';
export interface AcaoCoach {
  tipo: TipoAcao;
  titulo: string; // o que vai acontecer, em uma linha
  detalhe: string;
  dados: Record<string, string | number>;
  ajustar?: string; // rota onde a pessoa ajusta antes de fazer
}

const txt = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0);
const ROTAS_OK = /^\/(pagar|gastos|guardar|perfil|ferramentas|coach|investir|recuperacao|lancamentos|relatorios|dados|assistentes|plano\/[a-z]+)([?#].*)?$/;

/** Valida e dá forma a uma ação (vinda da IA ou de um fluxo). Entrada inválida vira null: nada é proposto. */
export function normalizarAcao(tipo: string, d: Record<string, unknown>): AcaoCoach | null {
  switch (tipo) {
    case 'colocar_no_caminho': {
      const titulo = txt(d.titulo);
      return titulo ? { tipo, titulo: `Colocar no seu caminho: ${titulo}`, detalhe: txt(d.detalhe, 300), dados: { titulo, detalhe: txt(d.detalhe, 300), rota: ROTAS_OK.test(txt(d.rota)) ? txt(d.rota) : '' } } : null;
    }
    case 'criar_meta': {
      const nome = txt(d.nome, 40);
      const alvo = num(d.alvo);
      const prazo = /^\d{4}-\d{2}-\d{2}$/.test(txt(d.prazo)) ? txt(d.prazo) : '';
      return nome && alvo ? { tipo, titulo: `Criar a meta "${nome}"`, detalhe: `${brl0(alvo)}${prazo ? ` até ${nomeMes(mesDe(prazo))}` : ''}.`, dados: { nome, alvo, prazo }, ajustar: '/guardar#metas' } : null;
    }
    case 'anotar_atraso': {
      const nome = txt(d.nome, 40);
      const valor = num(d.valor);
      const mes = /^\d{4}-\d{2}$/.test(txt(d.mes)) ? txt(d.mes) : '';
      return nome && valor && mes ? { tipo, titulo: `Anotar ${nome} como atrasada`, detalhe: `${brl(valor)}, de ${nomeMes(mes)}. Entra no plano de sair do atraso.`, dados: { nome, valor, mes, dia: Math.min(31, Math.max(1, Math.round(num(d.dia)) || 10)) }, ajustar: '/plano/atrasos?anotar=1' } : null;
    }
    case 'definir_limite_categoria': {
      const categoria = txt(d.categoria, 30);
      const valor = num(d.valor);
      return categoria && valor ? { tipo, titulo: `Limite de ${brl0(valor)} por mês em ${categoria}`, detalhe: 'Eu aviso quando você chegar perto.', dados: { categoria, valor }, ajustar: '/plano/orcamento' } : null;
    }
    case 'escolher_metodo_quitacao': {
      const metodo = d.metodo === 'maior-juro' ? 'maior-juro' : d.metodo === 'bola-de-neve' ? 'bola-de-neve' : '';
      return metodo ? { tipo, titulo: metodo === 'maior-juro' ? 'Pagar primeiro a dívida de maior juro' : 'Pagar primeiro a menor dívida (bola de neve)', detalhe: 'Muda a ordem do seu plano de quitação. Dá para trocar depois.', dados: { metodo }, ajustar: '/plano/dividas' } : null;
    }
    case 'criar_lembrete': {
      const texto = txt(d.texto);
      const em = /^\d{4}-\d{2}-\d{2}$/.test(txt(d.data)) ? txt(d.data) : '';
      return texto && em ? { tipo, titulo: `Lembrar em ${em.slice(8)}/${em.slice(5, 7)}: ${texto}`, detalhe: 'Fica nos seus passos e eu volto a perguntar nesse dia.', dados: { texto, data: em }, ajustar: '/assistentes' } : null;
    }
    case 'colocar_compra_em_espera_72h': {
      const item = txt(d.item, 60) || 'Compra';
      const valor = num(d.valor);
      return valor ? { tipo, titulo: `Esperar 72 horas antes de comprar: ${item}`, detalhe: `${brl0(valor)}. Se a vontade continuar depois de 3 dias, você decide de cabeça fria.`, dados: { item, valor }, ajustar: '/plano/comprar' } : null;
    }
    case 'abrir_ferramenta': {
      const rota = txt(d.rota);
      return ROTAS_OK.test(rota) ? { tipo, titulo: txt(d.rotulo, 60) || 'Abrir a ferramenta', detalhe: '', dados: { rota } } : null;
    }
    default:
      return null;
  }
}

/* ---------- os fluxos ---------- */
export type FluxoId = 'mes-nao-fecha' | 'conta-atrasada' | 'sair-das-dividas' | 'emprestimo' | 'posso-comprar' | 'dinheiro-extra' | 'juntar' | 'onde-errando' | 'meu-numero';
export type CampoFluxo = 'valor' | 'parcelas' | 'parcela' | 'meses' | 'nome';
export interface Fluxo {
  id: FluxoId;
  titulo: string; // como a pessoa diria
  campos: { id: CampoFluxo; rotulo: string; exemplo: string }[];
  /** telas de onde este fluxo é o ponto de partida natural */
  rotas: string[];
}
export const FLUXOS: Fluxo[] = [
  { id: 'mes-nao-fecha', titulo: 'O mês não fecha', campos: [], rotas: ['/recuperacao', '/plano/orcamento', '/gastos'] },
  { id: 'conta-atrasada', titulo: 'Tô com conta atrasada', campos: [], rotas: ['/plano/atrasos', '/pagar'] },
  { id: 'sair-das-dividas', titulo: 'Quero sair das dívidas', campos: [], rotas: ['/plano/dividas'] },
  { id: 'emprestimo', titulo: 'Me ofereceram um empréstimo ou parcelamento', campos: [{ id: 'valor', rotulo: 'Quanto você recebe (ou o preço à vista)', exemplo: '5000' }, { id: 'parcelas', rotulo: 'Em quantas vezes', exemplo: '12' }, { id: 'parcela', rotulo: 'Valor de cada parcela', exemplo: '520' }], rotas: ['/plano/emprestimos', '/plano/parcelado', '/plano/cartao'] },
  { id: 'posso-comprar', titulo: 'Posso comprar isso?', campos: [{ id: 'nome', rotulo: 'O que é (opcional)', exemplo: 'tênis' }, { id: 'valor', rotulo: 'Quanto custa', exemplo: '350' }], rotas: ['/plano/comprar'] },
  { id: 'dinheiro-extra', titulo: 'Recebi um dinheiro extra', campos: [{ id: 'valor', rotulo: 'Quanto entrou', exemplo: '1500' }], rotas: ['/plano/extras'] },
  { id: 'juntar', titulo: 'Quero juntar para uma coisa', campos: [{ id: 'nome', rotulo: 'Para quê', exemplo: 'viagem' }, { id: 'valor', rotulo: 'Quanto precisa', exemplo: '3000' }, { id: 'meses', rotulo: 'Em quantos meses', exemplo: '10' }], rotas: ['/guardar', '/plano/reserva'] },
  { id: 'onde-errando', titulo: 'Onde estou errando?', campos: [], rotas: ['/plano/cortar', '/plano/assinaturas', '/relatorios', '/lancamentos'] },
  { id: 'meu-numero', titulo: 'Explica meu número de hoje', campos: [], rotas: ['/'] },
];
/** O fluxo que combina com a tela de onde a pessoa abriu o Coach. */
export const fluxoDaRota = (rota: string): FluxoId | null => FLUXOS.find((f) => f.rotas.includes(rota.split(/[?#]/)[0]))?.id ?? null;

export type Entrada = Partial<Record<CampoFluxo, number | string>>;
export interface RespostaFluxo {
  textos: string[]; // mensagens curtas do Coach, na ordem
  impacto?: Impacto | null; // mini-cartão: a data do destino antes e depois
  acoes: AcaoCoach[];
  copiar?: { rotulo: string; texto: string }; // mensagem pronta (ex.: para negociar)
}
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const acao = (tipo: TipoAcao, d: Record<string, unknown>) => normalizarAcao(tipo, d);
const limpa = (as: (AcaoCoach | null)[]) => as.filter((a): a is AcaoCoach => Boolean(a));
const somaDiasISO = (iso: string, dias: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
const destinoFrase = (e: Estado, hoje: string) => {
  const d = destino(calcularCaminho(e, hoje));
  if (!d) return 'Você já passou por todos os marcos do caminho.';
  const f = fraseDoMarco(d);
  return f.data ? `Seu destino agora: ${f.antes.toLowerCase()} ${f.data}.` : `Seu destino agora: ${d.titulo.toLowerCase()}. ${d.pendencia ?? ''}`;
};

export function rodarFluxo(id: FluxoId, e: Estado, hoje: string, ent: Entrada = {}): RespostaFluxo {
  const mes = mesDe(hoje);
  const disp = detalheDisponivel(e, mes, hoje);
  const semRenda = disp.modo === 'incompleto';
  const pedirRenda: RespostaFluxo = { textos: ['Para te responder com números de verdade, preciso saber quanto entra por mês. Me conta a sua renda e eu refaço a conta na hora.'], acoes: limpa([acao('abrir_ferramenta', { rota: '/dados', rotulo: 'Informar minha renda' })]) };

  switch (id) {
    case 'meu-numero': {
      if (semRenda) return pedirRenda;
      const linhas = disp.linhas.map((l) => `${l.sinal === '+' ? '+' : '−'} ${l.rotulo}: ${brl0(l.valor)}${l.confianca === 'estimado' ? ' (estimado)' : ''}`).join('\n');
      return { textos: [`Hoje você pode gastar ${brl(disp.porDia)}. Veja de onde sai:`, linhas, disp.livre < 0 ? `A conta fecha ${brl0(-disp.livre)} abaixo de zero, por isso o número do dia é zero.` : `Sobram ${brl0(disp.livre)} para ${disp.diasRestantes} ${disp.diasRestantes === 1 ? 'dia' : 'dias'}: ${brl0(disp.livre)} ÷ ${disp.diasRestantes}.`, ...(disp.avisos.length ? [disp.avisos[0]] : [])], acoes: limpa([acao('abrir_ferramenta', { rota: '/gastos', rotulo: 'Ver meus gastos' })]) };
    }

    case 'mes-nao-fecha': {
      if (semRenda) return pedirRenda;
      const abertas = contasDoMes(e, mes, hoje).filter((c) => c.estado !== 'paga');
      const essenciais = abertas.filter((c) => ['Aluguel', 'Luz', 'Água', 'Internet', 'Financiamento'].includes(c.gasto.categoria));
      const esperam = abertas.filter((c) => !essenciais.includes(c));
      if (disp.livre >= 0) return { textos: [`O que já está bom: pelas minhas contas, o mês fecha. Sobram ${brl0(disp.livre)} depois de contas e reserva.`, `Seu limite é ${brl(disp.porDia)} por dia. Se a sensação é de aperto, vale anotar os gastos pequenos: é onde o dinheiro costuma sumir.`], acoes: limpa([acao('abrir_ferramenta', { rota: '/plano/cortar', rotulo: 'Ver onde cortar' })]) };
      const t = [`Sem drama: faltam ${brl0(-disp.livre)} para o mês fechar. Vamos por ordem.`];
      if (essenciais.length) t.push(`Primeiro o essencial: ${essenciais.map((c) => `${c.gasto.nome} (${brl0(c.valor)})`).join(', ')}. Teto e luz vêm antes de tudo.`);
      if (esperam.length) t.push(`Pode esperar ou negociar: ${esperam.map((c) => `${c.gasto.nome} (${brl0(c.valor)})`).join(', ')}.`);
      t.push('Até fechar, o limite do dia é zero: só o essencial. Um corte pequeno já muda a conta.');
      const imp = simularImpacto(e, hoje, { tipo: 'corte', porMes: Math.ceil(-disp.livre / 10) * 10 });
      return { textos: t, impacto: imp, acoes: limpa([acao('colocar_no_caminho', { titulo: `Cortar ${brl0(-disp.livre)} neste mês`, detalhe: 'Para o mês fechar no zero. Comece pelo que não é essencial.', rota: '/plano/cortar' }), acao('abrir_ferramenta', { rota: '/recuperacao', rotulo: 'Montar meu plano de saída' })]) };
    }

    case 'conta-atrasada': {
      const s = situacaoAtrasos(e, hoje);
      if (s.atrasos.length === 0) return { textos: ['Pelas contas que você cadastrou, não há nada atrasado. Se tem uma conta antiga que eu não conheço, anote e eu coloco na ordem certa.'], acoes: limpa([acao('abrir_ferramenta', { rota: '/plano/atrasos?anotar=1', rotulo: 'Anotar conta atrasada' })]) };
      const p = s.atrasos[0];
      const t = [`Você tem ${s.atrasos.length} ${s.atrasos.length === 1 ? 'conta atrasada' : 'contas atrasadas'}, cerca de ${brl0(s.total)} com multa e juros estimados. Tem saída.`, `Pague primeiro: ${p.nome} (${brl0(p.total)}). ${NIVEIS[p.nivel]?.motivo ?? ''}`];
      t.push(s.plano.emDiaEm === mes ? 'O que já está bom: pelo que sobra no seu mês, dá para pôr em dia ainda neste mês.' : s.plano.emDiaEm ? `Separando ${brl0(s.porMes)} por mês, você fica em dia em ${nomeMes(s.plano.emDiaEm)}.` : s.porMes <= 0 ? 'Me diga quanto dá para separar por mês e eu calculo quando você fica em dia.' : `Com ${brl0(s.porMes)} por mês não fecha em 2 anos. Negociar é o melhor caminho.`);
      t.push('Fale direto com quem você deve. Deixei uma mensagem pronta para pedir a retirada da multa.');
      return { textos: t, copiar: { rotulo: 'Copiar a mensagem para negociar', texto: mensagemAtraso({ nome: e.config.nome, credor: p.nome, valor: p.total, meses: s.atrasos.filter((a) => a.refId === p.refId).length, pedido: 'multa', porMes: s.porMes }) }, acoes: limpa([acao('colocar_no_caminho', { titulo: `Negociar ${p.nome}`, detalhe: `Pedir para tirar a multa de ${brl0(p.encargos)} e pagar ${brl0(p.valor)}.`, rota: '/plano/atrasos' }), acao('abrir_ferramenta', { rota: '/plano/atrasos', rotulo: 'Ver o plano mês a mês' })]) };
    }

    case 'sair-das-dividas': {
      const ds = paraSim(e.dividas);
      if (ds.length === 0) return { textos: [e.dividas.length ? 'Suas dívidas cadastradas estão quitadas. Isso é grande.' : 'Ainda não tenho suas dívidas. Cadastre em 3 toques (tipo, quanto deve, quanto paga por mês) e eu digo a data em que você fica livre.'], acoes: limpa([acao('abrir_ferramenta', { rota: '/plano/dividas?nova=1', rotulo: 'Cadastrar uma dívida' })]) };
      const { pagamento, sugerido } = planoDeQuitacao(e, mes);
      const c = compararEstrategias(ds, pagamento, mes);
      const total = ds.reduce((x, d) => x + d.saldo, 0);
      const t = [`Você deve ${brl0(total)} em ${ds.length} ${ds.length === 1 ? 'dívida' : 'dívidas'}. Pagando ${brl0(pagamento)} por mês${sugerido ? ' (sugestão minha, dentro do que sobra)' : ''}:`];
      if (!c.bola.quita && !c.juro.quita) return { textos: [...t, `Com esse valor os juros ganham. Precisa de pelo menos ${brl0(c.bola.minimoNecessario)} por mês, ou de uma negociação que baixe os juros.`], acoes: limpa([acao('abrir_ferramenta', { rota: '/plano/dividas', rotulo: 'Ajustar o valor mensal' })]) };
      t.push(`Bola de neve (a menor primeiro, para ganhar fôlego): livre em ${c.bola.dataFinal ? nomeMes(c.bola.dataFinal) : 'sem data'}, ${brl0(c.bola.totalJuros)} de juros.`);
      t.push(`Maior juro primeiro (paga menos no total): livre em ${c.juro.dataFinal ? nomeMes(c.juro.dataFinal) : 'sem data'}, ${brl0(c.juro.totalJuros)} de juros.`);
      t.push(c.economia >= 1 ? `Eu iria de ${c.melhor === 'maior-juro' ? 'maior juro' : 'bola de neve'}: economiza ${brl0(c.economia)}.` : 'As duas dão quase no mesmo. Vá de bola de neve: quitar a primeira logo anima a continuar.');
      return { textos: t, acoes: limpa([acao('escolher_metodo_quitacao', { metodo: c.economia >= 1 ? c.melhor : 'bola-de-neve' }), acao('abrir_ferramenta', { rota: '/plano/dividas', rotulo: 'Abrir meu plano de quitação' })]) };
    }

    case 'emprestimo': {
      const valor = n(ent.valor);
      const parcelas = Math.round(n(ent.parcelas));
      const parcela = n(ent.parcela);
      if (!valor || !parcelas || !parcela) return { textos: ['Me diga o valor, o número de parcelas e o valor de cada parcela.'], acoes: [] };
      const c = custoDaOferta({ valor, parcelas, parcela });
      const imp = simularImpacto(e, hoje, { tipo: 'parcela', valor: parcela, meses: parcelas });
      const folga = folgaMensal(e, mes).folga;
      const cabe = parcela <= Math.max(0, folga);
      const t = [`O custo real: você recebe ${brl0(valor)} e devolve ${brl0(c.total)}. São ${brl0(c.juros)} de juros${c.taxaMensal !== null ? `, ${String(c.taxaMensal).replace('.', ',')}% ao mês` : ''}.`];
      t.push(semRenda ? 'Sem a sua renda eu não sei se a parcela cabe.' : cabe ? `A parcela de ${brl0(parcela)} cabe no que sobra por mês (${brl0(folga)}), mas ocupa esse espaço por ${parcelas} meses.` : `A parcela de ${brl0(parcela)} não cabe no que sobra por mês (${brl0(Math.max(0, folga))}). Ela viraria conta atrasada.`);
      t.push(c.juros <= 1 ? 'Veredito: sem juros de verdade, pode valer. Confirme se o preço à vista não tem desconto.' : !cabe ? 'Veredito: não pegue agora.' : (c.taxaMensal ?? 0) >= 3 ? 'Veredito: caro. Só vale para trocar uma dívida que cobra ainda mais. Peça o custo total por escrito e compare outra oferta.' : 'Veredito: taxa razoável. Vale só se resolver um problema maior do que os juros.');
      return { textos: t, impacto: imp, acoes: limpa([acao('colocar_no_caminho', { titulo: `Comparar outra oferta antes de pegar ${brl0(valor)}`, detalhe: `Esta custa ${brl0(c.juros)} de juros em ${parcelas}x de ${brl0(parcela)}.`, rota: '/plano/emprestimos' }), acao('abrir_ferramenta', { rota: '/plano/emprestimos', rotulo: 'Comparar ofertas' })]) };
    }

    case 'posso-comprar': {
      const valor = n(ent.valor);
      if (!valor) return { textos: ['Quanto custa? Responda só o valor, ex.: 350.'], acoes: [] };
      const item = typeof ent.nome === 'string' ? ent.nome.trim() : '';
      const a = analisarCompra({ valor, renda: e.config.renda, horasMes: e.config.horasMes, livre: disp.livre });
      const imp = simularImpacto(e, hoje, { tipo: 'compra', valor });
      const t = [a.frase, a.veredito === 'cabe' ? `Cabe: são ${Math.round(a.pctLivre ?? 0)}% do que ainda está livre no mês (${brl0(disp.livre)}).` : a.veredito === 'aperta' ? `Aperta: leva ${Math.round(a.pctLivre ?? 0)}% do que está livre no mês (${brl0(disp.livre)}).` : semRenda ? 'Sem a sua renda eu não consigo dizer se cabe.' : `Não cabe agora: ${disp.livre > 0 ? `só há ${brl0(disp.livre)} livres no mês` : 'o mês já está no limite'}.`];
      t.push(a.veredito === 'cabe' && (!imp || imp.meses <= 0) ? 'Minha direção: se você precisa e vai usar, compre sem culpa.' : a.veredito === 'nao-cabe' ? 'Minha direção: não agora. Junte primeiro, ou espere 72 horas e veja se a vontade continua.' : 'Minha direção: espere 72 horas. Se ainda quiser depois, compre de cabeça fria.');
      return { textos: t, impacto: imp, acoes: limpa([a.veredito === 'cabe' && (!imp || imp.meses <= 0) ? null : acao('colocar_compra_em_espera_72h', { item, valor }), acao('abrir_ferramenta', { rota: '/plano/comprar', rotulo: 'Ver a análise completa' })]) };
    }

    case 'dinheiro-extra': {
      const valor = n(ent.valor);
      if (!valor) return { textos: ['Quanto entrou? Responda só o valor, ex.: 1500.'], acoes: [] };
      const r = rumoDoExtra(e, hoje, valor);
      const voce = r.destinos.find((d) => d.tipo === 'voce')?.valor ?? 0;
      const imp = simularImpacto(e, hoje, { tipo: 'extra', valor: valor - voce });
      return { textos: [r.manchete, ...r.destinos.map((d) => `${brl0(d.valor)} → ${d.titulo}. ${d.resultado}`)], impacto: imp, acoes: limpa([acao('colocar_no_caminho', { titulo: `Dar destino aos ${brl0(valor)} que entraram`, detalhe: r.manchete, rota: '/plano/extras' }), acao('abrir_ferramenta', { rota: '/plano/extras', rotulo: 'Fazer isso agora, com 1 toque' })]) };
    }

    case 'juntar': {
      const alvo = n(ent.valor);
      const meses = Math.round(n(ent.meses));
      if (!alvo || !meses) return { textos: ['Quanto você precisa e em quantos meses? Ex.: 3000 em 10 meses.'], acoes: [] };
      const nome = (typeof ent.nome === 'string' && ent.nome.trim()) || 'Minha meta';
      const porMes = Math.ceil(alvo / meses);
      const folga = folgaMensal(e, mes);
      const prazo = somaDiasISO(hoje, Math.round(meses * 30.4375));
      const t = [`Para juntar ${brl0(alvo)} em ${meses} meses: ${brl0(porMes)} por mês (cerca de ${brl0(porMes / 4.33)} por semana).`];
      if (semRenda) t.push('Sem a sua renda eu não sei se cabe. Mas a meta já pode nascer.');
      else if (porMes <= Math.max(0, folga.folga)) t.push(`Cabe: sobram cerca de ${brl0(folga.folga)} por mês${folga.semHistorico ? ' (sem gastos anotados, pode estar otimista)' : ''}.`);
      else t.push(`Não cabe inteiro: sobram cerca de ${brl0(Math.max(0, folga.folga))} por mês. ${folga.folga > 0 ? `Nesse ritmo leva ${Math.ceil(alvo / folga.folga)} meses.` : 'Antes, vale liberar espaço no mês.'}`);
      t.push(destinoFrase(e, hoje));
      return { textos: t, acoes: limpa([acao('criar_meta', { nome, alvo, prazo }), acao('abrir_ferramenta', { rota: '/guardar#metas', rotulo: 'Ver minhas metas' })]) };
    }

    case 'onde-errando': {
      const atual = gastoPorCategoria(e, mes);
      const media = mediaPorCategoria(e, mes);
      const top = Object.entries(atual).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (top.length === 0) return { textos: ['Ainda não há gastos anotados neste mês, então eu estaria chutando. Anote por alguns dias (ou mande pelo WhatsApp) e eu mostro onde o dinheiro escapa.'], acoes: limpa([acao('abrir_ferramenta', { rota: '/lancamentos', rotulo: 'Anotar gastos' })]) };
      const linhas = top.map(([cat, v]) => `${cat}: ${brl0(v)}${media[cat] > 0 ? ` (seu normal: ${brl0(media[cat])})` : ''}`);
      const acima = top.map(([cat, v]) => ({ cat, v, extra: media[cat] > 0 ? v - media[cat] : 0 })).sort((a, b) => b.extra - a.extra)[0];
      const alvoCat = acima.extra > 20 ? acima : { cat: top[0][0], v: top[0][1], extra: 0 };
      const corte = Math.max(10, Math.round((alvoCat.extra > 20 ? alvoCat.extra : alvoCat.v * 0.15) / 10) * 10);
      const imp = simularImpacto(e, hoje, { tipo: 'corte', porMes: corte });
      return { textos: ['Não é erro, é para onde o dinheiro está indo. Seus 3 maiores gastos do mês:', linhas.join('\n'), `Um corte só: ${brl0(corte)} a menos em ${alvoCat.cat}${alvoCat.extra > 20 ? ', que está acima do seu normal' : ''}.`], impacto: imp, acoes: limpa([acao('definir_limite_categoria', { categoria: alvoCat.cat, valor: Math.max(10, Math.round((alvoCat.v - corte) / 10) * 10) }), acao('abrir_ferramenta', { rota: '/plano/cortar', rotulo: 'Ver onde cortar' })]) };
    }
  }
}
