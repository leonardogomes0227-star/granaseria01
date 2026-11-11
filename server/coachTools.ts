// As ferramentas do Coach de IA. Rodam AQUI, no servidor, sobre o estado salvo da pessoa: o modelo nunca faz conta
// "de cabeça" e o navegador não consegue forjar números. São as mesmas funções puras e testadas que as telas usam.
// As ações que mudariam dados NÃO são executadas: viram propostas que a pessoa confirma num cartão, no app.

import type Anthropic from '@anthropic-ai/sdk';
import { mesDe } from '../src/gs/datas.js';
import { calcularCaminho, marcosVisiveis, planoDeQuitacao, simularImpacto, type Mudanca } from '../src/gs/caminho.js';
import { analisarCompra, compararOfertas, planoDaMeta } from '../src/gs/ferramentas.js';
import { analisarParcelado } from '../src/gs/parcelado.js';
import { situacaoAtrasos } from '../src/gs/atrasosLogica.js';
import { paraSim, simular } from '../src/gs/dividas.js';
import { rumoDoExtra } from '../src/gs/extrasLogica.js';
import { linhasDeCategoria } from '../src/gs/orcamento.js';
import { detalheDisponivel } from '../src/gs/selectores.js';
import { passosDoMes } from '../src/gs/passos.js';
import { normalizarAcao, type AcaoCoach, type TipoAcao } from '../src/gs/coachFluxos.js';
import type { Impacto } from '../src/gs/caminho.js';
import type { Estado } from '../src/gs/tipos.js';

type Tool = Anthropic.Tool;
const obj = (properties: Record<string, unknown>, required: string[] = []): Tool['input_schema'] => ({ type: 'object', properties, required, additionalProperties: false });
const numero = (description: string) => ({ type: 'number', description });
const texto = (description: string) => ({ type: 'string', description });

const MUDANCA = obj({ tipo: { type: 'string', enum: ['compra', 'parcela', 'corte', 'extra'], description: 'compra à vista; parcela nova por N meses; corte mensal de gasto; dinheiro extra recebido' }, valor: numero('valor em reais (da compra, da parcela, do corte por mês ou do extra)'), meses: numero('só para parcela: por quantos meses') }, ['tipo', 'valor']);

export const TOOLS_CALCULO: Tool[] = [
  { name: 'ver_caminho', description: 'Os marcos da vida financeira da pessoa (em dia, sem dívidas, reserva, objetivo, investir, renda) com status, data prevista, quanto falta e as premissas; e os passos deste mês. Use antes de falar de prazos ou de "quando".', input_schema: obj({}) },
  { name: 'simular_impacto', description: 'Quanto uma decisão adianta ou atrasa a data do destino da pessoa. Use sempre que ela pensar em comprar, parcelar, pegar empréstimo, cortar um gasto ou receber um dinheiro extra.', input_schema: MUDANCA },
  { name: 'analisar_compra', description: 'Se uma compra cabe no mês: horas de trabalho que custa, % do dinheiro livre e veredito (cabe, aperta, não cabe).', input_schema: obj({ valor: numero('preço em reais') }, ['valor']) },
  { name: 'comparar_parcelado', description: 'À vista ou parcelado: total parcelado, juro embutido e diferença.', input_schema: obj({ avista: numero('preço à vista'), parcelas: numero('número de parcelas'), valorParcela: numero('valor de cada parcela'), descontoAvistaPct: numero('desconto à vista em %, se houver') }, ['avista', 'parcelas', 'valorParcela']) },
  { name: 'comparar_emprestimos', description: 'Custo real de uma ou mais ofertas de empréstimo: total pago, juros e taxa ao mês de cada uma, e qual é a melhor.', input_schema: obj({ ofertas: { type: 'array', maxItems: 4, items: obj({ valor: numero('valor recebido'), parcelas: numero('número de parcelas'), parcela: numero('valor da parcela') }, ['valor', 'parcelas', 'parcela']) } }, ['ofertas']) },
  { name: 'plano_atrasos', description: 'Contas atrasadas, a ordem de pagar (moradia, luz e água, financiamento, outras, cartão), multa e juros estimados e o mês em que tudo fica em dia.', input_schema: obj({}) },
  { name: 'simular_quitacao', description: 'Quando a pessoa fica livre das dívidas com um método e um valor a mais por mês: data final, juros totais e ordem de pagamento.', input_schema: obj({ metodo: { type: 'string', enum: ['bola-de-neve', 'maior-juro'] }, extraPorMes: numero('quanto a mais por mês, além do que já paga (0 se nada)') }, ['metodo']) },
  { name: 'dividir_extra', description: 'O melhor destino de um dinheiro extra (13º, bônus), em cascata: atrasos, dívidas caras, reserva, investir.', input_schema: obj({ valor: numero('quanto entrou') }, ['valor']) },
  { name: 'plano_meta', description: 'Quanto guardar por mês e por semana para juntar um valor até uma data.', input_schema: obj({ alvo: numero('quanto precisa juntar'), prazo: texto('data limite, AAAA-MM-DD'), jaGuardado: numero('quanto já tem, se souber') }, ['alvo', 'prazo']) },
  { name: 'orcamento_atual', description: 'Gasto do mês por categoria, com o limite de cada uma (se houver) e o estado (dentro, perto, passou).', input_schema: obj({}) },
  { name: 'disponivel_hoje', description: 'Quanto a pessoa pode gastar hoje e no mês, com cada linha do cálculo e se é confirmado ou estimado.', input_schema: obj({}) },
];

const ACOES: [TipoAcao, string, Tool['input_schema']][] = [
  ['colocar_no_caminho', 'Propõe um passo novo no plano do mês da pessoa.', obj({ titulo: texto('começa com verbo, ex.: "Cancelar o streaming"'), detalhe: texto('número real e porquê, em uma frase'), rota: texto('tela do app para fazer isso, ex.: /plano/cortar (opcional)') }, ['titulo', 'detalhe'])],
  ['criar_meta', 'Propõe criar uma meta de guardar dinheiro.', obj({ nome: texto('nome curto'), alvo: numero('valor em reais'), prazo: texto('AAAA-MM-DD (opcional)') }, ['nome', 'alvo'])],
  ['anotar_atraso', 'Propõe anotar uma conta atrasada que o app ainda não conhece.', obj({ nome: texto('nome da conta'), valor: numero('valor em reais'), mes: texto('mês da conta, AAAA-MM'), dia: numero('dia do vencimento') }, ['nome', 'valor', 'mes'])],
  ['definir_limite_categoria', 'Propõe um limite mensal para uma categoria de gasto.', obj({ categoria: texto('ex.: Lazer, Comida, Compras'), valor: numero('limite por mês') }, ['categoria', 'valor'])],
  ['escolher_metodo_quitacao', 'Propõe a ordem de pagar as dívidas.', obj({ metodo: { type: 'string', enum: ['bola-de-neve', 'maior-juro'] } }, ['metodo'])],
  ['criar_lembrete', 'Propõe um lembrete para voltar a conversar (acompanhamento), ex.: daqui a 7 dias.', obj({ texto: texto('o que perguntar na volta'), data: texto('AAAA-MM-DD') }, ['texto', 'data'])],
  ['colocar_compra_em_espera_72h', 'Propõe colocar uma compra em espera de 72 horas.', obj({ item: texto('o que é'), valor: numero('preço') }, ['valor'])],
  ['liberar_ferramenta', 'Propõe liberar uma ferramenta que a pessoa ainda não tem no plano dela, quando a situação pede (ex.: recebeu dinheiro extra → extras; reserva completa → investir). Ids: contas, calendario, fatura, atrasos, anotar-atraso, dividas, recuperacao, direitos, cartao, emprestimos, lancamentos, carteiras, orcamento, cortar, assinaturas, comprar, parcelado, relatorios, checkin, reserva, metas, extras, investir, renda, longo-prazo, placar.', obj({ id: texto('id da ferramenta'), titulo: texto('nome da ferramenta'), motivo: texto('por que agora, com o número da pessoa') }, ['id', 'titulo', 'motivo'])],
  ['abrir_ferramenta', 'Propõe abrir uma tela do app onde a pessoa resolve o assunto.', obj({ rota: texto('ex.: /plano/dividas, /plano/atrasos, /plano/extras, /guardar'), rotulo: texto('texto do botão') }, ['rota', 'rotulo'])],
];
export const TOOLS_ACAO: Tool[] = ACOES.map(([name, d, input_schema]) => ({ name, description: `${d} NÃO executa nada: a pessoa vê um cartão e decide (Fazer, Ajustar ou Agora não).`, input_schema }));
export const TOOLS: Tool[] = [...TOOLS_CALCULO, ...TOOLS_ACAO];

export interface Coleta {
  acoes: AcaoCoach[];
  impactos: Impacto[];
}
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Executa uma ferramenta sobre o estado salvo. Devolve o que o modelo lê; ações e impactos vão para a `coleta` (cartões do app). */
export function executarTool(nome: string, input: Record<string, unknown>, e: Estado, hoje: string, coleta: Coleta): unknown {
  const mes = mesDe(hoje);
  if (TOOLS_ACAO.some((t) => t.name === nome)) {
    const a = normalizarAcao(nome, input);
    if (!a) return { erro: 'Dados incompletos ou inválidos para esta ação. Pergunte à pessoa o que falta.' };
    if (coleta.acoes.length < 3 && !coleta.acoes.some((x) => x.titulo === a.titulo)) coleta.acoes.push(a);
    return { proposta: a.titulo, estado: 'mostrada como cartão; a pessoa ainda não confirmou' };
  }
  switch (nome) {
    case 'ver_caminho':
      return { marcos: marcosVisiveis(calcularCaminho(e, hoje)).map((m) => ({ marco: m.titulo, status: m.status, dataPrevista: m.dataPrevista, faltaValor: m.faltaValor, faltaMeses: m.faltaMeses, porMes: m.porMes, premissas: m.premissas, pendencia: m.pendencia })), passosDoMes: passosDoMes(e, hoje).map((p) => ({ passo: p.titulo, detalhe: p.detalhe, status: p.status })) };
    case 'simular_impacto': {
      const valor = n(input.valor);
      const meses = Math.round(n(input.meses));
      if (!valor) return { erro: 'Falta o valor.' };
      const mud: Mudanca = input.tipo === 'parcela' ? { tipo: 'parcela', valor, meses: meses || 12 } : input.tipo === 'corte' ? { tipo: 'corte', porMes: valor } : input.tipo === 'extra' ? { tipo: 'extra', valor } : { tipo: 'compra', valor };
      const imp = simularImpacto(e, hoje, mud);
      if (!imp) return { semData: 'Ainda não há data de destino para comparar (faltam dados da pessoa). Não invente uma.' };
      if (coleta.impactos.length < 2) coleta.impactos.push(imp);
      return imp;
    }
    case 'analisar_compra': {
      const d = detalheDisponivel(e, mes, hoje);
      return n(input.valor) ? { ...analisarCompra({ valor: n(input.valor), renda: e.config.renda, horasMes: e.config.horasMes, livre: d.livre }), livreNoMes: d.livre, rendaConhecida: d.modo !== 'incompleto' } : { erro: 'Falta o valor.' };
    }
    case 'comparar_parcelado':
      return n(input.avista) && n(input.parcelas) && n(input.valorParcela) ? analisarParcelado({ avista: n(input.avista), parcelas: Math.round(n(input.parcelas)), parcela: n(input.valorParcela), descontoAvistaPct: n(input.descontoAvistaPct) }) : { erro: 'Faltam o preço à vista, o número de parcelas ou o valor da parcela.' };
    case 'comparar_emprestimos': {
      const os = (Array.isArray(input.ofertas) ? input.ofertas : []).map((o) => o as Record<string, unknown>).filter((o) => n(o.valor) && n(o.parcelas) && n(o.parcela)).slice(0, 4).map((o) => ({ valor: n(o.valor), parcelas: Math.round(n(o.parcelas)), parcela: n(o.parcela) }));
      return os.length ? compararOfertas(os) : { erro: 'Preciso de valor, parcelas e parcela de pelo menos uma oferta.' };
    }
    case 'plano_atrasos': {
      const s = situacaoAtrasos(e, hoje);
      return { atrasadas: s.atrasos.map((a) => ({ nome: a.nome, mes: a.mes, valor: a.valor, multaEJurosEstimados: a.encargos, total: a.total, diasDeAtraso: a.dias, prioridade: a.nivel })), total: s.total, separaPorMes: s.porMes, emDiaEm: s.plano.emDiaEm, precisaConfirmarQuantoSobra: s.confirmar };
    }
    case 'simular_quitacao': {
      const ds = paraSim(e.dividas);
      if (ds.length === 0) return { semDividas: 'Nenhuma dívida em aberto cadastrada.' };
      const base = planoDeQuitacao(e, mes);
      const metodo = input.metodo === 'maior-juro' ? 'maior-juro' : 'bola-de-neve';
      const sim = simular(ds, base.pagamento + n(input.extraPorMes), metodo, mes);
      return { pagamentoMensal: base.pagamento + n(input.extraPorMes), pagamentoEhSugestao: base.sugerido, quita: sim.quita, livreEm: sim.dataFinal, meses: sim.meses, totalJuros: sim.totalJuros, ordem: sim.ordem, minimoNecessario: sim.minimoNecessario, dividas: ds.map((d) => ({ nome: d.nome, saldo: d.saldo, jurosAoMesPct: d.jurosMensal, parcela: d.parcelaMinima })) };
    }
    case 'dividir_extra':
      return n(input.valor) ? rumoDoExtra(e, hoje, n(input.valor)) : { erro: 'Falta o valor.' };
    case 'plano_meta': {
      const prazo = typeof input.prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.prazo) ? input.prazo : '';
      return n(input.alvo) && prazo ? planoDaMeta({ alvo: n(input.alvo), jaGuardado: n(input.jaGuardado), prazo, hoje }) : { erro: 'Preciso do valor e da data (AAAA-MM-DD).' };
    }
    case 'orcamento_atual':
      return linhasDeCategoria(e, mes).filter((l) => l.gasto > 0 || l.limite).map((l) => ({ categoria: l.categoria, gasto: l.gasto, limite: l.limite ?? null, estado: l.tom }));
    case 'disponivel_hoje': {
      const d = detalheDisponivel(e, mes, hoje);
      return d.modo === 'incompleto' ? { desconhecido: 'A pessoa não informou renda nem saldo. Não invente: peça a renda.' } : { podeGastarHoje: d.porDia, livreNoMes: d.livre, diasRestantes: d.diasRestantes, base: d.modo, temEstimativa: d.temEstimativa, linhas: d.linhas.map((l) => ({ item: l.rotulo, valor: l.sinal === '+' ? l.valor : -l.valor, confianca: l.confianca })), avisos: d.avisos };
    }
    default:
      return { erro: 'Ferramenta desconhecida.' };
  }
}
