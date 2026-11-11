// O registro único das ferramentas: a grade de cada área, "Todas as ferramentas", a busca e o Coach leem daqui.
// Nenhuma ferramenta fica de fora. Puro: o ícone é só um nome (a tela escolhe o desenho).

import { brl0, mesCurto, mesDe } from './datas.js';
import { sem } from './atrasosBase.js';
import { situacaoAtrasos } from './atrasosLogica.js';
import { totalDividas } from './dividas.js';
import { contasDoMes, detalheDisponivel, faltaPagar, faturaAberta, patrimonioGuardado, reservaMeta, totalVariaveis } from './selectores.js';
import { calcularCaminho } from './caminho.js';
import type { Estado } from './tipos.js';

export type Area = 'pagar' | 'gastos' | 'guardar' | 'caminho' | 'perfil';
export type TomStatus = 'perigo' | 'aviso' | 'ok' | '';
export interface StatusFerramenta {
  texto: string;
  tom: TomStatus;
}
export interface Ferramenta {
  id: string;
  area: Area;
  grupo: string;
  icone: string;
  titulo: string;
  resolve: string; // a pergunta que ela responde
  rota: string;
  palavrasBusca: string;
  alimentaCaminho: boolean;
  status: (e: Estado, hoje: string) => StatusFerramenta;
  /** id usado para guardar a etapa em que a pessoa parou (ferramentas de várias etapas). */
  etapas?: number;
}

const fixo = (texto: string) => (): StatusFerramenta => ({ texto, tom: '' });
const s = (texto: string, tom: TomStatus = ''): StatusFerramenta => ({ texto, tom });
const marcoData = (e: Estado, hoje: string, id: string) => calcularCaminho(e, hoje).find((m) => m.id === id);

export const GRUPOS: Record<Area, string[]> = {
  pagar: ['Contas do mês', 'Sair do vermelho', 'Cartão e empréstimos'],
  gastos: ['Dia a dia', 'Gastar menos', 'Antes de comprar', 'Ver como foi'],
  guardar: ['Proteger', 'Conquistar', 'Fazer render'],
  caminho: ['Seu caminho', 'Aprender'],
  perfil: ['Sua conta', 'Avisos e WhatsApp', 'Sobre'],
};
export const NOME_AREA: Record<Area, string> = { pagar: 'Pagar', gastos: 'Gastos', guardar: 'Guardar', caminho: 'Caminho', perfil: 'Perfil' };

export const FERRAMENTAS: Ferramenta[] = [
  /* ---------- Pagar ---------- */
  { id: 'contas', area: 'pagar', grupo: 'Contas do mês', icone: 'recibo', titulo: 'Contas fixas', resolve: 'O que falta pagar este mês?', rota: '/lancamentos?aba=contas', palavrasBusca: 'contas fixas boleto aluguel luz agua internet dar baixa pagar vencimento o que eu pago primeiro', alimentaCaminho: true,
    status: (e, hoje) => { const mes = mesDe(hoje); const cs = contasDoMes(e, mes, hoje); const atr = cs.filter((c) => c.estado === 'atrasada').length; const falta = faltaPagar(e, mes); return cs.length === 0 ? s('Cadastre suas contas') : atr ? s(`${atr} atrasada${atr > 1 ? 's' : ''} · faltam ${brl0(falta)}`, 'perigo') : falta > 0 ? s(`faltam ${brl0(falta)}`, cs.some((c) => c.estado === 'vence-logo') ? 'aviso' : '') : s('Tudo pago este mês', 'ok'); } },
  { id: 'calendario', area: 'pagar', grupo: 'Contas do mês', icone: 'calendario', titulo: 'Calendário de contas', resolve: 'O dinheiro dá até o próximo salário?', rota: '/plano/calendario', palavrasBusca: 'calendario contas vencimento boleto salario quando vence', alimentaCaminho: false,
    status: (e, hoje) => { const n = contasDoMes(e, mesDe(hoje), hoje).filter((c) => c.estado !== 'paga').length; return e.gastosFixos.length ? s(`${n} a pagar até o fim do mês`) : s('Do salário até o próximo salário'); } },
  { id: 'fatura', area: 'pagar', grupo: 'Contas do mês', icone: 'arquivo', titulo: 'Importar fatura', resolve: 'Para onde foi o dinheiro do cartão?', rota: '/plano/cartao#importar', palavrasBusca: 'importar fatura pdf csv foto print cartao ler fatura leitor', alimentaCaminho: false, status: fixo('Mande o PDF, a foto ou o texto') },
  { id: 'atrasos', area: 'pagar', grupo: 'Sair do vermelho', icone: 'relogio', titulo: 'Sair do atraso', resolve: 'Tô com conta atrasada. O que pago primeiro?', rota: '/plano/atrasos', palavrasBusca: 'atraso atrasada atrasei parcela atrasada nao consegui pagar bola de neve multa em dia negociar', alimentaCaminho: true, etapas: 3,
    status: (e, hoje) => { const a = situacaoAtrasos(e, hoje); return a.atrasos.length ? s(`${a.atrasos.length} atrasada${a.atrasos.length > 1 ? 's' : ''} · ${brl0(a.total)}${a.plano.emDiaEm ? ` · em dia em ${mesCurto(a.plano.emDiaEm)}` : ''}`, 'perigo') : s('Nenhuma conta atrasada', 'ok'); } },
  { id: 'anotar-atraso', area: 'pagar', grupo: 'Sair do vermelho', icone: 'mais', titulo: 'Anotar conta atrasada', resolve: 'Tenho uma conta antiga para pôr no plano', rota: '/plano/atrasos?anotar=1', palavrasBusca: 'anotar conta atrasada antiga devendo esqueci', alimentaCaminho: true, status: fixo('Leva 1 minuto') },
  { id: 'dividas', area: 'pagar', grupo: 'Sair do vermelho', icone: 'alvo', titulo: 'Quitar dívidas', resolve: 'Quando eu saio das dívidas?', rota: '/plano/dividas', palavrasBusca: 'divida dividas devo juros banco negociar quitar quando saio amortizar parcelas adiantar', alimentaCaminho: true, etapas: 3,
    status: (e, hoje) => { const t = totalDividas(e.dividas); const m = marcoData(e, hoje, 'dividas'); return t > 0 ? s(`${brl0(t)} em aberto${m?.dataPrevista ? ` · livre em ${mesCurto(m.dataPrevista)}` : ''}`, m?.dataPrevista ? 'aviso' : 'perigo') : e.dividas.length ? s('Tudo quitado', 'ok') : s('Nenhuma dívida cadastrada'); } },
  { id: 'recuperacao', area: 'pagar', grupo: 'Sair do vermelho', icone: 'boia', titulo: 'Modo recuperação', resolve: 'O mês não fecha. Por onde começo?', rota: '/recuperacao', palavrasBusca: 'recuperacao mes nao fecha endividado aperto raio x plano de saida triagem', alimentaCaminho: true, etapas: 6,
    status: (e) => (e.recuperacao.ativo ? s(e.recuperacao.raioXFeito ? 'Plano de saída ativo' : 'Raio-X pela metade', 'aviso') : s('Um plano de saída, passo a passo')) },
  { id: 'direitos', area: 'pagar', grupo: 'Sair do vermelho', icone: 'escudo', titulo: 'Seus direitos', resolve: 'O que o banco pode e não pode cobrar?', rota: '/ferramentas/seus-direitos', palavrasBusca: 'direitos cobranca abusiva procon banco juros nome sujo negativado serasa', alimentaCaminho: false, status: fixo('Cobrança, juros e nome limpo') },
  { id: 'cartao', area: 'pagar', grupo: 'Cartão e empréstimos', icone: 'cartao', titulo: 'Cartão de crédito', resolve: 'O cartão estourou. Quanto vem na fatura?', rota: '/plano/cartao', palavrasBusca: 'cartao fatura limite credito estourou parcelado faturas futuras outro cartao simular compra', alimentaCaminho: true,
    status: (e) => { const f = faturaAberta(e); const uso = e.cartao && e.cartao.limite > 0 ? Math.round((e.cartao.usado / e.cartao.limite) * 100) : 0; return e.cartao ? s(`fatura de ${brl0(f)} · ${uso}% do limite`, uso > 90 ? 'perigo' : uso > 70 ? 'aviso' : '') : s('Fatura, limite e parcelas'); } },
  { id: 'emprestimos', area: 'pagar', grupo: 'Cartão e empréstimos', icone: 'banco', titulo: 'Empréstimo', resolve: 'Me ofereceram um empréstimo. Vale a pena?', rota: '/plano/emprestimos', palavrasBusca: 'emprestimo financiamento juros oferta taxa parcela quanto custa comparar consignado', alimentaCaminho: true, status: fixo('Quanto de juros você vai pagar') },

  /* ---------- Gastos ---------- */
  { id: 'lancamentos', area: 'gastos', grupo: 'Dia a dia', icone: 'carteira', titulo: 'Lançamentos', resolve: 'O que eu já gastei este mês?', rota: '/lancamentos', palavrasBusca: 'lancamentos historico gastos anotar buscar editar duplicar desfazer extrato', alimentaCaminho: true,
    status: (e, hoje) => { const v = totalVariaveis(e, mesDe(hoje)); return v > 0 ? s(`${brl0(v)} anotados no mês`) : s('Nada anotado este mês', 'aviso'); } },
  { id: 'carteiras', area: 'gastos', grupo: 'Dia a dia', icone: 'troca', titulo: 'Contas e transferências', resolve: 'Onde meu dinheiro está guardado?', rota: '/lancamentos?aba=historico#contas', palavrasBusca: 'contas carteira banco transferencia transferir corrente poupanca', alimentaCaminho: false, status: (e) => s(e.contas.length ? `${e.contas.length} conta${e.contas.length > 1 ? 's' : ''}` : 'Organize por conta, se quiser') },
  { id: 'orcamento', area: 'gastos', grupo: 'Dia a dia', icone: 'pizza', titulo: 'Orçamento', resolve: 'Quanto posso gastar em cada coisa?', rota: '/plano/orcamento', palavrasBusca: 'orcamento limite categoria gastos 50 30 20 envelopes pague-se primeiro 52 semanas', alimentaCaminho: true,
    status: (e, hoje) => { const d = detalheDisponivel(e, mesDe(hoje), hoje); const n = Object.keys(e.limites).length; return d.modo !== 'incompleto' && d.livre < 0 ? s(`passou ${brl0(-d.livre)} do mês`, 'perigo') : n ? s(`${n} limite${n > 1 ? 's' : ''} definido${n > 1 ? 's' : ''}`) : s('Um limite por categoria'); } },
  { id: 'cortar', area: 'gastos', grupo: 'Gastar menos', icone: 'tesoura', titulo: 'Onde cortar', resolve: 'Onde estou gastando demais?', rota: '/plano/cortar', palavrasBusca: 'cortar economizar reduzir gastos superfluos gastando demais onde estou errando', alimentaCaminho: true, status: fixo('O que dá para reduzir primeiro') },
  { id: 'assinaturas', area: 'gastos', grupo: 'Gastar menos', icone: 'lupa', titulo: 'Gastos escondidos', resolve: 'O que eu pago todo mês sem perceber?', rota: '/plano/assinaturas', palavrasBusca: 'assinaturas streaming gastos escondidos vazamentos mensalidade cancelar', alimentaCaminho: true,
    status: (e) => { const t = e.assinaturas.filter((a) => a.ativa).reduce((x, a) => x + a.valor, 0); return t > 0 ? s(`${brl0(t)} por mês`) : s('Ache o que você paga sem ver'); } },
  { id: 'comprar', area: 'gastos', grupo: 'Antes de comprar', icone: 'cronometro', titulo: 'Posso comprar isso?', resolve: 'Posso comprar isso?', rota: '/plano/comprar', palavrasBusca: 'comprar compra desejo 72 horas vale a pena posso impulso', alimentaCaminho: true,
    status: (e) => { const n = e.desejos.filter((d) => d.status === 'esperando').length; return n ? s(`${n} em espera de 72h`, 'aviso') : s('Horas de trabalho e veredito'); } },
  { id: 'parcelado', area: 'gastos', grupo: 'Antes de comprar', icone: 'duelo', titulo: 'À vista ou parcelado?', resolve: 'Vale a pena parcelar?', rota: '/plano/parcelado', palavrasBusca: 'parcelado a vista parcela desconto juros sem juros parcelar', alimentaCaminho: true, status: fixo('Quem sai mais barato') },
  { id: 'relatorios', area: 'gastos', grupo: 'Ver como foi', icone: 'grafico', titulo: 'Relatórios', resolve: 'Estou melhorando ou piorando?', rota: '/relatorios', palavrasBusca: 'relatorios evolucao grafico receitas despesas categorias comparar meses patrimonio', alimentaCaminho: false, status: fixo('3, 6 ou 12 meses') },
  { id: 'checkin', area: 'gastos', grupo: 'Ver como foi', icone: 'check', titulo: 'Check-in do mês', resolve: 'Como fechei o mês?', rota: '/ferramentas/check-in-mensal', palavrasBusca: 'check-in mensal fechamento revisao do mes', alimentaCaminho: false, status: fixo('Uma revisão rápida por mês') },

  /* ---------- Guardar ---------- */
  { id: 'reserva', area: 'guardar', grupo: 'Proteger', icone: 'cofre', titulo: 'Reserva de emergência', resolve: 'Quanto já guardei?', rota: '/plano/reserva', palavrasBusca: 'reserva emergencia guardar poupar quanto ja guardei sacar', alimentaCaminho: true,
    status: (e, hoje) => { const meta = reservaMeta(e, mesDe(hoje)); const g = Math.max(0, patrimonioGuardado(e)); return meta > 0 ? s(`${brl0(g)} de ${brl0(meta)}`, g >= meta ? 'ok' : '') : s(g > 0 ? `${brl0(g)} guardados` : 'Guarde antes de gastar'); } },
  { id: 'metas', area: 'guardar', grupo: 'Conquistar', icone: 'bandeira', titulo: 'Metas', resolve: 'Quero juntar para uma meta', rota: '/guardar#metas', palavrasBusca: 'meta metas juntar objetivo viagem carro casa sonho calculadora', alimentaCaminho: true, etapas: 2,
    status: (e, hoje) => { const m = marcoData(e, hoje, 'objetivo'); const abertas = e.metas.filter((x) => x.guardados.reduce((t, g) => t + g.valor, 0) < x.alvo).length; return abertas ? s(`${abertas} em andamento${m?.dataPrevista ? ` · ${mesCurto(m.dataPrevista)}` : ''}`) : s(e.metas.length ? 'Todas batidas' : 'Dê um nome e um valor ao seu objetivo', e.metas.length ? 'ok' : ''); } },
  { id: 'extras', area: 'guardar', grupo: 'Conquistar', icone: 'presente', titulo: 'Dinheiro extra', resolve: 'Recebi um dinheiro extra. O que faço?', rota: '/plano/extras', palavrasBusca: 'extra 13 bonus freela decimo terceiro restituicao renda extra recebi', alimentaCaminho: true, status: fixo('13º, bônus: o melhor rumo') },
  { id: 'investir', area: 'guardar', grupo: 'Fazer render', icone: 'broto', titulo: 'Investir', resolve: 'Quero começar a investir', rota: '/investir', palavrasBusca: 'investir investimento cdi selic bolsa cripto renda fixa tesouro mercado', alimentaCaminho: true, etapas: 5,
    status: (e, hoje) => { const m = marcoData(e, hoje, 'investir'); return m?.status === 'feito' ? s('Seu dinheiro já trabalha', 'ok') : m?.status === 'atual' ? s('É o seu próximo passo', 'aviso') : s('Um caminho em passos'); } },
  { id: 'renda', area: 'guardar', grupo: 'Fazer render', icone: 'sol', titulo: 'Viver de renda', resolve: 'Quando o rendimento paga minhas contas?', rota: '/plano/renda', palavrasBusca: 'renda liberdade aposentadoria patrimonio viver de renda independencia', alimentaCaminho: true,
    status: (e, hoje) => { const m = marcoData(e, hoje, 'renda'); return m?.dataPrevista ? s(`no ritmo de hoje: ${m.dataPrevista.slice(0, 4)}`) : s('Degrau por degrau'); } },
  { id: 'longo-prazo', area: 'guardar', grupo: 'Fazer render', icone: 'linha', titulo: 'Simulador de longo prazo', resolve: 'Quanto vira se eu guardar todo mês?', rota: '/ferramentas/simulador-longo-prazo', palavrasBusca: 'simulador longo prazo juros compostos quanto vira', alimentaCaminho: false, status: fixo('Juros sobre juros, em reais') },
  { id: 'placar', area: 'guardar', grupo: 'Fazer render', icone: 'balanca', titulo: 'Placar: o que rende × o que custa', resolve: 'O que eu tenho põe ou tira dinheiro do bolso?', rota: '/ferramentas/placar-pai-rico', palavrasBusca: 'placar ativos passivos pai rico patrimonio', alimentaCaminho: false, status: fixo('Ativos e passivos, sem jargão') },

  /* ---------- Caminho ---------- */
  { id: 'coach', area: 'caminho', grupo: 'Seu caminho', icone: 'brilho', titulo: 'Coach', resolve: 'Preciso de ajuda para decidir', rota: '/coach', palavrasBusca: 'coach ajuda conversar duvida conselho pergunta', alimentaCaminho: true, status: fixo('Resolve com você, passo a passo') },
  { id: 'meu-plano', area: 'caminho', grupo: 'Seu caminho', icone: 'mapa', titulo: 'Plano do diagnóstico', resolve: 'Qual era o plano do meu diagnóstico?', rota: '/ferramentas/meu-plano', palavrasBusca: 'meu plano mes a mes diagnostico', alimentaCaminho: false, status: fixo('O plano mês a mês') },
  { id: 'diagnostico', area: 'caminho', grupo: 'Seu caminho', icone: 'bussola', titulo: 'Diagnóstico', resolve: 'Como está minha vida financeira?', rota: '/diagnostico', palavrasBusca: 'diagnostico perfil arquetipo como estou', alimentaCaminho: false, status: fixo('7 perguntas, 3 minutos') },
  { id: 'selos', area: 'caminho', grupo: 'Seu caminho', icone: 'medalha', titulo: 'Meus selos', resolve: 'O que eu já conquistei?', rota: '/ferramentas/meus-selos', palavrasBusca: 'selos conquistas medalhas', alimentaCaminho: false,
    status: (e, hoje) => { const n = calcularCaminho(e, hoje).filter((m) => m.status === 'feito').length; return s(n ? `${n} marco${n > 1 ? 's' : ''} conquistado${n > 1 ? 's' : ''}` : 'Cada marco vira um selo', n ? 'ok' : ''); } },
  { id: 'guias', area: 'caminho', grupo: 'Aprender', icone: 'livro', titulo: 'Guias', resolve: 'Quero entender melhor', rota: '/guias', palavrasBusca: 'guias aprender entender artigos', alimentaCaminho: false, status: fixo('Explicações curtas, sem jargão') },
  { id: 'frase', area: 'caminho', grupo: 'Aprender', icone: 'aspas', titulo: 'Frase do dia', resolve: 'Uma ideia para hoje', rota: '/ferramentas/frase-do-dia', palavrasBusca: 'frase do dia citacao inspiracao', alimentaCaminho: false, status: fixo('Uma ideia do livro, nas nossas palavras') },

  /* ---------- Perfil ---------- */
  { id: 'dados', area: 'perfil', grupo: 'Sua conta', icone: 'pessoa', titulo: 'Meus dados', resolve: 'Mudar renda, salário ou nome', rota: '/dados', palavrasBusca: 'meus dados renda salario nome saldo conta apagar limpar', alimentaCaminho: false, status: (e) => s(e.config.renda > 0 ? `renda de ${brl0(e.config.renda)}` : 'Informe sua renda', e.config.renda > 0 ? '' : 'aviso') },
  { id: 'planos', area: 'perfil', grupo: 'Sua conta', icone: 'coroa', titulo: 'Planos', resolve: 'O que tem no plano pago?', rota: '/planos', palavrasBusca: 'planos assinatura preco pagar premium', alimentaCaminho: false, status: fixo('Grátis, mensal e anual') },
  { id: 'assistentes', area: 'perfil', grupo: 'Avisos e WhatsApp', icone: 'sino', titulo: 'Lembretes e assistentes', resolve: 'Quero ser avisado antes de vencer', rota: '/assistentes', palavrasBusca: 'lembretes assistentes avisos notificacao lembrar', alimentaCaminho: false, status: fixo('Avisos do jeito que você quiser') },
  { id: 'whatsapp', area: 'perfil', grupo: 'Avisos e WhatsApp', icone: 'conversa', titulo: 'WhatsApp', resolve: 'Anotar gasto por mensagem ou foto', rota: '/perfil#whatsapp', palavrasBusca: 'whatsapp zap mensagem foto cupom audio anotar pelo celular', alimentaCaminho: true, status: fixo('"gastei 35 no mercado" ou a foto do cupom') },
  { id: 'instalar', area: 'perfil', grupo: 'Sobre', icone: 'celular', titulo: 'Instalar o app', resolve: 'Quero o ícone na tela do celular', rota: '/perfil#instalar', palavrasBusca: 'instalar app aplicativo atalho tela inicial', alimentaCaminho: false, status: fixo('Abre como um aplicativo') },
  { id: 'sobre', area: 'perfil', grupo: 'Sobre', icone: 'info', titulo: 'Sobre e avisos', resolve: 'Quem faz o Grana Séria?', rota: '/sobre', palavrasBusca: 'sobre avisos termos privacidade quem somos', alimentaCaminho: false, status: fixo('Conteúdo educacional') },
];

export const ferramenta = (id: string) => FERRAMENTAS.find((f) => f.id === id);
export const ferramentasDaArea = (area: Area) => FERRAMENTAS.filter((f) => f.area === area);

const PESO: Record<TomStatus, number> = { perigo: 0, aviso: 1, '': 2, ok: 3 };
/** A grade de uma área: por grupo, com o que está em vermelho no topo de cada grupo. */
export function gradeDaArea(area: Area, e: Estado, hoje: string): { grupo: string; itens: (Ferramenta & { st: StatusFerramenta })[] }[] {
  const itens = ferramentasDaArea(area).map((f) => ({ ...f, st: f.status(e, hoje) }));
  return GRUPOS[area].map((grupo) => ({ grupo, itens: itens.filter((f) => f.grupo === grupo).sort((a, b) => PESO[a.st.tom] - PESO[b.st.tom]) })).filter((g) => g.itens.length > 0);
}
/** O que está em vermelho na área (sobe para o topo da grade, com o ponto vermelho). */
export const urgentesDaArea = (area: Area, e: Estado, hoje: string) => ferramentasDaArea(area).map((f) => ({ ...f, st: f.status(e, hoje) })).filter((f) => f.st.tom === 'perigo');

/* ---------- "O que você quer resolver?" ---------- */
export interface Pergunta {
  texto: string;
  ferramentaId: string;
  rota?: string; // quando não é a rota padrão da ferramenta
}
export const PERGUNTAS: Pergunta[] = [
  { texto: 'O que eu pago primeiro?', ferramentaId: 'contas', rota: '/pagar' },
  { texto: 'Quanto posso gastar hoje?', ferramentaId: 'orcamento', rota: '/?calculo=1' },
  { texto: 'Quando eu saio das dívidas?', ferramentaId: 'dividas' },
  { texto: 'Tô com conta atrasada', ferramentaId: 'atrasos' },
  { texto: 'O cartão estourou', ferramentaId: 'cartao' },
  { texto: 'Posso comprar isso?', ferramentaId: 'comprar' },
  { texto: 'Vale a pena parcelar?', ferramentaId: 'parcelado' },
  { texto: 'Me ofereceram um empréstimo', ferramentaId: 'emprestimos' },
  { texto: 'Onde estou gastando demais?', ferramentaId: 'cortar' },
  { texto: 'Recebi um dinheiro extra', ferramentaId: 'extras' },
  { texto: 'Quero juntar para uma meta', ferramentaId: 'metas' },
  { texto: 'Quanto já guardei?', ferramentaId: 'reserva' },
  { texto: 'Quero começar a investir', ferramentaId: 'investir' },
  { texto: 'O mês não fecha', ferramentaId: 'recuperacao' },
];

export interface Achado {
  titulo: string;
  sub: string;
  rota: string;
  ferramentaId: string;
}
/** Busca por texto: ignora acentos e maiúsculas; olha a pergunta, o título e as palavras de busca. Todas as palavras precisam bater. */
export function buscar(texto: string): Achado[] {
  const termos = sem(texto).split(/\s+/).filter((t) => t.length > 1);
  if (termos.length === 0) return [];
  const bate = (alvo: string) => termos.every((t) => sem(alvo).includes(t));
  const out: Achado[] = [];
  const visto = new Set<string>();
  for (const p of PERGUNTAS) {
    const f = ferramenta(p.ferramentaId)!;
    if (bate(p.texto) && !visto.has(p.rota ?? f.rota)) {
      visto.add(p.rota ?? f.rota);
      out.push({ titulo: p.texto, sub: f.titulo, rota: p.rota ?? f.rota, ferramentaId: f.id });
    }
  }
  const pontos = (f: Ferramenta) => (bate(f.titulo) ? 0 : bate(f.resolve) ? 1 : 2);
  for (const f of [...FERRAMENTAS].filter((x) => bate(`${x.titulo} ${x.resolve} ${x.palavrasBusca}`)).sort((a, b) => pontos(a) - pontos(b))) {
    if (visto.has(f.rota)) continue;
    visto.add(f.rota);
    out.push({ titulo: f.titulo, sub: f.resolve, rota: f.rota, ferramentaId: f.id });
  }
  return out.slice(0, 8);
}
