// Motor dos chats roteirizados (spec v2, seção 5). Sem IA: cada roteiro é uma lista de passos. O estado de uma
// conversa é só a lista de respostas, em ordem. O passo em que a conversa está sai de repetir as respostas desde o
// começo, então salvar é guardar essa lista, retomar é repeti-la e editar uma resposta é cortar a lista ali.
//
// Ponto de extensão (seção 13): as falas passam por um ProvedorDeFala. Hoje é o roteiro; no futuro um passo pode
// pedir a fala a uma IA sem mudar o motor nem a tela.

import type { DadosDoApp } from './dados';
import type { Missao } from '../missoes';
import type { Eu } from '../eu';

export type AgenteId = 'arkad' | 'bansir' | 'nomasir' | 'dabasir' | 'mathon' | 'rodan' | 'sharru';

/** Um item de uma resposta de lista (ex.: uma dívida). */
export type ItemLista = Record<string, string | number | null>;
/** O valor de uma resposta: dinheiro → número; botões, texto, data → texto; múltiplo → lista de textos; lista → itens. */
export type Valor = number | string | string[] | ItemLista[];

export interface Opcao {
  valor: string;
  rotulo: string;
}

export interface Campo {
  id: string;
  rotulo: string;
  tipo: 'texto' | 'dinheiro' | 'percentual';
  opcional?: boolean;
  placeholder?: string;
  max?: number;
}

export type Resposta =
  | { tipo: 'dinheiro'; min?: number; max?: number; sugestao?: (ctx: Ctx) => { valor: number; rotulo: string } | null }
  | { tipo: 'botoes'; opcoes: Opcao[] }
  | { tipo: 'multiplo'; opcoes: Opcao[]; min?: number }
  | { tipo: 'texto'; placeholder: string; max: number }
  | { tipo: 'data'; min?: string; max?: string } // 'AAAA-MM-DD'
  | { tipo: 'dia' } // dia do mês, 1 a 31
  | { tipo: 'lista'; campos: Campo[]; minItens?: number; rotuloItem: string; inicial?: ItemLista[] }
  | { tipo: 'nenhuma' }; // só fala e avança sozinho

export interface Ctx {
  agente: AgenteId;
  nome: string; // primeiro nome ('' se não sabemos)
  respostas: Record<string, Valor>;
  dados: DadosDoApp;
}

export interface Passo {
  id: string;
  /** 1 a 3 balões. Podem usar as respostas anteriores. */
  falas: string[] | ((ctx: Ctx) => string[]);
  resposta: Resposta | ((ctx: Ctx) => Resposta);
  /** Mensagem de erro dita pelo agente, ou null se a resposta serve. */
  validar?: (valor: Valor, ctx: Ctx) => string | null;
  /** O próximo passo; null termina a conversa. */
  proximo: string | null | ((valor: Valor | null, ctx: Ctx) => string | null);
  /** Como a resposta aparece no balão da pessoa (padrão: o rótulo da opção ou o valor formatado). */
  rotulo?: (valor: Valor, ctx: Ctx) => string;
}

/** O cartão de resultado no fim do chat (seção 6). */
export interface Resultado {
  titulo: string;
  linhas: string[]; // no máximo 3, em ordem de prioridade
  agentes: AgenteId[]; // os que ficam ativos com este plano
  rodape?: string;
  botao?: string; // padrão "Começar missão"
}

export interface Roteiro {
  id: string;
  agente: AgenteId;
  titulo: string;
  primeiro: string;
  passos: Passo[];
  /** O cartão do fim. Sem ele o chat termina só com as falas. */
  resultado?: (ctx: Ctx) => Resultado;
  /** Ao tocar no botão do cartão: o que a conversa cria (as missões antigas do mesmo tipo só saem agora). */
  concluir?: (ctx: Ctx, conversa: string) => Conclusao;
}

export interface Conclusao {
  missoes: Missao[];
  ativar: AgenteId[];
  eu?: Partial<Eu>;
  /** Pra onde a tela vai depois (padrão: Início). */
  destino?: string;
}

export interface RespostaDada {
  passo: string;
  valor: Valor;
}

/** De onde vêm as falas. Hoje: o roteiro. */
export interface ProvedorDeFala {
  falas(passo: Passo, ctx: Ctx): string[];
}
export const falasDoRoteiro: ProvedorDeFala = {
  falas: (passo, ctx) => (typeof passo.falas === 'function' ? passo.falas(ctx) : passo.falas).filter(Boolean).slice(0, 3),
};

export const respostaDe = (passo: Passo, ctx: Ctx): Resposta => (typeof passo.resposta === 'function' ? passo.resposta(ctx) : passo.resposta);

function proximoDe(passo: Passo, valor: Valor | null, ctx: Ctx): string | null {
  return typeof passo.proximo === 'function' ? passo.proximo(valor, ctx) : passo.proximo;
}

/** Um passo visitado na conversa, com o contexto de antes da resposta (as falas dele usam esse contexto). */
export interface Visita {
  passo: Passo;
  ctx: Ctx; // contexto quando o passo foi dito
  valor?: Valor; // a resposta (não existe em passo sem resposta)
  indice?: number; // posição da resposta na lista
}

export interface Percurso {
  visitas: Visita[];
  /** O passo esperando resposta agora (null: a conversa terminou). */
  atual: Passo | null;
  /** O contexto agora (com todas as respostas válidas). */
  ctx: Ctx;
  fim: boolean;
  /** As respostas que ainda batem com o roteiro (se o roteiro mudou, as do fim podem cair). */
  validas: RespostaDada[];
}

const MAX_VISITAS = 400;

function acha(roteiro: Roteiro, id: string): Passo | null {
  return roteiro.passos.find((p) => p.id === id) ?? null;
}

const copia = (ctx: Ctx): Ctx => ({ ...ctx, respostas: { ...ctx.respostas } });

/** Repete as respostas desde o começo e devolve onde a conversa está. */
export function percorrer(roteiro: Roteiro, respostas: RespostaDada[], base: Omit<Ctx, 'respostas'>): Percurso {
  const ctx: Ctx = { ...base, respostas: {} };
  const visitas: Visita[] = [];
  let passo = acha(roteiro, roteiro.primeiro);
  let i = 0;
  while (passo && visitas.length < MAX_VISITAS) {
    const r = respostaDe(passo, ctx);
    if (r.tipo === 'nenhuma') {
      visitas.push({ passo, ctx: copia(ctx) });
      const prox = proximoDe(passo, null, ctx);
      if (prox === null) return { visitas, atual: null, ctx, fim: true, validas: respostas.slice(0, i) };
      passo = acha(roteiro, prox);
      continue;
    }
    const dada = respostas[i];
    if (!dada || dada.passo !== passo.id) break; // espera a resposta deste passo
    visitas.push({ passo, ctx: copia(ctx), valor: dada.valor, indice: i });
    ctx.respostas[passo.id] = dada.valor;
    i++;
    const prox = proximoDe(passo, dada.valor, ctx);
    if (prox === null) return { visitas, atual: null, ctx, fim: true, validas: respostas.slice(0, i) };
    passo = acha(roteiro, prox);
  }
  return { visitas, atual: passo, ctx, fim: !passo, validas: respostas.slice(0, i) };
}

/* ---------- formatação e conferência ---------- */

export const brl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
export const brl2 = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Valor de resumo: sem centavos quando é redondo, com centavos quando não é. */
export const brlCurto = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? brl(n) : brl2(n));

export function rotuloDe(passo: Passo, valor: Valor, ctx: Ctx): string {
  if (passo.rotulo) return passo.rotulo(valor, ctx);
  const r = respostaDe(passo, ctx);
  if (r.tipo === 'botoes') return r.opcoes.find((o) => o.valor === valor)?.rotulo ?? String(valor);
  if (r.tipo === 'multiplo' && Array.isArray(valor)) return (valor as string[]).map((v) => r.opcoes.find((o) => o.valor === v)?.rotulo ?? v).join(', ');
  if (r.tipo === 'dinheiro') return brlCurto(Number(valor));
  if (r.tipo === 'dia') return `Dia ${valor}`;
  if (r.tipo === 'data' && typeof valor === 'string') {
    const [y, m, d] = valor.split('-');
    return `${d}/${m}/${y}`;
  }
  if (r.tipo === 'lista' && Array.isArray(valor)) {
    const n = valor.length;
    return n === 0 ? 'Nenhuma' : n === 1 ? `1 ${r.rotuloItem}` : `${n} ${r.rotuloItem}s`;
  }
  return String(valor);
}

/** Confere os limites do tipo e a validação do passo. A mensagem é dita pelo agente. */
export function conferir(passo: Passo, valor: Valor, ctx: Ctx): string | null {
  const r = respostaDe(passo, ctx);
  if (r.tipo === 'dinheiro') {
    const n = Number(valor);
    if (!Number.isFinite(n)) return 'Digite um valor.';
    if (r.min !== undefined && n < r.min) return r.min <= 0 ? 'O valor não pode ser negativo.' : `Digite pelo menos ${brl2(r.min)}.`;
    if (r.max !== undefined && n > r.max) return 'Esse valor parece alto demais. Confere e digita de novo?';
  }
  if (r.tipo === 'botoes' && !r.opcoes.some((o) => o.valor === valor)) return 'Escolha uma das opções.';
  if (r.tipo === 'multiplo') {
    const lista = Array.isArray(valor) ? (valor as string[]) : [];
    if (lista.length < (r.min ?? 1)) return 'Escolha pelo menos uma opção.';
  }
  if (r.tipo === 'texto' && !String(valor).trim()) return 'Escreva alguma coisa.';
  if (r.tipo === 'dia') {
    const d = Number(valor);
    if (!Number.isInteger(d) || d < 1 || d > 31) return 'Escolha um dia de 1 a 31.';
  }
  if (r.tipo === 'data') {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'Escolha uma data.';
    if (r.min && valor < r.min) return 'Essa data é cedo demais.';
    if (r.max && valor > r.max) return 'Essa data ainda não chegou.';
  }
  if (r.tipo === 'lista') {
    const itens = Array.isArray(valor) ? (valor as ItemLista[]) : [];
    if (itens.length < (r.minItens ?? 0)) return `Adicione pelo menos ${r.minItens} ${r.rotuloItem}.`;
    for (const it of itens) {
      for (const c of r.campos) {
        const v = it[c.id];
        if (!c.opcional && (v === null || v === undefined || v === '' || (c.tipo === 'dinheiro' && !(Number(v) > 0)))) {
          return `Falta ${c.rotulo.toLowerCase()} em ${String(it[r.campos[0].id] || `um${r.rotuloItem.endsWith('a') ? 'a' : ''} ${r.rotuloItem}`)}.`;
        }
      }
    }
  }
  return passo.validar ? passo.validar(valor, ctx) : null;
}

/* ---------- leitura segura das respostas (pros roteiros) ---------- */

export const num = (ctx: Ctx, id: string): number => {
  const v = ctx.respostas[id];
  return typeof v === 'number' ? v : Number(v) || 0;
};
export const txt = (ctx: Ctx, id: string): string => {
  const v = ctx.respostas[id];
  return typeof v === 'string' ? v : '';
};
export const lista = (ctx: Ctx, id: string): ItemLista[] => {
  const v = ctx.respostas[id];
  return Array.isArray(v) && (v.length === 0 || typeof v[0] === 'object') ? (v as ItemLista[]) : [];
};
export const varios = (ctx: Ctx, id: string): string[] => {
  const v = ctx.respostas[id];
  return Array.isArray(v) && (v.length === 0 || typeof v[0] === 'string') ? (v as string[]) : [];
};
/** Já respondeu este passo? */
export const respondeu = (ctx: Ctx, id: string) => ctx.respostas[id] !== undefined;
/** "{nome}" vira o primeiro nome (ou some, com a vírgula, quando não sabemos o nome). */
export function comNome(texto: string, nome: string): string {
  if (nome) return texto.replace(/\{nome\}/g, nome);
  return texto.replace(/,\s*\{nome\}/g, '').replace(/\{nome\},?\s*/g, '').replace(/\s+([.?!])/g, '$1');
}
