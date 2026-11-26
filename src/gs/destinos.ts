// Os lugares do app e as palavras que levam até eles. O Midas usa isto para direcionar a pessoa para a aba que ela procura.
import { sem } from './atrasosBase.js';
import { buscar } from './registroFerramentas.js';

export interface Destino { titulo: string; rota: string; palavras: string }

export const DESTINOS: Destino[] = [
  { titulo: 'Início', rota: '/inicio', palavras: 'inicio home painel resumo funil mes principal' },
  { titulo: 'Contas', rota: '/pagar', palavras: 'contas conta pagar pagamento pagamentos boleto boletos vencimento vence aluguel luz agua internet fatura atrasada atrasadas' },
  { titulo: 'Gastos', rota: '/gastos', palavras: 'gastos gasto gastar despesas despesa categorias lancamentos mercado anotar' },
  { titulo: 'Dívidas', rota: '/plano/dividas', palavras: 'dividas divida devo dever quitar quitacao juros negociar' },
  { titulo: 'Guardar', rota: '/guardar', palavras: 'guardar reserva poupar poupanca metas meta economizar emergencia' },
  { titulo: 'Relatórios', rota: '/relatorios', palavras: 'relatorios relatorio evolucao grafico graficos historico comparar' },
  { titulo: 'Coach', rota: '/coach', palavras: 'coach conselho resolver orientacao plano' },
  { titulo: 'Seu caminho', rota: '/caminho', palavras: 'caminho passos marcos jornada proximo passo' },
  { titulo: 'Todas as ferramentas', rota: '/ferramentas', palavras: 'ferramentas ferramenta todas lista menu' },
  { titulo: 'Perfil', rota: '/perfil', palavras: 'perfil conta dados nome renda configuracoes whatsapp avisos' },
];

const PARADAS = new Set(['quero', 'para', 'pra', 'ir', 'abrir', 'abre', 'onde', 'fica', 'esta', 'minha', 'meu', 'meus', 'minhas', 'ver', 'tela', 'aba', 'pagina', 'leva', 'levar', 'mostrar', 'mostra', 'acessar', 'cade', 'como', 'que', 'uma', 'umas', 'uns', 'dos', 'das', 'por', 'com', 'sem', 'tem', 'tenho', 'preciso', 'de', 'do', 'da', 'no', 'na', 'em', 'me', 'o', 'a', 'os', 'as', 'um', 'e']);

export interface LinkDestino { titulo: string; rota: string }

/** Devolve até `max` lugares que combinam com o que a pessoa escreveu: as áreas principais primeiro, depois as ferramentas. */
export function acharDestinos(texto: string, max = 3): LinkDestino[] {
  const termos = sem(texto).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !PARADAS.has(t));
  if (termos.length === 0) return [];
  const pontos = (d: Destino) => {
    const pal = d.palavras.split(' ');
    const tit = sem(d.titulo);
    return termos.reduce((s, t) => s + (tit.includes(t) ? 3 : 0) + (pal.some((p) => p === t || (t.length > 3 && p.startsWith(t.slice(0, 5)))) ? 1 : 0), 0);
  };
  const pontuadas = DESTINOS.map((d) => ({ d, p: pontos(d) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
  // quando uma área combina pelo nome e as outras só de leve, é ela e pronto
  const so = pontuadas.length > 0 && pontuadas[0].p >= 3 && (pontuadas[1]?.p ?? 0) <= 1;
  const areas = (so ? pontuadas.slice(0, 1) : pontuadas).map((x) => ({ titulo: x.d.titulo, rota: x.d.rota }));
  if (so) return areas;
  const ferr = buscar(termos.join(' ')).map((a) => ({ titulo: a.titulo, rota: a.rota }));
  const vistos = new Set<string>();
  return [...areas, ...ferr].filter((x) => { const k = x.rota.split(/[?#]/)[0]; if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, max);
}

/** A pessoa pediu para ir a algum lugar ("abrir contas", "onde fica o orçamento")? */
export const pedidoDeIr = (textoSemAcento: string) => /\b(ir para|ir pra|vou para|abrir|abre|abra|onde fica|onde esta|onde encontro|onde acho|me leva|leva|levar|quero ver|quero ir|quero acessar|mostrar|mostra|acessar|cade|aba|tela|pagina|menu)\b/.test(textoSemAcento);
