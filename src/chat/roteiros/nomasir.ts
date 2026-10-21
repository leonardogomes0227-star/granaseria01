// Roteiro 6.5 — Nomasir: cortar e limitar gastos. A pessoa marca onde o dinheiro mais escapa; pra cada lugar, quanto
// vai por mês e o teto que ela topa (zero = cortar de vez). Nas assinaturas, lista as que paga e marca as que não usou:
// viram passos "Cancelar X". No fim: os limites por categoria e a economia estimada por mês e por ano.
//
// Os passos são uma lista fixa: cada categoria tem o seu par (gasto_x / teto_x) e o "proximo" de cada passo pula pra
// próxima categoria marcada, na ordem das opções, até o fim.

import { novaMissao, type PassoMissao } from '../../missoes';
import { brl, brlCurto, lista, num, respondeu, txt, varios, type Ctx, type Passo, type Roteiro, type Valor } from '../engine';
import { falas, fim } from './comum';

export type Categoria = 'delivery' | 'assinaturas' | 'compras' | 'saidas' | 'app' | 'outro';
type ComTeto = Exclude<Categoria, 'assinaturas'>;

/** Na ordem em que aparecem (e em que o chat pergunta). A frase é como a categoria entra no meio de uma fala. */
const CATEGORIAS: { id: Categoria; rotulo: string; frase: string }[] = [
  { id: 'delivery', rotulo: 'Delivery', frase: 'delivery' },
  { id: 'assinaturas', rotulo: 'Assinaturas', frase: 'assinaturas' },
  { id: 'compras', rotulo: 'Compras online', frase: 'compras online' },
  { id: 'saidas', rotulo: 'Saídas', frase: 'saídas' },
  { id: 'app', rotulo: 'Transporte por app', frase: 'corridas de app' },
  { id: 'outro', rotulo: 'Outro', frase: 'outro' },
];
const ORDEM = CATEGORIAS.map((c) => c.id);
const COM_TETO: ComTeto[] = ['delivery', 'compras', 'saidas', 'app', 'outro'];

/** O valor da opção "Usei todas" (as outras opções são as assinaturas listadas: a1, a2…). */
export const USEI_TODAS = 'todas';
const MAX_NOME = 30;

/* ---------- leitura das respostas ---------- */

/** As categorias marcadas, na ordem das opções (não na ordem do toque). */
export const escolhidas = (ctx: Ctx): Categoria[] => {
  const v = varios(ctx, 'onde');
  return ORDEM.filter((id) => v.includes(id));
};

const nomeOutro = (ctx: Ctx) => txt(ctx, 'outro_nome').trim().replace(/\s+/g, ' ');
// "farmácia" vira "Farmácia" no cartão; "iFood" fica como está
const maiuscula = (s: string) => (/^\p{Ll}\p{Lu}/u.test(s) ? s : s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1));
// "Farmácia" vira "farmácia" no meio da frase; siglas e nomes como "iFood" ou "UBER" ficam como estão
const minuscula = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLocaleLowerCase('pt-BR') + s.slice(1) : s);

/** Como a categoria aparece no cartão e nos limites ("Delivery", "Farmácia"). */
export function rotuloDaCategoria(c: Categoria, ctx: Ctx): string {
  if (c !== 'outro') return CATEGORIAS.find((x) => x.id === c)!.rotulo;
  const n = nomeOutro(ctx);
  if (!n) return 'Outro';
  const r = maiuscula(n);
  // os limites são guardados pelo nome: "outro" com o nome de uma categoria da lista não pode apagar a dela
  return CATEGORIAS.some((x) => x.id !== 'outro' && x.rotulo.toLocaleLowerCase('pt-BR') === r.toLocaleLowerCase('pt-BR')) ? `${r} (outro)` : r;
}

/** Como a categoria entra no meio de uma fala ("Quanto vai em delivery…"). */
export function fraseDaCategoria(c: Categoria, ctx: Ctx): string {
  if (c !== 'outro') return CATEGORIAS.find((x) => x.id === c)!.frase;
  return minuscula(nomeOutro(ctx)) || 'outro';
}

export interface Assinatura {
  id: string; // a1, a2… (a posição na lista)
  nome: string;
  valor: number;
}

export function assinaturasDoChat(ctx: Ctx): Assinatura[] {
  return lista(ctx, 'assinaturas')
    .map((it, i) => ({ id: `a${i + 1}`, nome: String(it.nome ?? '').trim() || `Assinatura ${i + 1}`, valor: Number(it.valor) || 0 }))
    .filter((a) => a.valor > 0);
}

export interface Limite {
  categoria: ComTeto;
  rotulo: string;
  frase: string;
  gasto: number;
  teto: number;
  economia: number;
}

export interface PlanoGastos {
  limites: Limite[]; // do que economiza mais pro que economiza menos
  assinaturas: Assinatura[];
  cancelar: Assinatura[];
  economia: number; // por mês: soma de (gasto - teto) + assinaturas canceladas
}

const centavos = (n: number) => Math.round(n * 100) / 100;
/** Valor de resumo: sem centavos; abaixo de R$ 10, com centavos quando não é redondo (R$ 0,50 não vira "R$ 1"). */
const rs = (n: number) => (Math.abs(n) < 10 ? brlCurto(n) : brl(n));

export function planoGastos(ctx: Ctx): PlanoGastos {
  const cats = escolhidas(ctx);
  const limites = COM_TETO.filter((c) => cats.includes(c) && num(ctx, `gasto_${c}`) > 0 && respondeu(ctx, `teto_${c}`))
    .map((c) => {
      const gasto = num(ctx, `gasto_${c}`);
      const teto = Math.min(gasto, Math.max(0, num(ctx, `teto_${c}`)));
      return { categoria: c, rotulo: rotuloDaCategoria(c, ctx), frase: fraseDaCategoria(c, ctx), gasto, teto, economia: centavos(gasto - teto) };
    })
    .sort((a, b) => b.economia - a.economia || b.teto - a.teto);
  const assinaturas = cats.includes('assinaturas') ? assinaturasDoChat(ctx) : [];
  const marcadas = varios(ctx, 'nao_usou');
  const cancelar = marcadas.includes(USEI_TODAS) ? [] : assinaturas.filter((a) => marcadas.includes(a.id)).sort((a, b) => b.valor - a.valor);
  const economia = centavos(limites.reduce((t, l) => t + l.economia, 0) + cancelar.reduce((t, a) => t + a.valor, 0));
  return { limites, assinaturas, cancelar, economia };
}

/** As linhas do plano (sem número), do que economiza mais pro que economiza menos. */
function itensDoPlano(p: PlanoGastos): string[] {
  const itens: { texto: string; economia: number; valor: number }[] = [
    ...p.limites.map((l) => ({ texto: l.teto > 0 ? `${l.rotulo}: no máximo ${rs(l.teto)}/mês` : `${l.rotulo}: cortar de vez (${rs(l.gasto)}/mês)`, economia: l.economia, valor: l.teto })),
    ...p.cancelar.map((a) => ({ texto: `Cancelar ${a.nome} (${rs(a.valor)})`, economia: a.valor, valor: a.valor })),
  ];
  if (p.assinaturas.length && !p.cancelar.length) {
    const total = p.assinaturas.reduce((t, a) => t + a.valor, 0);
    itens.push({ texto: `Assinaturas: manter as que você usa (${rs(total)}/mês)`, economia: 0, valor: 0 });
  }
  return itens.sort((a, b) => b.economia - a.economia || b.valor - a.valor).map((i) => i.texto);
}

const linhaEconomia = (e: number) => `Economia estimada: ${rs(e)}/mês → ${rs(e * 12)}/ano`;

/* ---------- caminho entre as categorias ---------- */

const inicioDe = (c: Categoria) => (c === 'assinaturas' ? 'assinaturas' : c === 'outro' ? 'outro_nome' : `gasto_${c}`);

/** O primeiro passo da próxima categoria marcada depois de "c" (null: a primeira); sem mais nenhuma, o fim. */
function depois(c: Categoria | null, ctx: Ctx): string {
  const marcadas = escolhidas(ctx);
  const de = c === null ? 0 : ORDEM.indexOf(c) + 1;
  const prox = ORDEM.slice(de).find((x) => marcadas.includes(x));
  return prox ? inicioDe(prox) : 'resultado';
}

/** Ainda não perguntou nenhum teto? (a dica do "pode pôr zero" vem só na primeira vez) */
const primeiroTeto = (ctx: Ctx) => !Object.keys(ctx.respostas).some((k) => k.startsWith('teto_'));

function parDaCategoria(c: ComTeto): Passo[] {
  const g = `gasto_${c}`;
  const t = `teto_${c}`;
  return [
    {
      id: g,
      falas: (ctx) => [`Quanto vai em ${fraseDaCategoria(c, ctx)} por mês, mais ou menos?`],
      resposta: { tipo: 'dinheiro', min: 0, max: 10_000_000 },
      // nada vai nisso: não tem o que limitar, segue pra próxima
      proximo: (v, ctx) => (Number(v) > 0 ? t : depois(c, ctx)),
    },
    {
      id: t,
      falas: (ctx) => {
        const gasto = num(ctx, g);
        return [`${rs(gasto)} por mês dá ${rs(gasto * 12)} no ano.`, 'E quanto você topa gastar no máximo?', primeiroTeto(ctx) ? 'Se quiser cortar de vez, pode pôr zero.' : ''];
      },
      resposta: (ctx) => ({
        tipo: 'dinheiro',
        min: 0,
        max: 10_000_000,
        sugestao: () => {
          const gasto = num(ctx, g);
          const s = Math.round((gasto * 0.7) / 10) * 10;
          return s > 0 && s < gasto ? { valor: s, rotulo: `${brl(s)} (30% a menos)` } : null;
        },
      }),
      validar: (v, ctx) => (Number(v) > num(ctx, g) ? `Assim o teto fica acima do que já vai hoje (${brlCurto(num(ctx, g))}). Pode ser igual ou menor.` : null),
      rotulo: (v: Valor) => (Number(v) === 0 ? 'R$ 0 (cortar de vez)' : brlCurto(Number(v))),
      proximo: (_v, ctx) => depois(c, ctx),
    },
  ];
}

/* ---------- os passos ---------- */

const passos: Passo[] = [
  {
    id: 'abertura',
    falas: (ctx) => falas(ctx, ['Vou ser sincero: eu perdi todo o ouro que meu pai me deu antes de aprender.', 'Gasto pequeno que se repete é o que mais pesa.']),
    resposta: { tipo: 'nenhuma' },
    proximo: 'onde',
  },
  {
    id: 'onde',
    falas: ['Onde você acha que mais escapa?', 'Pode marcar mais de um.'],
    resposta: { tipo: 'multiplo', opcoes: CATEGORIAS.map((c) => ({ valor: c.id, rotulo: c.rotulo })) },
    proximo: (_v, ctx) => depois(null, ctx),
  },
  ...parDaCategoria('delivery'),
  {
    id: 'assinaturas',
    falas: ['Lista as que você paga.', 'Filmes, música, apps, clubes. Tudo que cobra todo mês.'],
    resposta: {
      tipo: 'lista',
      rotuloItem: 'assinatura',
      campos: [
        { id: 'nome', rotulo: 'Nome', tipo: 'texto', placeholder: 'Ex.: streaming de filmes', max: MAX_NOME },
        { id: 'valor', rotulo: 'Quanto por mês', tipo: 'dinheiro' },
      ],
    },
    // sem nenhuma na lista, não tem o que cancelar
    proximo: (_v, ctx) => (assinaturasDoChat(ctx).length ? 'nao_usou' : depois('assinaturas', ctx)),
  },
  {
    id: 'nao_usou',
    falas: (ctx) => {
      const listadas = assinaturasDoChat(ctx);
      const total = listadas.reduce((t, a) => t + a.valor, 0);
      // "somando" e "mais de uma" só fazem sentido com duas ou mais
      return listadas.length > 1
        ? [`Somando, dá ${rs(total)} por mês, ${rs(total * 12)} no ano.`, 'Qual você não usou no último mês?', 'Pode marcar mais de uma.']
        : [`Dá ${rs(total)} por mês, ${rs(total * 12)} no ano.`, 'Qual você não usou no último mês?'];
    },
    resposta: (ctx) => ({
      tipo: 'multiplo',
      opcoes: [...assinaturasDoChat(ctx).map((a) => ({ valor: a.id, rotulo: a.nome })), { valor: USEI_TODAS, rotulo: 'Usei todas' }],
    }),
    validar: (v) => {
      const marcadas = Array.isArray(v) ? (v as string[]) : [];
      return marcadas.includes(USEI_TODAS) && marcadas.length > 1 ? 'Você marcou “Usei todas” e também uma que não usou. Fica com qual?' : null;
    },
    proximo: (_v, ctx) => depois('assinaturas', ctx),
  },
  ...parDaCategoria('compras'),
  ...parDaCategoria('saidas'),
  ...parDaCategoria('app'),
  {
    id: 'outro_nome',
    falas: ['Com o quê?'],
    resposta: { tipo: 'texto', placeholder: 'Ex.: lanche na rua', max: MAX_NOME },
    validar: (v) => (String(v).trim().length > MAX_NOME ? `Resume em poucas palavras, até ${MAX_NOME} letras.` : null),
    proximo: 'gasto_outro',
  },
  ...parDaCategoria('outro'),
  fim('resultado', (ctx) => {
    const p = planoGastos(ctx);
    if (p.economia > 0) return falas(ctx, [`Pronto, {nome}. Segurando esses gastos, sobram ${rs(p.economia)} por mês.`, `Em um ano, isso dá ${rs(p.economia * 12)}. Foi cortando o pequeno que eu voltei a juntar ouro.`]);
    if (p.limites.length) return falas(ctx, ['Esses gastos já estão bem controlados, {nome}.', 'Vou deixar os limites anotados pra você manter assim.']);
    return falas(ctx, ['Pelo que você contou, não tem nada escapando agora, {nome}. Melhor assim.', 'Se algo mudar, é só voltar aqui.']);
  }),
];

export const ROTEIRO_GASTOS: Roteiro = {
  id: 'gastos',
  agente: 'nomasir',
  titulo: 'Cortar e limitar gastos',
  primeiro: 'abertura',
  passos,
  resultado: (ctx) => {
    const p = planoGastos(ctx);
    const itens = itensDoPlano(p);
    const base = itens.length ? itens : ['Seguir de olho nos gastos pequenos'];
    // a economia entra como última linha quando cabe; senão vai pro rodapé
    const cabe = p.economia > 0 && base.length < 3;
    const linhas = (cabe ? [...base, linhaEconomia(p.economia)] : base.slice(0, 3)).map((l, i) => `${i + 1}. ${l}`);
    const rodape = p.economia > 0 ? (cabe ? 'Estimativa com os seus números.' : linhaEconomia(p.economia)) : 'Seus gastos já estão bem controlados. Agora é manter.';
    return {
      titulo: 'Seu plano com Nomasir',
      linhas,
      // o que não coube nas 3 linhas aparece nos detalhes
      lista: itens.length > 3 ? itens : undefined,
      agentes: ['nomasir'],
      rodape,
    };
  },
  concluir: (ctx, conversa) => {
    const p = planoGastos(ctx);
    const mes = ctx.dados.mes;
    const passosMissao: PassoMissao[] = [
      ...p.cancelar.map((a, i): PassoMissao => ({ id: `c${i + 1}`, ordem: i + 1, titulo: `Cancelar ${a.nome}`, valor: a.valor, acao: 'cancelar', dataAlvo: mes })),
      ...p.limites.map(
        (l, i): PassoMissao => ({
          id: `l${i + 1}`,
          ordem: p.cancelar.length + i + 1,
          titulo: l.teto > 0 ? `Gastar no máximo ${rs(l.teto)} com ${l.frase} este mês` : `Não gastar com ${l.frase} este mês`,
          valor: l.teto,
          acao: 'conferir',
          dataAlvo: mes,
        })
      ),
    ];
    if (!passosMissao.length) passosMissao.push({ id: 'p1', ordem: 1, titulo: 'Anotar os gastos pequenos deste mês', acao: 'conferir', dataAlvo: mes });
    return {
      missoes: [
        novaMissao(
          {
            agente: 'nomasir',
            conversa,
            titulo: 'Segurar os gastos',
            tipo: 'gastos',
            metaValor: 0,
            valorInicial: 0,
            valorMensal: p.economia,
            dataInicio: ctx.dados.hoje,
            limites: Object.fromEntries(p.limites.map((l) => [l.rotulo, l.teto])),
            economiaMensal: p.economia,
            editarPasso: 'onde',
            passos: passosMissao,
            notas: p.economia > 0 ? `Segurando esses gastos, sobram ${rs(p.economia)} por mês.` : 'Seus gastos já estão bem controlados. Agora é manter.',
          },
          ctx.dados.hoje
        ),
      ],
      ativar: ['nomasir'],
    };
  },
};
