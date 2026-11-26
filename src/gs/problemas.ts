// O Midas existe para isto: a pessoa conta o problema com as próprias palavras e ele aponta a ferramenta certa.
// Cada problema tem frases-chave e até 3 ferramentas, a primeira é por onde começar. Cada uma vem com o porquê, em uma linha.
// Puro e testado: nada aqui depende da tela.

import { sem } from './atrasosBase.js';
import { FERRAMENTAS, type Ferramenta } from './registroFerramentas.js';

export interface Problema {
  id: string;
  /** como a pessoa se refere ao problema (em palavras simples, sem acento) */
  chaves: string[];
  /** a frase do Midas: reconhece o problema antes de mandar para a ferramenta */
  abertura: string;
  passos: { ferramenta: string; porque: string }[];
}

export const PROBLEMAS: Problema[] = [
  { id: 'acaba-antes', chaves: ['acaba antes', 'nao chega ate o fim', 'nao dura o mes', 'dinheiro some', 'dinheiro sumiu', 'acaba rapido', 'nao sobra nada', 'fim do mes aperto', 'falta dinheiro no fim', 'nao da pra viver', 'mes nao fecha'],
    abertura: 'Quando o dinheiro some antes do fim do mês, o primeiro passo é dar um limite para cada gasto.',
    passos: [{ ferramenta: 'orcamento', porque: 'monta um limite para cada coisa e avisa antes de estourar' }, { ferramenta: 'cortar', porque: 'mostra onde você mais gasta e o que dá para segurar' }, { ferramenta: 'recuperacao', porque: 'se o mês já não fecha, um plano de saída passo a passo' }] },
  { id: 'atrasada', chaves: ['conta atrasada', 'contas atrasadas', 'atrasei', 'em atraso', 'atrasado', 'vencida', 'venceu', 'nao paguei', 'esqueci de pagar', 'multa', 'juros de atraso', 'nome sujo', 'negativado', 'cobranca', 'cobrando'],
    abertura: 'Com conta atrasada, a ordem do que pagar primeiro faz diferença.',
    passos: [{ ferramenta: 'atrasos', porque: 'põe as contas na ordem certa e monta o plano mês a mês' }, { ferramenta: 'direitos', porque: 'o que o banco ou a empresa pode e não pode cobrar, com mensagem pronta' }, { ferramenta: 'anotar-atraso', porque: 'para registrar uma conta antiga que ainda não está no app' }] },
  { id: 'dividas', chaves: ['divida', 'dividas', 'devendo', 'devo muito', 'sair das dividas', 'quitar', 'quitacao', 'financiamento', 'emprestimo atrasado', 'bola de neve', 'juros altos', 'rotativo', 'cheque especial'],
    abertura: 'Para sair das dívidas, o que importa é a ordem de pagamento e a data em que você fica livre.',
    passos: [{ ferramenta: 'dividas', porque: 'mostra o dia em que você fica livre e quanto pagar por mês' }, { ferramenta: 'direitos', porque: 'como negociar e quais juros são abusivos' }, { ferramenta: 'emprestimos', porque: 'compara ofertas para trocar uma dívida cara por uma mais barata' }] },
  { id: 'cartao', chaves: ['cartao', 'fatura', 'cartao estourou', 'limite do cartao', 'parcelas do cartao', 'parcelei muito', 'fatura alta', 'fatura do cartao'],
    abertura: 'O cartão engana porque cada parcela parece pequena, mas elas se acumulam.',
    passos: [{ ferramenta: 'cartao', porque: 'a fatura de hoje e as parcelas que ainda vêm' }, { ferramenta: 'fatura', porque: 'mande o PDF e veja para onde foi o dinheiro e se há tarifa escondida' }, { ferramenta: 'parcelado', porque: 'quanto de juro está escondido em parcelar' }] },
  { id: 'guardar', chaves: ['guardar dinheiro', 'guardar', 'poupar', 'economizar', 'nunca consigo guardar', 'nao consigo guardar', 'juntar dinheiro', 'reserva', 'emergencia', 'imprevisto', 'colchao'],
    abertura: 'Guardar é mais fácil quando o valor tem um objetivo e uma data.',
    passos: [{ ferramenta: 'reserva', porque: 'quanto guardar e em quantos meses você fica protegido' }, { ferramenta: 'desafio', porque: 'uma grade de quadradinhos: juntar de pouco em pouco até o valor que você quer' }, { ferramenta: 'metas', porque: 'para guardar rumo a algo que você quer (viagem, carro, casa)' }] },
  { id: 'desafio', chaves: ['desafio', 'desafio de juntar', 'pouco em pouco', 'de pouco em pouco', 'cofrinho', 'caixinha', '52 semanas', 'quadradinhos', 'juntar 5 mil', 'juntar 10 mil', 'juntar 40 mil', 'juntar mil'],
    abertura: 'Juntar de pouco em pouco fica mais fácil quando dá para ver cada passo.',
    passos: [{ ferramenta: 'desafio', porque: 'você escolhe a meta e marca um quadradinho a cada depósito' }, { ferramenta: 'reserva', porque: 'se ainda não tem reserva, ela vem primeiro' }] },
  { id: 'investir', chaves: ['investir', 'investimento', 'investimentos', 'rendimento', 'render', 'tesouro', 'cdb', 'acoes', 'bolsa', 'poupanca', 'onde aplicar', 'comecar a investir'],
    abertura: 'Antes de investir, vale conferir se a base está pronta. O app mostra o caminho em passos.',
    passos: [{ ferramenta: 'investir', porque: 'um caminho em passos: atraso, dívida cara, reserva, perfil e só então investir' }, { ferramenta: 'longo-prazo', porque: 'simula quanto o dinheiro vira com os anos' }, { ferramenta: 'renda', porque: 'quando o rendimento paga as suas contas' }] },
  { id: 'comprar', chaves: ['posso comprar', 'vale a pena comprar', 'quero comprar', 'vou comprar', 'comprar um', 'compra grande', 'compra por impulso', 'tenis', 'celular novo', 'financiar', 'cabe no bolso'],
    abertura: 'Antes de comprar, o mais honesto é ver quanto aquilo custa em horas do seu trabalho.',
    passos: [{ ferramenta: 'comprar', porque: 'o preço em dias de trabalho e se cabe no seu mês' }, { ferramenta: 'parcelado', porque: 'se for parcelar, quanto de juro está escondido' }, { ferramenta: 'orcamento', porque: 'confere se ainda sobra no limite da categoria' }] },
  { id: 'gastos-escondidos', chaves: ['assinatura', 'assinaturas', 'gasto escondido', 'gastos escondidos', 'pago sem perceber', 'sem perceber', 'sem usar', 'streaming', 'netflix', 'tarifa', 'debito automatico', 'cobranca que nao conheco'],
    abertura: 'Muita gente paga todo mês por coisas que nem usa. Vale uma revisão.',
    passos: [{ ferramenta: 'assinaturas', porque: 'lista o que você paga todo mês e ajuda a cancelar o que não usa' }, { ferramenta: 'fatura', porque: 'a IA lê a fatura e acha tarifas e cobranças escondidas' }] },
  { id: 'onde-gastei', chaves: ['para onde foi', 'pra onde foi', 'onde gastei', 'onde estou gastando', 'gasto demais', 'gastando demais', 'gastando muito', 'gasto muito', 'sem controle', 'nao sei onde', 'controlar gastos', 'controle de gastos', 'anotar gastos', 'anotar'],
    abertura: 'Para ter controle, o começo é ver para onde cada real está indo.',
    passos: [{ ferramenta: 'lancamentos', porque: 'tudo o que você já gastou este mês, por categoria' }, { ferramenta: 'cortar', porque: 'aponta onde você está gastando demais' }, { ferramenta: 'whatsapp', porque: 'anote pelo WhatsApp: "mercado 35" e já aparece aqui' }] },
  { id: 'organizar', chaves: ['organizar', 'me organizar', 'organizacao', 'planilha', 'por onde comeco', 'por onde começar', 'nao sei por onde', 'nao entendo de financas', 'comecar do zero', 'perdido', 'bagunca'],
    abertura: 'Sem saber por onde começar? O app guia você, um passo de cada vez.',
    passos: [{ ferramenta: 'caminho', porque: 'mostra o seu próximo passo, do atraso até a reserva' }, { ferramenta: 'coach', porque: 'conversa com você e resolve um problema por vez' }, { ferramenta: 'diagnostico', porque: 'umas perguntas rápidas e você recebe sua nota e um plano' }] },
  { id: 'extra', chaves: ['13o', 'decimo terceiro', 'bonus', 'restituicao', 'imposto de renda', 'dinheiro extra', 'ganhei um dinheiro', 'recebi um dinheiro', 'heranca', 'fgts', 'premio', 'freela'],
    abertura: 'Dinheiro extra rende mais quando já chega com destino.',
    passos: [{ ferramenta: 'extras', porque: 'indica para onde ir cada real: atraso, dívida cara, reserva ou investir' }, { ferramenta: 'dividas', porque: 'quanto cada real a mais antecipa a sua data de saída' }] },
  { id: 'salario', chaves: ['salario', 'quando cai o salario', 'antes do salario', 'ate o salario', 'proximo salario', 'dia do pagamento', 'vencimento antes do salario'],
    abertura: 'O que importa é o que vence antes de o salário cair.',
    passos: [{ ferramenta: 'calendario', porque: 'mostra o que vence antes do salário e quanto sobra depois de cada conta' }, { ferramenta: 'contas', porque: 'o que falta pagar neste mês' }] },
  { id: 'renda-baixa', chaves: ['ganho pouco', 'renda baixa', 'salario baixo', 'pouco dinheiro', 'nao ganho', 'desempregado', 'perdi o emprego', 'sem renda'],
    abertura: 'Com renda apertada, cada passo precisa ser pequeno e certo.',
    passos: [{ ferramenta: 'recuperacao', porque: 'um plano de saída quando o mês não fecha' }, { ferramenta: 'orcamento', porque: 'divide o pouco que entra pelo que é mais importante' }, { ferramenta: 'reserva', porque: 'começar com uma semana de proteção já ajuda' }] },
  { id: 'viver-de-renda', chaves: ['viver de renda', 'independencia financeira', 'aposentadoria', 'aposentar', 'liberdade financeira', 'parar de trabalhar'],
    abertura: 'Viver de renda é um degrau de cada vez, e dá para ver o seu.',
    passos: [{ ferramenta: 'renda', porque: 'quando o seu dinheiro passa a pagar a sua vida' }, { ferramenta: 'longo-prazo', porque: 'quanto vira se você guardar todo mês' }] },
  { id: 'lembrete', chaves: ['lembrar de pagar', 'me avise', 'me avisa', 'ser avisado', 'ser avisada', 'avisado', 'avisada', 'aviso', 'avisar', 'lembrete', 'lembretes', 'notificacao', 'esqueco de pagar'],
    abertura: 'Dá para ser avisado antes de cada conta vencer.',
    passos: [{ ferramenta: 'assistentes', porque: 'liga os lembretes e o aviso pelo WhatsApp' }, { ferramenta: 'contas', porque: 'cadastre as contas fixas para o aviso saber o que vence' }] },
  { id: 'whatsapp', chaves: ['whatsapp', 'zap', 'mensagem', 'anotar pelo whatsapp', 'anotar no zap'],
    abertura: 'Pelo WhatsApp você anota gastos só mandando uma mensagem.',
    passos: [{ ferramenta: 'whatsapp', porque: 'liga o número e já pode mandar "mercado 35 no pix"' }] },
];

export interface SugestaoProblema { problema: Problema; passos: { ferramenta: Ferramenta; porque: string }[]; forca: number }

const palavras = (t: string) => sem(t).split(/[^a-z0-9]+/).filter(Boolean);

/** Procura o problema que a pessoa descreveu. Devolve até `max`, o mais provável primeiro; vazio quando não reconhece. */
export function acharProblema(texto: string, max = 2): SugestaoProblema[] {
  const t = ` ${sem(texto).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  if (t.trim().length < 3) return [];
  const toks = new Set(palavras(texto));
  const out: SugestaoProblema[] = [];
  for (const p of PROBLEMAS) {
    let forca = 0;
    for (const c of p.chaves) {
      if (t.includes(` ${c} `)) forca += 2 + c.split(' ').length; // frase inteira: forte, e quanto mais longa, mais certeza
      else if (!c.includes(' ') && toks.has(c)) forca += 2;
    }
    if (forca > 0) {
      const passos = p.passos.flatMap((s) => { const f = FERRAMENTAS.find((x) => x.id === s.ferramenta); return f ? [{ ferramenta: f, porque: s.porque }] : []; });
      if (passos.length) out.push({ problema: p, passos, forca });
    }
  }
  return out.sort((a, b) => b.forca - a.forca).slice(0, max);
}
