// O WhatsApp cuida do dia a dia (gastos, dinheiro que entra, saldo, quanto ainda dá pra gastar).
// As ferramentas maiores (diagnóstico, dívidas, 13º, vazamentos, direitos, metas…) ficam no site (login pelo WhatsApp):
// aqui o bot só manda o link certo. No fim do diagnóstico do site, "Continuar no WhatsApp" traz tudo de volta.

import type { Outgoing } from './meta.js';
import { buttons, txt } from './hubcore.js';

// Fixo de propósito: a variável SITE_URL da Vercel já mandou link com domínio errado. O site é este.
export const SITE_URL = 'https://granaseria.com.br';

type SiteKey = 'diag' | 'plano' | 'dividas' | 'emprestimo' | 'meta' | 'longo' | 'extra' | 'vazamentos' | 'direitos' | 'fatura' | 'checkin' | 'selos' | 'frase';

const TOOLS: Record<SiteKey, { title: string; path: string; why: string }> = {
  diag: { title: 'Diagnóstico', path: '/diagnostico', why: 'umas perguntas rápidas e você recebe sua nota e um plano com valores e datas' },
  plano: { title: 'Meu plano, mês a mês', path: '/ferramentas/meu-plano', why: 'o que pagar e guardar em cada mês, recalculado quando você atrasa ou adianta' },
  dividas: { title: 'Qual dívida pagar primeiro', path: '/ferramentas/quitar-dividas', why: 'a ordem certa pra pagar suas dívidas e quando você fica livre' },
  emprestimo: { title: 'Comparador de empréstimo', path: '/ferramentas/comparador-de-emprestimo', why: 'qual proposta sai mais barata no total' },
  meta: { title: 'Calculadora de meta', path: '/ferramentas/calculadora-de-meta', why: 'quanto guardar por mês pra chegar no valor que você quer' },
  longo: { title: 'Simulador de longo prazo', path: '/ferramentas/simulador-longo-prazo', why: 'quanto o que você guarda vira com os anos' },
  extra: { title: 'O que fazer com o 13º', path: '/ferramentas/decimo-terceiro', why: 'onde colocar cada real do 13º, da restituição ou de um extra' },
  vazamentos: { title: 'Caça-vazamentos', path: '/ferramentas/caca-vazamentos', why: 'assinaturas, tarifas e seguros que comem seu dinheiro sem você ver, com a mensagem pronta pra cancelar' },
  direitos: { title: 'Seus direitos com o banco', path: '/ferramentas/seus-direitos', why: 'renegociar, levar a dívida pra outro banco, teto de juros, com a mensagem pronta pra mandar' },
  fatura: { title: 'Leitor de fatura', path: '/ferramentas/leitor-de-fatura', why: 'mande o PDF da fatura e a IA acha juros, tarifas e cobranças escondidas' },
  checkin: { title: 'Check-in mensal', path: '/ferramentas/check-in-mensal', why: 'veja se o quanto você guarda está subindo mês a mês' },
  selos: { title: 'Meus selos', path: '/ferramentas/meus-selos', why: 'suas conquistas com as leis do livro' },
  frase: { title: 'Frase do dia', path: '/ferramentas/frase-do-dia', why: 'uma frase nova por dia, pronta pra postar' },
};

export const siteLink = (key: SiteKey) => `${SITE_URL}${TOOLS[key].path}`;

const DAY_TO_DAY = 'Aqui no WhatsApp eu cuido do seu dia a dia: o que você gasta e o que entra. É só me mandar (ex.: *mercado 80 no pix*).';

function toolOut(key: SiteKey): Outgoing[] {
  const t = TOOLS[key];
  const back =
    key === 'diag'
      ? '\n\nNo fim, toque em *Continuar no WhatsApp*: eu trago seu diagnóstico pra cá e passo a te mostrar quanto ainda dá pra gastar em cada coisa.'
      : '\n\nO link já abre com a sua conta: é só tocar.';
  return [txt(`🌐 *${t.title}*: ${t.why}. Fica no site:\n${siteLink(key)}${back}\n\n${DAY_TO_DAY}`)];
}

/** Todas as ferramentas do site numa mensagem só, com os links. */
export function siteToolsOut(): Outgoing[] {
  const order: SiteKey[] = ['diag', 'plano', 'dividas', 'direitos', 'extra', 'vazamentos', 'meta', 'emprestimo', 'fatura', 'longo', 'checkin'];
  return [
    txt(
      [
        '🌐 *Ferramentas da Grana Séria*, no site (os links já abrem com a sua conta):',
        '',
        ...order.map((k) => `• *${TOOLS[k].title}*: ${siteLink(k)}`),
        '',
        DAY_TO_DAY,
      ].join('\n')
    ),
  ];
}

// botões, linhas de lista e palavras que antes abriam uma ferramenta aqui → o link dela no site
const TO_SITE: [RegExp, SiteKey | 'all'][] = [
  [/^(menu:diag|menu:rapido|diag:tudo|goal:organizar|diagnostico|fazer diagnostico|meu diagnostico|refazer diagnostico|rapido|comeco rapido|inicio rapido|comecar rapido|diagnostico rapido)$/, 'diag'],
  [/^(menu:13o|goal:extra|13o|13 salario|decimo terceiro|dinheiro extra|restituicao( do ir)?|extra)$/, 'extra'],
  [/^(menu:vazamentos|goal:sobra|vazamentos?|caca vazamentos?|cacar vazamentos?|assinaturas|tarifas|dinheiro perdido|dinheiro que sobra)$/, 'vazamentos'],
  [/^(menu:direitos|goal:direitos|next:renegociar|dir:\S+|direitos?|meus direitos|seus direitos|renegociar|renegociacao|negociar|negociar divida|como renegociar|mensagem pronta)$/, 'direitos'],
  [/^(calc:meta|goal:guardar|meta|minha meta|calculadora de meta|juntar dinheiro|guardar dinheiro|poupar|quanto guardar)$/, 'meta'],
  [/^(calc:longo|longo prazo|simulador|aposentadoria|simulador de longo prazo)$/, 'longo'],
  [/^(calc:emprestimo|goal:emprestimo|emprestimo|comparar emprestimos?|financiamento)$/, 'emprestimo'],
  [
    /^(calc:dividas|calc:novadivida|calc:apagardivida|goal:divida|dividas|minhas dividas|sair das dividas|pagar dividas|qual divida pagar|avalanche|bola de neve|avalanche x bola de neve|(nova|novo|adicionar|incluir|outra|mais uma|esqueci|apagar|apaga|excluir|remover|tirar|deletar)\b.*\bdivida\b.*|quitei\b.*|terminei de pagar\b.*|acabei de pagar\b.*)$/,
    'dividas',
  ],
  [/^(menu:checkin|check[ -]?in( do mes)?)$/, 'checkin'],
  [/^(mais:selos|selos|meus selos|perfil|meu perfil)$/, 'selos'],
  [/^(mais:frase|frase|frase do dia)$/, 'frase'],
  [/^(menu:fatura|fatura|ler fatura|ler minha fatura|leitor de fatura)$/, 'fatura'],
  [/^(menu:tudo|menu:calc|menu:mais|job:plano|job:dividas|job:guardar|site:todas|ferramentas|mais ferramentas|todas as opcoes|todas as ferramentas|calculadoras?|calcular|site|no site)$/, 'all'],
];

/** Se a mensagem pede uma ferramenta que agora fica no site, a resposta com o link. null: não é o caso. */
export function toSite(t: string): Outgoing[] | null {
  const hit = TO_SITE.find(([re]) => re.test(t));
  if (!hit) return null;
  return hit[1] === 'all' ? siteToolsOut() : toolOut(hit[1]);
}

/**
 * O "oi": a maioria chega sem saber que as ferramentas foram pro site. Então o oi explica a novidade primeiro,
 * manda o link (o webhook põe o login nele, então é só tocar) e só depois lembra o que continua aqui.
 * Sem diagnóstico, o link leva à página inicial (a apresentação e o "O que você quer resolver?"); com, ao painel.
 */
export function welcomeOut(name: string | null, hasDiagnosis: boolean): Outgoing[] {
  const hi = name ? `Oi, ${name}! 👋` : 'Oi! 👋';
  const link = hasDiagnosis ? `${SITE_URL}/painel` : `${SITE_URL}/`;
  return [
    txt(
      [
        `${hi} Eu sou o assistente da *Grana Séria*. 🪙`,
        '',
        hasDiagnosis
          ? '📣 *Novidade:* agora seu plano de ação, seus gastos do mês e todas as ferramentas ficam juntos no nosso site, salvos na sua conta.'
          : '📣 *Novidade:* agora tudo fica no nosso site, mais fácil de usar e com passo a passo: o diagnóstico (sua nota e o seu plano de ação), dívidas, 13º, metas, seus direitos e mais.',
        '',
        `👉 *Toque aqui pra entrar* (já com a sua conta, sem senha):`,
        link,
        '',
        hasDiagnosis
          ? 'Lá, quando quiser voltar pra cá, é só tocar em *Anotar no WhatsApp*.'
          : 'Comece pelo *diagnóstico* (uns 10 minutos). No fim, toque em *Continuar no WhatsApp* que eu trago tudo pra cá e passo a te mostrar quanto ainda dá pra gastar em cada coisa.',
      ].join('\n')
    ),
    buttons(
      '✍️ *Aqui no WhatsApp* você anota o dia a dia: *mercado 80 no pix*, *recebi 3000 salário* ou a foto do cupom. Eu somo e mostro o saldo e quanto ainda dá pra gastar por dia.',
      [
        ['gastos:saldo', '⚖️ Ver meu mês'],
        ['job:anotar', '✍️ Como anotar'],
        ['menu:menu', '📋 Mais opções'],
      ]
    ),
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
    'Pra ficar mais fácil, agora tudo fica no nosso site, com passo a passo e salvo na sua conta: 📊 diagnóstico e plano de ação, ❄️ qual dívida pagar primeiro, 🎁 13º, 🎯 metas, ⚖️ seus direitos e mais.',
    '',
    '👉 *Toque aqui pra entrar* (já com a sua conta, sem senha):',
    link,
    '',
    '*Como fica:*',
    '1️⃣ No site você vê seu plano e usa as ferramentas.',
    '2️⃣ Aqui no WhatsApp você continua anotando o dia a dia: *mercado 80 no pix*, *recebi 3000 salário* ou a foto do cupom.',
    '3️⃣ Tudo fica junto: o que você anota aqui aparece no site.',
    '',
    'No site, pra voltar pra cá, é só tocar em *Anotar no WhatsApp*. 🪙',
  ].join('\n');
}
