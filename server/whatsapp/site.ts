// O WhatsApp é só o dia a dia: o que entra, o que sai e como está o mês. Nenhuma ferramenta roda aqui.
// Todo o resto (diagnóstico, plano, dívidas, 13º, vazamentos, direitos, metas, compras…) fica no site, que a pessoa
// abre já logada pelo link: o bot só manda o link certo. O que ela anota aqui aparece no painel do site.

import type { Outgoing } from './meta.js';
import { buttons, txt } from './hubcore.js';

// Fixo de propósito: a variável SITE_URL da Vercel já mandou link com domínio errado. O site é este.
export const SITE_URL = 'https://granaseria.com.br';

type SiteKey = 'diag' | 'painel' | 'plano' | 'dividas' | 'emprestimo' | 'meta' | 'longo' | 'extra' | 'vazamentos' | 'direitos' | 'fatura' | 'compra' | 'checkin' | 'selos' | 'frase';

const TOOLS: Record<SiteKey, { title: string; path: string; why: string }> = {
  diag: { title: 'Diagnóstico', path: '/diagnostico', why: 'umas perguntas rápidas e você recebe sua nota e um plano com valores e datas' },
  painel: { title: 'Meu app', path: '/', why: 'quanto você pode gastar hoje e o seu próximo passo' },
  plano: { title: 'Seu plano', path: '/plano', why: 'o que fazer este mês, com valores e datas' },
  dividas: { title: 'Sair das dívidas', path: '/ferramentas/quitar-dividas', why: 'a ordem certa pra pagar suas dívidas e quando você fica livre' },
  emprestimo: { title: 'Comparar empréstimos', path: '/ferramentas/comparador-de-emprestimo', why: 'qual proposta sai mais barata no total' },
  meta: { title: 'Juntar pra um objetivo', path: '/ferramentas/calculadora-de-meta', why: 'quanto guardar por mês pra chegar no valor que você quer' },
  longo: { title: 'Simulador de longo prazo', path: '/ferramentas/simulador-longo-prazo', why: 'quanto o que você guarda vira com os anos' },
  extra: { title: 'Usar bem o 13º e extras', path: '/ferramentas/decimo-terceiro', why: 'onde colocar cada real do 13º, da restituição ou de um extra' },
  vazamentos: { title: 'Cortar gastos escondidos', path: '/ferramentas/caca-vazamentos', why: 'assinaturas, tarifas e seguros que comem seu dinheiro sem você ver, com a mensagem pronta pra cancelar' },
  direitos: { title: 'Negociar com o banco', path: '/ferramentas/seus-direitos', why: 'renegociar, levar a dívida pra outro banco, teto de juros, com a mensagem pronta pra mandar' },
  fatura: { title: 'Analisar minha fatura', path: '/ferramentas/leitor-de-fatura', why: 'mande o PDF da fatura e a IA acha juros, tarifas e cobranças escondidas' },
  compra: { title: 'Posso comprar isso?', path: '/ferramentas/vale-a-pena-comprar', why: 'antes de comprar, veja quanto custa em dias de trabalho e se cabe no seu mês' },
  checkin: { title: 'Check-in mensal', path: '/ferramentas/check-in-mensal', why: 'veja se o quanto você guarda está subindo mês a mês' },
  selos: { title: 'Meus selos', path: '/ferramentas/meus-selos', why: 'suas conquistas com as leis do livro' },
  frase: { title: 'Frase do dia', path: '/ferramentas/frase-do-dia', why: 'uma frase nova por dia, pronta pra postar' },
};

export const siteLink = (key: SiteKey) => `${SITE_URL}${TOOLS[key].path}`;

const DAY_TO_DAY = 'Aqui no WhatsApp eu cuido só do que entra e do que sai: é só me mandar (ex.: *mercado 80 no pix*).';

function toolOut(key: SiteKey): Outgoing[] {
  const t = TOOLS[key];
  const back = key === 'diag' ? '\n\nNo fim, toque em *Continuar no WhatsApp* que eu passo a te mostrar quanto ainda dá pra gastar em cada coisa.' : '';
  return [txt(`🌐 *${t.title}* fica no site: ${t.why}.\n\n👉 ${siteLink(key)}\n(o link já abre com a sua conta)${back}\n\n${DAY_TO_DAY}`)];
}

/** Ferramentas em geral: um link só, pro site. Lá a pessoa escolhe o que quer fazer. */
export function siteToolsOut(): Outgoing[] {
  return [
    txt(
      [
        '🌐 *As ferramentas ficam no site*: diagnóstico, plano de ação, dívidas, 13º, metas, seus direitos e mais. Lá você escolhe o que quer fazer e vê seu painel.',
        '',
        `👉 ${SITE_URL}/`,
        '(o link já abre com a sua conta)',
        '',
        DAY_TO_DAY,
      ].join('\n')
    ),
  ];
}

// botões, linhas de lista e palavras que antes abriam uma ferramenta aqui → o link dela no site
const TO_SITE: [RegExp, SiteKey | 'all'][] = [
  [/^(menu:diag|menu:rapido|diag:\S+|goal:organizar|diagnostico|fazer diagnostico|meu diagnostico|refazer diagnostico|rapido|comeco rapido|inicio rapido|comecar rapido|diagnostico rapido)$/, 'diag'],
  [/^(menu:proximo|plan:\S+|next:\S+|proximo passo|meu proximo passo|e agora|o que faco|o que eu faco|o que faco hoje|o que eu faco hoje|por onde comeco)$/, 'painel'],
  [/^(menu:plano|job:plano|plano|meu plano|plano do mes|o que pagar)$/, 'plano'],
  [/^(menu:13o|goal:extra|13o|13 salario|decimo terceiro|dinheiro extra|restituicao( do ir)?|extra)$/, 'extra'],
  [/^(menu:vazamentos|goal:sobra|vazamentos?|caca vazamentos?|cacar vazamentos?|assinaturas|tarifas|dinheiro perdido|dinheiro que sobra)$/, 'vazamentos'],
  [/^(menu:direitos|goal:direitos|dir:\S+|direitos?|meus direitos|seus direitos|renegociar|renegociacao|negociar|negociar divida|como renegociar|mensagem pronta)$/, 'direitos'],
  [/^(calc:meta|job:guardar|goal:guardar|meta|minha meta|calculadora de meta|juntar dinheiro|guardar dinheiro|poupar|quanto guardar)$/, 'meta'],
  [/^(calc:longo|longo prazo|simulador|aposentadoria|simulador de longo prazo)$/, 'longo'],
  [/^(calc:emprestimo|goal:emprestimo|emprestimo|comparar emprestimos?|financiamento)$/, 'emprestimo'],
  [/^(calc:compra|goal:comprar|(vale a pena|vale comprar|posso comprar|devo comprar)\b.*)$/, 'compra'],
  [
    /^(calc:dividas|calc:novadivida|calc:apagardivida|job:dividas|goal:divida|dividas|minhas dividas|sair das dividas|pagar dividas|qual divida pagar|avalanche|bola de neve|avalanche x bola de neve|(nova|novo|adicionar|incluir|outra|mais uma|esqueci|apagar|apaga|excluir|remover|tirar|deletar)\b.*\bdivida\b.*|quitei\b.*|terminei de pagar\b.*|acabei de pagar\b.*|liquidei\b.*|paguei tudo d[oae]\b.*)$/,
    'dividas',
  ],
  [/^(menu:checkin|check[ -]?in( do mes)?)$/, 'checkin'],
  [/^(mais:selos|selos|meus selos|perfil|meu perfil)$/, 'selos'],
  [/^(mais:frase|frase:\d+|frase|frase do dia)$/, 'frase'],
  [/^(menu:fatura|fatura|ler fatura|ler minha fatura|leitor de fatura)$/, 'fatura'],
  [
    /^(menu:tudo|menu:calc|menu:mais|job:(?!anotar)\S+|goal:(?!gastos)\S+|site:todas|ferramentas|mais ferramentas|todas as opcoes|todas as ferramentas|calculadoras?|calcular|site|no site|objetivos?|meus? objetivos?|o que voce faz|o que voce pode fazer)$/,
    'all',
  ],
];

/** Se a mensagem pede uma ferramenta que agora fica no site, a resposta com o link. null: não é o caso. */
export function toSite(t: string): Outgoing[] | null {
  const hit = TO_SITE.find(([re]) => re.test(t));
  if (!hit) return null;
  return hit[1] === 'all' ? siteToolsOut() : toolOut(hit[1]);
}

/**
 * O "oi": diz em poucas linhas o que o WhatsApp faz (só o que entra e o que sai) e manda o link do site, onde fica
 * todo o resto (o webhook põe o login no link, então é só tocar). Sem diagnóstico, o link leva à página inicial
 * (lá a pessoa escolhe o que quer fazer); com, ao painel.
 */
export function welcomeOut(name: string | null, hasDiagnosis: boolean, gastosNoMes = 0): Outgoing[] {
  const hi = name ? `Oi, ${name}! 👋` : 'Oi! 👋';
  const link = hasDiagnosis ? `${SITE_URL}/painel` : `${SITE_URL}/`;
  // quem já anota não precisa ler o manual de novo: um oi curto e os atalhos
  if (gastosNoMes > 0) {
    return [
      buttons(
        `${hi} Bom te ver. Você já anotou *${gastosNoMes} ${gastosNoMes === 1 ? 'gasto' : 'gastos'}* este mês.\n\nMande o próximo (ex.: *mercado 35*) ou escolha:`,
        [
          ['gastos:saldo', '⚖️ Ver meu mês'],
          ['gastos:sobra', '💸 Posso gastar?'],
          ['site:painel', '📲 Abrir o app'],
        ]
      ),
    ];
  }
  // primeira vez (ou mês ainda vazio): uma coisa só para fazer agora, e o resto em uma linha
  return [
    txt(
      [
        `${hi} Eu sou o assistente da *Grana Séria*. 🪙`,
        'Eu anoto o seu dinheiro por aqui, do jeito que você fala.',
        '',
        '👉 *Mande seu primeiro gasto agora*, por exemplo:',
        '*mercado 35*',
        '',
        'Depois é só ir mandando: *recebi 3000 salário*, a foto do cupom, *saldo*, *quanto posso gastar*.',
        'Errou? Mande *era 30* pra corrigir ou *apagar* pra desfazer.',
        '',
        hasDiagnosis ? '📲 Seu painel e o seu plano ficam no app:' : '📲 Contas, dívidas e metas ficam no app:',
        link,
        '(o link já abre na sua conta, sem senha)',
      ].join('\n')
    ),
    buttons('Ou escolha por onde começar:', [
      ['job:anotar', '✍️ Como anotar'],
      ['gastos:saldo', '⚖️ Ver meu mês'],
      ['site:painel', '📲 Abrir o app'],
    ]),
  ];
}

/**
 * O aviso das ferramentas no site, pra quem já usava o bot. O link é pessoal (já entra com a conta da pessoa).
 * Vai no chat (uma vez, na próxima mensagem) e no "Avisar todo mundo" do painel do dono.
 */
export function siteNoticeText(link: string, name?: string | null): string {
  return [
    `📣 *${name ? `${name}, temos` : 'Temos'} novidade na Grana Séria!*`,
    '',
    'Pra ficar mais simples, separamos as coisas:',
    '',
    '💬 *Aqui no WhatsApp:* só o que entra e o que sai. Mande *mercado 80 no pix*, *recebi 3000 salário* ou a foto do cupom, e eu mostro o saldo e quanto ainda dá pra gastar.',
    '',
    '📲 *No site:* o diagnóstico com o seu plano de ação, as ferramentas (dívidas, metas, 13º, seus direitos…) e o seu painel, tudo salvo na sua conta.',
    '',
    '👉 *Toque aqui pra entrar* (já com a sua conta, sem senha):',
    link,
    '',
    'O que você anota aqui aparece no seu painel na hora. 🪙',
  ].join('\n');
}
