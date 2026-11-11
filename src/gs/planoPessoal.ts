// O plano de cada pessoa. O site tem muitas ferramentas, mas a pessoa só vê as que fazem sentido para ela:
// o Coach monta o plano com poucas perguntas e, com o tempo, indica e libera outras quando a vida pede.
// Nenhuma ferramenta é apagada: as que não foram liberadas ficam em "Todas as ferramentas", com "Liberar". Puro e testado.

import { brl0, mesDe } from './datas.js';
import { atrasosAbertos } from './atrasosBase.js';
import { totalDividas, maiorJuroMensal } from './dividas.js';
import { detalheDisponivel, patrimonioGuardado, reservaMeta, receitasDoMes } from './selectores.js';
import type { OrigemPasso, Passo } from './passos.js';
import type { Estado, PlanoPessoal } from './tipos.js';

export interface Foco {
  id: string;
  titulo: string; // como a pessoa diria
  ferramentas: string[]; // ids do registro que este foco libera
  origens: OrigemPasso[]; // os passos do mês que pertencem a este foco
  /** Os dados da pessoa pedem este foco? Devolve o porquê, com número. */
  indicado: (e: Estado, hoje: string) => string | null;
}

export const FOCOS: Foco[] = [
  { id: 'atrasos', titulo: 'Pôr as contas atrasadas em dia', ferramentas: ['atrasos', 'anotar-atraso', 'direitos', 'calendario'], origens: ['atraso'],
    indicado: (e, h) => { const a = atrasosAbertos(e, h); return a.length ? `${a.length === 1 ? 'Uma conta está atrasada' : `${a.length} contas estão atrasadas`}: ${brl0(a.reduce((t, x) => t + x.total, 0))}.` : null; } },
  { id: 'dividas', titulo: 'Sair das dívidas', ferramentas: ['dividas', 'emprestimos', 'cartao', 'fatura', 'direitos'], origens: ['divida', 'fatura'],
    indicado: (e) => (totalDividas(e.dividas) > 0 ? `Você deve ${brl0(totalDividas(e.dividas))}${maiorJuroMensal(e.dividas) >= 1.5 ? ', com juro alto' : ''}.` : null) },
  { id: 'mes-fecha', titulo: 'Fazer o mês fechar', ferramentas: ['orcamento', 'cortar', 'assinaturas', 'recuperacao', 'calendario'], origens: ['limite'],
    indicado: (e, h) => { const d = detalheDisponivel(e, mesDe(h), h); return d.modo !== 'incompleto' && d.livre < 0 ? `O mês fecha ${brl0(-d.livre)} no vermelho.` : null; } },
  { id: 'controlar', titulo: 'Saber para onde vai o meu dinheiro', ferramentas: ['orcamento', 'relatorios', 'assinaturas', 'cortar'], origens: ['limite'],
    indicado: (e, h) => (e.config.renda > 0 && !e.lancamentos.some((l) => mesDe(l.data) === mesDe(h)) ? 'Nenhum gasto anotado neste mês ainda.' : null) },
  { id: 'comprar', titulo: 'Decidir compras sem me arrepender', ferramentas: ['comprar', 'parcelado', 'cartao'], origens: [],
    indicado: (e) => (e.cartao && e.cartao.limite > 0 && e.cartao.usado / e.cartao.limite >= 0.7 ? `O cartão está em ${Math.round((e.cartao.usado / e.cartao.limite) * 100)}% do limite.` : null) },
  { id: 'reserva', titulo: 'Ter uma reserva para imprevistos', ferramentas: ['reserva', 'extras'], origens: ['guardar'],
    indicado: (e, h) => { const m = reservaMeta(e, mesDe(h)); return m > 0 && patrimonioGuardado(e) < m && totalDividas(e.dividas) === 0 && atrasosAbertos(e, h).length === 0 ? `Faltam ${brl0(m - Math.max(0, patrimonioGuardado(e)))} para a sua reserva.` : null; } },
  { id: 'meta', titulo: 'Juntar para um objetivo', ferramentas: ['metas', 'extras'], origens: ['meta'],
    indicado: (e) => (e.metas.length ? `Você tem ${e.metas.length === 1 ? 'uma meta' : `${e.metas.length} metas`}.` : e.config.objetivo ? `Seu objetivo: ${e.config.objetivo.toLowerCase()}.` : null) },
  { id: 'investir', titulo: 'Começar a investir', ferramentas: ['investir', 'renda', 'longo-prazo', 'placar'], origens: [],
    indicado: (e, h) => { const m = reservaMeta(e, mesDe(h)); return m > 0 && patrimonioGuardado(e) >= m ? 'Sua reserva está completa: é hora de fazer o dinheiro trabalhar.' : null; } },
];
export const foco = (id: string) => FOCOS.find((f) => f.id === id);

/** O que toda pessoa usa, com ou sem plano: anotar, pagar as contas, o Coach e o Perfil. */
export const BASE = ['contas', 'lancamentos', 'coach', 'saude', 'dados', 'planos', 'assistentes', 'whatsapp', 'instalar', 'sobre', 'guias'];

/** Assuntos que dá para esconder ("não quero ver isso agora"). */
export const ESCONDIVEIS: { id: string; titulo: string; ferramentas: string[] }[] = [
  { id: 'investir', titulo: 'Investimentos', ferramentas: ['investir', 'renda', 'longo-prazo', 'placar'] },
  { id: 'metas', titulo: 'Metas', ferramentas: ['metas'] },
  { id: 'cartao', titulo: 'Cartão de crédito', ferramentas: ['cartao', 'fatura', 'parcelado'] },
  { id: 'relatorios', titulo: 'Gráficos e relatórios', ferramentas: ['relatorios', 'checkin'] },
];

/** Os focos que os dados indicam, do mais urgente ao menos, com o porquê. */
export function focosIndicados(e: Estado, hoje: string): { foco: Foco; porque: string }[] {
  return FOCOS.map((f) => ({ foco: f, porque: f.indicado(e, hoje) })).filter((x): x is { foco: Foco; porque: string } => Boolean(x.porque));
}

export function montarPlano(p: { focos: string[]; esconder?: string[]; ritmo?: PlanoPessoal['ritmo'] }, hoje: string, anterior?: PlanoPessoal): PlanoPessoal {
  return { focos: p.focos.filter((f) => foco(f)).slice(0, 3), esconder: (p.esconder ?? []).filter((x) => ESCONDIVEIS.some((y) => y.id === x)), ritmo: p.ritmo ?? 'um-passo', extras: anterior?.extras ?? [], criadoEm: hoje };
}

/** As ferramentas que a pessoa vê. Sem plano: o básico mais o que os dados já indicam (para ser útil desde o primeiro dia). */
export function ferramentasLiberadas(e: Estado, hoje: string): Set<string> {
  const pl = e.caminho?.plano;
  const focos = pl ? pl.focos : focosIndicados(e, hoje).slice(0, 2).map((x) => x.foco.id);
  const escondidas = new Set((pl?.esconder ?? []).flatMap((id) => ESCONDIVEIS.find((x) => x.id === id)?.ferramentas ?? []));
  const out = new Set(BASE);
  for (const id of focos) for (const f of foco(id)?.ferramentas ?? []) if (!escondidas.has(f)) out.add(f);
  for (const f of pl?.extras ?? []) out.add(f);
  return out;
}

export interface Indicacao {
  ferramentaId: string;
  motivo: string; // por que o Coach está indicando agora, com número
}
/** O Coach indica uma ferramenta nova quando a vida da pessoa pede (e ela ainda não está liberada). */
export function indicacoes(e: Estado, hoje: string): Indicacao[] {
  const lib = ferramentasLiberadas(e, hoje);
  const esc = new Set(e.caminho?.plano?.esconder ?? []);
  const mes = mesDe(hoje);
  const out: Indicacao[] = [];
  const add = (id: string, motivo: string | null, assunto?: string) => { if (motivo && !lib.has(id) && !(assunto && esc.has(assunto)) && !out.some((x) => x.ferramentaId === id)) out.push({ ferramentaId: id, motivo }); };
  const atr = atrasosAbertos(e, hoje);
  add('atrasos', atr.length ? `${atr.length === 1 ? 'Uma conta atrasou' : `${atr.length} contas atrasaram`}. Esta ferramenta põe em ordem o que pagar primeiro.` : null);
  add('dividas', totalDividas(e.dividas) > 0 ? `Você tem ${brl0(totalDividas(e.dividas))} em dívidas. Aqui eu mostro a data em que você fica livre.` : null);
  const extra = receitasDoMes(e, mes).filter((r) => r.tipo === 'extra').reduce((t, r) => t + r.valor, 0);
  add('extras', extra > 0 ? `Entraram ${brl0(extra)} de dinheiro extra. Aqui eu mostro o melhor destino para ele.` : null);
  const d = detalheDisponivel(e, mes, hoje);
  add('cortar', d.modo !== 'incompleto' && d.livre < 0 ? `O mês fecha ${brl0(-d.livre)} no vermelho. Aqui você vê o que dá para reduzir primeiro.` : null);
  add('cartao', e.cartao && e.cartao.limite > 0 && e.cartao.usado / e.cartao.limite >= 0.7 ? `O cartão chegou a ${Math.round((e.cartao.usado / e.cartao.limite) * 100)}% do limite.` : null, 'cartao');
  add('comprar', e.desejos.some((x) => x.status === 'esperando') ? 'Você tem uma compra em espera de 72 horas.' : null);
  add('assinaturas', e.assinaturas.some((a) => a.ativa) ? `Você paga ${brl0(e.assinaturas.filter((a) => a.ativa).reduce((t, a) => t + a.valor, 0))} por mês em assinaturas.` : null);
  const m = reservaMeta(e, mes);
  add('investir', m > 0 && patrimonioGuardado(e) >= m ? 'Sua reserva está completa. O próximo passo é fazer o dinheiro trabalhar.' : null, 'investir');
  add('metas', e.config.objetivo && e.metas.length === 0 ? `Você disse que quer: ${e.config.objetivo.toLowerCase()}. Dê um valor e eu digo quando chega lá.` : null, 'metas');
  return out;
}

/** Os passos do mês que aparecem na tela inicial: os do plano (o urgente sempre entra). Um passo de cada vez = no máximo 3. */
export function passosDoPlano(passos: Passo[], e: Estado, hoje: string): { visiveis: Passo[]; outros: number } {
  const pl = e.caminho?.plano;
  const focos = pl ? pl.focos : focosIndicados(e, hoje).slice(0, 2).map((x) => x.foco.id);
  const origens = new Set<OrigemPasso>(['atraso', 'conta', 'comecar', 'plano', ...focos.flatMap((f) => foco(f)?.origens ?? [])]);
  const doPlano = passos.filter((p) => origens.has(p.origem) && p.status !== 'segurado');
  const max = pl?.ritmo === 'tudo' ? 99 : 3;
  const abertos = doPlano.filter((p) => p.status !== 'feito');
  const visiveis = [...abertos.slice(0, max), ...(pl?.ritmo === 'tudo' ? doPlano.filter((p) => p.status === 'feito') : [])];
  // se o passo destacado ("atual") ficou de fora do recorte, o primeiro visível vira o atual
  if (visiveis.length && !visiveis.some((p) => p.status === 'atual')) {
    const i = visiveis.findIndex((p) => p.status === 'pendente');
    if (i >= 0) visiveis[i] = { ...visiveis[i], status: 'atual' };
  }
  return { visiveis, outros: passos.length - visiveis.length };
}

/** Em uma frase: o que o plano faz. */
export function resumoDoPlano(pl: PlanoPessoal): string {
  const t = pl.focos.map((f) => foco(f)?.titulo.toLowerCase()).filter(Boolean) as string[];
  return t.length ? `Seu plano: ${t[0]}${t.length > 1 ? `, depois ${t.slice(1).join(' e ')}` : ''}.` : 'Seu plano ainda não tem foco.';
}

/* ---------- o plano evolui: foco concluído, o Coach propõe o próximo do caminho ---------- */
const ORDEM_DO_CAMINHO = ['atrasos', 'dividas', 'mes-fecha', 'reserva', 'meta', 'investir'];
/** O foco já está resolvido? (os que são hábito, como controlar e comprar bem, nunca "acabam") */
export function focoConcluido(id: string, e: Estado, hoje: string): boolean {
  const mes = mesDe(hoje);
  switch (id) {
    case 'atrasos': return atrasosAbertos(e, hoje).length === 0;
    case 'dividas': return e.dividas.length > 0 && totalDividas(e.dividas) === 0;
    case 'mes-fecha': { const d = detalheDisponivel(e, mes, hoje); return d.modo !== 'incompleto' && d.livre >= 0; }
    case 'reserva': { const m = reservaMeta(e, mes); return m > 0 && patrimonioGuardado(e) >= m; }
    case 'meta': return e.metas.length > 0 && e.metas.every((x) => x.guardados.reduce((t, g) => t + g.valor, 0) >= x.alvo - 0.005);
    case 'investir': return e.aportes.some((a) => a.origem === 'investimento' && a.valor > 0);
    default: return false;
  }
}
export interface Evolucao { concluido: Foco; proximo: Foco | null; porque: string }
/** Algum foco do plano foi concluído? Diz qual e propõe o próximo (o que os números pedem, senão o próximo do caminho). */
export function evolucaoDoPlano(e: Estado, hoje: string): Evolucao | null {
  const pl = e.caminho?.plano;
  if (!pl) return null;
  const feito = pl.focos.find((f) => focoConcluido(f, e, hoje));
  if (!feito) return null;
  const ja = new Set(pl.focos);
  // primeiro o que os números pedem dentro da ordem do caminho; hábitos (controlar, comprar bem) só se não houver outro
  const indicado = focosIndicados(e, hoje).find((x) => ORDEM_DO_CAMINHO.includes(x.foco.id) && !ja.has(x.foco.id) && !focoConcluido(x.foco.id, e, hoje));
  const daOrdem = ORDEM_DO_CAMINHO.slice(ORDEM_DO_CAMINHO.indexOf(feito) + 1).map((id) => foco(id)!).find((f) => !ja.has(f.id) && !focoConcluido(f.id, e, hoje) && !pl.esconder.includes(f.id));
  const proximo = indicado?.foco ?? daOrdem ?? null;
  return { concluido: foco(feito)!, proximo, porque: indicado?.porque ?? (proximo ? 'É o próximo passo do seu caminho.' : 'Você chegou longe. Escolha um novo objetivo quando quiser.') };
}
/** Troca o foco concluído pelo próximo (ou só tira o concluído). As ferramentas liberadas pelo Coach continuam. */
export function trocarFoco(pl: PlanoPessoal, concluido: string, proximo: string | null): PlanoPessoal {
  const focos = pl.focos.filter((f) => f !== concluido);
  return { ...pl, focos: proximo && !focos.includes(proximo) ? [...focos, proximo].slice(0, 3) : focos };
}
